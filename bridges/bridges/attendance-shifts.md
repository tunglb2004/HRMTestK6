# Bridge Docs — Ca làm việc & Lịch ca (`/v1/work-shifts`, `/v1/shift-schedules`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture.

---

## Endpoints

### Nhóm 1 — WorkShift (khuôn ca cố định)

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/work-shifts` | Mọi authenticated | Danh sách tất cả ca |
| POST | `/v1/work-shifts` | `ADMIN`, `HR` | Tạo ca mới |
| PATCH | `/v1/work-shifts/:id` | `ADMIN`, `HR` | Cập nhật thông tin ca |
| DELETE | `/v1/work-shifts/:id` | `ADMIN`, `HR` | Vô hiệu hóa ca (soft delete) |

### Nhóm 2 — ShiftSchedule (gán ca theo ngày)

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/shift-schedules/me` | `EMPLOYEE` | Lịch ca của tôi (mặc định: tuần hiện tại) |
| GET | `/v1/shift-schedules/calendar` | `ADMIN`, `HR` | Calendar view theo ngày (tối đa 31 ngày) |
| GET | `/v1/shift-schedules` | `ADMIN`, `HR` | Lịch ca toàn công ty |
| POST | `/v1/shift-schedules` | `ADMIN`, `HR` | Gán ca 1 ngày cho 1 nhân viên |
| POST | `/v1/shift-schedules/bulk` | `ADMIN`, `HR` | Gán ca hàng loạt (tối đa 100 mục) |
| POST | `/v1/shift-schedules/bulk-online-saturday` | `ADMIN`, `HR` | Gán Ca online T7 cho nhiều nhân viên trong 1 tháng |
| PATCH | `/v1/shift-schedules/employees/:employeeId/default-shift` | `ADMIN`, `HR` | Gán ca mặc định hàng ngày |
| DELETE | `/v1/shift-schedules/:employeeId/:date` | `ADMIN`, `HR` | Xóa lịch ca theo ngày |

> **Lưu ý thứ tự route:** Các segment tĩnh (`me`, `calendar`, `bulk`) được khai báo **trước** các segment có param (`/:id`, `/:employeeId/:date`) trong controller để NestJS không nhầm route.

---

## TypeScript Types

```typescript
// types/shift.types.ts

// ─── WorkShift ─────────────────────────────────────────────────────────────

// Response từ GET /work-shifts, POST /work-shifts, PATCH /work-shifts/:id
export interface WorkShiftResponse {
  id: number;
  name: string;
  checkInTime: string;        // "HH:mm" UTC — ví dụ "08:00"
  checkOutTime: string;       // "HH:mm" UTC — ví dụ "17:00"
  lateThresholdMin: number;   // Số phút trễ được phép, mặc định 15
  earlyThresholdMin: number;  // Số phút về sớm được phép, mặc định 15
  workDays: number[];         // 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
  isOnline: boolean;          // true = ca online, không yêu cầu GPS check-in
  isActive: boolean;
  createdAt: string;          // ISO 8601
}

// POST /work-shifts request
export interface CreateWorkShiftDto {
  name: string;
  checkInTime: string;         // "HH:mm"
  checkOutTime: string;        // "HH:mm"
  lateThresholdMin?: number;   // 0–60, mặc định 15
  earlyThresholdMin?: number;  // 0–60, mặc định 15
  workDays: number[];          // 0=CN, 1=T2, ..., 6=T7
  isOnline?: boolean;          // mặc định false
}

// PATCH /work-shifts/:id — mọi field đều optional
export type UpdateWorkShiftDto = Partial<CreateWorkShiftDto>;

// ─── ShiftSchedule ─────────────────────────────────────────────────────────

// Shape của object "shift" lồng trong ShiftScheduleResponse
export interface WorkShiftSummary {
  id: number;
  name: string;
  checkInTime: string;   // "HH:mm"
  checkOutTime: string;  // "HH:mm"
  workDays: number[];    // 0=CN, 1=T2, ..., 6=T7
}

// Response từ GET /shift-schedules và GET /shift-schedules/me
export interface ShiftScheduleResponse {
  id: number;
  date: string;    // "YYYY-MM-DD"
  isOnline: boolean;  // true = lịch gán này là online (không cần GPS check-in)
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
  };
  shift: WorkShiftSummary;
}

// POST /shift-schedules request
export interface AssignShiftDto {
  employeeId: number;
  shiftId: number;
  date: string;      // "YYYY-MM-DD"
  isOnline?: boolean;  // mặc định false
}

// POST /shift-schedules/bulk request
export interface BulkAssignShiftDto {
  assignments: AssignShiftDto[];  // tối đa 100 phần tử
}

// POST /shift-schedules/bulk-online-saturday request
export interface BulkOnlineSaturdayDto {
  month: number;        // 1–12
  year: number;         // >= 2020
  employeeIds: number[];
  shiftId: number;      // ID của "Ca online T7"
}

// PATCH /shift-schedules/employees/:id/default-shift request
export interface SetDefaultShiftDto {
  shiftId: number;
}

// Query params cho GET /shift-schedules và GET /shift-schedules/me
export interface QueryShiftScheduleParams {
  employeeId?: number;
  departmentId?: number;
  startDate?: string;  // "YYYY-MM-DD" — mặc định đầu tuần hiện tại
  endDate?: string;    // "YYYY-MM-DD" — mặc định cuối tuần hiện tại
}

// ─── Calendar ──────────────────────────────────────────────────────────────

// Query params cho GET /shift-schedules/calendar
export interface QueryCalendarParams {
  startDate: string;    // "YYYY-MM-DD" — bắt buộc
  endDate: string;      // "YYYY-MM-DD" — bắt buộc, tối đa 31 ngày từ startDate
  departmentId?: number;
  employeeId?: number;
}

export interface CalendarShift {
  id: number;
  name: string;
  checkInTime: string;   // "HH:mm"
  checkOutTime: string;  // "HH:mm"
}

export interface CalendarDayEmployee {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  department: string | null;
  shift: CalendarShift | null;  // null = không có ca nào (không có default, không có override)
  isDefault: boolean;           // true = đang dùng defaultShift, false = override theo ngày cụ thể
}

// Response từ GET /shift-schedules/calendar
export interface CalendarDayResponse {
  date: string;  // "YYYY-MM-DD"
  employees: CalendarDayEmployee[];
}
```

> **Quan trọng về `checkInTime`/`checkOutTime`:**  
> Server lưu dạng `TIME WITHOUT TIME ZONE` trong PostgreSQL (`@db.Time`), trả về string `"HH:mm"` đã format theo UTC.  
> Dùng trực tiếp để hiển thị — không cần parse thêm.

> **`workDays` convention:** `0 = Chủ nhật`, `1 = Thứ 2`, `2 = Thứ 3`, ..., `6 = Thứ 7`.  
> Ví dụ: `[1, 2, 3, 4, 5]` = Thứ 2 đến Thứ 6. `[0]` = Chủ nhật.

---

## Hiểu về luồng ca làm việc

```
WorkShift (khuôn ca — HR tạo, cố định)
    │
    ├──► Employee.defaultShiftId
    │         Ca áp dụng mọi ngày nếu không có override cụ thể
    │
    └──► EmployeeShiftSchedule (override ca cho 1 ngày cụ thể)
              │
              ▼
         Server resolve khi employee check-in:
         1. Có EmployeeShiftSchedule cho ngày hôm nay? → dùng ca đó
         2. Không có? → dùng Employee.defaultShiftId
         3. Không có cả hai? → NO_SHIFT_TODAY (check-in thất bại)
              │
              ▼ (nếu tìm được ca)
         EffectiveShiftOverride
              Hệ thống tự tạo khi HR duyệt đơn nghỉ nửa ngày
              Thu hẹp cửa sổ giờ làm việc (sáng hoặc chiều)
              Frontend chỉ đọc — không tạo trực tiếp
              │
              ▼
         AttendanceRecord
              isHalfDay: true  → có EffectiveShiftOverride
              isHalfDay: false → ca bình thường
```

**Frontend cần làm:**
- Gọi `GET /work-shifts` để populate dropdown khi tạo/gán ca
- Gọi `GET /shift-schedules/me` để hiển thị lịch ca tuần này (EMPLOYEE)
- Gọi `GET /shift-schedules/calendar` để render calendar view (HR)
- HR gọi `POST /shift-schedules` hoặc `POST /shift-schedules/bulk` để gán ca
- HR gọi `PATCH .../default-shift` để gán ca mặc định cho nhân viên mới
- `EffectiveShiftOverride` — **không thao tác trực tiếp** — đọc qua `isHalfDay`/`effectiveStart`/`effectiveEnd` trong `AttendanceRecord`

---

## GET /v1/work-shifts — Danh sách ca làm việc

Mọi authenticated user được gọi.

**Response:** `ApiSuccess<WorkShiftResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Ca hành chính",
      "checkInTime": "08:00",
      "checkOutTime": "17:00",
      "lateThresholdMin": 15,
      "earlyThresholdMin": 15,
      "workDays": [1, 2, 3, 4, 5],
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Ca chiều",
      "checkInTime": "13:00",
      "checkOutTime": "22:00",
      "lateThresholdMin": 10,
      "earlyThresholdMin": 10,
      "workDays": [1, 2, 3, 4, 5, 6],
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## POST /v1/work-shifts — Tạo ca mới

Chỉ `ADMIN` và `HR` được gọi.

**Request body:**
```json
{
  "name": "Ca sáng sớm",
  "checkInTime": "06:00",
  "checkOutTime": "14:00",
  "lateThresholdMin": 10,
  "earlyThresholdMin": 10,
  "workDays": [1, 2, 3, 4, 5]
}
```

**Response 201:** `ApiSuccess<WorkShiftResponse>`

**400** nếu `checkInTime`/`checkOutTime` sai format (phải là `HH:mm`):
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "checkInTime must match /^\\d{2}:\\d{2}$/" } }
```

---

## PATCH /v1/work-shifts/:id — Cập nhật ca

Mọi field đều optional. Chỉ `ADMIN` và `HR` được gọi.

**Ví dụ:** `PATCH /v1/work-shifts/1`

**Request body:**
```json
{ "lateThresholdMin": 5 }
```

**Response 200:** `ApiSuccess<WorkShiftResponse>`

**404** nếu ca không tồn tại.

---

## DELETE /v1/work-shifts/:id — Vô hiệu hóa ca

Soft delete — chỉ set `isActive = false`, không xóa khỏi DB. Chỉ `ADMIN` và `HR` được gọi.

**Ví dụ:** `DELETE /v1/work-shifts/1`

**Response: 204 No Content**

**400** nếu ca đã bị vô hiệu hóa trước đó:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ca làm việc đã bị vô hiệu hóa" } }
```

---

## GET /v1/shift-schedules/me — Lịch ca của tôi

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18`  
Mặc định nếu không truyền: từ đầu đến cuối tuần hiện tại.

**Response:** `ApiSuccess<ShiftScheduleResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "date": "2026-05-12",
      "employee": {
        "id": 4,
        "fullName": "Nguyễn Văn An",
        "employeeCode": "EMP004"
      },
      "shift": {
        "id": 1,
        "name": "Ca sáng",
        "checkInTime": "08:00",
        "checkOutTime": "17:00",
        "workDays": [1, 2, 3, 4, 5]
      }
    }
  ]
}
```

> Response không có `meta` phân trang — trả toàn bộ lịch ca trong khoảng ngày.

---

## GET /v1/shift-schedules/calendar — Calendar view

Chỉ `ADMIN` và `HR` được gọi. `startDate` và `endDate` đều **bắt buộc**. Tối đa 31 ngày.

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18&departmentId=1`

**Response:** `ApiSuccess<CalendarDayResponse[]>` — mỗi phần tử là 1 ngày với danh sách nhân viên và ca của họ.

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-05-12",
      "employees": [
        {
          "employeeId": 4,
          "employeeCode": "EMP004",
          "fullName": "Nguyễn Văn An",
          "department": "Kỹ thuật",
          "shift": {
            "id": 1,
            "name": "Ca hành chính",
            "checkInTime": "08:00",
            "checkOutTime": "17:00"
          },
          "isDefault": true
        },
        {
          "employeeId": 5,
          "employeeCode": "EMP005",
          "fullName": "Trần Thị Bình",
          "department": "Kỹ thuật",
          "shift": {
            "id": 2,
            "name": "Ca chiều",
            "checkInTime": "13:00",
            "checkOutTime": "22:00"
          },
          "isDefault": false
        }
      ]
    },
    {
      "date": "2026-05-13",
      "employees": [...]
    }
  ]
}
```

**Hiểu `isDefault`:**
- `isDefault: true` → nhân viên đang dùng `Employee.defaultShiftId` (không có override cho ngày này)
- `isDefault: false` → nhân viên có `EmployeeShiftSchedule` cụ thể cho ngày này (override)
- `shift: null` → nhân viên không có ca mặc định và không có override — sẽ bị `NO_SHIFT_TODAY`

**400** nếu khoảng ngày vượt quá 31 ngày:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Khoảng ngày phải từ 0 đến 31 ngày" } }
```

---

## GET /v1/shift-schedules — Lịch ca toàn công ty

Chỉ `ADMIN` và `HR` được gọi.

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18&employeeId=4&departmentId=1`

**Response:** `ApiSuccess<ShiftScheduleResponse[]>` — shape giống `/me`

---

## POST /v1/shift-schedules — Gán ca 1 ngày

Nếu nhân viên đã có lịch ca cho ngày đó → **upsert** (ghi đè, không báo lỗi).

**Request body:**
```json
{
  "employeeId": 4,
  "shiftId": 1,
  "date": "2026-05-20"
}
```

**Response 201:** `ApiSuccess<ShiftScheduleResponse>`

```json
{
  "success": true,
  "data": {
    "id": 10,
    "date": "2026-05-20",
    "employee": {
      "id": 4,
      "fullName": "Nguyễn Văn An",
      "employeeCode": "EMP004"
    },
    "shift": {
      "id": 1,
      "name": "Ca sáng",
      "checkInTime": "08:00",
      "checkOutTime": "17:00",
      "workDays": [1, 2, 3, 4, 5]
    }
  }
}
```

**400** nếu ca đã bị vô hiệu hóa (`isActive: false`):
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ca làm việc đã bị vô hiệu hóa" } }
```

**404** nếu nhân viên hoặc ca không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên hoặc ca làm việc không tồn tại" } }
```

---

## POST /v1/shift-schedules/bulk — Gán ca hàng loạt

Tối đa 100 mục trong một request. Gán cho nhiều nhân viên và/hoặc nhiều ngày.

**Request body:**
```json
{
  "assignments": [
    { "employeeId": 4, "shiftId": 1, "date": "2026-05-19" },
    { "employeeId": 4, "shiftId": 1, "date": "2026-05-20" },
    { "employeeId": 5, "shiftId": 2, "date": "2026-05-19" }
  ]
}
```

**Response 201: No Content** (void — không trả data)

**400** nếu vượt quá 100 mục:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "assignments must contain no more than 100 elements" } }
```

---

## PATCH /v1/shift-schedules/employees/:employeeId/default-shift — Gán ca mặc định

Gán ca mặc định cho nhân viên. Ca này được áp dụng cho mọi ngày không có lịch ca cụ thể.

**Ví dụ:** `PATCH /v1/shift-schedules/employees/4/default-shift`

**Request body:**
```json
{ "shiftId": 1 }
```

**Response 200: No Content** (void)

**404** nếu nhân viên hoặc ca không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên không tồn tại" } }
```

---

## DELETE /v1/shift-schedules/:employeeId/:date — Xóa lịch ca theo ngày

Xóa override ca của một ngày cụ thể. Sau khi xóa, hệ thống fallback về `defaultShiftId` của nhân viên.

**Ví dụ:** `DELETE /v1/shift-schedules/4/2026-05-20`

**Response: 204 No Content**

**404** nếu không tìm thấy lịch ca:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Lịch ca không tồn tại" } }
```

---

## Ca online T7

### Khái niệm

"Ca online T7" là loại ca làm việc đặc biệt: nhân viên làm việc tại nhà vào Thứ 7 và **không cần GPS check-in**. Hệ thống tự động ghi nhận PRESENT cuối ngày.

Hai cấp `isOnline`:
| Field | Model | Ý nghĩa |
|-------|-------|---------|
| `WorkShift.isOnline` | Khuôn ca | Ca này được thiết kế dành cho online |
| `EmployeeShiftSchedule.isOnline` | Lịch gán | Ngày cụ thể này nhân viên làm online |

Seed mặc định có sẵn ca **"Ca online T7"** (`workDays: [6]`, `isOnline: true`).

---

### Field `isOnline` trong response

**`WorkShiftResponse`** — trường `isOnline` xuất hiện trong mọi response của `/v1/work-shifts`:

```json
{
  "id": 5,
  "name": "Ca online T7",
  "checkInTime": "08:00",
  "checkOutTime": "13:00",
  "lateThresholdMin": 0,
  "earlyThresholdMin": 0,
  "workDays": [6],
  "isOnline": true,
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**`ShiftScheduleResponse`** — trường `isOnline` ở cấp lịch gán (không phải trong object `shift`):

```json
{
  "id": 42,
  "date": "2026-05-24",
  "isOnline": true,
  "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" },
  "shift": {
    "id": 5,
    "name": "Ca online T7",
    "checkInTime": "08:00",
    "checkOutTime": "13:00",
    "workDays": [6]
  }
}
```

> `isOnline` trên lịch gán (`ShiftScheduleResponse`) có thể khác với `WorkShift.isOnline`. HR có thể gán bất kỳ ca nào với `isOnline: true` cho một ngày cụ thể.

---

### POST /v1/shift-schedules/bulk-online-saturday — Gán Ca online T7 hàng loạt

Tự động tìm tất cả ngày Thứ 7 trong tháng và upsert `EmployeeShiftSchedule` với `isOnline: true` cho từng nhân viên.

**Request body:**
```json
{
  "month": 5,
  "year": 2026,
  "employeeIds": [4, 5, 7],
  "shiftId": 5
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "assigned": 15,
    "month": 5,
    "year": 2026
  }
}
```

> `assigned` = tổng số bản ghi đã upsert = số Thứ 7 trong tháng × số nhân viên.

**400** nếu không có ngày Thứ 7 nào (hiếm — tháng nào cũng có ít nhất 4):
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Không có ngày T7 nào trong tháng đã chọn" } }
```

**404** nếu ca làm việc hoặc bất kỳ nhân viên nào không tồn tại.

---

### Behavior khi nhân viên có lịch online

**GPS check-in bị block:**  
Khi nhân viên cố check-in thủ công vào ngày có `EmployeeShiftSchedule.isOnline = true`, API trả về lỗi ngay cả khi GPS hợp lệ:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Hôm nay là ca làm việc online. Hệ thống sẽ tự động ghi nhận công."
  }
}
```

Mobile/Web nên kiểm tra `ShiftScheduleResponse.isOnline` trước khi hiển thị nút check-in.

---

**PRESENT tự động (cron 23:50 Thứ 7):**  
Hệ thống chạy cron lúc **23:50 Thứ 7 (VN time)** và tạo `AttendanceRecord` tự động:

```json
{
  "status": "PRESENT",
  "checkInAt": null,
  "checkOutAt": null,
  "isManual": true,
  "note": "Tự động ghi nhận — Ca online T7",
  "lateMinutes": 0,
  "earlyMinutes": 0
}
```

Nếu nhân viên đã có `AttendanceRecord` cho ngày đó (ví dụ: đã được duyệt nghỉ phép) → cron **bỏ qua**, không ghi đè.

---

**Đơn nghỉ phép T7 hoạt động bình thường:**  
Nếu nhân viên có đơn nghỉ phép đã duyệt trùng ngày Thứ 7 online:
- `findActiveEmployeesWithoutAttendance` đã lọc ra những người có đơn nghỉ phép duyệt — họ không xuất hiện trong danh sách cần tạo record
- Cron `autoRecordOnlineSaturday` bỏ qua nhân viên đã có `AttendanceRecord` (`existing` check)
- Kết quả: `AttendanceRecord.status = ON_LEAVE` từ đơn nghỉ phép **override** PRESENT online — hoạt động đúng

---

### Luồng đầy đủ Ca online T7

```
HR gọi POST /shift-schedules/bulk-online-saturday
    → Server tìm tất cả T7 trong tháng (ví dụ 4 ngày: 3/5, 10/5, 17/5, 24/5)
    → Upsert EmployeeShiftSchedule với isOnline=true cho mỗi (nhân viên × ngày T7)

Thứ 7 đến:
    Nhân viên mở app → thấy isOnline=true → app ẩn nút check-in / hiển thị thông báo
    23:50 VN: cron autoRecordOnlineSaturday chạy
        → Lấy tất cả EmployeeShiftSchedule có date=hôm nay, isOnline=true
        → Với mỗi nhân viên: nếu chưa có AttendanceRecord → tạo PRESENT tự động
        → Nếu đã có record (ON_LEAVE, ABSENT từ trước) → bỏ qua

00:10 (Chủ nhật): cron markAbsentEmployees chạy
    → Với mỗi nhân viên chưa có record ngày hôm qua:
        shouldWorkOnDate() → tìm shiftId
        hasOnlineScheduleForEmployee() → nếu isOnline=true → skip (đã xử lý bởi cron T7)
```

---

## Composable — useShiftSchedules

```typescript
// composables/useShiftSchedules.ts
import type {
  WorkShiftResponse,
  CreateWorkShiftDto,
  UpdateWorkShiftDto,
  ShiftScheduleResponse,
  AssignShiftDto,
  BulkAssignShiftDto,
  BulkOnlineSaturdayDto,
  SetDefaultShiftDto,
  QueryShiftScheduleParams,
  QueryCalendarParams,
  CalendarDayResponse,
} from '~/types/shift.types';

export function useShiftSchedules() {
  const { get, post, patch, del } = useFetch();

  // ─── WorkShift ──────────────────────────────────────────────────────────

  const fetchWorkShifts = () =>
    get<WorkShiftResponse[]>('/v1/work-shifts');

  const createWorkShift = (dto: CreateWorkShiftDto) =>
    post<WorkShiftResponse>('/v1/work-shifts', dto);

  const updateWorkShift = (id: number, dto: UpdateWorkShiftDto) =>
    patch<WorkShiftResponse>(`/v1/work-shifts/${id}`, dto);

  const deactivateWorkShift = (id: number) =>
    del(`/v1/work-shifts/${id}`);

  // ─── ShiftSchedule ──────────────────────────────────────────────────────

  const fetchMySchedule = (params?: QueryShiftScheduleParams) =>
    get<ShiftScheduleResponse[]>('/v1/shift-schedules/me', { params });

  const fetchSchedules = (params?: QueryShiftScheduleParams) =>
    get<ShiftScheduleResponse[]>('/v1/shift-schedules', { params });

  const fetchCalendar = (params: QueryCalendarParams) =>
    get<CalendarDayResponse[]>('/v1/shift-schedules/calendar', { params });

  const assignShift = (dto: AssignShiftDto) =>
    post<ShiftScheduleResponse>('/v1/shift-schedules', dto);

  const bulkAssign = (dto: BulkAssignShiftDto) =>
    post<void>('/v1/shift-schedules/bulk', dto);

  const bulkOnlineSaturday = (dto: BulkOnlineSaturdayDto) =>
    post<{ assigned: number; month: number; year: number }>(
      '/v1/shift-schedules/bulk-online-saturday',
      dto,
    );

  const setDefaultShift = (employeeId: number, dto: SetDefaultShiftDto) =>
    patch<void>(`/v1/shift-schedules/employees/${employeeId}/default-shift`, dto);

  const removeShift = (employeeId: number, date: string) =>
    del(`/v1/shift-schedules/${employeeId}/${date}`);

  return {
    fetchWorkShifts,
    createWorkShift,
    updateWorkShift,
    deactivateWorkShift,
    fetchMySchedule,
    fetchSchedules,
    fetchCalendar,
    assignShift,
    bulkAssign,
    bulkOnlineSaturday,
    setDefaultShift,
    removeShift,
  };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `EMPLOYEE` gọi `GET /shift-schedules` | 403 Forbidden |
| Gán ca cho ngày đã có lịch ca | Upsert — ghi đè, không báo lỗi |
| Gán ca đã bị vô hiệu hóa | 400 Bad Request |
| `bulk` với > 100 mục | 400 Bad Request |
| `date` truyền sai format (không phải `YYYY-MM-DD`) | 400 Bad Request |
| `GET /calendar` không truyền `startDate`/`endDate` | 400 Bad Request (2 field bắt buộc) |
| `GET /calendar` với khoảng > 31 ngày | 400 Bad Request |
| `shift: null` trong calendar response | Nhân viên không có defaultShift và không có override |
| `isDefault: true` trong calendar | Nhân viên đang dùng `Employee.defaultShiftId` |
| `isDefault: false` trong calendar | Có `EmployeeShiftSchedule` override cho ngày đó |
| Xóa lịch ca ngày đó → nhân viên còn `defaultShiftId` | Hệ thống dùng `defaultShift` khi check-in |
| Xóa lịch ca ngày đó → nhân viên không có `defaultShiftId` | `NO_SHIFT_TODAY` khi check-in |
| `DELETE /work-shifts/:id` khi ca đã inactive | 400 Bad Request |
| `PATCH default-shift` với `shiftId` không tồn tại | 404 Not Found |
| `workDays: [1,2,3,4,5]` | Thứ 2 đến Thứ 6 |
| `workDays: [0]` | Chủ nhật |
| `workDays: [6]` | Thứ 7 |
| Không truyền `startDate`/`endDate` cho `/me` | Server mặc định tuần hiện tại (Thứ 2 → Chủ nhật) |
| Nhân viên cố check-in khi `EmployeeShiftSchedule.isOnline = true` | 400 — "Hôm nay là ca làm việc online..." |
| `WorkShift.isOnline = true` nhưng lịch gán `isOnline = false` | GPS check-in bình thường — cấp lịch gán được ưu tiên |
| Nhân viên có đơn nghỉ phép T7 đã duyệt + lịch online T7 | Record ON_LEAVE tồn tại → cron bỏ qua, PRESENT không ghi đè |
| `bulk-online-saturday` gán đè T7 đã có lịch ca khác | Upsert — ghi đè `shiftId` và `isOnline=true` |
| `autoRecordOnlineSaturday` chạy nhưng không có lịch online hôm nay | Skip toàn bộ, không tạo record |
| `markAbsentEmployees` (00:10 CN) gặp nhân viên có lịch online T7 | Skip — không đánh ABSENT nhân viên online |
