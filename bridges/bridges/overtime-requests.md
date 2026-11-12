# Bridge Docs — Đăng ký làm thêm giờ (`/v1/overtime-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/overtime-requests/me` | Mọi user đã đăng nhập | Danh sách đơn OT của bản thân |
| GET | `/v1/overtime-requests/me/stats` | Mọi user đã đăng nhập | Thống kê OT theo tháng của bản thân |
| POST | `/v1/overtime-requests` | Mọi user đã đăng nhập | Tạo đơn OT mới |
| GET | `/v1/overtime-requests/report` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Thống kê OT theo tháng |
| GET | `/v1/overtime-requests/report/export` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Xuất báo cáo OT ra Excel |
| GET | `/v1/overtime-requests` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Danh sách tất cả đơn OT |
| GET | `/v1/overtime-requests/:id` | Chủ đơn, `ADMIN`, `HR`, hoặc approver được phân công | Chi tiết một đơn OT |
| PATCH | `/v1/overtime-requests/:id/approve` | `ADMIN`, `MANAGER`, `CHIEF` | Duyệt đơn OT |
| PATCH | `/v1/overtime-requests/:id/reject` | `ADMIN`, `MANAGER`, `CHIEF` | Từ chối đơn OT |
| PATCH | `/v1/overtime-requests/:id/cancel` | Chủ đơn | Thu hồi đơn OT |

> **Lưu ý thứ tự route:** `/overtime-requests/me` và `/overtime-requests/report` được khai báo **trước** `/:id` trong controller.  
> Gọi `/overtime-requests/me` mà trả 404 → kiểm tra thứ tự route phía client.

---

## TypeScript Types

```typescript
// types/overtime.types.ts

export type OvertimeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'AUTO_CANCELLED';

export interface OvertimeApproverDto {
  id: number;
  fullName: string;
}

export interface OvertimeEmployeeDto {
  id: number;
  fullName: string;
  employeeCode: string;
  department: string | null; // tên phòng ban (string), không phải object
}

// Dùng trong GET /overtime-requests, GET /overtime-requests/:id, POST /overtime-requests
export interface OvertimeRequestResponse {
  id: number;
  overtimeDate: string;           // "YYYY-MM-DD"
  startTime: string;              // ISO 8601 full datetime
  endTime: string;                // ISO 8601 full datetime
  totalHours: number;             // số thực, tối thiểu 0.5, tối đa 12
  reason: string;
  status: OvertimeStatus;
  reviewNote: string | null;
  assignedApprover: OvertimeApproverDto | null;
  reviewedBy: OvertimeApproverDto | null;
  reviewedAt: string | null;      // ISO 8601 full datetime
  autoExpireAt: string;           // ISO 8601 — deadline để manager duyệt (tạo + 7 ngày)
  deadlineAt: string;             // ISO 8601 — deadline tạo đơn (overtimeDate + 30 ngày)
  isExpired: boolean;
  employee: OvertimeEmployeeDto;
  createdAt: string;              // ISO 8601 full datetime
  canBeCancelled: boolean;        // true khi status === 'PENDING'
  hoursDisplay: string;           // VD: "3.0 giờ" — dùng để hiển thị
}

// Dùng trong GET /overtime-requests/report và GET /reports/overtime
export interface OvertimeMonthlyStatsResponse {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  totalRequests: number;
  approvedRequests: number;
  totalApprovedHours: number;     // tổng giờ OT đã duyệt trong tháng
  pendingRequests: number;
  rejectedRequests: number;
}

// Request DTOs
export interface CreateOvertimeRequestDto {
  overtimeDate: string;   // "YYYY-MM-DD" — ngày OT
  startTime: string;      // ISO 8601 datetime — giờ bắt đầu OT
  endTime: string;        // ISO 8601 datetime — giờ kết thúc OT
  reason: string;         // tối thiểu 10 ký tự
}

export interface RejectOvertimeDto {
  reviewNote: string;     // lý do từ chối, bắt buộc
}

export interface QueryOvertimeParams {
  page?: number;          // default 1
  limit?: number;         // default 20, max 100
  status?: OvertimeStatus;
  startDate?: string;     // "YYYY-MM-DD" — filter khoảng ngày OT
  endDate?: string;       // "YYYY-MM-DD"
  month?: number;         // 1–12
  year?: number;
  departmentId?: number;  // chỉ HR/ADMIN dùng; MANAGER/CHIEF bị override sang phòng ban mình
  employeeId?: number;
}

export interface QueryOvertimeReportParams {
  month: number;          // 1–12, bắt buộc
  year: number;           // >= 2020, bắt buộc
  departmentId?: number;
}
```

---

## Business Rules

### Deadline tạo đơn

- Chỉ được tạo đơn nếu `now <= overtimeDate + 30 ngày`
- Quá 30 ngày → **400** `"Đã quá 30 ngày kể từ ngày OT. Không thể tạo đơn."`

### Auto-cancel sau 7 ngày

- Mỗi đơn có `autoExpireAt = createdAt + 7 ngày`
- Cron chạy lúc **00:05 Asia/Ho_Chi_Minh** mỗi ngày
- Đơn `PENDING` quá `autoExpireAt` → chuyển sang `AUTO_CANCELLED`, `isExpired = true`
- Nhân viên nhận email + push notification

### OT Window (giờ hợp lệ)

| Ngày | Quy tắc |
|------|---------|
| Chủ nhật (CN) | OT cả ngày, không kiểm tra ca |
| Thứ 2 – Thứ 7 | Phải nằm **ngoài** giờ ca: trước `checkInTime` hoặc sau `checkOutTime` |
| Không có ca | Cho phép OT bất kỳ giờ nào |

- `totalHours` tính từ `endTime - startTime`; nếu `endTime < startTime` thì tự động cộng thêm 24h (OT qua đêm)
- Tối thiểu 0.5 giờ, tối đa 12 giờ/đơn

### Approver resolution

1. Nhân viên có `managerId` trực tiếp → giao cho manager đó
2. Không có manager trực tiếp → fallback gửi cho toàn bộ HR

- **HR không được duyệt** đơn OT — chỉ xem báo cáo (`403` nếu HR gọi PATCH approve/reject)
- **ADMIN** luôn có quyền duyệt
- **MANAGER/CHIEF** chỉ duyệt được đơn có `assignedApproverId` trỏ đến mình (hoặc đơn không được giao cho ai cụ thể)

---

## FCM Notifications

### Đăng ký device token

```
PATCH /v1/employees/me/fcm-token
{ "token": "<firebase_device_token>", "platform": "android" | "ios" }
```

Một nhân viên có thể đăng ký nhiều device token (đa thiết bị).

### Các sự kiện push notification

| Sự kiện | Nhận thông báo | `type` |
|---------|---------------|--------|
| Nhân viên tạo đơn OT mới | Approver được phân công | `overtime.new_request` |
| Đơn OT được duyệt | Nhân viên tạo đơn | `overtime.approved` |
| Đơn OT bị từ chối | Nhân viên tạo đơn | `overtime.rejected` |
| Đơn OT tự động huỷ (7 ngày) | Nhân viên tạo đơn | `overtime.auto_cancelled` |

**Payload FCM** kèm theo (trong `data` map):

```json
{
  "type": "overtime.approved",
  "notificationId": "42",
  "title": "Đơn OT đã được duyệt",
  "body": "Đơn OT 3.0h ngày 2026-05-20 đã được duyệt",
  "overtimeId": "15"
}
```

Lấy danh sách in-app notifications qua `/v1/notifications` (xem bridge doc riêng).

---

## Role-based Access

| Role | Xem đơn của mình | Xem đơn người khác | Tạo đơn | Duyệt/Từ chối | Báo cáo |
|------|:---:|:---:|:---:|:---:|:---:|
| `EMPLOYEE` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `MANAGER` | ✅ | ✅ phòng ban mình | ✅ | ✅ đơn được phân công | ✅ phòng ban mình |
| `CHIEF` | ✅ | ✅ phòng ban mình | ✅ | ✅ đơn được phân công | ✅ phòng ban mình |
| `HR` | ✅ | ✅ tất cả | ✅ | ❌ **bị chặn (403)** | ✅ tất cả |
| `ADMIN` | ✅ | ✅ tất cả | ✅ | ✅ tất cả | ✅ tất cả |

> `MANAGER`/`CHIEF` khi gọi `GET /overtime-requests` sẽ tự động bị filter về phòng ban của mình — không cần truyền `departmentId`.

---

## GET /v1/overtime-requests/me — Danh sách đơn OT của bản thân

**Query params:** `?status=PENDING&startDate=2026-05-01&endDate=2026-05-31&page=1&limit=20`

**Response:** `ApiPaginated<OvertimeRequestResponse>`

```json
{
  "success": true,
  "data": [
    {
      "id": 15,
      "overtimeDate": "2026-05-20",
      "startTime": "2026-05-20T11:00:00.000Z",
      "endTime": "2026-05-20T14:00:00.000Z",
      "totalHours": 3,
      "reason": "Hoàn thành dự án X trước deadline",
      "status": "PENDING",
      "reviewNote": null,
      "assignedApprover": { "id": 3, "fullName": "Trần Thị B" },
      "reviewedBy": null,
      "reviewedAt": null,
      "autoExpireAt": "2026-05-27T07:30:00.000Z",
      "deadlineAt": "2026-06-19T00:00:00.000Z",
      "isExpired": false,
      "employee": {
        "id": 4,
        "fullName": "Nguyễn Văn A",
        "employeeCode": "EMP004",
        "department": "Kỹ thuật"
      },
      "createdAt": "2026-05-20T07:30:00.000Z",
      "canBeCancelled": true,
      "hoursDisplay": "3.0 giờ"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## GET /v1/overtime-requests/me/stats — Thống kê OT của bản thân

**Query params:** `?month=5&year=2026` (**bắt buộc**)

**Response:** `ApiSuccess<OvertimeMyStats>`

```json
{
  "success": true,
  "data": {
    "month": 5,
    "year": 2026,
    "totalHours": 9.5,
    "countByStatus": {
      "PENDING": 1,
      "APPROVED": 3,
      "REJECTED": 0
    }
  }
}
```

---

## POST /v1/overtime-requests — Tạo đơn OT

**Request body:**

```json
{
  "overtimeDate": "2026-05-20",
  "startTime": "2026-05-20T11:00:00.000Z",
  "endTime": "2026-05-20T14:00:00.000Z",
  "reason": "Hoàn thành dự án X trước deadline"
}
```

**Lưu ý quan trọng:**
- `overtimeDate`: chỉ ngày `"YYYY-MM-DD"`, giờ không quan trọng
- `startTime`/`endTime`: phải là ISO 8601 datetime đầy đủ — giờ UTC
- `reason`: tối thiểu 10 ký tự
- OT qua đêm: `startTime` 23:00, `endTime` 02:00 ngày hôm sau → hợp lệ, `totalHours = 3`

**Response 201:** `ApiSuccess<OvertimeRequestResponse>`

---

## PATCH /v1/overtime-requests/:id/approve — Duyệt đơn

Không cần body.

**Response 200:** `ApiSuccess<OvertimeRequestResponse>` với `status: "APPROVED"`

**403** nếu HR gọi:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "HR không được phép duyệt đơn OT" } }
```

---

## PATCH /v1/overtime-requests/:id/reject — Từ chối đơn

**Request body:**
```json
{ "reviewNote": "Không có nhu cầu thực tế" }
```

**Response 200:** `ApiSuccess<OvertimeRequestResponse>` với `status: "REJECTED"`

---

## PATCH /v1/overtime-requests/:id/cancel — Thu hồi đơn

Chỉ chủ đơn được thu hồi, chỉ khi `status === 'PENDING'`.

**Response 200:** `ApiSuccess<OvertimeRequestResponse>` với `status: "CANCELLED"`

---

## GET /v1/overtime-requests/report — Báo cáo tháng

**Query params:** `?month=5&year=2026&departmentId=1` (`month` và `year` **bắt buộc**)

**Response:** `ApiSuccess<OvertimeMonthlyStatsResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn A",
      "departmentName": "Kỹ thuật",
      "totalRequests": 5,
      "approvedRequests": 3,
      "totalApprovedHours": 9.5,
      "pendingRequests": 1,
      "rejectedRequests": 1
    }
  ]
}
```

Endpoint giống nhau cũng có tại `/v1/reports/overtime` (xem bridge docs reports).

---

## Composable — useOvertimeRequests

```typescript
// composables/useOvertimeRequests.ts
import type {
  OvertimeRequestResponse,
  OvertimeMonthlyStatsResponse,
  CreateOvertimeRequestDto,
  RejectOvertimeDto,
  QueryOvertimeParams,
  QueryOvertimeReportParams,
} from '~/types/overtime.types';

export function useOvertimeRequests() {
  const { get, list, post, patch } = useFetch();

  const fetchMyRequests = (params?: QueryOvertimeParams) =>
    list<OvertimeRequestResponse>('/v1/overtime-requests/me', { params });

  const fetchMyStats = (month: number, year: number) =>
    get<{ month: number; year: number; totalHours: number; countByStatus: Record<string, number> }>(
      '/v1/overtime-requests/me/stats',
      { params: { month, year } },
    );

  const fetchAll = (params?: QueryOvertimeParams) =>
    list<OvertimeRequestResponse>('/v1/overtime-requests', { params });

  const fetchOne = (id: number) =>
    get<OvertimeRequestResponse>(`/v1/overtime-requests/${id}`);

  const createRequest = (dto: CreateOvertimeRequestDto) =>
    post<OvertimeRequestResponse>('/v1/overtime-requests', dto);

  const approve = (id: number) =>
    patch<OvertimeRequestResponse>(`/v1/overtime-requests/${id}/approve`);

  const reject = (id: number, dto: RejectOvertimeDto) =>
    patch<OvertimeRequestResponse>(`/v1/overtime-requests/${id}/reject`, dto);

  const cancel = (id: number) =>
    patch<OvertimeRequestResponse>(`/v1/overtime-requests/${id}/cancel`);

  const fetchReport = (params: QueryOvertimeReportParams) =>
    get<OvertimeMonthlyStatsResponse[]>('/v1/overtime-requests/report', { params });

  const exportReport = (params: QueryOvertimeReportParams) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return `/v1/overtime-requests/report/export?${q}`; // dùng trực tiếp làm href tải file
  };

  return {
    fetchMyRequests,
    fetchMyStats,
    fetchAll,
    fetchOne,
    createRequest,
    approve,
    reject,
    cancel,
    fetchReport,
    exportReport,
  };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| Tạo đơn OT > 30 ngày kể từ `overtimeDate` | **400** `"Đã quá 30 ngày kể từ ngày OT"` |
| `totalHours < 0.5` | **400** `"Thời gian OT tối thiểu 30 phút"` |
| `totalHours > 12` | **400** `"Thời gian OT tối đa 12 giờ/đơn"` |
| OT trong giờ ca (T2–T7) | **400** `"OT chỉ được đăng ký ngoài giờ ca..."` kèm tên ca |
| OT ngày Chủ nhật | ✅ Hợp lệ, không kiểm tra ca |
| Nhân viên không có ca làm việc | ✅ Hợp lệ, không kiểm tra giờ |
| `endTime < startTime` (qua đêm) | ✅ Hợp lệ — tự động `+24h` để tính `totalHours` |
| HR gọi `PATCH /:id/approve` | **403** `"HR không được phép duyệt đơn OT"` |
| MANAGER duyệt đơn không được phân công | **403** `"Chỉ trưởng phòng được phân công mới có thể xử lý đơn này"` |
| `PATCH /:id/reject` không có `reviewNote` | **400** `"Lý do từ chối là bắt buộc"` |
| Thu hồi đơn đã `APPROVED`/`REJECTED` | **400** `"Chỉ được thu hồi đơn đang chờ xử lý"` |
| Thu hồi đơn của người khác | **403** `"Chỉ được thu hồi đơn của chính mình"` |
| Đơn `PENDING` sau 7 ngày | Auto-cancel lúc 00:05 VN → `AUTO_CANCELLED`, email + FCM |
| `canBeCancelled = false` | `status !== 'PENDING'` — ẩn nút thu hồi trên UI |
