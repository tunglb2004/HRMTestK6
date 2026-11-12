# Bridge Docs — Đơn bù công (`/v1/makeup-attendance`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture — đặc biệt phần "Flow bù công".

---

## Tại sao có đơn bù công?

Mỗi đêm lúc **00:05 Asia/Ho_Chi_Minh**, hệ thống tự động lock tất cả bản ghi chấm công ngày hôm qua chưa hoàn chỉnh:

- Nhân viên check-in nhưng **quên check-out** → `isLocked: true`, `missingType: 'MISSING_CHECKOUT'`
- Nhân viên **không check-in** cả ngày (không phải ngày nghỉ phép) → `isLocked: true`

Khi bản ghi đã lock, nhân viên phải tạo đơn bù công để HR/Manager xem xét và điều chỉnh.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| POST | `/v1/makeup-attendance` | `EMPLOYEE` | Tạo đơn — gửi kèm ảnh evidence (tùy chọn) |
| GET | `/v1/makeup-attendance/me` | `EMPLOYEE` | Đơn bù công của bản thân |
| GET | `/v1/makeup-attendance` | `ADMIN`, `HR` | Tất cả đơn trong hệ thống |
| PATCH | `/v1/makeup-attendance/:id/approve` | `ADMIN`, `HR`, `MANAGER` | Duyệt đơn |
| PATCH | `/v1/makeup-attendance/:id/reject` | `ADMIN`, `HR`, `MANAGER` | Từ chối đơn |

> **Lưu ý thứ tự route:** `/makeup-attendance/me` khai báo **trước** `/makeup-attendance/:id/*` trong controller.

---

## TypeScript Types

```typescript
// types/makeup-attendance.types.ts

export type MakeupRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Response từ mọi endpoint
export interface MakeupRequestDetail {
  id: number;
  attendanceDate: string;           // "YYYY-MM-DD" — ngày cần bù
  requestedCheckIn: string | null;  // ISO 8601 — giờ vào yêu cầu
  requestedCheckOut: string | null; // ISO 8601 — giờ ra yêu cầu
  reason: string;
  evidencePhotoUrl: string | null;  // S3 URL ảnh chứng minh
  status: MakeupRequestStatus;
  reviewNote: string | null;
  reviewedBy: { id: number; fullName: string } | null;
  employee: { id: number; fullName: string; employeeCode: string };
  createdAt: string;                // ISO 8601
}

// POST /makeup-attendance — multipart/form-data
// Dùng FormData, không phải JSON
export interface CreateMakeupRequestFormData {
  attendanceDate: string;          // "YYYY-MM-DD"
  requestedCheckIn?: string;       // ISO 8601 — tùy chọn
  requestedCheckOut?: string;      // ISO 8601 — tùy chọn
  reason: string;                  // tối thiểu 10 ký tự
  evidencePhoto?: File;            // JPG hoặc PNG, tối đa 5MB — tùy chọn
}

// PATCH /approve và /reject
export interface ReviewMakeupRequestDto {
  reviewNote?: string;  // bắt buộc khi reject, tùy chọn khi approve
}

// Query params cho GET /me và GET /
export interface QueryMakeupRequestParams {
  page?: number;                  // default 1
  limit?: number;                 // default 20, max 100
  status?: MakeupRequestStatus;   // lọc theo trạng thái
  departmentId?: number;          // chỉ dùng được với HR/Admin
}
```

---

## POST /v1/makeup-attendance — Tạo đơn bù công

**Content-Type: `multipart/form-data`** (không phải JSON — có file upload)

Phải gửi ít nhất một trong `requestedCheckIn` hoặc `requestedCheckOut`.

**Ví dụ dùng FormData:**
```typescript
const formData = new FormData();
formData.append('attendanceDate', '2026-05-18');
formData.append('requestedCheckIn', '2026-05-18T01:00:00.000Z');
formData.append('requestedCheckOut', '2026-05-18T10:00:00.000Z');
formData.append('reason', 'Tôi quên check-out do có cuộc họp đột xuất lúc 17:30');
// evidencePhoto là tùy chọn
formData.append('evidencePhoto', file); // File object (JPG/PNG, ≤ 5MB)

await fetch('/v1/makeup-attendance', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
  // KHÔNG set Content-Type — để browser tự set multipart boundary
});
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "attendanceDate": "2026-05-18",
    "requestedCheckIn": "2026-05-18T01:00:00.000Z",
    "requestedCheckOut": "2026-05-18T10:00:00.000Z",
    "reason": "Tôi quên check-out do có cuộc họp đột xuất lúc 17:30",
    "evidencePhotoUrl": "https://bucket.s3.ap-southeast-1.amazonaws.com/attendance/makeup-evidence/2026/05/19/uuid.jpg",
    "status": "PENDING",
    "reviewNote": null,
    "reviewedBy": null,
    "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" },
    "createdAt": "2026-05-19T02:00:00.000Z"
  }
}
```

**Response 400 — ngày không hợp lệ:**
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chỉ được tạo đơn bù công cho ngày đã qua" } }
```

**Response 400 — thiếu giờ vào/ra:**
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Phải có ít nhất giờ vào hoặc giờ ra" } }
```

**Response 400 — bản ghi chưa bị lock:**
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Bản ghi chưa bị khóa, không cần tạo đơn bù công" } }
```

**Response 404 — không tìm thấy bản ghi:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Không tìm thấy bản ghi chấm công ngày này" } }
```

**Response 409 — đã có đơn PENDING:**
```json
{ "success": false, "error": { "code": "CONFLICT", "message": "Đã có đơn bù công đang chờ duyệt cho ngày này" } }
```

---

## GET /v1/makeup-attendance/me — Đơn bù công cá nhân

**Query params:** `?page=1&limit=20&status=PENDING`

**Response:** `ApiPaginated<MakeupRequestDetail>`

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "attendanceDate": "2026-05-18",
      "requestedCheckIn": "2026-05-18T01:00:00.000Z",
      "requestedCheckOut": "2026-05-18T10:00:00.000Z",
      "reason": "Tôi quên check-out do có cuộc họp đột xuất",
      "evidencePhotoUrl": "https://bucket.s3.ap-southeast-1.amazonaws.com/attendance/makeup-evidence/...",
      "status": "PENDING",
      "reviewNote": null,
      "reviewedBy": null,
      "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" },
      "createdAt": "2026-05-19T02:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## GET /v1/makeup-attendance — Tất cả đơn (HR/Admin)

Chỉ `ADMIN` và `HR` được gọi.

**Query params:** `?page=1&limit=20&status=PENDING&departmentId=1`

**Response:** `ApiPaginated<MakeupRequestDetail>` — shape giống `/me`

---

## PATCH /v1/makeup-attendance/:id/approve — Duyệt đơn

Chỉ đơn ở trạng thái `PENDING` mới được duyệt.

**Request body:**
```json
{ "reviewNote": "Đã xác nhận qua email với nhân viên" }
```
(`reviewNote` là tùy chọn khi approve)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "attendanceDate": "2026-05-18",
    "requestedCheckIn": "2026-05-18T01:00:00.000Z",
    "requestedCheckOut": "2026-05-18T10:00:00.000Z",
    "reason": "Tôi quên check-out do có cuộc họp đột xuất",
    "evidencePhotoUrl": "https://...",
    "status": "APPROVED",
    "reviewNote": "Đã xác nhận qua email với nhân viên",
    "reviewedBy": { "id": 2, "fullName": "Trần Thị Bình" },
    "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" },
    "createdAt": "2026-05-19T02:00:00.000Z"
  }
}
```

> Sau khi approve, `AttendanceRecord` của ngày đó sẽ được **unlock** (`isLocked: false`) và cập nhật `checkInAt`/`checkOutAt` từ đơn. Thao tác này là **atomic** (transaction).

**Response 400 — đơn không ở trạng thái PENDING:**
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Đơn không ở trạng thái chờ duyệt" } }
```

---

## PATCH /v1/makeup-attendance/:id/reject — Từ chối đơn

`reviewNote` là **bắt buộc** khi từ chối (lý do từ chối).

**Request body:**
```json
{ "reviewNote": "Ảnh chứng minh không hợp lệ, vui lòng cung cấp ảnh camera VP" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "status": "REJECTED",
    "reviewNote": "Ảnh chứng minh không hợp lệ, vui lòng cung cấp ảnh camera VP",
    "reviewedBy": { "id": 2, "fullName": "Trần Thị Bình" },
    ...
  }
}
```

**Response 400 — thiếu `reviewNote`:**
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Lý do từ chối là bắt buộc" } }
```

> Sau khi reject, `AttendanceRecord` **giữ nguyên** trạng thái lock. Nhân viên có thể tạo đơn mới (đơn cũ không còn `PENDING` nữa nên cho phép tạo mới).

---

## Composable — useMakeupAttendance

```typescript
// composables/useMakeupAttendance.ts
import type {
  MakeupRequestDetail,
  CreateMakeupRequestFormData,
  ReviewMakeupRequestDto,
  QueryMakeupRequestParams,
} from '~/types/makeup-attendance.types';
import type { ApiPaginated } from '~/types/api.types';

export function useMakeupAttendance() {
  const { get, patch } = useFetch();

  const createRequest = async (data: CreateMakeupRequestFormData): Promise<MakeupRequestDetail> => {
    const formData = new FormData();
    formData.append('attendanceDate', data.attendanceDate);
    if (data.requestedCheckIn) formData.append('requestedCheckIn', data.requestedCheckIn);
    if (data.requestedCheckOut) formData.append('requestedCheckOut', data.requestedCheckOut);
    formData.append('reason', data.reason);
    if (data.evidencePhoto) formData.append('evidencePhoto', data.evidencePhoto);

    // fetch thủ công vì cần multipart/form-data
    const res = await fetch('/v1/makeup-attendance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    return json.data;
  };

  const fetchMyRequests = (params?: QueryMakeupRequestParams) =>
    get<ApiPaginated<MakeupRequestDetail>>('/v1/makeup-attendance/me', { params });

  const fetchAll = (params?: QueryMakeupRequestParams) =>
    get<ApiPaginated<MakeupRequestDetail>>('/v1/makeup-attendance', { params });

  const approve = (id: number, dto: ReviewMakeupRequestDto) =>
    patch<MakeupRequestDetail>(`/v1/makeup-attendance/${id}/approve`, dto);

  const reject = (id: number, dto: ReviewMakeupRequestDto) =>
    patch<MakeupRequestDetail>(`/v1/makeup-attendance/${id}/reject`, dto);

  return { createRequest, fetchMyRequests, fetchAll, approve, reject };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `attendanceDate` là hôm nay hoặc tương lai | 400 — chỉ được tạo đơn cho ngày đã qua |
| Không có `requestedCheckIn` lẫn `requestedCheckOut` | 400 — phải có ít nhất một |
| `requestedCheckOut` ≤ `requestedCheckIn` | 400 — giờ ra phải sau giờ vào |
| Không tìm thấy bản ghi ngày đó | 404 — nhân viên chưa có record ngày đó |
| Bản ghi chưa bị lock | 400 — chưa cần tạo đơn bù công |
| Đã có đơn PENDING cho ngày đó | 409 — chờ đơn hiện tại được xử lý trước |
| Đơn đã APPROVED/REJECTED mà gọi approve/reject lại | 400 — đơn không ở trạng thái chờ duyệt |
| Reject mà không có `reviewNote` | 400 — lý do từ chối là bắt buộc |
| `evidencePhoto` không phải JPG/PNG | 400 — chỉ chấp nhận ảnh JPG hoặc PNG |
| `evidencePhoto` > 5MB | 400 — ảnh không được vượt quá 5MB |
| `evidencePhoto` không gửi | OK — ảnh evidence là tùy chọn |
| `EMPLOYEE` gọi `GET /makeup-attendance` (không có `/me`) | 403 Forbidden |
| `EMPLOYEE` gọi approve/reject | 403 Forbidden |
| `MANAGER` gọi `GET /makeup-attendance` | 403 Forbidden — chỉ HR/Admin |
| Không truyền `page`/`limit` | Mặc định `page=1`, `limit=20` |
| Sau khi approve — nhân viên tạo đơn mới cho cùng ngày | Cho phép (đơn cũ đã APPROVED, không còn PENDING) |
