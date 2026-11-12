# Bridge Docs — Loại phép (`/v1/leave-types`)

> Đọc [leave-requests.md](./leave-requests.md) để biết cách `leaveType.code` ảnh hưởng đến form tạo đơn.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/leave-types` | Mọi user đã đăng nhập | Chỉ trả loại đang `isActive = true`, sắp xếp A–Z |
| POST | `/v1/leave-types` | `HR`, `ADMIN` | Tạo loại phép mới |
| PATCH | `/v1/leave-types/:id` | `HR`, `ADMIN` | Cập nhật thông tin loại phép |
| PATCH | `/v1/leave-types/:id/deactivate` | `HR`, `ADMIN` | Tắt loại phép (soft delete) |

---

## TypeScript Types

```typescript
// types/leave.types.ts

export type LeaveTypeCode = 'ANNUAL' | 'HALF_DAY' | 'LATE' | 'EARLY' | string;

export interface LeaveType {
  id: number;
  name: string;
  code: LeaveTypeCode;
  daysPerYear: number | null;  // null = loại phép không giới hạn số ngày (HALF_DAY, LATE, EARLY)
  isPaid: boolean;
  isActive: boolean;
}

// Request DTOs
export interface CreateLeaveTypeDto {
  name: string;              // tối thiểu 2 ký tự, tối đa 100
  code: string;              // chỉ A-Z, số, dấu gạch dưới; bắt đầu bằng chữ hoa; tối đa 20 ký tự
  daysPerYear?: number | null; // nguyên dương nếu có giới hạn; null/bỏ trống = không giới hạn
  isPaid: boolean;
  isActive?: boolean;        // default true
}

export type UpdateLeaveTypeDto = Partial<CreateLeaveTypeDto>;
```

---

## GET /v1/leave-types — Danh sách loại phép

Trả tất cả loại phép đang active, sắp xếp theo tên A–Z.

**Response:** `ApiSuccess<LeaveType[]>` — mảng thẳng, không có `meta` phân trang.

```json
{
  "success": true,
  "data": [
    { "id": 3, "name": "Đi muộn",     "code": "LATE",     "daysPerYear": null, "isPaid": true, "isActive": true },
    { "id": 1, "name": "Nghỉ cả ngày","code": "ANNUAL",   "daysPerYear": 12,   "isPaid": true, "isActive": true },
    { "id": 2, "name": "Nghỉ nửa ngày","code": "HALF_DAY","daysPerYear": null, "isPaid": true, "isActive": true },
    { "id": 4, "name": "Về sớm",      "code": "EARLY",    "daysPerYear": null, "isPaid": true, "isActive": true }
  ]
}
```

---

## POST /v1/leave-types — Tạo loại phép (HR/Admin)

```json
{
  "name": "Nghỉ thai sản",
  "code": "MATERNITY",
  "daysPerYear": 180,
  "isPaid": true
}
```

**Response 201:** `ApiSuccess<LeaveType>`

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 409 | `code` đã tồn tại |
| 400 | Validation thất bại (code sai format, name quá ngắn...) |

---

## PATCH /v1/leave-types/:id — Cập nhật (HR/Admin)

Tất cả fields đều optional — chỉ gửi fields muốn thay đổi.

```json
{ "name": "Phép năm", "daysPerYear": 14 }
```

**Response 200:** `ApiSuccess<LeaveType>`

> Nếu đổi `code` sang một code đã tồn tại → 409.

---

## PATCH /v1/leave-types/:id/deactivate — Tắt loại phép (HR/Admin)

Không cần body. Set `isActive = false` — loại phép bị ẩn khỏi `GET /leave-types` nhưng vẫn còn trong DB.

**Response 200:** `ApiSuccess<LeaveType>` (isActive = false)

**400** nếu loại phép đã bị tắt trước đó.

> Để bật lại: dùng `PATCH /:id` với `{ "isActive": true }`.

---

## Ý nghĩa từng field

| Field | Mô tả |
|---|---|
| `code` | Định danh kỹ thuật — dùng để switch form phía frontend và để backend nhận biết loại phép đặc biệt (LATE/EARLY) |
| `daysPerYear` | Số ngày phép tối đa mỗi năm; `null` = không giới hạn, không kiểm tra balance |
| `isPaid` | `true` = nghỉ có hưởng lương (hiển thị badge) |
| `isActive` | `false` = ẩn khỏi danh sách (GET trả về chỉ active) |

---

## Dùng `code` để render form

```typescript
const selectedType = ref<LeaveType | null>(null);

const showHalfDayPicker = computed(() => selectedType.value?.code === 'HALF_DAY');
const showLateInput     = computed(() => selectedType.value?.code === 'LATE');
const showEarlyInput    = computed(() => selectedType.value?.code === 'EARLY');
const showDateRange     = computed(() => selectedType.value?.code === 'ANNUAL');
```

---

## Composable — useLeaveTypes

```typescript
// composables/useLeaveTypes.ts
import type { LeaveType, CreateLeaveTypeDto, UpdateLeaveTypeDto } from '~/types/leave.types';

export function useLeaveTypes() {
  const { get, post, patch } = useFetch();

  /** Tất cả role: danh sách loại phép đang active */
  const fetchLeaveTypes = () =>
    get<LeaveType[]>('/v1/leave-types');

  /** HR/Admin: tạo loại phép mới */
  const createLeaveType = (dto: CreateLeaveTypeDto) =>
    post<LeaveType>('/v1/leave-types', dto);

  /** HR/Admin: cập nhật thông tin loại phép */
  const updateLeaveType = (id: number, dto: UpdateLeaveTypeDto) =>
    patch<LeaveType>(`/v1/leave-types/${id}`, dto);

  /** HR/Admin: tắt loại phép (ẩn khỏi danh sách) */
  const deactivateLeaveType = (id: number) =>
    patch<LeaveType>(`/v1/leave-types/${id}/deactivate`);

  return { fetchLeaveTypes, createLeaveType, updateLeaveType, deactivateLeaveType };
}
```

---

## Seed data mặc định

Sau khi chạy `npx prisma db seed`, hệ thống có sẵn 4 loại phép:

| `code` | `name` | `daysPerYear` | Ghi chú |
|---|---|---|---|
| `ANNUAL` | Nghỉ cả ngày | `12` | Trừ ngày phép, kiểm tra balance |
| `HALF_DAY` | Nghỉ nửa ngày | `null` | Trừ 0.5 ngày, không giới hạn |
| `LATE` | Đi muộn | `null` | Không trừ ngày phép |
| `EARLY` | Về sớm | `null` | Không trừ ngày phép |

---

## Edge cases

| Tình huống | Kết quả |
|---|---|
| Tắt loại phép đang có đơn PENDING | Cho phép — đơn hiện tại vẫn xử lý được, chỉ ẩn khỏi form tạo mới |
| Đổi `daysPerYear` từ có giới hạn → null | Balance cũ vẫn còn trong DB; đơn mới sẽ không kiểm tra balance |
| `code` chứa chữ thường hoặc ký tự đặc biệt | 400 Validation failed |
| Bật lại loại phép đã tắt | `PATCH /:id` với `{ "isActive": true }` |
