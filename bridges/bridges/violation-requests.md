# Bridge Docs — Phiếu giải trình vi phạm (`/v1/violation-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/violation-requests/me` | Mọi user đã đăng nhập | Phiếu của bản thân (có phân trang) |
| GET | `/v1/violation-requests/me/status` | Mọi user đã đăng nhập | Quota tháng — **bắt buộc `?month=&year=`** |
| POST | `/v1/violation-requests` | Mọi user đã đăng nhập | Tạo phiếu giải trình — `multipart/form-data` |
| GET | `/v1/violation-requests` | `HR`, `ADMIN`, `MANAGER` | HR/Admin: tất cả; Manager: chỉ phòng ban mình |
| GET | `/v1/violation-requests/report` | `HR`, `ADMIN` | Thống kê vi phạm theo tháng — **bắt buộc `?month=&year=`** |
| PATCH | `/v1/violation-requests/:id/approve` | `MANAGER` (được phân công) | Duyệt phiếu — chỉ đúng người được giao |
| PATCH | `/v1/violation-requests/:id/reject` | `MANAGER` (được phân công) | Từ chối phiếu — body: `{ reviewNote }` |
| PATCH | `/v1/violation-requests/:id/cancel` | Employee (chính chủ) | Thu hồi phiếu đang chờ |

> **Lưu ý thứ tự route:** `/me` và `/me/status` được khai báo **trước** `/:id/...` và `/report` trong controller.

---

## Phân quyền duyệt/từ chối

Mỗi phiếu có `assignedReviewer` — trưởng phòng ban của nhân viên tại thời điểm tạo phiếu.  
**Chỉ đúng người đó mới được approve/reject.** HR/ADMIN không có quyền này.

| Trường hợp | Người được phép duyệt/từ chối |
|---|---|
| Phiếu có `assignedReviewer` | Đúng người đó (department manager) |
| Phiếu không có `assignedReviewer` (fallback) | Bất kỳ HR/ADMIN nào |

Nếu sai người → `403 Chỉ trưởng phòng được phân công mới có thể xử lý phiếu này`.

---

## Loại vi phạm — 3 loại (phân biệt qua `type`)

| `type` | Tên | Fields bổ sung khi tạo | Side effect khi APPROVE |
|--------|-----|------------------------|------------------------|
| `FORGOT_CHECKIN` | Quên chấm công | `requestedCheckIn` (ISO 8601, **bắt buộc**) + `requestedCheckOut` (tùy chọn) | Cập nhật `checkInAt`/`checkOutAt` theo giá trị requested |
| `LATE` | Đi muộn | _(không có)_ | Cập nhật `checkInAt` về đúng giờ bắt đầu ca, `lateMinutes` → 0, `status` → PRESENT |
| `EARLY` | Về sớm | _(không có)_ | Cập nhật `checkOutAt` về đúng giờ kết thúc ca, `earlyMinutes` → 0, `status` → PRESENT |

> Với LATE/EARLY, khi tạo phiếu server tự động tìm và link bản ghi chấm công ngày tương ứng (`attendanceRecordId`). Không cần client gửi gì thêm.

---

## Quota Logic — 5 lần/tháng

Mỗi nhân viên được tạo tối đa **5 phiếu giải trình mỗi tháng**, tính chung cho cả 3 loại.

```
usedCount = số phiếu có status PENDING hoặc APPROVED trong tháng vi phạm
remaining = max(0, 5 - usedCount)
isBlocked = usedCount >= 5
```

**REJECTED và CANCELLED không tính vào quota:**

| Tình huống | usedCount | remaining |
|-----------|-----------|-----------|
| Tạo 3 phiếu, cả 3 APPROVED | 3 | 2 |
| Tạo 3 phiếu, 2 APPROVED + 1 REJECTED | 2 | 3 — được tạo thêm |
| Tạo 5 phiếu, tất cả PENDING | 5 | 0 — **bị block** |
| Tạo 5 phiếu, 2 bị REJECT → còn 3 active | 3 | 2 — **được tạo tiếp** |
| Thu hồi (CANCELLED) 1 phiếu PENDING | usedCount - 1 | tăng lên |

Khi `isBlocked = true`, server trả `400`:
> `"Bạn đã hết số lần giải trình vi phạm chuyên cần trong tháng (Tối đa 5 lần)."`

---

## Deadline Rule

Deadline được tính dựa vào **ngày vi phạm** (không phải ngày tạo phiếu):

```
deadline = ngày 05 của tháng kế tiếp lúc 23:59:59
```

| Ngày vi phạm | Deadline |
|-------------|----------|
| 2026-05-01 | 2026-06-05T23:59:59 |
| 2026-05-15 | 2026-06-05T23:59:59 |
| 2026-05-31 | 2026-06-05T23:59:59 |
| 2026-12-20 | 2027-01-05T23:59:59 |

Nếu tạo phiếu sau deadline, server trả `400`:
> `"Đã quá hạn tạo phiếu. Thời hạn là ngày 05/06/2026."`

---

## Thông báo email

| Sự kiện | To | CC |
|---|---|---|
| Tạo phiếu | Trưởng phòng ban (assignedReviewer) | HR/ADMIN |
| Tạo phiếu (không có trưởng phòng) | Tất cả HR/ADMIN | — |
| Approve | Nhân viên | HR/ADMIN |
| Reject | Nhân viên | HR/ADMIN |

---

## TypeScript Types

```typescript
// types/violation.types.ts

export type ViolationRequestType = 'FORGOT_CHECKIN' | 'LATE' | 'EARLY';
export type ViolationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ViolationEmployeeRef {
  id: number;
  fullName: string;
  employeeCode: string;
}

export interface ViolationReviewerRef {
  id: number;
  fullName: string;
}

export interface ViolationRequest {
  id: number;
  type: ViolationRequestType;
  typeLabel: string;                        // 'Quên chấm công' | 'Đi muộn' | 'Về sớm'
  violationDate: string;                    // "YYYY-MM-DD"
  violationMonth: number;                   // 1–12
  violationYear: number;
  deadline: string;                         // ISO 8601 — ngày 05 tháng sau lúc 23:59:59
  deadlinePassed: boolean;                  // true nếu đã qua deadline tại thời điểm query
  requestedCheckIn: string | null;          // ISO 8601 — chỉ có với FORGOT_CHECKIN
  requestedCheckOut: string | null;         // ISO 8601 — chỉ có với FORGOT_CHECKIN, tùy chọn
  reason: string;                           // tối thiểu 10 ký tự
  evidencePhotoUrl: string | null;          // URL ảnh minh chứng
  status: ViolationRequestStatus;
  reviewNote: string | null;                // ghi chú khi từ chối
  assignedReviewer: ViolationReviewerRef | null;  // trưởng phòng được giao duyệt
  reviewedBy: ViolationReviewerRef | null;        // người đã duyệt/từ chối
  reviewedAt: string | null;               // ISO 8601 full datetime
  isViolationFlagged: boolean;             // bản ghi bị đánh dấu vi phạm kỷ luật
  employee: ViolationEmployeeRef;
  createdAt: string;                       // ISO 8601 full datetime
}

// Trạng thái quota tháng — dùng để block tạo phiếu khi hết lượt
export interface ViolationCounter {
  usedCount: number;            // số phiếu PENDING + APPROVED trong tháng
  remaining: number;            // số lần còn lại (max: 5 - usedCount, tối thiểu 0)
  isBlocked: boolean;           // true khi usedCount >= 5
  blockedMessage: string | null; // null nếu chưa blocked
}

// Request DTOs
export interface CreateViolationRequestDto {
  type: ViolationRequestType;
  violationDate: string;          // "YYYY-MM-DD"
  reason: string;                 // tối thiểu 10 ký tự
  requestedCheckIn?: string;      // ISO 8601 — bắt buộc với FORGOT_CHECKIN
  requestedCheckOut?: string;     // ISO 8601 — tùy chọn với FORGOT_CHECKIN
  evidencePhoto?: File;           // ảnh minh chứng (multipart), tùy chọn
}

export interface QueryViolationRequestParams {
  page?: number;                  // default 1
  limit?: number;                 // default 20, max 100
  month?: number;                 // 1–12
  year?: number;
  status?: ViolationRequestStatus;
  type?: ViolationRequestType;
  departmentId?: number;          // HR/Admin: filter theo phòng ban; Manager: bị ignore (tự động filter phòng mình)
}

export interface QueryViolationReportParams {
  month: number;                  // bắt buộc, 1–12
  year: number;                   // bắt buộc
  departmentId?: number;          // tùy chọn
}

export interface RejectViolationRequestDto {
  reviewNote: string;             // tối thiểu 1 ký tự
}

// Thống kê vi phạm mỗi nhân viên trong tháng
export interface ViolationMonthlyStats {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  forgotCount: number;      // số phiếu FORGOT_CHECKIN đã APPROVED
  lateCount: number;        // số phiếu LATE đã APPROVED
  earlyCount: number;       // số phiếu EARLY đã APPROVED
  totalCount: number;       // forgotCount + lateCount + earlyCount
  flaggedCount: number;     // số bản ghi bị đánh dấu vi phạm kỷ luật
  remainingQuota: number;   // lượt giải trình còn lại = max(0, 5 - usedQuota)
                            // usedQuota = PENDING + APPROVED (khác totalCount)
}
```

---

## GET /v1/violation-requests/me — Phiếu của tôi

**Query params:** `?month=5&year=2026&status=PENDING&type=LATE&page=1&limit=20`

Tất cả params đều optional.

**Response:** `ApiPaginated<ViolationRequest>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "LATE",
      "typeLabel": "Đi muộn",
      "violationDate": "2026-05-15",
      "violationMonth": 5,
      "violationYear": 2026,
      "deadline": "2026-06-05T23:59:59.999Z",
      "deadlinePassed": false,
      "requestedCheckIn": null,
      "requestedCheckOut": null,
      "reason": "Tôi bị kẹt xe trên đường đến công ty",
      "evidencePhotoUrl": null,
      "status": "PENDING",
      "reviewNote": null,
      "assignedReviewer": { "id": 12, "fullName": "Trần Văn Bình" },
      "reviewedBy": null,
      "reviewedAt": null,
      "isViolationFlagged": false,
      "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" },
      "createdAt": "2026-05-15T04:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## GET /v1/violation-requests/me/status — Quota tháng

**Query params bắt buộc:** `?month=5&year=2026`

**Response:** `ApiSuccess<ViolationCounter>`

```json
{
  "success": true,
  "data": {
    "usedCount": 3,
    "remaining": 2,
    "isBlocked": false,
    "blockedMessage": null
  }
}
```

Khi đã dùng hết 5 lần:
```json
{
  "success": true,
  "data": {
    "usedCount": 5,
    "remaining": 0,
    "isBlocked": true,
    "blockedMessage": "Bạn đã hết số lần giải trình vi phạm chuyên cần trong tháng (Tối đa 5 lần)."
  }
}
```

**Pattern gọi trước khi hiển thị form tạo phiếu:**
```typescript
const status = await fetchMyMonthlyStatus(month, year);
if (status.isBlocked) {
  // Hiện banner: status.blockedMessage
  // Disable nút "Tạo phiếu"
}
```

---

## POST /v1/violation-requests — Tạo phiếu giải trình

**Content-Type:** `multipart/form-data` (dù không upload ảnh vẫn phải dùng form-data)

### Ví dụ: Đi muộn (LATE)
```json
{
  "type": "LATE",
  "violationDate": "2026-05-15",
  "reason": "Tôi bị kẹt xe trên đường đến công ty"
}
```

### Ví dụ: Về sớm (EARLY)
```json
{
  "type": "EARLY",
  "violationDate": "2026-05-15",
  "reason": "Cần đưa con đi khám bệnh theo lịch hẹn bác sĩ"
}
```

### Ví dụ: Quên chấm công (FORGOT_CHECKIN)
```json
{
  "type": "FORGOT_CHECKIN",
  "violationDate": "2026-05-15",
  "requestedCheckIn": "2026-05-15T01:30:00.000Z",
  "requestedCheckOut": "2026-05-15T10:00:00.000Z",
  "reason": "Tôi quên chấm công do có cuộc họp khẩn đầu giờ"
}
```

> Với `FORGOT_CHECKIN`, `requestedCheckIn` là **bắt buộc**; `requestedCheckOut` là tùy chọn.

**Upload ảnh minh chứng (tùy chọn):** Gửi file qua field `evidencePhoto` trong form-data. Chấp nhận JPG/PNG, tối đa 5MB.

**Response 201:** `ApiSuccess<ViolationRequest>`

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Đã quá hạn tạo phiếu cho ngày vi phạm này |
| 400 | Đã hết 5 lần giải trình trong tháng |
| 400 | `requestedCheckIn` bắt buộc với FORGOT_CHECKIN |
| 400 | Bản ghi chấm công ngày đó chưa bị khóa (chỉ với FORGOT_CHECKIN) |
| 404 | Không tìm thấy bản ghi chấm công ngày vi phạm (chỉ với FORGOT_CHECKIN) |
| 409 | Đã có phiếu PENDING/APPROVED cho bản ghi chấm công này (chỉ với FORGOT_CHECKIN) |

---

## GET /v1/violation-requests — Danh sách phiếu

**Query params:** `?month=5&year=2026&departmentId=1&status=PENDING&type=LATE&page=1&limit=20`

Nếu không truyền `month`/`year`, server mặc định tháng/năm hiện tại.

**Hành vi theo role:**
- **HR/ADMIN:** Xem tất cả. `departmentId` filter tùy chọn.
- **MANAGER:** Tự động chỉ thấy phòng ban của mình. `departmentId` từ query bị **bỏ qua**.

**Response:** `ApiPaginated<ViolationRequest>` — shape giống `/me`.

---

## GET /v1/violation-requests/report — Thống kê tháng (HR/Admin)

**Query params bắt buộc:** `?month=5&year=2026`
**Query params tùy chọn:** `?departmentId=1`

**Response:** `ApiSuccess<ViolationMonthlyStats[]>`

```json
{
  "success": true,
  "data": [
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "departmentName": "Kỹ thuật",
      "forgotCount": 0,
      "lateCount": 2,
      "earlyCount": 1,
      "totalCount": 3,
      "flaggedCount": 0,
      "remainingQuota": 2
    }
  ]
}
```

> `forgotCount` / `lateCount` / `earlyCount` chỉ đếm phiếu **APPROVED**.  
> `remainingQuota` tính từ cả PENDING + APPROVED, nên có thể nhỏ hơn `5 - totalCount`.

---

## PATCH /v1/violation-requests/:id/approve — Duyệt phiếu

Không cần body.

**Điều kiện:** Người gọi phải là `assignedReviewer` của phiếu (trưởng phòng ban được phân công).

**Side effect khi duyệt — cập nhật bản ghi chấm công:**

| Loại | Hành động |
|---|---|
| `FORGOT_CHECKIN` | Mở khóa bản ghi, cập nhật `checkInAt` = `requestedCheckIn`, `checkOutAt` = `requestedCheckOut` (nếu có) |
| `LATE` | Cập nhật `checkInAt` về giờ bắt đầu ca, `lateMinutes` → 0, `status` → `PRESENT` |
| `EARLY` | Cập nhật `checkOutAt` về giờ kết thúc ca, `earlyMinutes` → 0, `status` → `PRESENT` |

> Giờ ca ưu tiên `effectiveShiftOverride` (nghỉ nửa ngày) trước, fallback về `shift.checkInTime`/`shift.checkOutTime`.

**Response 200:** `ApiSuccess<ViolationRequest>` (status = `APPROVED`)

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Phiếu không ở trạng thái PENDING |
| 403 | Không phải người được phân công duyệt phiếu này |
| 404 | Phiếu không tồn tại |

---

## PATCH /v1/violation-requests/:id/reject — Từ chối phiếu

**Request body:**
```json
{ "reviewNote": "Thông tin không khớp với dữ liệu chấm công hệ thống" }
```

`reviewNote` là **bắt buộc** khi từ chối.

**Điều kiện:** Người gọi phải là `assignedReviewer` của phiếu.

**Response 200:** `ApiSuccess<ViolationRequest>` (status = `REJECTED`)

**Sau khi REJECT:** phiếu không còn tính vào `usedCount` → nhân viên được tạo phiếu mới cho cùng tháng đó (nếu còn quota).

---

## PATCH /v1/violation-requests/:id/cancel — Thu hồi phiếu

Không cần body. Chỉ chính chủ gọi được. Chỉ thu hồi được khi `status === PENDING`.

**Response 200:** `ApiSuccess<ViolationRequest>` (status = `CANCELLED`)

**400** nếu không phải PENDING:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chỉ được thu hồi phiếu đang chờ xử lý" } }
```

**403** nếu không phải chính chủ:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Chỉ được thu hồi phiếu của chính mình" } }
```

---

## Đính kèm phiếu trong bản ghi chấm công

`GET /v1/attendance/me` trả về field `violationRequests` trong mỗi bản ghi chấm công:

```typescript
// Thêm vào AttendanceRecord
violationRequests: {
  id: number;
  type: ViolationRequestType;
  typeLabel: string;
  status: ViolationRequestStatus;
  reason: string;
  createdAt: string;
}[];
```

Ví dụ bản ghi đã được duyệt violation LATE:
```json
{
  "id": 78,
  "date": "2026-05-14",
  "checkInAt": "2026-05-14T01:30:00.000Z",
  "lateMinutes": 0,
  "status": "PRESENT",
  "isManual": true,
  "shift": { "id": 4, "name": "Ca hành chính HN", "checkInTime": "08:30", "checkOutTime": "18:00" },
  "violationRequests": [
    {
      "id": 1,
      "type": "LATE",
      "typeLabel": "Đi muộn",
      "status": "APPROVED",
      "reason": "Tôi bị kẹt xe trên đường đến công ty",
      "createdAt": "2026-05-21T09:21:37.060Z"
    }
  ]
}
```

Mảng rỗng `[]` với các ngày không có phiếu.

---

## Báo cáo vi phạm — `/v1/reports/violations`

Ngoài endpoint `/v1/violation-requests/report`, HR/Admin có thể dùng endpoints trong `ReportsController`:

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/v1/reports/violations` | JSON thống kê — cùng shape với `/violation-requests/report` |
| GET | `/v1/reports/violations/export` | Tải file Excel |

**Query params:** `?month=5&year=2026&departmentId=1`

File Excel gồm các cột: Mã NV · Họ tên · Phòng ban · Quên CC · Đi muộn · Về sớm · Tổng · Vi phạm KL · Quota còn lại.

---

## Composable — useViolationRequests

```typescript
// composables/useViolationRequests.ts
import type {
  ViolationRequest,
  ViolationCounter,
  ViolationMonthlyStats,
  CreateViolationRequestDto,
  RejectViolationRequestDto,
  QueryViolationRequestParams,
  QueryViolationReportParams,
} from '~/types/violation.types';

export function useViolationRequests() {
  const { get, list, post, patch } = useFetch();

  /** Mọi user: danh sách phiếu của bản thân */
  const fetchMyRequests = (params?: QueryViolationRequestParams) =>
    list<ViolationRequest>('/v1/violation-requests/me', { params });

  /** Mọi user: kiểm tra quota tháng trước khi tạo phiếu */
  const fetchMyMonthlyStatus = (month: number, year: number) =>
    get<ViolationCounter>('/v1/violation-requests/me/status', { params: { month, year } });

  /**
   * Tạo phiếu giải trình — gửi dưới dạng FormData.
   * Nếu có ảnh minh chứng, append vào field "evidencePhoto".
   */
  const submitRequest = (dto: CreateViolationRequestDto) => {
    const form = new FormData();
    form.append('type', dto.type);
    form.append('violationDate', dto.violationDate);
    form.append('reason', dto.reason);
    if (dto.requestedCheckIn) form.append('requestedCheckIn', dto.requestedCheckIn);
    if (dto.requestedCheckOut) form.append('requestedCheckOut', dto.requestedCheckOut);
    if (dto.evidencePhoto) form.append('evidencePhoto', dto.evidencePhoto);
    return post<ViolationRequest>('/v1/violation-requests', form);
  };

  /** HR/Admin/Manager: danh sách phiếu theo quyền */
  const fetchAllRequests = (params?: QueryViolationRequestParams) =>
    list<ViolationRequest>('/v1/violation-requests', { params });

  /** HR/Admin: thống kê vi phạm tháng */
  const fetchMonthlyReport = (params: QueryViolationReportParams) =>
    get<ViolationMonthlyStats[]>('/v1/violation-requests/report', { params });

  /** Manager (được phân công): duyệt phiếu */
  const approveRequest = (id: number) =>
    patch<ViolationRequest>(`/v1/violation-requests/${id}/approve`);

  /**
   * Manager (được phân công): từ chối phiếu.
   * reviewNote bắt buộc.
   */
  const rejectRequest = (id: number, dto: RejectViolationRequestDto) =>
    patch<ViolationRequest>(`/v1/violation-requests/${id}/reject`, dto);

  /** Chính chủ: thu hồi phiếu đang chờ */
  const cancelRequest = (id: number) =>
    patch<ViolationRequest>(`/v1/violation-requests/${id}/cancel`);

  return {
    fetchMyRequests,
    fetchMyMonthlyStatus,
    submitRequest,
    fetchAllRequests,
    fetchMonthlyReport,
    approveRequest,
    rejectRequest,
    cancelRequest,
  };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `usedCount = 5` (5 phiếu PENDING/APPROVED) | 400 — bị block |
| Tạo phiếu với `violationDate` tháng trước đã qua ngày 05 tháng này | 400 — đã quá hạn |
| `violationDate = 2026-05-31`, tạo vào 2026-06-06 | 400 — đã quá hạn (deadline là 05/06) |
| `violationDate = 2026-05-31`, tạo vào 2026-06-05 23:59 | 201 — còn trong deadline |
| FORGOT_CHECKIN, bản ghi chấm công ngày đó chưa bị khóa | 400 |
| FORGOT_CHECKIN, không tìm thấy bản ghi chấm công | 404 |
| FORGOT_CHECKIN, đã có 1 phiếu PENDING/APPROVED cho cùng bản ghi | 409 |
| FORGOT_CHECKIN, phiếu trước REJECTED → tạo lại cho cùng ngày | 201 — hợp lệ |
| FORGOT_CHECKIN không truyền `requestedCheckIn` | 400 |
| LATE/EARLY — không cần gửi thêm field nào | 201 — chỉ cần type + violationDate + reason |
| REJECTED → `usedCount` giảm 1 → nhân viên được tạo phiếu mới | 201 nếu còn quota |
| CANCELLED → `usedCount` giảm 1 (CANCELLED không tính quota) | — |
| EMPLOYEE gọi `GET /violation-requests` | 403 Forbidden |
| MANAGER gọi `GET /violation-requests` | 200 — chỉ thấy phòng ban của mình |
| MANAGER không phải assignedReviewer gọi approve/reject | 403 — chỉ người được phân công |
| HR/ADMIN gọi approve/reject (phiếu có assignedReviewer) | 403 — không có quyền |
| Thu hồi phiếu đã APPROVED | 400 — chỉ được thu hồi PENDING |
| Thu hồi phiếu của người khác | 403 Forbidden |
| Approve LATE → bản ghi chấm công: checkInAt = giờ ca, lateMinutes = 0, status = PRESENT | tự động |
| Approve EARLY → bản ghi chấm công: checkOutAt = giờ ca, earlyMinutes = 0, status = PRESENT | tự động |
| Approve FORGOT_CHECKIN → bản ghi tự mở khóa + cập nhật checkInAt/checkOutAt | tự động |
| `remainingQuota` trong report có thể < `5 - totalCount` | vì `totalCount` chỉ đếm APPROVED, còn PENDING cũng trừ quota |
| Bản ghi chấm công có `violationRequests[]` rỗng | ngày không có phiếu nào |
| Bản ghi chấm công có `violationRequests[]` không rỗng | hiển thị badge/link xem phiếu |
