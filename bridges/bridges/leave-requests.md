# Bridge Docs — Đơn nghỉ phép (`/v1/leave-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/leave-requests/me` | `EMPLOYEE` | Đơn của bản thân (có phân trang) |
| GET | `/v1/leave-requests` | `HR`, `ADMIN`, `MANAGER` | Toàn bộ đơn (có filter) |
| POST | `/v1/leave-requests/preview` | Mọi user đã đăng nhập | Preview split P/KL — **không tạo đơn** |
| POST | `/v1/leave-requests` | `EMPLOYEE` | Tạo đơn mới |
| PATCH | `/v1/leave-requests/:id/approve` | `HR`, `ADMIN`, `MANAGER` | Duyệt đơn |
| PATCH | `/v1/leave-requests/:id/reject` | `HR`, `ADMIN`, `MANAGER` | Từ chối đơn |
| PATCH | `/v1/leave-requests/:id/cancel` | `EMPLOYEE` (chính chủ) | Thu hồi → CANCELLED, giữ lịch sử |
| DELETE | `/v1/leave-requests/:id` | `EMPLOYEE` (chính chủ) | Xóa hẳn khỏi DB (hard delete) |

> **Lưu ý thứ tự route:** `/leave-requests/me` được khai báo trước `/leave-requests/:id`.  
> Nếu server trả 400 "Validation failed" khi gọi `/me`, kiểm tra lại thứ tự route phía client.

---

## Hình thức đơn — 4 loại (phân biệt qua `leaveType.code`)

| `leaveType.code` | Tên | Fields bắt buộc thêm | `totalDays` |
|---|---|---|---|
| `ANNUAL` | Nghỉ cả ngày | `startDate` + `endDate` (có thể nhiều ngày) | Số ngày làm việc thực tế (trừ cuối tuần + ngày lễ) |
| `HALF_DAY` | Nghỉ nửa ngày | `startDate === endDate` + `halfDayPeriod` (`MORNING`/`AFTERNOON`) | `0.5` |
| `LATE` | Đi muộn | `startDate === endDate` + `lateMinutes` (1–**120** phút) | `0` — không trừ phép |
| `EARLY` | Về sớm | `startDate === endDate` + `earlyMinutes` (1–**120** phút) | `0` — không trừ phép |
| `UNPAID` | Nghỉ không lương | `startDate` + `endDate` | Số ngày làm việc thực tế — `leaveCode` luôn là `'KL'` |

**Quy tắc chọn form phía frontend:**
1. Gọi `GET /v1/leave-types` để lấy danh sách loại phép.
2. Khi user chọn loại phép, dựa vào `leaveType.code` để hiện đúng fields phụ:
   - `ANNUAL` → date range picker (startDate ≤ endDate)
   - `HALF_DAY` → single date picker + radio MORNING/AFTERNOON
   - `LATE` → single date picker + number input lateMinutes
   - `EARLY` → single date picker + number input earlyMinutes

---

## Người duyệt — Approval Routing

Khi employee tạo đơn, server tự xác định `assignedApprover` theo thứ tự ưu tiên:

1. **`employee.managerId`** (line manager trực tiếp) — ưu tiên cao nhất
2. **`employee.department.managerId`** (trưởng phòng) — nếu không có line manager hoặc line manager INACTIVE
3. **Fallback HR/ADMIN** — nếu không tìm được cả 2; email gửi đồng loạt cho tất cả HR/ADMIN đang ACTIVE

> Trưởng phòng tự xin nghỉ → server dùng `managerId` của trưởng phòng đó (leo lên manager cấp trên).  
> Không có manager nào → HR nhận đơn.

Email notification:
- Có `assignedApprover` → gửi cho approver, CC cho HR/ADMIN
- Fallback → gửi riêng cho từng HR/ADMIN, không CC

---

## Split P/KL — Nghỉ phép hưởng lương và không lương

Áp dụng **chỉ với loại ANNUAL**. Khi tạo đơn, server tự tính split dựa vào số dư phép còn lại (`leaveBalance.totalDays - leaveBalance.usedDays`) và ghi vào `paidDays`, `unpaidDays`, `leaveCode`.

### Kịch bản A — Hết phép (remaining = 0)

```
Còn lại: 0 ngày   |  Xin: 3 ngày
─────────────────────────────────
paidDays   = 0
unpaidDays = 3
leaveCode  = 'KL'
warningMessage = 'Số dư phép năm của bạn đã hết. Đơn này sẽ tự động chuyển thành Nghỉ không lương.'
```

### Kịch bản B — Hết phép giữa chừng (0 < remaining < totalDays)

```
Còn lại: 1 ngày   |  Xin: 3 ngày
─────────────────────────────────
paidDays   = 1    → ngày hưởng lương
unpaidDays = 2    → ngày không lương
leaveCode  = 'P+KL'
warningMessage = 'Số dư phép năm còn lại 1 ngày. 1 ngày đầu hưởng lương (P), 2 ngày còn lại không hưởng lương (KL).'
```

### Kịch bản C — Đủ phép (remaining ≥ totalDays)

```
Còn lại: 5 ngày   |  Xin: 3 ngày
─────────────────────────────────
paidDays   = 3
unpaidDays = 0
leaveCode  = 'P'
warningMessage = null
remainingAfter = 2
```

> **Lưu ý:**
> - ANNUAL không còn trả lỗi `LEAVE_INSUFFICIENT_BALANCE` — đơn luôn được tạo, server tự split.
> - UNPAID luôn `leaveCode = 'KL'`, `paidDays = 0`, không check balance.
> - HALF_DAY / LATE / EARLY luôn `leaveCode = 'P'` (không trừ ngày phép hoặc isPaid = true).
> - Khi approve: backend trừ `paidDays` vào `usedDays` (không phải `totalDays`).
> - Khi cancel đơn đã APPROVED: backend hoàn trả đúng `paidDays` vào balance.

### POST /v1/leave-requests/preview — Preview split trước khi submit

Body giống `CreateLeaveRequestDto`. Không tạo đơn, chỉ tính toán và trả về kết quả.

**Ví dụ request:**
```json
{
  "leaveTypeId": 1,
  "startDate": "2026-06-02",
  "endDate": "2026-06-04"
}
```

**Response 200:** `ApiSuccess<LeavePreviewResponse>`
```json
{
  "success": true,
  "data": {
    "totalDays": 3,
    "paidDays": 1,
    "unpaidDays": 2,
    "leaveCode": "P+KL",
    "warningMessage": "Số dư phép năm còn lại 1 ngày. 1 ngày đầu hưởng lương (P), 2 ngày còn lại không hưởng lương (KL).",
    "remainingAfter": 0,
    "currentBalance": 1
  }
}
```

**Pattern gọi preview trước khi submit:**
```typescript
// Gọi preview khi user chọn ngày xong, trước khi bấm "Gửi đơn"
const preview = ref<LeavePreviewResponse | null>(null);

async function onDateChanged() {
  if (!form.leaveTypeId || !form.startDate || !form.endDate) return;
  preview.value = await previewRequest(form);
}

// Hiển thị warning nếu có split
// preview.value?.warningMessage → hiển thị banner cảnh báo
// preview.value?.leaveCode      → hiển thị badge "P" / "KL" / "P+KL"
```

---

## TypeScript Types

```typescript
// types/leave.types.ts

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type HalfDayPeriod = 'MORNING' | 'AFTERNOON';

export interface LeaveEmployeeRef {
  id: number;
  fullName: string;
  employeeCode: string;
}

export interface LeaveTypeRef {
  id: number;
  name: string;
  code: 'ANNUAL' | 'HALF_DAY' | 'LATE' | 'EARLY' | string;
}

export interface ApprovedByRef {
  id: number;
  fullName: string;
}

export interface AssignedApproverRef {
  id: number;
  fullName: string;
  email: string;
}

export interface TimelineActor {
  id: number;
  fullName: string;
  position: string | null;  // tên chức vụ, null nếu chưa gán
}

export interface LeaveTimeline {
  submittedAt: string;                        // ISO 8601 — thời điểm tạo đơn
  submittedBy: TimelineActor;                 // người tạo đơn
  reviewedAt: string | null;                  // thời điểm approve/reject/cancel; null khi PENDING
  reviewedBy: TimelineActor | null;           // người xử lý; null khi PENDING
  action: 'APPROVED' | 'REJECTED' | 'CANCELLED' | null;  // null khi PENDING
}

export interface LeaveRequest {
  id: number;
  employee: LeaveEmployeeRef;
  leaveType: LeaveTypeRef;
  startDate: string;            // "YYYY-MM-DD"
  endDate: string;              // "YYYY-MM-DD"
  totalDays: number;            // 0 với LATE/EARLY, 0.5 với HALF_DAY, ≥1 với ANNUAL/UNPAID
  paidDays: number;             // số ngày hưởng lương (P)
  unpaidDays: number;           // số ngày không hưởng lương (KL)
  leaveCode: 'P' | 'KL' | 'P+KL' | null;  // null với đơn cũ trước khi deploy tính năng này
  reason: string | null;
  status: LeaveStatus;
  halfDayPeriod: HalfDayPeriod | null;  // chỉ có khi code = HALF_DAY
  lateMinutes: number | null;           // chỉ có khi code = LATE (tối đa 120 phút)
  earlyMinutes: number | null;          // chỉ có khi code = EARLY (tối đa 120 phút)
  approvedBy: ApprovedByRef | null;
  approvedAt: string | null;            // ISO 8601 full datetime
  rejectNote: string | null;
  assignedApprover: AssignedApproverRef | null;  // người được server chỉ định duyệt khi tạo đơn
  createdAt: string;                    // ISO 8601 full datetime
  // Computed fields — dùng để điều khiển hiển thị button
  canBeRevoked: boolean;    // true khi status === PENDING → hiện nút "Thu hồi"
  canBeRemoved: boolean;    // true khi status === PENDING → hiện nút "Xóa"
  timeline: LeaveTimeline | null;
}

// Request DTOs
export interface CreateLeaveRequestDto {
  leaveTypeId: number;
  startDate: string;              // "YYYY-MM-DD"
  endDate: string;                // "YYYY-MM-DD"
  reason?: string;
  halfDayPeriod?: HalfDayPeriod;  // bắt buộc nếu code = HALF_DAY
  lateMinutes?: number;           // bắt buộc nếu code = LATE (1–120)
  earlyMinutes?: number;          // bắt buộc nếu code = EARLY (1–120)
}

// Preview — dùng cùng body với CreateLeaveRequestDto, không tạo đơn
export interface LeavePreviewResponse {
  totalDays: number;              // tổng ngày làm việc trong khoảng startDate–endDate
  paidDays: number;               // số ngày hưởng lương (P)
  unpaidDays: number;             // số ngày không hưởng lương (KL)
  leaveCode: 'P' | 'KL' | 'P+KL';
  warningMessage: string | null;  // null nếu đủ balance; có nội dung nếu split hoặc hết phép
  remainingAfter: number;         // số ngày phép còn lại sau khi trừ (0 nếu KL hoặc P+KL)
  currentBalance: number | null;  // số dư hiện tại trước khi submit; null với loại không có balance
}

export interface RejectLeaveRequestDto {
  rejectNote: string;             // tối thiểu 1 ký tự
}

export interface QueryLeaveRequestParams {
  page?: number;          // default 1
  limit?: number;         // default 20, max 100
  employeeId?: number;    // chỉ HR/Manager dùng
  departmentId?: number;  // chỉ HR/Manager dùng
  status?: LeaveStatus;
  leaveTypeId?: number;
  startDate?: string;     // "YYYY-MM-DD" — lọc đơn bắt đầu từ ngày này
  endDate?: string;       // "YYYY-MM-DD" — lọc đơn kết thúc trước ngày này
}
```

---

## Computed fields — canBeRevoked và canBeRemoved

Hai fields này do backend tính sẵn, frontend không cần tự suy ra:

| Field | Giá trị `true` khi | Nút tương ứng | API gọi |
|---|---|---|---|
| `canBeRevoked` | `status === 'PENDING'` | "Thu hồi" | `PATCH /:id/cancel` |
| `canBeRemoved` | `status === 'PENDING'` | "Xóa" | `DELETE /:id` |

Hiện tại cả hai cùng logic (`PENDING`), nhưng được tách riêng để sau này có thể diverge (ví dụ ADMIN có thể remove đơn REJECTED, employee không thể).

**Pattern dùng trong template:**
```vue
<button v-if="leave.canBeRevoked" @click="revokeRequest(leave.id)">Thu hồi</button>
<button v-if="leave.canBeRemoved" @click="removeRequest(leave.id)">Xóa</button>
```

---

## Xóa vs Thu hồi — khác nhau quan trọng

| Hành động | API | Kết quả DB | Xuất hiện trong lịch sử | Điều kiện |
|---|---|---|---|---|
| **Xóa** | `DELETE /:id` | Hard delete — xóa hẳn record | Không | Chỉ khi `PENDING` + chính chủ |
| **Thu hồi** | `PATCH /:id/cancel` | Soft — set `status = CANCELLED` | Có (có timeline) | Chỉ khi `PENDING` + chính chủ |

Khi thu hồi: backend stamp `approvedAt` (thời điểm thu hồi) và `approvedById` (chính người thu hồi) để timeline hiển thị đúng.

---

## Timeline field — cách render

`timeline` luôn có trong response (không null nếu employee tồn tại). Dùng để vẽ timeline phê duyệt.

### PENDING — chờ xử lý
```json
{
  "timeline": {
    "submittedAt": "2026-05-19T07:30:00.000Z",
    "submittedBy": { "id": 4, "fullName": "Nguyễn Văn An", "position": "Software Engineer" },
    "reviewedAt": null,
    "reviewedBy": null,
    "action": null
  }
}
```

### APPROVED — đã duyệt
```json
{
  "timeline": {
    "submittedAt": "2026-05-19T07:30:00.000Z",
    "submittedBy": { "id": 4, "fullName": "Nguyễn Văn An", "position": "Software Engineer" },
    "reviewedAt": "2026-05-19T09:15:00.000Z",
    "reviewedBy": { "id": 3, "fullName": "Lê Văn Manager", "position": "CTO" },
    "action": "APPROVED"
  }
}
```

### REJECTED — từ chối
```json
{
  "timeline": {
    "submittedAt": "2026-05-19T07:30:00.000Z",
    "submittedBy": { "id": 4, "fullName": "Nguyễn Văn An", "position": "Software Engineer" },
    "reviewedAt": "2026-05-19T10:00:00.000Z",
    "reviewedBy": { "id": 2, "fullName": "Trần Thị HR", "position": "HR Manager" },
    "action": "REJECTED"
  }
}
```

### CANCELLED — thu hồi (chính chủ)
```json
{
  "timeline": {
    "submittedAt": "2026-05-19T07:30:00.000Z",
    "submittedBy": { "id": 4, "fullName": "Nguyễn Văn An", "position": "Software Engineer" },
    "reviewedAt": "2026-05-19T08:00:00.000Z",
    "reviewedBy": { "id": 4, "fullName": "Nguyễn Văn An", "position": "Software Engineer" },
    "action": "CANCELLED"
  }
}
```

> Lưu ý: CANCELLED — `reviewedBy` là chính người nộp đơn (họ tự thu hồi).

**Gợi ý render:**
```typescript
const timelineSteps = computed(() => {
  if (!leave.timeline) return [];
  const steps = [
    { label: 'Đã nộp', at: leave.timeline.submittedAt, by: leave.timeline.submittedBy, done: true },
  ];
  if (leave.timeline.action) {
    const labelMap = { APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Thu hồi' };
    steps.push({
      label: labelMap[leave.timeline.action],
      at: leave.timeline.reviewedAt,
      by: leave.timeline.reviewedBy,
      done: true,
    });
  } else {
    steps.push({ label: 'Chờ duyệt', at: null, by: null, done: false });
  }
  return steps;
});
```

---

## GET /v1/leave-requests/me — Đơn của tôi

**Query params:** `?status=PENDING&leaveTypeId=1&page=1&limit=20`

**Response:** `ApiPaginated<LeaveRequest>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" },
      "leaveType": { "id": 1, "name": "Nghỉ cả ngày", "code": "ANNUAL" },
      "startDate": "2026-06-02",
      "endDate": "2026-06-04",
      "totalDays": 3,
      "reason": "Nghỉ phép năm",
      "status": "PENDING",
      "halfDayPeriod": null,
      "lateMinutes": null,
      "earlyMinutes": null,
      "approvedBy": null,
      "approvedAt": null,
      "rejectNote": null,
      "createdAt": "2026-05-19T07:30:00.000Z",
      "canBeRevoked": true,
      "canBeRemoved": true,
      "timeline": {
        "submittedAt": "2026-05-19T07:30:00.000Z",
        "submittedBy": { "id": 4, "fullName": "Nguyễn Văn An", "position": "Software Engineer" },
        "reviewedAt": null,
        "reviewedBy": null,
        "action": null
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## GET /v1/leave-requests — Toàn bộ đơn (HR/Admin/Manager)

**Query params:** `?employeeId=4&departmentId=1&status=PENDING&leaveTypeId=1&startDate=2026-06-01&endDate=2026-06-30&page=1&limit=20`

Tất cả params đều optional. Response shape giống `/me`.

---

## POST /v1/leave-requests — Tạo đơn

### Ví dụ: Nghỉ cả ngày (ANNUAL)
```json
{
  "leaveTypeId": 1,
  "startDate": "2026-06-02",
  "endDate": "2026-06-04",
  "reason": "Nghỉ phép năm"
}
```

### Ví dụ: Nghỉ nửa ngày buổi sáng (HALF_DAY)
```json
{
  "leaveTypeId": 2,
  "startDate": "2026-06-02",
  "endDate": "2026-06-02",
  "halfDayPeriod": "MORNING"
}
```

### Ví dụ: Đi muộn 30 phút (LATE)
```json
{
  "leaveTypeId": 3,
  "startDate": "2026-06-02",
  "endDate": "2026-06-02",
  "lateMinutes": 30,
  "reason": "Kẹt xe"
}
```

### Ví dụ: Về sớm 45 phút (EARLY)
```json
{
  "leaveTypeId": 4,
  "startDate": "2026-06-02",
  "endDate": "2026-06-02",
  "earlyMinutes": 45
}
```

**Response 201:** `ApiSuccess<LeaveRequest>`

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | `lateMinutes` / `earlyMinutes` bắt buộc theo code; LATE/EARLY chỉ 1 ngày; `endDate` < `startDate` |
| 400 | `LEAVE_INSUFFICIENT_BALANCE` — hết ngày phép (chỉ với loại phép tuỳ chỉnh có `daysPerYear`, không áp dụng với ANNUAL — ANNUAL tự split P/KL) |
| 409 | `LEAVE_OVERLAP` — đã có đơn PENDING/APPROVED trùng ngày |
| 404 | Loại phép không tồn tại |

---

## PATCH /v1/leave-requests/:id/approve

Không cần body. Chỉ `HR`, `ADMIN`, `MANAGER` gọi được.

Nếu leaveType có `daysPerYear` (ANNUAL) → backend tự trừ `usedDays` trong `leave_balances` bằng transaction.

Nếu `halfDayPeriod` được set → backend tự tạo `EffectiveShiftOverride` cho ngày đó.

**Response 200:** `ApiSuccess<LeaveRequest>` (status = `APPROVED`)

**400** nếu đơn không ở PENDING:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chỉ có thể duyệt đơn đang chờ xử lý" } }
```

---

## PATCH /v1/leave-requests/:id/reject

**Request body:**
```json
{ "rejectNote": "Không đủ nhân sự trong thời gian này" }
```

**Response 200:** `ApiSuccess<LeaveRequest>` (status = `REJECTED`)

---

## PATCH /v1/leave-requests/:id/cancel — Thu hồi

Không cần body. Chỉ chính chủ (EMPLOYEE owner) gọi được.

- Set status → `CANCELLED`
- Stamp `approvedAt` + `approvedById` để timeline hiển thị
- Không hoàn trả `leaveBalance` (đơn PENDING chưa bị trừ)

**Response 200:** `ApiSuccess<LeaveRequest>` (status = `CANCELLED`)

---

## DELETE /v1/leave-requests/:id — Xóa hẳn

Không cần body. Chỉ chính chủ gọi được. Chỉ xóa được khi `status === PENDING`.

**Response 204 No Content**

**400** nếu không phải PENDING:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chỉ được xóa đơn đang chờ duyệt" } }
```

---

## Composable — useLeaveRequests

```typescript
// composables/useLeaveRequests.ts
import type {
  LeaveRequest,
  CreateLeaveRequestDto,
  RejectLeaveRequestDto,
  QueryLeaveRequestParams,
} from '~/types/leave.types';

export function useLeaveRequests() {
  const { get, list, post, patch, del } = useFetch();

  /** EMPLOYEE: lấy đơn của bản thân */
  const fetchMyRequests = (params?: QueryLeaveRequestParams) =>
    list<LeaveRequest>('/v1/leave-requests/me', { params });

  /** HR/Admin/Manager: lấy toàn bộ đơn */
  const fetchAllRequests = (params?: QueryLeaveRequestParams) =>
    list<LeaveRequest>('/v1/leave-requests', { params });

  /** EMPLOYEE: tạo đơn mới */
  const submitRequest = (dto: CreateLeaveRequestDto) =>
    post<LeaveRequest>('/v1/leave-requests', dto);

  /**
   * Duyệt đơn — 403 nếu user không phải assignedApprover và không có role HR/ADMIN.
   * MANAGER chỉ duyệt được đơn mà mình là assignedApprover; HR/ADMIN bypass check này.
   */
  const approveRequest = (id: number) =>
    patch<LeaveRequest>(`/v1/leave-requests/${id}/approve`);

  /**
   * Từ chối đơn — cùng điều kiện quyền với approveRequest.
   */
  const rejectRequest = (id: number, dto: RejectLeaveRequestDto) =>
    patch<LeaveRequest>(`/v1/leave-requests/${id}/reject`, dto);

  /** EMPLOYEE (chính chủ): thu hồi → CANCELLED, giữ lịch sử */
  const revokeRequest = (id: number) =>
    patch<LeaveRequest>(`/v1/leave-requests/${id}/cancel`);

  /** EMPLOYEE (chính chủ): xóa hẳn khỏi DB */
  const removeRequest = (id: number) =>
    del(`/v1/leave-requests/${id}`);

  return {
    fetchMyRequests,
    fetchAllRequests,
    submitRequest,
    approveRequest,
    rejectRequest,
    revokeRequest,
    removeRequest,
  };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|---|---|
| EMPLOYEE gọi `GET /leave-requests` (không phải `/me`) | 403 Forbidden |
| Tạo đơn LATE mà không truyền `lateMinutes` | 400 Bad Request |
| Tạo đơn LATE với `startDate !== endDate` | 400 Bad Request |
| `halfDayPeriod` được set nhưng `startDate !== endDate` | 400 Bad Request |
| Đơn ANNUAL với leaveType.daysPerYear=null (không giới hạn) | Không kiểm tra balance, tạo được |
| Thu hồi đơn đã APPROVED | 400 — chỉ được thu hồi PENDING |
| Xóa đơn đã CANCELLED | 400 — chỉ được xóa PENDING |
| Trùng ngày với đơn đã APPROVED | 409 LEAVE_OVERLAP |
| Trùng ngày với đơn đã CANCELLED | Cho phép (đã huỷ không còn chiếm slot) |
| employee không có manager + dept không có manager | Đơn tạo được, `assignedApprover = null`, email gửi cho tất cả HR/ADMIN |
| manager bị INACTIVE | Server bỏ qua line manager, fallback sang trưởng phòng hoặc HR |
| trưởng phòng tự xin nghỉ | Server dùng `managerId` của trưởng phòng đó (leo lên cấp trên) |
| HR duyệt thay manager | Hợp lệ — role HR/ADMIN bypass `assignedApprover` check |
| ANNUAL với balance = 0 | `leaveCode = 'KL'`, `paidDays = 0` — đơn vẫn được tạo, không báo lỗi |
| ANNUAL với balance < totalDays | `leaveCode = 'P+KL'`, split tự động theo số dư còn lại |
| UNPAID | `leaveCode = 'KL'`, `paidDays = 0`, không check balance |
| Khi approve đơn ANNUAL | Backend trừ `paidDays` vào `usedDays`, không phải `totalDays` |
