# Bridge Docs — Quản lý chức vụ (`/v1/positions`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/positions` | Tất cả (authenticated) | Danh sách chức vụ, có phân trang + filter |
| POST | `/v1/positions` | `HR`, `ADMIN` | Tạo chức vụ mới |
| GET | `/v1/positions/:id` | Tất cả (authenticated) | Chi tiết một chức vụ |
| PATCH | `/v1/positions/:id` | `HR`, `ADMIN` | Cập nhật tên / phòng ban |
| DELETE | `/v1/positions/:id` | `ADMIN` only | Vô hiệu hóa (soft delete — set `isActive = false`) |

> `EMPLOYEE` và `MANAGER` **không thể** tạo, sửa, hay xóa chức vụ → **403**.  
> `DELETE` chỉ `ADMIN` — `HR` gọi → **403**.

---

## TypeScript Types

```typescript
// types/positions.types.ts

export interface PositionDepartment {
  id: number;
  name: string;
}

// Trả về từ GET /positions/:id, POST, PATCH, DELETE
export interface PositionResponse {
  id: number;
  name: string;             // "Software Engineer"
  isActive: boolean;        // false = đã vô hiệu hóa
  department: PositionDepartment;
  employeeCount: number;    // số nhân viên đang giữ chức vụ này
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}

// Trả về từ GET /positions (danh sách — gọn hơn)
export interface PositionSummaryResponse {
  id: number;
  name: string;
  department: string;       // tên phòng ban — string thuần, không phải object
  isActive: boolean;
  employeeCount: number;
}

// Query params cho GET /positions
export interface QueryPositionParams {
  departmentId?: number;  // lọc theo phòng ban
  search?: string;        // tìm theo tên chức vụ (case-insensitive, contains)
  isActive?: boolean;     // true = chỉ active | false = chỉ inactive | bỏ qua = tất cả
  page?: number;          // default 1
  limit?: number;         // default 20, max 100
}

// Body cho POST /v1/positions
export interface CreatePositionBody {
  name: string;        // 2–100 ký tự, bắt buộc
  departmentId: number; // bắt buộc, >= 1
}

// Body cho PATCH /v1/positions/:id  (mọi field đều optional)
export interface UpdatePositionBody {
  name?: string;
  departmentId?: number;
}
```

---

## GET /v1/positions — Danh sách chức vụ

**Query params:** `?page=1&limit=20&departmentId=1&isActive=true&search=engineer`

Kết quả sort theo `name` A-Z.  
`department` trong summary response là **string** (tên phòng ban), không phải object.

**Response:** `ApiSuccess<PositionSummaryResponse[]>` + `meta`

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "name": "Senior Engineer",
      "department": "Kỹ thuật",
      "isActive": true,
      "employeeCount": 2
    },
    {
      "id": 2,
      "name": "Software Engineer",
      "department": "Kỹ thuật",
      "isActive": true,
      "employeeCount": 5
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "totalPages": 1
  }
}
```

> Muốn lấy dropdown chọn chức vụ: gọi với `?isActive=true&limit=100` để lấy toàn bộ active positions.

---

## GET /v1/positions/:id — Chi tiết chức vụ

**Response:** `ApiSuccess<PositionResponse>`

```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Software Engineer",
    "isActive": true,
    "department": {
      "id": 1,
      "name": "Kỹ thuật"
    },
    "employeeCount": 5,
    "createdAt": "2025-01-10T07:00:00.000Z",
    "updatedAt": "2025-03-15T09:30:00.000Z"
  }
}
```

> `department` ở đây là **object** `{ id, name }` — khác với danh sách (string thuần).

---

## POST /v1/positions — Tạo chức vụ mới

**Roles:** `HR`, `ADMIN`

**Request body:**
```json
{
  "name": "DevOps Engineer",
  "departmentId": 1
}
```

**Response:** `ApiSuccess<PositionResponse>` — status **201**

```json
{
  "success": true,
  "data": {
    "id": 9,
    "name": "DevOps Engineer",
    "isActive": true,
    "department": {
      "id": 1,
      "name": "Kỹ thuật"
    },
    "employeeCount": 0,
    "createdAt": "2025-05-20T08:00:00.000Z",
    "updatedAt": "2025-05-20T08:00:00.000Z"
  }
}
```

---

## PATCH /v1/positions/:id — Cập nhật chức vụ

**Roles:** `HR`, `ADMIN`

Chỉ gửi field cần thay đổi — mọi field đều optional.

**Request body:**
```json
{
  "name": "Principal Engineer"
}
```

hoặc đổi cả tên lẫn phòng ban:
```json
{
  "name": "Sales Director",
  "departmentId": 4
}
```

**Response:** `ApiSuccess<PositionResponse>` — status **200** — trả về object sau khi cập nhật.

---

## DELETE /v1/positions/:id — Vô hiệu hóa chức vụ

**Roles:** `ADMIN` only

Không xóa khỏi database — chỉ set `isActive = false` (soft delete).  
Sau khi deactivate, chức vụ này vẫn xuất hiện khi query nếu không truyền `isActive=true`.

**Response:** status **204 No Content** — không có body.

> Gọi DELETE trên chức vụ đã `isActive = false` → **400** (`Chức vụ đã bị vô hiệu hóa`).

---

## Composable — usePositions

```typescript
// composables/usePositions.ts
import type {
  PositionResponse,
  PositionSummaryResponse,
  QueryPositionParams,
  CreatePositionBody,
  UpdatePositionBody,
} from '~/types/positions.types';

export function usePositions() {
  const fetchPositions = (params?: QueryPositionParams) =>
    $fetch<{ success: true; data: PositionSummaryResponse[]; meta: PaginationMeta }>(
      '/v1/positions',
      { params },
    );

  const fetchPosition = (id: number) =>
    $fetch<{ success: true; data: PositionResponse }>(`/v1/positions/${id}`).then(
      (r) => r.data,
    );

  const createPosition = (body: CreatePositionBody) =>
    $fetch<{ success: true; data: PositionResponse }>('/v1/positions', {
      method: 'POST',
      body,
    }).then((r) => r.data);

  const updatePosition = (id: number, body: UpdatePositionBody) =>
    $fetch<{ success: true; data: PositionResponse }>(`/v1/positions/${id}`, {
      method: 'PATCH',
      body,
    }).then((r) => r.data);

  const deactivatePosition = (id: number) =>
    $fetch(`/v1/positions/${id}`, { method: 'DELETE' });

  // Helper: lấy toàn bộ active positions cho dropdown
  const fetchActivePositions = (departmentId?: number) =>
    $fetch<{ success: true; data: PositionSummaryResponse[] }>('/v1/positions', {
      params: { isActive: true, limit: 100, departmentId },
    }).then((r) => r.data);

  return {
    fetchPositions,
    fetchPosition,
    createPosition,
    updatePosition,
    deactivatePosition,
    fetchActivePositions,
  };
}
```

---

## Lưu ý — Quan hệ với Employee

Khi tạo / cập nhật employee, truyền `positionId` vào body:

```json
// PATCH /v1/employees/:id
{
  "positionId": 3
}
```

Để bỏ chức vụ khỏi employee: truyền `"positionId": null`.  
`positionId` là **optional** trên employee — một nhân viên có thể không có chức vụ.

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `departmentId` không tồn tại khi tạo | **404** — `Phòng ban không tồn tại` |
| `name` < 2 ký tự hoặc > 100 ký tự | **400** — validation error |
| `id` không tồn tại | **404** — `Chức vụ không tồn tại` |
| Deactivate chức vụ đang `isActive = false` | **400** — `Chức vụ đã bị vô hiệu hóa` |
| `EMPLOYEE` / `MANAGER` gọi POST / PATCH | **403** |
| `HR` gọi DELETE | **403** — chỉ `ADMIN` được xóa |
| Không truyền `isActive` trong query | Trả về **cả** active lẫn inactive |
| `isActive=true` trong query string | Phải là string `"true"` — backend tự convert sang `boolean` |
| Chức vụ có `employeeCount > 0` bị deactivate | **204** — backend không chặn. Nhân viên đang giữ chức vụ đó **vẫn giữ nguyên `positionId`** trỏ vào chức vụ đã inactive. FE phải đọc `employeeCount` từ response GET trước khi gọi DELETE và hiển thị dialog xác nhận kiểu: *"Chức vụ này đang có N nhân viên. Vô hiệu hóa sẽ không tự động gỡ chức vụ khỏi các nhân viên đó."* |
