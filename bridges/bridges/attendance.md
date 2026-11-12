# Bridge Docs — Chấm công (`/v1/attendance`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| POST | `/v1/attendance/check-in` | `EMPLOYEE` | Multipart — ảnh selfie + GPS |
| POST | `/v1/attendance/check-out` | `EMPLOYEE` | Multipart — ảnh selfie |
| GET | `/v1/attendance/me` | `EMPLOYEE` | Lịch sử chấm công cá nhân (có phân trang) |
| GET | `/v1/attendance` | `ADMIN`, `HR` | Toàn bộ chấm công công ty (có phân trang) |
| PATCH | `/v1/attendance/:id` | `ADMIN`, `HR` | Chỉnh sửa thủ công bản ghi |

> **Lưu ý thứ tự route:** `/attendance/me` được khai báo **trước** `/attendance/:id` trong controller.

---

## TypeScript Types

```typescript
// types/attendance.types.ts
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';

export interface AttendanceLocationDto {
  id: number;
  name: string;
}

export interface AttendanceShiftDto {
  id: number;
  name: string;
  checkInTime: string;    // "HH:mm" — giờ bắt đầu ca gốc (UTC)
  checkOutTime: string;   // "HH:mm" — giờ kết thúc ca gốc (UTC)
}

export interface AttendanceEmployeeDto {
  id: number;
  fullName: string;
  employeeCode: string;
}

export interface AttendanceRecordDetail {
  id: number;
  date: string;                      // "YYYY-MM-DD"
  checkInAt: string | null;          // ISO 8601 full datetime
  checkOutAt: string | null;         // ISO 8601 full datetime
  checkInPhotoUrl: string | null;    // S3 URL ảnh selfie check-in
  checkOutPhotoUrl: string | null;   // S3 URL ảnh selfie check-out
  isLocked: boolean;                 // true = bị lock, không tự sửa được
  lockReason: string | null;         // "AUTO_MIDNIGHT" | "HR_LOCKED"
  missingType: string | null;        // "MISSING_CHECKOUT" | "MISSING_CHECKIN"
  lateMinutes: number;
  earlyMinutes: number;
  status: AttendanceStatus;
  isManual: boolean;                 // true nếu HR chỉnh sửa thủ công
  note: string | null;
  distance: number | null;           // khoảng cách GPS khi check-in (mét), null nếu isManual
  effectiveStart: string | null;     // ISO 8601 epoch-based — xem ghi chú ⚠️ bên dưới
  effectiveEnd: string | null;       // ISO 8601 epoch-based — xem ghi chú ⚠️ bên dưới
  isHalfDay: boolean;                // true nếu ngày này có EffectiveShiftOverride
  location: AttendanceLocationDto | null;
  shift: AttendanceShiftDto | null;
  employee: AttendanceEmployeeDto | null;
}

// POST /check-in — multipart/form-data (không phải JSON)
// Dùng FormData: append('photo', file), append('latitude', '21.0285'), append('longitude', '105.8542')

// PATCH /:id request body
export interface ManualEditAttendanceDto {
  checkInAt?: string;   // ISO 8601
  checkOutAt?: string;  // ISO 8601
  note?: string;
}

// Query params cho GET /me và GET /
export interface QueryAttendanceParams {
  page?: number;         // default 1
  limit?: number;        // default 20, max 100
  date?: string;         // "YYYY-MM-DD" — lọc đúng ngày
  startDate?: string;    // "YYYY-MM-DD"
  endDate?: string;      // "YYYY-MM-DD"
  employeeId?: number;
  departmentId?: number;
  status?: AttendanceStatus;
}
```

> **Check-in và check-out đều là `multipart/form-data`.** Không set `Content-Type` khi dùng `FormData` — để browser tự set boundary.

### ⚠️ Quan trọng: `effectiveStart` và `effectiveEnd`

`effectiveStart`/`effectiveEnd` là giờ **thực tế** khi nhân viên có nửa ngày phép. Chúng được lưu dạng `TIME WITHOUT TIME ZONE` trong PostgreSQL (`@db.Time`) và trả về dưới dạng **ISO 8601 epoch-based** — tức là phần date luôn là `1970-01-01`, chỉ phần giờ là có nghĩa.

```typescript
// ✅ Đúng — dùng getUTCHours() / getUTCMinutes()
const start = new Date(record.effectiveStart!);
const hour = start.getUTCHours();    // ví dụ: 12 (12:00 trưa UTC)
const min  = start.getUTCMinutes();  // ví dụ: 0
const display = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`; // "12:00"

// ❌ Sai — getHours() phụ thuộc timezone của browser
const hour = new Date(record.effectiveStart!).getHours(); // kết quả sai nếu browser không ở UTC
```

| Field | Ví dụ giá trị | Ý nghĩa |
|-------|---------------|---------|
| `effectiveStart` | `"1970-01-01T12:00:00.000Z"` | Bắt đầu làm lúc 12:00 UTC (nghỉ sáng → làm từ trưa) |
| `effectiveEnd` | `"1970-01-01T17:00:00.000Z"` | Kết thúc lúc 17:00 UTC |
| `shift.checkInTime` | `"08:00"` | Giờ vào ca gốc — không thay đổi dù có nửa ngày phép |

Khi `isHalfDay: true`, dùng `effectiveStart`/`effectiveEnd` để hiển thị "Ca rút gọn" thay vì `shift.checkInTime`/`shift.checkOutTime`.

---

## Flow check-in từ góc nhìn frontend

```
Mobile lấy GPS + chụp ảnh selfie
    │
    ├─ Khuyến nghị: kiểm tra accuracy < 100m trước khi gửi
    │   (server không validate accuracy — chỉ validate vị trí và bán kính)
    │
    ▼
POST /v1/attendance/check-in  (multipart/form-data)
  photo     = <File JPG/PNG ≤ 5MB>
  latitude  = 21.0285
  longitude = 105.8542
    │
    ├─ 400 "Ảnh check-in là bắt buộc"
    ├─ 400 "Chỉ chấp nhận ảnh JPG hoặc PNG"
    ├─ 400 "Ảnh không được vượt quá 5MB"
    ├─ 400 "Vị trí hiện tại không nằm trong bán kính địa điểm chấm công được phép"
    ├─ 400 "Không có ca làm việc hôm nay"
    ├─ 400 "Ngoài khung giờ cho phép của ca làm việc"
    ├─ 400 "Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."
    ├─ 409 "ATTENDANCE_ALREADY_CHECKED_IN"
    │
    └─ 201 Created → AttendanceRecordDetail
           ├─ isHalfDay: false → hiển thị ca bình thường
           └─ isHalfDay: true  → hiển thị "Ca rút gọn" (getUTCHours())
```

---

## POST /v1/attendance/check-in — Check-in

**Content-Type:** `multipart/form-data`

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `photo` | File | ✓ | Ảnh selfie, JPG hoặc PNG, tối đa 5MB |
| `latitude` | number | ✓ | Vĩ độ GPS |
| `longitude` | number | ✓ | Kinh độ GPS |

**Response 201 — check-in thành công:**
```json
{
  "success": true,
  "data": {
    "id": 101,
    "date": "2026-05-18",
    "checkInAt": "2026-05-18T08:05:00.000Z",
    "checkOutAt": null,
    "checkInPhotoUrl": "https://bucket.s3.ap-southeast-1.amazonaws.com/attendance/check-in/2026/05/18/uuid.jpg",
    "checkOutPhotoUrl": null,
    "isLocked": false,
    "lockReason": null,
    "missingType": null,
    "lateMinutes": 5,
    "earlyMinutes": 0,
    "status": "LATE",
    "isManual": false,
    "note": null,
    "distance": 42,
    "effectiveStart": null,
    "effectiveEnd": null,
    "isHalfDay": false,
    "location": { "id": 1, "name": "Văn phòng Hà Nội" },
    "shift": { "id": 1, "name": "Ca sáng", "checkInTime": "08:00", "checkOutTime": "17:00" },
    "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" }
  }
}
```

**Response 201 — `isHalfDay: true` (nghỉ sáng):** Giống trên nhưng `effectiveStart: "1970-01-01T12:00:00.000Z"`, `effectiveEnd: "1970-01-01T17:00:00.000Z"`, `isHalfDay: true`.

> `shift.checkInTime` vẫn là `"08:00"` — giờ ca gốc, không đổi dù có nửa ngày phép.

**Response 400 — bản ghi bị lock:**
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công." } }
```

**Response 409 — đã check-in rồi:**
```json
{ "success": false, "error": { "code": "CONFLICT", "message": "ATTENDANCE_ALREADY_CHECKED_IN" } }
```

---

## POST /v1/attendance/check-out — Check-out

**Content-Type:** `multipart/form-data`

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `photo` | File | ✓ | Ảnh selfie, JPG hoặc PNG, tối đa 5MB |

Server lấy `checkOutAt = thời điểm nhận request`.

**Response 200:** `ApiSuccess<AttendanceRecordDetail>` (shape giống check-in, `checkOutAt` và `checkOutPhotoUrl` được điền)

**400** nếu chưa check-in:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chưa check-in" } }
```

**400** nếu đã check-out rồi:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Đã check-out rồi" } }
```

**400** nếu bản ghi bị lock:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công." } }
```

---

## GET /v1/attendance/me — Lịch sử cá nhân

**Query params:** `?page=1&limit=20&startDate=2026-05-01&endDate=2026-05-31&status=LATE`

**Response:** `ApiPaginated<AttendanceRecordDetail>`

---

## GET /v1/attendance — Toàn bộ (HR/Admin)

Chỉ `ADMIN` và `HR` được gọi.

**Query params:** `?page=1&limit=20&employeeId=4&departmentId=1&startDate=2026-05-01&endDate=2026-05-31&status=LATE`

**Response:** `ApiPaginated<AttendanceRecordDetail>` — shape giống `/me`

---

## PATCH /v1/attendance/:id — Chỉnh sửa thủ công

Dành cho HR/Admin. Bản ghi sau khi sửa có `isManual: true`, `isLocked: false` (tự động unlock), `distance: null`.

**Request body:**
```json
{
  "checkInAt": "2026-05-18T08:05:00.000Z",
  "checkOutAt": "2026-05-18T17:30:00.000Z",
  "note": "Nhân viên quên check-in, đã xác nhận qua email"
}
```

Tất cả fields đều optional — có thể chỉ cập nhật `checkOutAt` nếu muốn.

**Response 200:** `ApiSuccess<AttendanceRecordDetail>`

**404** nếu bản ghi không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Bản ghi chấm công không tồn tại" } }
```

---

## Composable — useAttendance

```typescript
// composables/useAttendance.ts
import type {
  AttendanceRecordDetail,
  ManualEditAttendanceDto,
  QueryAttendanceParams,
} from '~/types/attendance.types';
import type { ApiPaginated } from '~/types/api.types';

export function useAttendance() {
  const { get, patch } = useFetch();

  // check-in: multipart/form-data — không set Content-Type thủ công
  const checkIn = (params: { latitude: number; longitude: number }, photo: File) => {
    const form = new FormData();
    form.append('photo', photo);
    form.append('latitude', String(params.latitude));
    form.append('longitude', String(params.longitude));
    return fetch('/v1/attendance/check-in', { method: 'POST', body: form });
  };

  // check-out: multipart/form-data
  const checkOut = (photo: File) => {
    const form = new FormData();
    form.append('photo', photo);
    return fetch('/v1/attendance/check-out', { method: 'POST', body: form });
  };

  const fetchMyHistory = (params?: QueryAttendanceParams) =>
    get<ApiPaginated<AttendanceRecordDetail>>('/v1/attendance/me', { params });

  const fetchAll = (params?: QueryAttendanceParams) =>
    get<ApiPaginated<AttendanceRecordDetail>>('/v1/attendance', { params });

  const manualEdit = (id: number, dto: ManualEditAttendanceDto) =>
    patch<AttendanceRecordDetail>(`/v1/attendance/${id}`, dto);

  return { checkIn, checkOut, fetchMyHistory, fetchAll, manualEdit };
}
```

---

## Bản ghi bị lock (`isLocked: true`)

Khi `isLocked: true`, nhân viên **không thể** tự check-in hoặc check-out vào bản ghi đó:

- **Check-in khi bản ghi bị lock:** → 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."`
- **Check-out khi bản ghi bị lock:** → 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."`

**Nguồn gốc lock:**

| `lockReason` | Nguyên nhân |
|-------------|-------------|
| `AUTO_MIDNIGHT` | Cron 00:05 HCM — record ngày hôm qua chưa hoàn chỉnh |
| `HR_LOCKED` | HR/Admin lock thủ công (dự kiến tương lai) |

**`missingType`:**

| Giá trị | Ý nghĩa |
|---------|---------|
| `MISSING_CHECKOUT` | Đã check-in nhưng quên check-out |
| `null` | Không check-in cả ngày (vắng) |

**Hiển thị trên UI:** Khi `isLocked: true`, thay thế nút check-in/check-out bằng nút "Tạo đơn bù công" → điều hướng sang flow `/v1/makeup-attendance`.

Xem chi tiết tại [makeup-attendance.md](./makeup-attendance.md).

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| Check-in lần 2 trong ngày | 409 `ATTENDANCE_ALREADY_CHECKED_IN` |
| Check-in khi bản ghi đã lock | 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."` |
| Check-out khi chưa check-in | 400 Bad Request |
| Check-out khi bản ghi đã lock | 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."` |
| Check-out lần 2 trong ngày | 400 Bad Request |
| GPS accuracy > 100m | Server không validate — frontend nên tự kiểm tra `coords.accuracy < 100` trước khi gọi |
| `isHalfDay: true` | `effectiveStart`/`effectiveEnd` khác giờ ca gốc — hiển thị "Ca rút gọn", không dùng `shift.checkInTime/checkOutTime` |
| Parse `effectiveStart`/`effectiveEnd` | Dùng `new Date(val).getUTCHours()` — **không** dùng `getHours()` |
| `distance: null` | Bản ghi được edit thủ công (`isManual: true`) — không có khoảng cách GPS |
| `EMPLOYEE` gọi `GET /attendance` | 403 Forbidden |
| `EMPLOYEE` gọi `PATCH /attendance/:id` | 403 Forbidden |
| Lọc `?date=X` kết hợp `startDate`/`endDate` | Nên dùng một trong hai, không nên kết hợp |
| Không truyền `page`/`limit` | Mặc định `page=1`, `limit=20` |
| `status: "ABSENT"` | Bản ghi vắng — `checkInAt` và `checkOutAt` đều `null` |
