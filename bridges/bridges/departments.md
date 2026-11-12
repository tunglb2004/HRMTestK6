# Bridge Docs — Quản lý phòng ban (`/v1/departments`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/v1/departments` | JWT | — |
| POST | `/v1/departments` | JWT | `ADMIN` system role |
| GET | `/v1/departments/:id` | JWT | — |
| PATCH | `/v1/departments/:id` | JWT | `ADMIN` system role |
| DELETE | `/v1/departments/:id` | JWT | `ADMIN` system role |

---

## TypeScript Types

```typescript
// types/department.types.ts

export interface ManagerSummaryDto {
  id: number;
  fullName: string;
  email: string;
}

// Dùng trong GET /departments/:id
export interface DepartmentDetail {
  id: number;
  name: string;
  isActive: boolean;
  manager: ManagerSummaryDto | null;
  employeeCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// Dùng trong GET /departments (list)
export interface DepartmentSummary {
  id: number;
  name: string;
  isActive: boolean;
  employeeCount: number;
}

// Request DTOs
export interface CreateDepartmentDto {
  name: string;          // min 2, max 100 ký tự
  managerId?: number;    // ID nhân viên làm trưởng phòng
}

export type UpdateDepartmentDto = Partial<CreateDepartmentDto>;

export interface QueryDepartmentParams {
  search?: string;    // tìm theo tên (case-insensitive)
  isActive?: boolean; // filter theo trạng thái
  page?: number;      // default 1
  limit?: number;     // default 20, max 100
}
```

---

## GET /v1/departments — Danh sách phòng ban

**Query params:** `?search=kỹ&isActive=true&page=1&limit=20`

**Response:** `ApiPaginated<DepartmentSummary>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Kỹ thuật",
      "isActive": true,
      "employeeCount": 5
    },
    {
      "id": 2,
      "name": "Nhân sự",
      "isActive": true,
      "employeeCount": 2
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 4,
    "totalPages": 1
  }
}
```

> `isActive` mặc định **không filter** — trả cả active lẫn inactive.  
> Truyền `?isActive=true` để chỉ lấy phòng ban đang hoạt động.

---

## GET /v1/departments/:id — Chi tiết phòng ban

**Response:** `ApiSuccess<DepartmentDetail>`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Kỹ thuật",
    "isActive": true,
    "manager": {
      "id": 3,
      "fullName": "Lê Văn Manager",
      "email": "manager.tech@company.com"
    },
    "employeeCount": 5,
    "createdAt": "2026-05-18T02:24:40.459Z",
    "updatedAt": "2026-05-18T02:24:40.459Z"
  }
}
```

> `manager` là `null` nếu phòng ban chưa có trưởng phòng.

**404:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Phòng ban không tồn tại" } }
```

---

## POST /v1/departments — Tạo phòng ban

**Request body:**
```json
{
  "name": "Marketing",
  "managerId": 4
}
```

- `managerId` optional — có thể tạo phòng ban trước, gán manager sau qua PATCH.

**Response 201:** `ApiSuccess<DepartmentDetail>`

```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "Marketing",
    "isActive": true,
    "manager": {
      "id": 4,
      "fullName": "Nguyễn Văn An",
      "email": "nguyen.a@company.com"
    },
    "employeeCount": 0,
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  }
}
```

**403** nếu không phải ADMIN:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Forbidden resource" } }
```

---

## PATCH /v1/departments/:id — Cập nhật phòng ban

**Request body** — tất cả fields đều optional:
```json
{
  "name": "Marketing & Communications",
  "managerId": 5
}
```

> Để xóa manager: truyền `"managerId": null` (nếu backend hỗ trợ) — hiện tại backend chỉ nhận số nguyên dương, muốn clear manager thì cần trao đổi thêm với backend team.

**Response 200:** `ApiSuccess<DepartmentDetail>` (shape giống GET /:id)

---

## DELETE /v1/departments/:id — Vô hiệu hóa phòng ban

Soft delete — set `isActive = false`, không xóa dữ liệu.

**Response: 204 No Content** (không có body)

> Phòng ban sau khi deactivate vẫn xuất hiện trong list nếu không filter `?isActive=true`.  
> Nhân viên thuộc phòng ban này không bị ảnh hưởng.

---

## Composable — useDepartments

```typescript
// composables/useDepartments.ts
import type {
  DepartmentDetail,
  DepartmentSummary,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  QueryDepartmentParams,
} from '~/types/department.types';

export function useDepartments() {
  const { get, list, post, patch, del } = useFetch();

  const fetchDepartments = (params?: QueryDepartmentParams) =>
    list<DepartmentSummary>('/v1/departments', { params });

  const fetchDepartment = (id: number) =>
    get<DepartmentDetail>(`/v1/departments/${id}`);

  const createDepartment = (dto: CreateDepartmentDto) =>
    post<DepartmentDetail>('/v1/departments', dto);

  const updateDepartment = (id: number, dto: UpdateDepartmentDto) =>
    patch<DepartmentDetail>(`/v1/departments/${id}`, dto);

  const deactivateDepartment = (id: number) =>
    del(`/v1/departments/${id}`);

  return {
    fetchDepartments,
    fetchDepartment,
    createDepartment,
    updateDepartment,
    deactivateDepartment,
  };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `GET /departments` không truyền `isActive` | Trả cả active và inactive |
| `GET /departments?isActive=true` | Chỉ phòng ban đang hoạt động |
| `GET /departments/:id` với id không tồn tại | 404 |
| `POST` với `managerId` không tồn tại | 400 Bad Request |
| `DELETE` phòng ban đã inactive | Vẫn thành công (idempotent) |
| Nhân viên list — `department` field | Chỉ có `{ id, name }`, không có `isActive` hay `employeeCount` |
