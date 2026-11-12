# Bridge Docs — Quản lý nhân viên (`/v1/employees`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/employees` | `ADMIN`, `HR` | Danh sách toàn bộ (có phân trang) |
| GET | `/v1/employees/me` | Mọi user đã đăng nhập | Thông tin bản thân |
| POST | `/v1/employees` | `ADMIN`, `HR` | Tạo nhân viên mới |
| GET | `/v1/employees/:id` | Bản thân, hoặc `ADMIN`/`HR`/`MANAGER` | Chi tiết một nhân viên |
| PATCH | `/v1/employees/:id` | `ADMIN`, `HR` | Cập nhật thông tin |
| DELETE | `/v1/employees/:id` | `ADMIN` | Vô hiệu hóa |

> **Lưu ý thứ tự route:** `/employees/me` được khai báo **trước** `/employees/:id` trong controller.  
> Nếu gọi `/employees/me` mà server trả 404 "employee not found", kiểm tra lại thứ tự route của router phía client.

---

## TypeScript Types

```typescript
// types/employee.types.ts
import type { SystemRole } from './auth.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type Gender = 'Nam' | 'Nữ' | 'Khác';

export interface DepartmentSummaryDto {
  id: number;
  name: string;
}

export interface PositionSummaryDto {
  id: number;
  name: string;
}

// Dùng trong GET /employees/:id và GET /employees/me
export interface EmployeeDetail {
  id: number;
  employeeCode: string;       // Auto-generated, format: "EMP001"
  fullName: string;
  email: string;
  phone: string | null;
  role: SystemRole;
  status: EmployeeStatus;
  joinDate: string;           // "YYYY-MM-DD" — chỉ ngày, không có giờ
  dateOfBirth: string | null; // "YYYY-MM-DD" — chỉ ngày, không có giờ
  gender: Gender | null;
  address: string | null;
  avatarUrl: string | null;
  department: DepartmentSummaryDto | null;
  position: PositionSummaryDto | null;
  createdAt: string;          // ISO 8601 full datetime
}

// Dùng trong GET /employees (list)
export interface EmployeeSummary {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  department: DepartmentSummaryDto | null;
  position: PositionSummaryDto | null;
  status: EmployeeStatus;
  role: SystemRole;
}

// Request DTOs
export interface CreateEmployeeDto {
  fullName: string;       // min 2, max 100 ký tự
  email: string;          // tự động lowercase + trim
  password: string;       // min 6 ký tự, hash server-side — KHÔNG trả ra response
  joinDate: string;       // "YYYY-MM-DD"
  role: SystemRole;
  departmentId?: number;
  positionId?: number;
  managerId?: number;
  phone?: string;         // định dạng số điện thoại Việt Nam
  dateOfBirth?: string;   // "YYYY-MM-DD"
  gender?: Gender;
  address?: string;
}

// UpdateEmployeeDto — tất cả optional, trừ email và password (không thể đổi qua endpoint này)
export type UpdateEmployeeDto = Partial<Omit<CreateEmployeeDto, 'email' | 'password'>>;

export interface QueryEmployeeParams {
  departmentId?: number;
  status?: EmployeeStatus;
  role?: SystemRole;
  search?: string;  // tìm theo fullName, email, hoặc employeeCode
  page?: number;    // default 1
  limit?: number;   // default 20, max 100
}
```

---

## GET /v1/employees — Danh sách nhân viên

**Query params:** `?departmentId=1&status=ACTIVE&role=EMPLOYEE&search=nguyen&page=1&limit=20`

**Response:** `ApiPaginated<EmployeeSummary>`

```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "email": "nguyen.a@company.com",
      "department": { "id": 1, "name": "Kỹ thuật" },
      "position": { "id": 2, "name": "Software Engineer" },
      "status": "ACTIVE",
      "role": "EMPLOYEE"
    },
    {
      "id": 5,
      "employeeCode": "EMP005",
      "fullName": "Trần Thị Bình",
      "email": "tran.b@company.com",
      "department": { "id": 1, "name": "Kỹ thuật" },
      "position": { "id": 4, "name": "Senior Engineer" },
      "status": "ACTIVE",
      "role": "EMPLOYEE"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

**403** nếu không phải HR hoặc ADMIN:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Forbidden resource" } }
```

---

## GET /v1/employees/me — Thông tin bản thân

Không cần truyền id — lấy từ JWT. Mọi user đã đăng nhập đều gọi được.

**Response:** `ApiSuccess<EmployeeDetail>`

```json
{
  "success": true,
  "data": {
    "id": 4,
    "employeeCode": "EMP004",
    "fullName": "Nguyễn Văn An",
    "email": "nguyen.a@company.com",
    "phone": "0901234567",
    "role": "EMPLOYEE",
    "status": "ACTIVE",
    "joinDate": "2022-01-10",
    "dateOfBirth": null,
    "gender": "Nam",
    "address": null,
    "avatarUrl": null,
    "department": { "id": 1, "name": "Kỹ thuật" },
    "position": { "id": 2, "name": "Software Engineer" },
    "createdAt": "2026-05-18T02:24:40.459Z"
  }
}
```

---

## GET /v1/employees/:id — Chi tiết một nhân viên

- Bản thân (`id == user.id`) → luôn được phép
- `ADMIN`, `HR`, `MANAGER` → được phép xem bất kỳ nhân viên nào
- `EMPLOYEE` xem người khác → **403**

**Response:** `ApiSuccess<EmployeeDetail>` — shape giống `/me`

**403:**
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Không có quyền xem thông tin nhân viên này" } }
```

**404:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên không tồn tại" } }
```

---

## POST /v1/employees — Tạo nhân viên mới

**Request body:**
```json
{
  "fullName": "Phạm Thị Cẩm",
  "email": "pham.c@company.com",
  "password": "Hr@123456",
  "joinDate": "2026-06-01",
  "role": "EMPLOYEE",
  "departmentId": 1,
  "positionId": 2,
  "managerId": 3,
  "phone": "0933123456",
  "dateOfBirth": "1995-04-20",
  "gender": "Nữ",
  "address": "TP. Hồ Chí Minh"
}
```

**Các trường quan trọng:**
- `employeeCode` — **không truyền** — server tự generate theo format `EMP001`, `EMP002`, ...
- `password` — plain text, server hash bcrypt 10 rounds — **không bao giờ trả ra response**
- `email` — tự động lowercase + trim trước khi lưu
- `joinDate` — format `"YYYY-MM-DD"` (không phải datetime)

**Response 201:** `ApiSuccess<EmployeeDetail>`

```json
{
  "success": true,
  "data": {
    "id": 6,
    "employeeCode": "EMP006",
    "fullName": "Phạm Thị Cẩm",
    "email": "pham.c@company.com",
    "phone": "0933123456",
    "role": "EMPLOYEE",
    "status": "ACTIVE",
    "joinDate": "2026-06-01",
    "dateOfBirth": "1995-04-20",
    "gender": "Nữ",
    "address": "TP. Hồ Chí Minh",
    "avatarUrl": null,
    "department": { "id": 1, "name": "Kỹ thuật" },
    "position": { "id": 2, "name": "Software Engineer" },
    "createdAt": "2026-05-18T10:00:00.000Z"
  }
}
```

**409** nếu email đã tồn tại:
```json
{ "success": false, "error": { "code": "CONFLICT", "message": "Email đã tồn tại" } }
```

---

## PATCH /v1/employees/:id — Cập nhật nhân viên

Tất cả fields optional. **Không thể đổi `email` hay `password`** qua endpoint này.

- Đổi password → `PATCH /v1/auth/change-password`
- Email không đổi được (unique key)

**Request body mẫu:**
```json
{
  "fullName": "Phạm Thị Cẩm Tú",
  "phone": "0933999888",
  "departmentId": 2,
  "positionId": 3,
  "managerId": 2
}
```

**Response 200:** `ApiSuccess<EmployeeDetail>` (shape đầy đủ)

---

## DELETE /v1/employees/:id — Vô hiệu hóa nhân viên

Soft delete — set `status = 'INACTIVE'`, không xóa dữ liệu.

**Response: 204 No Content**

**400** nếu đã inactive:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Nhân viên đã bị vô hiệu hóa" } }
```

---

## Composable — useEmployees

```typescript
// composables/useEmployees.ts
import type {
  EmployeeDetail,
  EmployeeSummary,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeeParams,
} from '~/types/employee.types';

export function useEmployees() {
  const { get, list, post, patch, del } = useFetch();

  const fetchEmployees = (params?: QueryEmployeeParams) =>
    list<EmployeeSummary>('/v1/employees', { params });

  const fetchMe = () =>
    get<EmployeeDetail>('/v1/employees/me');

  const fetchEmployee = (id: number) =>
    get<EmployeeDetail>(`/v1/employees/${id}`);

  const createEmployee = (dto: CreateEmployeeDto) =>
    post<EmployeeDetail>('/v1/employees', dto);

  const updateEmployee = (id: number, dto: UpdateEmployeeDto) =>
    patch<EmployeeDetail>(`/v1/employees/${id}`, dto);

  const deactivateEmployee = (id: number) =>
    del(`/v1/employees/${id}`);

  return {
    fetchEmployees,
    fetchMe,
    fetchEmployee,
    createEmployee,
    updateEmployee,
    deactivateEmployee,
  };
}
```

---

## Sự khác biệt giữa List và Detail

| Field | `EmployeeSummary` (list) | `EmployeeDetail` (detail / me) |
|-------|--------------------------|-------------------------------|
| `department` | `{ id, name } \| null` | `{ id, name } \| null` |
| `position` | `{ id, name } \| null` | `{ id, name } \| null` |
| `phone` | ❌ không có | `string \| null` |
| `gender` | ❌ không có | `'Nam' \| 'Nữ' \| 'Khác' \| null` |
| `address` | ❌ không có | `string \| null` |
| `dateOfBirth` | ❌ không có | `string \| null` |
| `joinDate` | ❌ không có | `string` |
| `avatarUrl` | ❌ không có | `string \| null` |
| `createdAt` | ❌ không có | `string` |

---

## Date format

Backend trả về 2 định dạng ngày khác nhau — **không đồng nhất** theo kiểu dữ liệu:

| Field | Format | Ví dụ |
|-------|--------|-------|
| `joinDate` | `YYYY-MM-DD` | `"2022-01-10"` |
| `dateOfBirth` | `YYYY-MM-DD` | `"1995-04-20"` |
| `createdAt` | ISO 8601 full | `"2026-05-18T02:24:40.459Z"` |
| `updatedAt` | ISO 8601 full | `"2026-05-18T02:24:40.459Z"` |

Khi gửi lên (`POST`/`PATCH`), `joinDate` và `dateOfBirth` phải dùng `"YYYY-MM-DD"`.

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `EMPLOYEE` gọi `GET /employees` | 403 Forbidden |
| `EMPLOYEE` gọi `GET /employees/:id` với id của chính mình | 200 OK |
| `EMPLOYEE` gọi `GET /employees/:id` với id người khác | 403 Forbidden |
| `MANAGER` gọi `GET /employees/:id` | 200 OK (có thể xem mọi nhân viên) |
| Tạo employee với email đã tồn tại | 409 Conflict |
| Deactivate employee đã INACTIVE | 400 Bad Request |
| `search=nguyen` | Tìm trong `fullName`, `email`, `employeeCode` |
| `status` không truyền | Trả cả ACTIVE lẫn INACTIVE |
