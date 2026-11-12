# Bridge Docs — Báo cáo (`/v1/reports`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/reports/attendance` | `ADMIN`, `HR`, `MANAGER` | Báo cáo chấm công theo tháng |
| GET | `/v1/reports/attendance/export` | `ADMIN`, `HR`, `MANAGER` | Tải file `.xlsx` bảng công tổng hợp |
| GET | `/v1/reports/attendance/export-detail` | `ADMIN`, `HR`, `MANAGER` | Tải file `.xlsx` bảng chấm công chi tiết (1 dòng/ngày/NV) |
| GET | `/v1/reports/leave` | `ADMIN`, `HR`, `MANAGER` | Báo cáo nghỉ phép theo năm / tháng |
| GET | `/v1/reports/leave/export` | `ADMIN`, `HR`, `MANAGER` | Tải file `.xlsx` thống kê nghỉ phép |
| GET | `/v1/reports/summary` | `ADMIN`, `HR` | Thống kê tổng quan toàn công ty |

> `EMPLOYEE` và `MANAGER` gọi `/summary` → **403**. Chỉ HR và Admin xem được số liệu toàn công ty.

---

## TypeScript Types

```typescript
// types/reports.types.ts

export interface AttendanceReportResponse {
  employeeId: number;
  employeeCode: string;        // "EMP001"
  fullName: string;
  departmentName: string | null;
  positionName: string | null;
  totalWorkDays: number;       // tổng ngày làm việc trong tháng (trừ Thứ 7, Chủ nhật)
  presentDays: number;         // số ngày có mặt đúng giờ
  lateDays: number;            // số ngày đi muộn
  absentDays: number;          // số ngày vắng
  onLeaveDays: number;         // số ngày nghỉ phép được duyệt
  totalLateMinutes: number;    // tổng phút đi muộn cộng dồn
  totalEarlyMinutes: number;   // tổng phút về sớm cộng dồn
  attendanceRate: number;      // % = (presentDays + lateDays) / totalWorkDays * 100
}

export interface LeaveReportResponse {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  leaveTypeName: string;       // "Nghỉ phép năm"
  leaveTypeCode: string;       // "ANNUAL"
  totalRequests: number;       // tổng đơn (mọi trạng thái)
  approvedRequests: number;    // đơn đã duyệt
  totalDaysApproved: number;   // tổng ngày được duyệt (tính từ các đơn APPROVED)
  pendingRequests: number;     // đơn đang chờ duyệt
  remainingBalance: number | null; // null nếu loại phép không có hạn mức (daysPerYear = null)
}

export interface SummaryStatsResponse {
  totalEmployees: number;              // tổng nhân viên đang ACTIVE
  presentToday: number;                // chấm công PRESENT hôm nay
  lateToday: number;                   // chấm công LATE hôm nay
  absentToday: number;                 // chấm công ABSENT hôm nay
  pendingLeaveRequests: number;        // đơn nghỉ phép đang chờ duyệt (toàn công ty)
  avgAttendanceRateThisMonth: number;  // % chuyên cần trung bình trong tháng
  topAbsentDepartment: string | null;  // phòng ban vắng nhiều nhất; null nếu chưa có dữ liệu
}

// Query params

export interface QueryAttendanceReportParams {
  year: number;           // bắt buộc, >= 2020
  month: number;          // bắt buộc, 1-12
  departmentId?: number;  // lọc theo phòng ban
  employeeId?: number;    // lọc theo 1 nhân viên cụ thể
}

export interface QueryLeaveReportParams {
  year: number;            // bắt buộc, >= 2020
  month?: number;          // tuỳ chọn, 1-12; bỏ qua → tổng hợp cả năm
  departmentId?: number;
  leaveTypeId?: number;
}

export interface QuerySummaryStatsParams {
  year: number;   // bắt buộc
  month: number;  // bắt buộc, 1-12
}

export interface QueryAttendanceDetailParams {
  year: number;          // bắt buộc, >= 2020
  month: number;         // bắt buộc, 1-12
  departmentId?: number; // lọc theo phòng ban (bỏ qua → toàn công ty)
}
```

---

## GET /v1/reports/attendance — Báo cáo chấm công

**Query params:** `?year=2025&month=5&departmentId=1`

Trả về mảng — mỗi phần tử là thống kê chấm công của một nhân viên trong tháng.  
Kết quả đã sort: phòng ban A-Z → họ tên A-Z.

**Response:** `ApiSuccess<AttendanceReportResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "departmentName": "Kỹ thuật",
      "positionName": "Software Engineer",
      "totalWorkDays": 22,
      "presentDays": 18,
      "lateDays": 2,
      "absentDays": 1,
      "onLeaveDays": 1,
      "totalLateMinutes": 35,
      "totalEarlyMinutes": 0,
      "attendanceRate": 90.9
    }
  ]
}
```

> `attendanceRate` được tính theo công thức: `(presentDays + lateDays) / totalWorkDays * 100`.  
> Nhân viên đi muộn vẫn được tính là đã đi làm — không bị trừ vào tỷ lệ chuyên cần.

---

## GET /v1/reports/leave — Báo cáo nghỉ phép

**Query params:** `?year=2025` hoặc `?year=2025&month=5&departmentId=1&leaveTypeId=2`

Trả về mảng — mỗi phần tử là thống kê nghỉ phép của một nhân viên theo từng **loại phép**.  
Một nhân viên có thể xuất hiện nhiều lần nếu có nhiều loại phép.

**Response:** `ApiSuccess<LeaveReportResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "departmentName": "Kỹ thuật",
      "leaveTypeName": "Nghỉ phép năm",
      "leaveTypeCode": "ANNUAL",
      "totalRequests": 2,
      "approvedRequests": 1,
      "totalDaysApproved": 3,
      "pendingRequests": 1,
      "remainingBalance": 9
    },
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "departmentName": "Kỹ thuật",
      "leaveTypeName": "Nghỉ ốm",
      "leaveTypeCode": "SICK",
      "totalRequests": 1,
      "approvedRequests": 1,
      "totalDaysApproved": 1,
      "pendingRequests": 0,
      "remainingBalance": null
    }
  ]
}
```

> `remainingBalance = null` khi loại phép không có hạn mức (`daysPerYear = null`), ví dụ nghỉ ốm không giới hạn.  
> Lọc theo `month` dựa trên `startDate` của đơn nghỉ — đơn bắt đầu trong tháng mới được tính.

---

## GET /v1/reports/summary — Thống kê tổng quan

**Query params:** `?year=2025&month=5`

**Chỉ `ADMIN` và `HR`.** `MANAGER` gọi endpoint này nhận **403**.

**Response:** `ApiSuccess<SummaryStatsResponse>`

```json
{
  "success": true,
  "data": {
    "totalEmployees": 50,
    "presentToday": 45,
    "lateToday": 3,
    "absentToday": 2,
    "pendingLeaveRequests": 5,
    "avgAttendanceRateThisMonth": 92.5,
    "topAbsentDepartment": "Kinh doanh"
  }
}
```

> `presentToday` / `lateToday` / `absentToday` dựa trên ngày **hiện tại** khi gọi API, không phụ thuộc vào `year`/`month`.  
> `avgAttendanceRateThisMonth` và `topAbsentDepartment` tính theo `year`+`month` truyền vào.

---

## Export Endpoints — File nhị phân `.xlsx`

> **Tất cả endpoint `/*/export*` không trả JSON.**  
> Response là file binary `.xlsx`. **Không** bọc trong `{ success, data }`.

### Headers response từ server

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="bang-cong-5-2025.xlsx"
Content-Length: <bytes>
```

### Cách trigger download từ frontend (Nuxt / Vue)

```typescript
// Bảng công
const downloadAttendanceExcel = async (params: QueryAttendanceReportParams) => {
  const blob = await $fetch('/v1/reports/attendance/export', {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bang-cong-${params.month}-${params.year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

// Thống kê nghỉ phép
const downloadLeaveExcel = async (params: QueryLeaveReportParams) => {
  const blob = await $fetch('/v1/reports/leave/export', {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thong-ke-nghi-phep-${params.year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
```

### Cấu trúc file Excel bảng công tổng hợp (`/attendance/export`)

| Cột | Key | Ghi chú |
|-----|-----|---------|
| Mã NV | `employeeCode` | |
| Họ tên | `fullName` | |
| Phòng ban | `departmentName` | |
| Chức vụ | `positionName` | |
| Đi làm | `presentDays` | |
| Đi muộn | `lateDays` | |
| Vắng | `absentDays` | |
| Nghỉ phép | `onLeaveDays` | |
| Phút muộn | `totalLateMinutes` | |
| Phút sớm | `totalEarlyMinutes` | |
| Tỷ lệ (%) | `attendanceRate` | Đỏ đậm nếu < 80%, cam nếu < 90% |

Dòng cuối là hàng **TỔNG CỘNG** (nền xanh nhạt).

### Cấu trúc file Excel nghỉ phép (`/leave/export`)

| Cột | Key |
|-----|-----|
| Mã NV | `employeeCode` |
| Họ tên | `fullName` |
| Phòng ban | `departmentName` |
| Loại phép | `leaveTypeName` |
| Tổng đơn | `totalRequests` |
| Đã duyệt | `approvedRequests` |
| Tổng ngày | `totalDaysApproved` |
| Còn lại | `remainingBalance` |

### Cấu trúc file Excel bảng chấm công chi tiết (`/attendance/export-detail`)

**Query params:** `?year=2025&month=5` hoặc thêm `&departmentId=1`

**Filename:** `bang-cong-chi-tiet-{month}-{year}.xlsx`

File có **3 dòng header** (tiếng Anh nhóm cột → tiếng Anh sub-header → tiếng Việt), tiếp theo là các nhóm phòng ban, mỗi nhóm bắt đầu bằng **1 dòng phân cách** tên phòng ban (nền xanh nhạt). Bên dưới là các dòng dữ liệu — **1 dòng mỗi ngày cho mỗi nhân viên**, kể cả cuối tuần.

**24 cột (A → X):**

| Cột | Tên VN | Ghi chú |
|-----|--------|---------|
| A | Họ và tên | Lặp lại trên mỗi dòng của cùng nhân viên |
| B | *(trống)* | — |
| C | Mã nhân viên | |
| D | Nhóm chấm công | Tên ca mặc định của nhân viên |
| E | Ngày | Định dạng `dd/mm/yyyy` |
| F | Thứ | `Monday` … `Sunday` (tiếng Anh) |
| G | Ca làm việc | `"Ca hành chính HN 08:30-18:00"` hoặc `"Break"` (cuối tuần) |
| H | Giờ chấm vào | Giờ VN định dạng `hh:mm`; `"-"` nếu không có |
| I | Ghi chú vào | Trống trong phiên bản hiện tại |
| J | Giờ chấm ra | Giờ VN `hh:mm`; `"-"` nếu không có |
| K | Ghi chú ra | Trống trong phiên bản hiện tại |
| L | Quy đổi giờ vào | Giờ vào đã điều chỉnh: giờ đến sớm → giờ bắt đầu ca; `"-"` nếu đến quá muộn (> 14:30) |
| M | Quy đổi giờ ra | Giờ ra đã điều chỉnh: không vượt quá giờ kết thúc ca |
| N | Tổng thời gian | Số giờ từ L đến M (thực tế có mặt) |
| O | TGLV thực tế | N trừ 1.5h nghỉ trưa nếu làm xuyên 12:00–13:30 |
| P | Số lần CC | `0` vắng / `1` quên 1 lần / `2` đủ cả vào & ra |
| Q | Quên CC | `"Quên CC"` nếu P = 1; trống nếu không |
| R | Chấm công | `"x"` đủ công (O ≥ 6h) · `"x/2"` nửa công (3h ≤ O < 6h) · `"Q"` quên CC · `0` vắng/không đủ |
| S | Tổng TG OT | Luôn = `0` (OT chưa tích hợp) |
| T | OT pay(hr) | Trống |
| U | Comp leave(hr) | Trống |
| V | Số lần đi muộn | `1` nếu status = LATE; `0` nếu không |
| W | Số lần đi rất muộn | `1` nếu LATE và lateMinutes > 30; `0` nếu không |
| X | Số lần về sớm | `1` nếu earlyMinutes > 0; `0` nếu không |

**Màu sắc:**
- Header row 1: nền `#1E3A5F` (xanh đậm), chữ trắng
- Header row 2: nền `#2E5491`, chữ trắng
- Header row 3 (VN): nền `#4472C4`, chữ trắng
- Dòng phân cách phòng ban: nền `#D6E4F0`, chữ đậm
- Dòng cuối tuần (Break): nền `#F0F0F0` (xám nhạt)
- Cột E đóng băng (freeze panes): 3 cột đầu (A-C) và 3 dòng header

---

## GET /v1/reports/attendance/export-detail — Bảng chấm công chi tiết

**Query params:** `?year=2025&month=5` · `&departmentId=1` (tuỳ chọn)

**Response:** Binary `.xlsx` — **không phải JSON**.

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="bang-cong-chi-tiet-5-2025.xlsx"
Content-Length: <bytes>
```

**Lưu ý quan trọng:**
- File bao gồm **tất cả ngày dương lịch** trong tháng, kể cả cuối tuần. Cuối tuần → cột G = `"Break"`, dòng nền xám.
- Giờ chấm công (cột H, J) theo **múi giờ Việt Nam (UTC+7)**.
- Nhân viên không có record chấm công trong 1 ngày làm việc → dòng đó hiển thị cột H/J = `"-"`, R = `0`.
- Nếu chưa có nhân viên nào ACTIVE hoặc không có dữ liệu trong `departmentId` → file Excel vẫn được trả về nhưng chỉ có 3 dòng header.

---

## Composable — useReports

```typescript
// composables/useReports.ts
import type {
  AttendanceReportResponse,
  LeaveReportResponse,
  SummaryStatsResponse,
  QueryAttendanceReportParams,
  QueryAttendanceDetailParams,
  QueryLeaveReportParams,
  QuerySummaryStatsParams,
} from '~/types/reports.types';

// Helper dùng lại cho tất cả các export
async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useReports() {
  const fetchAttendanceReport = (params: QueryAttendanceReportParams) =>
    $fetch<{ success: true; data: AttendanceReportResponse[] }>('/v1/reports/attendance', {
      params,
    }).then((r) => r.data);

  const fetchLeaveReport = (params: QueryLeaveReportParams) =>
    $fetch<{ success: true; data: LeaveReportResponse[] }>('/v1/reports/leave', {
      params,
    }).then((r) => r.data);

  const fetchSummaryStats = (params: QuerySummaryStatsParams) =>
    $fetch<{ success: true; data: SummaryStatsResponse }>('/v1/reports/summary', {
      params,
    }).then((r) => r.data);

  const exportAttendanceExcel = async (params: QueryAttendanceReportParams) => {
    const blob = await $fetch<Blob>('/v1/reports/attendance/export', {
      params,
      responseType: 'blob',
    });
    await triggerDownload(blob, `bang-cong-${params.month}-${params.year}.xlsx`);
  };

  /**
   * Bảng chấm công chi tiết — 1 dòng/ngày/nhân viên, gộp theo phòng ban.
   * File lớn hơn export tổng hợp; đặt timeout >= 30s nếu công ty > 100 NV.
   */
  const exportAttendanceDetailExcel = async (params: QueryAttendanceDetailParams) => {
    const blob = await $fetch<Blob>('/v1/reports/attendance/export-detail', {
      params,
      responseType: 'blob',
    });
    await triggerDownload(blob, `bang-cong-chi-tiet-${params.month}-${params.year}.xlsx`);
  };

  const exportLeaveExcel = async (params: QueryLeaveReportParams) => {
    const blob = await $fetch<Blob>('/v1/reports/leave/export', {
      params,
      responseType: 'blob',
    });
    await triggerDownload(blob, `thong-ke-nghi-phep-${params.year}.xlsx`);
  };

  return {
    fetchAttendanceReport,
    fetchLeaveReport,
    fetchSummaryStats,
    exportAttendanceExcel,
    exportAttendanceDetailExcel,
    exportLeaveExcel,
  };
}
```

**Ví dụ dùng trong component:**

```vue
<script setup lang="ts">
const { exportAttendanceDetailExcel } = useReports()
const loading = ref(false)

async function handleExport() {
  loading.value = true
  try {
    await exportAttendanceDetailExcel({ year: 2025, month: 5 })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <button :disabled="loading" @click="handleExport">
    {{ loading ? 'Đang xuất...' : 'Xuất bảng công chi tiết' }}
  </button>
</template>
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `month=0` hoặc `month=13` | **400** — validation reject |
| `year=2019` | **400** — `year` phải >= 2020 |
| `employeeId` không tồn tại | **200** — trả mảng rỗng `[]` |
| `departmentId` không có nhân viên nào ACTIVE | **200** — trả mảng rỗng `[]` |
| Nhân viên không có record chấm công nào trong tháng | Vẫn xuất hiện trong báo cáo, tất cả counter = 0, `attendanceRate = 0` |
| `remainingBalance` trong leave report | `null` nếu loại phép không có `daysPerYear` (nghỉ ốm không giới hạn v.v.) |
| `MANAGER` gọi `/summary` | **403** |
| Export file với công ty > 500 nhân viên | File được tạo server-side — có thể mất 5–10 giây; nên thêm loading state và đặt timeout phía client >= 30s |
| `export-detail` với tháng đủ 31 ngày × 50 NV | Sinh ~1550 dòng; nặng hơn `export` tổng hợp; vẫn ổn với công ty ~50 người |
| Nhân viên có record vào ngày cuối tuần | Dòng vẫn hiển thị dữ liệu thực; chỉ nền xám, cột G vẫn là `"Break"` |
| `lateMinutes > 30` nhưng status không phải LATE | Không xảy ra — cột W chỉ tính khi status = LATE |
| Gọi export không có `Authorization` header | **401** — response vẫn là JSON `{ success: false, error: {...} }`, không phải blob; cần handle lỗi trước khi `createObjectURL` |
