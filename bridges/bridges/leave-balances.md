# Bridge Docs — Số ngày phép (`/v1/leave-balances`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/leave-balances/me` | tất cả role | Số ngày phép còn lại của bản thân (năm hiện tại) |
| GET | `/v1/leave-balances` | `HR`, `ADMIN` | Toàn bộ balance (có filter + phân trang) |
| POST | `/v1/leave-balances/bulk-init/employee/:employeeId` | `HR`, `ADMIN` | Khởi tạo phép cho một nhân viên (dùng khi onboard) |
| POST | `/v1/leave-balances/bulk-init` | `HR`, `ADMIN` | Khởi tạo hàng loạt cho tất cả NV × loại phép |
| POST | `/v1/leave-balances` | `HR`, `ADMIN` | Cấp phát số ngày phép cho một nhân viên |
| PATCH | `/v1/leave-balances/:id` | `HR`, `ADMIN` | Điều chỉnh `totalDays` (ghi đè) |

> **Lưu ý thứ tự route:** `/leave-balances/me` và `/leave-balances/bulk-init` được khai báo trước `/leave-balances/:id`.

---

## TypeScript Types

```typescript
// types/leave.types.ts

export interface LeaveBalanceTypeRef {
  id: number;
  name: string;
  code: string;  // 'ANNUAL' | 'HALF_DAY' | 'LATE' | 'EARLY' | ...
}

// Response cho EMPLOYEE (/me)
export interface LeaveBalance {
  id: number;
  leaveType: LeaveBalanceTypeRef;
  year: number;           // năm dương lịch, ví dụ 2026
  totalDays: number;      // tổng ngày phép được cấp trong năm
  usedDays: number;       // số ngày đã dùng (đã approve)
  remainingDays: number;  // computed = totalDays - usedDays (backend tính sẵn)
}

// Response cho HR/Admin (GET all + POST + PATCH)
export interface LeaveBalanceAdmin {
  id: number;
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    department: string | null;  // tên phòng ban
  };
  leaveType: LeaveBalanceTypeRef;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

// Request DTO
export interface InitEmployeeLeaveBalanceDto {
  year?: number; // bỏ trống → năm hiện tại
}

export interface BulkInitLeaveBalanceDto {
  year: number;           // năm cấp phát (>= 2020)
  leaveTypeIds?: number[]; // bỏ trống → tất cả loại phép có daysPerYear != null
  employeeIds?: number[];  // bỏ trống → tất cả nhân viên ACTIVE
}

export interface BulkInitResult {
  created: number;  // số bản ghi mới
  skipped: number;  // số bản ghi đã tồn tại
  total: number;    // tổng cặp (employee × leaveType)
}

export interface CreateLeaveBalanceDto {
  employeeId: number;   // ID nhân viên
  leaveTypeId: number;  // ID loại phép (phải có daysPerYear != null)
  year: number;         // năm cấp phát (>= 2020)
  totalDays: number;    // số ngày phép (>= 0)
}

export interface AdjustLeaveBalanceDto {
  totalDays: number;  // ghi đè giá trị cũ (>= 0)
  note?: string;      // lý do điều chỉnh (tối đa 200 ký tự)
}

export interface QueryLeaveBalanceParams {
  year: number;          // bắt buộc
  page?: number;         // default 1
  limit?: number;        // default 20, max 100
  employeeId?: number;
  departmentId?: number;
  leaveTypeId?: number;
}
```

---

## GET /v1/leave-balances/me — Số ngày phép của tôi

Trả balance của tất cả loại phép có `daysPerYear != null` cho user hiện tại, trong năm hiện tại.

> Loại phép không giới hạn (`daysPerYear = null`) như HALF_DAY, LATE, EARLY **không có record** trong bảng `leave_balances` và sẽ không xuất hiện ở đây.

**Response:** `ApiSuccess<LeaveBalance[]>` — mảng thẳng, không có `meta` phân trang.

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "leaveType": { "id": 1, "name": "Nghỉ cả ngày", "code": "ANNUAL" },
      "year": 2026,
      "totalDays": 12,
      "usedDays": 3,
      "remainingDays": 9
    }
  ]
}
```

---

## GET /v1/leave-balances — Toàn bộ balance (HR/Admin)

**Query params:** `?year=2026&employeeId=4&departmentId=1&leaveTypeId=1&page=1&limit=20`

`year` là **bắt buộc**. Các params còn lại optional.

**Response:** `ApiPaginated<LeaveBalanceAdmin>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004", "department": "Kỹ thuật" },
      "leaveType": { "id": 1, "name": "Nghỉ cả ngày", "code": "ANNUAL" },
      "year": 2026,
      "totalDays": 12,
      "usedDays": 3,
      "remainingDays": 9
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

---

## POST /v1/leave-balances/bulk-init/employee/:employeeId — Khởi tạo cho nhân viên mới (HR/Admin)

Cấp phát tất cả loại phép có `daysPerYear != null` cho một nhân viên cụ thể.  
Dùng ngay sau khi tạo nhân viên mới (onboarding). **Idempotent** — chạy lại không bị lỗi.

```http
POST /v1/leave-balances/bulk-init/employee/6
Content-Type: application/json

{}
```

`year` mặc định là năm hiện tại, có thể override:

```json
{ "year": 2026 }
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "created": 3,
    "skipped": 0,
    "total": 3
  }
}
```

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Nhân viên không ở trạng thái ACTIVE |
| 404 | Nhân viên không tồn tại |

> `totalDays` lấy từ `leaveType.daysPerYear`. Nếu nhân viên gia nhập giữa năm và cần điều chỉnh số ngày, dùng `PATCH /leave-balances/:id` sau khi init.

---

## POST /v1/leave-balances/bulk-init — Khởi tạo hàng loạt (HR/Admin)

Tạo bản ghi balance cho toàn bộ nhân viên ACTIVE × toàn bộ loại phép có `daysPerYear != null`.  
Dùng đầu năm để khởi tạo phép cho cả công ty trong một lần gọi. **Idempotent** — chạy lại không bị lỗi.

```json
{
  "year": 2026
}
```

Có thể giới hạn phạm vi bằng `leaveTypeIds` hoặc `employeeIds`:

```json
{
  "year": 2026,
  "leaveTypeIds": [1],
  "employeeIds": [4, 5, 6]
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "created": 45,
    "skipped": 5,
    "total": 50
  }
}
```

| Field | Ý nghĩa |
|---|---|
| `created` | Số bản ghi mới được tạo |
| `skipped` | Số cặp (employee, leaveType, year) đã tồn tại, bỏ qua |
| `total` | Tổng số cặp xử lý = số NV × số loại phép |

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Một `leaveTypeId` trong danh sách có `daysPerYear = null` |
| 404 | Một `leaveTypeId` không tồn tại |

> `totalDays` của mỗi bản ghi được lấy từ `leaveType.daysPerYear` (ví dụ: ANNUAL → 12). HR có thể dùng `PATCH /:id` để điều chỉnh sau.

---

## POST /v1/leave-balances — Cấp phát số ngày phép (HR/Admin)

Tạo bản ghi balance cho một nhân viên. Mỗi cặp `(employeeId, leaveTypeId, year)` chỉ được tạo **một lần**.

```json
{
  "employeeId": 4,
  "leaveTypeId": 1,
  "year": 2026,
  "totalDays": 12
}
```

**Response 201:** `ApiSuccess<LeaveBalanceAdmin>`

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Loại phép không giới hạn (LATE/EARLY/HALF_DAY) — không cần cấp phát |
| 404 | Loại phép không tồn tại |
| 409 | Đã có bản ghi balance cho cặp (employee, leaveType, year) này |

---

## PATCH /v1/leave-balances/:id — Điều chỉnh totalDays (HR/Admin)

Ghi đè `totalDays`. Dùng khi HR cần bổ sung phép thâm niên, hoặc sửa sai.

```json
{
  "totalDays": 14,
  "note": "Bổ sung phép thâm niên 5 năm"
}
```

**Response 200:** `ApiSuccess<LeaveBalanceAdmin>`

> `usedDays` **không bị thay đổi**. Nếu `totalDays` mới < `usedDays` hiện tại → `remainingDays` sẽ âm. Frontend nên hiển thị cảnh báo.

---

## Khi nào balance thay đổi?

| Sự kiện | Thay đổi |
|---|---|
| HR approve đơn `ANNUAL` | `usedDays` tăng theo `totalDays` của đơn |
| Employee tạo đơn (PENDING) | Balance **chưa thay đổi** — chỉ bị trừ khi approve |
| Employee thu hồi / HR từ chối đơn PENDING | Balance không đổi (chưa trừ) |
| HR dùng `PATCH /:id` | Chỉ `totalDays` thay đổi, `usedDays` giữ nguyên |

---

## Hiển thị trên UI

```typescript
// Thanh progress ngày phép
const percentage = computed(() =>
  balance.totalDays > 0
    ? Math.round((balance.usedDays / balance.totalDays) * 100)
    : 0,
);
// remainingDays luôn >= 0 sau khi tạo đơn thành công
// (backend kiểm tra balance trước khi cho tạo đơn)
```

---

## Composable — useLeaveBalances

```typescript
// composables/useLeaveBalances.ts
import type {
  LeaveBalance,
  LeaveBalanceAdmin,
  CreateLeaveBalanceDto,
  AdjustLeaveBalanceDto,
  QueryLeaveBalanceParams,
} from '~/types/leave.types';

export function useLeaveBalances() {
  const { get, list, post, patch } = useFetch();

  /** Tất cả role: số ngày phép còn lại của bản thân (năm hiện tại) */
  const fetchMyBalance = () =>
    get<LeaveBalance[]>('/v1/leave-balances/me');

  /** HR/Admin: toàn bộ balance (year là bắt buộc) */
  const fetchAllBalances = (params: QueryLeaveBalanceParams) =>
    list<LeaveBalanceAdmin>('/v1/leave-balances', { params });

  /** HR/Admin: khởi tạo phép cho nhân viên mới (idempotent) */
  const initBalancesForEmployee = (employeeId: number, dto: InitEmployeeLeaveBalanceDto = {}) =>
    post<BulkInitResult>(`/v1/leave-balances/bulk-init/employee/${employeeId}`, dto);

  /** HR/Admin: khởi tạo hàng loạt đầu năm (idempotent) */
  const bulkInitBalances = (dto: BulkInitLeaveBalanceDto) =>
    post<BulkInitResult>('/v1/leave-balances/bulk-init', dto);

  /** HR/Admin: cấp phát số ngày phép cho một nhân viên */
  const createBalance = (dto: CreateLeaveBalanceDto) =>
    post<LeaveBalanceAdmin>('/v1/leave-balances', dto);

  /** HR/Admin: điều chỉnh totalDays (ghi đè) */
  const adjustBalance = (id: number, dto: AdjustLeaveBalanceDto) =>
    patch<LeaveBalanceAdmin>(`/v1/leave-balances/${id}`, dto);

  return { fetchMyBalance, fetchAllBalances, initBalancesForEmployee, bulkInitBalances, createBalance, adjustBalance };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|---|---|
| Employee chưa có record balance (HR chưa tạo) | `GET /me` trả mảng rỗng `[]` |
| Tạo đơn ANNUAL khi balance record không tồn tại | 400 `LEAVE_INSUFFICIENT_BALANCE` |
| `remainingDays` bằng 0 | Vẫn trả về trong response; tạo đơn mới → 400 |
| HALF_DAY / LATE / EARLY | `daysPerYear = null` → không có record balance, `POST /leave-balances` trả 400 |
| POST với cặp (employee, leaveType, year) đã tồn tại | 409 Conflict |
| PATCH `totalDays` xuống thấp hơn `usedDays` | Backend cho phép, `remainingDays` âm — frontend nên cảnh báo |
