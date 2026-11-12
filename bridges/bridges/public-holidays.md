# Bridge Docs — Ngày lễ (`/v1/public-holidays`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/public-holidays` | Mọi role | Danh sách, có filter ?year=2026 |
| GET | `/v1/public-holidays/:id` | `ADMIN`, `HR` | Chi tiết một ngày lễ |
| POST | `/v1/public-holidays` | `ADMIN`, `HR` | Tạo 1 ngày lễ |
| POST | `/v1/public-holidays/range` | `ADMIN`, `HR` | Tạo khoảng nghỉ từ from_date đến to_date |
| POST | `/v1/public-holidays/bulk-year` | `ADMIN`, `HR` | Tạo nhanh ngày lễ cố định cho 1 năm |
| PATCH | `/v1/public-holidays/:id` | `ADMIN`, `HR` | Cập nhật ngày lễ |
| DELETE | `/v1/public-holidays/:id` | `ADMIN`, `HR` | Xóa ngày lễ — 204 No Content |

---

## TypeScript Types

```typescript
// types/public-holiday.types.ts

export interface PublicHolidayResponse {
  id: number;
  name: string;
  date: string;       // "YYYY-MM-DD"
  year: number;
  createdAt: string;  // ISO 8601 full datetime
}

// POST /public-holidays
export interface CreatePublicHolidayDto {
  name: string;   // 2–100 ký tự
  date: string;   // "YYYY-MM-DD" — server tự tính year
}

// PATCH /public-holidays/:id
export type UpdatePublicHolidayDto = Partial<CreatePublicHolidayDto>;

// POST /public-holidays/bulk-year — request
export interface BulkYearDto {
  year: number;   // 2000–2100
}

// POST /public-holidays/bulk-year — response
export interface BulkYearResponse {
  created: number;
  message: string;
}

// POST /public-holidays/range — request
export interface CreateHolidayRangeDto {
  name: string;       // 2–100 ký tự, áp dụng cho tất cả ngày trong khoảng
  fromDate: string;   // "YYYY-MM-DD"
  toDate: string;     // "YYYY-MM-DD", phải >= fromDate
}

// POST /public-holidays/range — response
export interface RangeResponse {
  created: number;  // số ngày được tạo mới
  skipped: number;  // số ngày đã tồn tại, bỏ qua
  message: string;
}
```

---

## GET /v1/public-holidays — Danh sách ngày lễ

**Query params:** `?year=2026` (optional — bỏ trống trả tất cả mọi năm)

**Response:** `ApiSuccess<PublicHolidayResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Tết Dương lịch",
      "date": "2026-01-01",
      "year": 2026,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Ngày Giải phóng miền Nam",
      "date": "2026-04-30",
      "year": 2026,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": 3,
      "name": "Ngày Quốc tế Lao động",
      "date": "2026-05-01",
      "year": 2026,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": 4,
      "name": "Quốc khánh",
      "date": "2026-09-02",
      "year": 2026,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": 5,
      "name": "Quốc khánh (ngày 2)",
      "date": "2026-09-03",
      "year": 2026,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## POST /v1/public-holidays — Tạo ngày lễ mới

**Request body:**

```json
{
  "name": "Giỗ Tổ Hùng Vương",
  "date": "2026-04-06"
}
```

**Các trường quan trọng:**
- `year` — **không truyền** — server tự tính từ `date`
- `date` — format `"YYYY-MM-DD"`, phải là ngày duy nhất (unique constraint)

**Response 201:** `ApiSuccess<PublicHolidayResponse>`

```json
{
  "success": true,
  "data": {
    "id": 6,
    "name": "Giỗ Tổ Hùng Vương",
    "date": "2026-04-06",
    "year": 2026,
    "createdAt": "2026-05-19T00:00:00.000Z"
  }
}
```

**409** nếu ngày đã tồn tại:

```json
{ "success": false, "error": { "code": "CONFLICT", "message": "Ngày này đã được đăng ký là ngày lễ" } }
```

---

## POST /v1/public-holidays/bulk-year — Tạo nhanh ngày lễ cố định

Tạo các ngày lễ cố định theo Bộ luật Lao động Việt Nam cho một năm. Idempotent — chạy nhiều lần không lỗi.

**Danh sách ngày lễ cố định được tạo tự động:**

| Ngày | Tên |
|------|-----|
| 01/01 | Tết Dương lịch |
| 30/04 | Ngày Giải phóng miền Nam |
| 01/05 | Ngày Quốc tế Lao động |
| 02/09 | Quốc khánh |
| 03/09 | Quốc khánh (ngày 2) |

> **Không tự tạo:** Tết Nguyên Đán, Giỗ Tổ Hùng Vương — vì là ngày âm lịch, HR phải nhập thủ công qua `POST /public-holidays`.

**Request body:**

```json
{ "year": 2026 }
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "created": 5,
    "message": "Đã tạo 5 ngày lễ cố định cho năm 2026"
  }
}
```

---

## POST /v1/public-holidays/range — Tạo khoảng nghỉ lễ

Nhận `name + fromDate + toDate`, tạo 1 record cho **mỗi ngày** trong khoảng đó. Idempotent — ngày đã tồn tại sẽ được bỏ qua (không lỗi).

Dùng cho: Tết Nguyên Đán, Tết Âm lịch nhiều ngày liên tiếp mà phải nhập thủ công từng năm.

**Request body:**

```json
{
  "name": "Tết Nguyên Đán",
  "fromDate": "2026-02-17",
  "toDate": "2026-02-23"
}
```

**Response 200:** `ApiSuccess<RangeResponse>`

```json
{
  "success": true,
  "data": {
    "created": 7,
    "skipped": 0,
    "message": "Đã tạo 7 ngày lễ (Tết Nguyên Đán) từ 2026-02-17 đến 2026-02-23"
  }
}
```

**400** nếu `toDate < fromDate`:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "toDate phải >= fromDate" } }
```

---

## PATCH /v1/public-holidays/:id — Cập nhật ngày lễ

Tất cả fields optional. Nếu cập nhật `date`, server tự recalculate `year`.

**Request body mẫu:**

```json
{
  "name": "Tết Dương lịch (nghỉ bù)",
  "date": "2026-01-02"
}
```

**Response 200:** `ApiSuccess<PublicHolidayResponse>`

---

## DELETE /v1/public-holidays/:id — Xóa ngày lễ

Hard delete (ngày lễ không phải entity chính của hệ thống).

**Response: 204 No Content**

**404** nếu không tồn tại:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Ngày lễ không tồn tại" } }
```

---

## Composable — usePublicHolidays

```typescript
// composables/usePublicHolidays.ts
import type {
  PublicHolidayResponse,
  CreatePublicHolidayDto,
  UpdatePublicHolidayDto,
  BulkYearDto,
  BulkYearResponse,
} from '~/types/public-holiday.types';

export function usePublicHolidays() {
  const { get, post, patch, del } = useFetch();

  const fetchHolidays = (year?: number) =>
    get<PublicHolidayResponse[]>('/v1/public-holidays', { params: year ? { year } : {} });

  const fetchHoliday = (id: number) =>
    get<PublicHolidayResponse>(`/v1/public-holidays/${id}`);

  const createHoliday = (dto: CreatePublicHolidayDto) =>
    post<PublicHolidayResponse>('/v1/public-holidays', dto);

  const bulkCreateForYear = (dto: BulkYearDto) =>
    post<BulkYearResponse>('/v1/public-holidays/bulk-year', dto);

  const createHolidayRange = (dto: CreateHolidayRangeDto) =>
    post<RangeResponse>('/v1/public-holidays/range', dto);

  const updateHoliday = (id: number, dto: UpdatePublicHolidayDto) =>
    patch<PublicHolidayResponse>(`/v1/public-holidays/${id}`, dto);

  const deleteHoliday = (id: number) =>
    del(`/v1/public-holidays/${id}`);

  return {
    fetchHolidays,
    fetchHoliday,
    createHoliday,
    createHolidayRange,
    bulkCreateForYear,
    updateHoliday,
    deleteHoliday,
  };
}
```

---

## Tích hợp với LeaveService

`PublicHolidayService.getHolidayDates(startDate, endDate)` được dùng bởi `LeaveService.calculateWorkingDays()`.

Khi tạo đơn nghỉ phép, `totalDays` được tính theo ngày làm việc thực tế (trừ thứ 7, Chủ nhật và ngày lễ):

```
Ví dụ: nghỉ từ 30/04/2026 (Thứ 5) đến 06/05/2026 (Thứ 4)
  Lịch: T5(30/4-lễ), T6(1/5-lễ), T7, CN, T2, T3, T4
  totalDays = 3  (chỉ tính T2, T3, T4 — T5 và T6 là ngày lễ, T7 và CN cuối tuần)
```

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `GET ?year=` bỏ trống | Trả tất cả ngày lễ mọi năm |
| Tạo ngày đã tồn tại | 409 Conflict |
| `bulk-year` năm đã có đủ 5 ngày | `created: 0`, không lỗi |
| `bulk-year` năm có 2/5 ngày | `created: 3` (tạo thêm 3 ngày còn thiếu) |
| `range` với fromDate = toDate | Tạo đúng 1 ngày |
| `range` toDate < fromDate | 400 Bad Request |
| `range` khoảng đã có một số ngày | `created` < tổng ngày, `skipped` > 0, không lỗi |
| Xóa ngày lễ | 204 No Content |
| Xóa ngày lễ không tồn tại | 404 Not Found |
| PATCH chỉ cập nhật name | year không thay đổi |
| PATCH cập nhật date sang ngày đã có | 409 Conflict |
