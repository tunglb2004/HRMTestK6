# API Response Envelope — Bridge Doc

> Swagger UI hiển thị **kiểu dữ liệu của controller** (trước interceptor), không phải payload thực sự trả về qua dây.  
> Đây là nguồn gốc gây nhầm lẫn. Tài liệu này mô tả đúng wire format.

---

## Tại sao có sự khác biệt

Mọi response đi qua `ResponseInterceptor` trước khi rời server:

```typescript
// src/common/interceptors/response.interceptor.ts
map((data) => ({
  success: true,
  ...(data?.data !== undefined ? data : { data }),
}))
```

Logic spread:
- Nếu controller trả về object **đã có** field `data` (vd: `{ data: [...], meta: {...} }`) → interceptor **spread** thẳng vào envelope.
- Nếu controller trả về object **chưa có** field `data` (vd: `AuthResponseDto`) → interceptor **bọc** vào `{ data: ... }`.

Kết quả: **mọi response thành công đều có shape `{ success: true, data: ... }`**, Swagger không thể hiện layer này.

---

## Ba dạng envelope

### 1. Single resource

Controller trả `SomeDto` (không có field `data`):

```
{ success: true, data: SomeDto }
```

**Ví dụ — `POST /v1/auth/login`:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "token": "eyJhbGci...",
    "refreshToken": "uuid-v4-string",
    "user": {
      "id": 2,
      "fullName": "Trần Thị HR",
      "email": "hr@company.com",
      "employeeCode": "EMP002",
      "role": "HR",
      "avatarUrl": null
    }
  }
}
```

> `accessToken` và `token` đều là access token. `token` được thêm để tương thích client cũ.

**Ví dụ — `GET /v1/auth/me`:**

```json
{
  "success": true,
  "data": {
    "id": 2,
    "fullName": "Trần Thị HR",
    "email": "hr@company.com",
    "employeeCode": "EMP002",
    "role": "HR",
    "avatarUrl": null,
    "permissions": [
      "employee:read",
      "employee:create",
      "department:read",
      "leave:read",
      "leave:approve"
    ]
  }
}
```

### 2. Paginated list

Controller trả `{ data: T[], meta: PaginationMeta }` → interceptor spread:

```
{ success: true, data: T[], meta: PaginationMeta }
```

**Ví dụ — `GET /v1/employees`:**

```json
{
  "success": true,
  "data": [
    { "id": 1, "fullName": "Nguyễn Văn An", "..." : "..." }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### 3. Error

Shape đồng nhất cho mọi lỗi:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Email hoặc mật khẩu không đúng"
  }
}
```

| HTTP | code |
|------|------|
| 400  | `BAD_REQUEST` |
| 401  | `UNAUTHORIZED` |
| 403  | `FORBIDDEN` |
| 404  | `NOT_FOUND` |
| 409  | `CONFLICT` |
| 500  | `INTERNAL_SERVER_ERROR` |

### 4. No Content (204)

Các endpoint dạng delete / logout trả `void` + `@HttpCode(204)`.  
HTTP 204 không có body — client không cần đọc response.

---

## TypeScript types (Nuxt / fetch.factory.ts)

```typescript
// types/api.types.ts

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiPaginated<T> {
  success: true;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export type ApiListResponse<T> = ApiPaginated<T> | ApiError;
```

---

## fetch.factory.ts — cách unwrap đúng

```typescript
// utils/fetch.factory.ts
import type { ApiSuccess, ApiPaginated, ApiError } from '~/types/api.types';

export function createFetch(baseURL: string, getToken: () => string | null) {
  const instance = $fetch.create({
    baseURL,
    headers: computed(() => {
      const token = getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    }),
    async onResponseError({ response }) {
      // response._data đã là parsed JSON — shape: { success: false, error: {...} }
      if (response.status === 401) {
        await navigateTo('/login');
      }
    },
  });

  // Single resource — trả về T (đã unwrap data)
  async function get<T>(path: string, opts?: Parameters<typeof instance>[1]) {
    const res = await instance<ApiSuccess<T>>(path, { method: 'GET', ...opts });
    return res.data;
  }

  // Paginated list — trả về { items: T[], meta }
  async function list<T>(path: string, opts?: Parameters<typeof instance>[1]) {
    const res = await instance<ApiPaginated<T>>(path, { method: 'GET', ...opts });
    return { items: res.data, meta: res.meta };
  }

  // POST / PATCH — trả về T (đã unwrap)
  async function post<T>(path: string, body: unknown, opts?: Parameters<typeof instance>[1]) {
    const res = await instance<ApiSuccess<T>>(path, { method: 'POST', body, ...opts });
    return res.data;
  }

  async function patch<T>(path: string, body: unknown, opts?: Parameters<typeof instance>[1]) {
    const res = await instance<ApiSuccess<T>>(path, { method: 'PATCH', body, ...opts });
    return res.data;
  }

  async function put<T>(path: string, body: unknown, opts?: Parameters<typeof instance>[1]) {
    const res = await instance<ApiSuccess<T>>(path, { method: 'PUT', body, ...opts });
    return res.data;
  }

  // DELETE — không có body trả về
  async function del(path: string, opts?: Parameters<typeof instance>[1]) {
    await instance(path, { method: 'DELETE', ...opts });
  }

  // Public (không cần auth) — dùng cho login, refresh
  const publicInstance = $fetch.create({ baseURL });

  async function publicPost<T>(path: string, body: unknown) {
    const res = await publicInstance<ApiSuccess<T>>(path, { method: 'POST', body });
    return res.data; // res.data là AuthResponseDto
  }

  return { get, list, post, patch, put, del, publicPost };
}
```

---

## Cách dùng trong auth.service.ts

```typescript
// services/auth.service.ts
import type { AuthResponseDto, MeResponseDto } from '~/types/auth.types';

export function useAuthApi() {
  const { publicPost, get } = useFetch(); // composable wrap createFetch

  async function login(email: string, password: string): Promise<AuthResponseDto> {
    // publicPost đã unwrap: trả về AuthResponseDto chứ không phải { success, data }
    return publicPost<AuthResponseDto>('/v1/auth/login', { email, password });
  }

  async function me(): Promise<MeResponseDto> {
    return get<MeResponseDto>('/v1/auth/me');
  }

  async function refresh(refreshToken: string): Promise<AuthResponseDto> {
    return publicPost<AuthResponseDto>('/v1/auth/refresh', { refreshToken });
  }

  return { login, me, refresh };
}
```

**Kết quả:**

```typescript
const authData = await login('hr@company.com', 'Hr@123456');
// authData.accessToken ✅ — đã unwrap, không phải authData.data.accessToken
// authData.token       ✅ — alias
// authData.user.id     ✅

const me = await me();
// me.permissions  ✅ — string[]
// me.role         ✅ — 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE'
```

---

## Checklist khi debug response

```
Response trả về gì?
  ├─ success: false → đọc error.code + error.message
  ├─ success: true + data là array → paginated, đọc meta.total
  └─ success: true + data là object → single resource

accessToken ở đâu sau login?
  response.data.accessToken  ✅
  response.accessToken       ❌ (flat structure không tồn tại)

fetch factory có unwrap không?
  Có — nếu dùng publicPost<AuthResponseDto>(...) thì kết quả là AuthResponseDto
  Không — nếu dùng $fetch thô thì phải tự đọc .data
```

---

## Lưu ý với Swagger

Swagger UI → **Try it out** → Execute sẽ thấy response thực tế có `success` + `data` wrapper.  
Schema panel bên phải chỉ hiển thị DTO của controller — **không phải wire format hoàn chỉnh**.  
Đây là giới hạn của cách Swagger + NestJS integrate, không phải lỗi API.
