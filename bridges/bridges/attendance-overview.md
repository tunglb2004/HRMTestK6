# Attendance System — Tổng quan cho Frontend

> File này giải thích big picture của hệ thống chấm công.  
> Đọc file này **trước** khi đọc các bridge docs chi tiết.

---

## Sơ đồ quan hệ giữa các entities

```
CheckInLocation ◄──── LocationEmployee ────► Employee
      │                                          │
      │                                          │ defaultShiftId
      │                                    ┌─────┴──────┐
      │                                    ▼            ▼
      │                               WorkShift ◄── EmployeeShiftSchedule
      │                                    │         (override ca theo ngày)
      │                                    │
      │                                    ▼
      │                           EffectiveShiftOverride
      │                           (hệ thống tự tạo khi duyệt nửa ngày phép)
      │                                    │
      │                                    │ leaveRequestId
      │                                    │
      │                              LeaveRequest
      │                              (halfDayPeriod: MORNING | AFTERNOON)
      │
      └──────────► AttendanceRecord ◄──────────────────────┘
                        │
                        ├── employeeId
                        ├── shiftId (WorkShift)
                        ├── locationId (CheckInLocation)
                        ├── effectiveShiftOverrideId (EffectiveShiftOverride | null)
                        ├── isLocked → khi lock, nhân viên không tự sửa được
                        │
                        └──► MakeupAttendanceRequest
                                  (PENDING → APPROVED/REJECTED)
                                  Khi APPROVED: unlock record + apply giờ
```

---

## Các bước setup hệ thống (HR làm 1 lần)

```
Bước 1 — Tạo khuôn ca (WorkShift)
    POST /v1/work-shifts
    Mỗi ca gồm: tên, giờ vào, giờ ra, ngày làm việc trong tuần, ngưỡng đến muộn

Bước 2 — Tạo địa điểm chấm công (CheckInLocation)
    POST /v1/check-in-locations
    Mỗi địa điểm gồm: tên, tọa độ (lat/lng), bán kính (mét)

Bước 3 — Gán địa điểm cho nhân viên
    POST /v1/check-in-locations/:id/employees/:employeeId
    Một nhân viên có thể được gán nhiều địa điểm (làm ở nhiều văn phòng)

Bước 4 — Gán ca mặc định cho nhân viên
    PATCH /v1/shift-schedules/employees/:employeeId/default-shift
    Ca mặc định áp dụng cho mọi ngày nếu không có override cụ thể

(Tùy chọn) Bước 5 — Override ca theo ngày
    POST /v1/shift-schedules          → gán ca 1 ngày
    POST /v1/shift-schedules/bulk     → gán ca hàng loạt (tối đa 100 mục/request)
```

---

## Flow hàng ngày (Employee)

```
Mở app
    │
    ▼
Lấy danh sách địa điểm được phép
    GET /v1/check-in-locations/me
    │
    ▼
Hiển thị bản đồ với vòng tròn bán kính từng địa điểm
    │
    ▼
GPS lấy tọa độ + chụp ảnh selfie
    │
    ▼
Gửi check-in (multipart/form-data)
    POST /v1/attendance/check-in
    Fields: photo (File), latitude (number), longitude (number)
    │
    ├─ 400 ảnh thiếu / sai format → "Vui lòng chụp ảnh selfie rõ mặt."
    ├─ 400 isLocked → "Bản ghi đã bị khóa. Hãy tạo đơn bù công."
    ├─ Thất bại khác → hiển thị lỗi cụ thể (vị trí / ca / giờ)
    └─ Thành công → lưu AttendanceRecordDetail vào state
                    isHalfDay? → hiển thị "Ca rút gọn"
    │
    ▼ (cuối ngày — chụp ảnh selfie)
Gửi check-out (multipart/form-data)
    POST /v1/attendance/check-out
    Fields: photo (File)
    │
    ├─ 400 isLocked → "Bản ghi đã bị khóa. Hãy tạo đơn bù công."
    └─ Thành công → cập nhật checkOutAt + checkOutPhotoUrl trong state
```

---

## Flow auto-lock qua đêm (hệ thống — không cần frontend làm gì)

```
Cron chạy lúc 00:05 Asia/Ho_Chi_Minh mỗi ngày
    │
    ▼
Tìm tất cả AttendanceRecord ngày hôm qua chưa lock và chưa hoàn chỉnh
    │
    ├─ Có checkInAt nhưng KHÔNG có checkOutAt
    │       → isLocked = true, lockReason = 'AUTO_MIDNIGHT'
    │       → missingType = 'MISSING_CHECKOUT'
    │       → gửi email nhắc nhở nhân viên
    │
    └─ KHÔNG có checkInAt (vắng, không phải ON_LEAVE)
            → isLocked = true, lockReason = 'AUTO_MIDNIGHT'
            → không gửi email
```

> **Frontend:** Khi thấy `isLocked: true` trong `AttendanceRecord`, hiển thị nút "Tạo đơn bù công" thay vì cho phép check-in/check-out tiếp.

---

## Flow bù công (Employee + HR/Manager)

```
Nhân viên xem lịch sử — phát hiện ngày bị lock
    │
    ▼
Tạo đơn bù công
    POST /v1/makeup-attendance  (multipart/form-data)
    Body: { attendanceDate, requestedCheckIn?, requestedCheckOut?, reason, evidencePhoto? }
    │
    ├─ 400 ngày chưa qua / không tìm thấy bản ghi / bản ghi chưa bị lock
    ├─ 409 đã có đơn PENDING cho ngày đó
    └─ 201 → MakeupRequestResponseDto (status: PENDING)
    │
    ▼
HR/Manager nhận đơn → xem xét
    GET /v1/makeup-attendance  (HR/Admin)
    │
    ├─ PATCH /v1/makeup-attendance/:id/approve  { reviewNote? }
    │       → status: APPROVED
    │       → AttendanceRecord được unlock + apply giờ từ đơn (transaction)
    │       → gửi email thông báo duyệt
    │
    └─ PATCH /v1/makeup-attendance/:id/reject   { reviewNote: string }  ← bắt buộc
            → status: REJECTED
            → AttendanceRecord giữ nguyên trạng thái lock
            → gửi email thông báo từ chối
```

---

## Flow khi có nghỉ nửa ngày

```
Employee tạo đơn nghỉ nửa ngày
    POST /v1/leave-requests  { halfDayPeriod: "MORNING" | "AFTERNOON" }
    │
    ▼
Manager/HR duyệt đơn
    PATCH /v1/leave-requests/:id/approve
    │
    ▼ (hệ thống tự xử lý — không cần frontend làm gì thêm)
Server tạo EffectiveShiftOverride
    MORNING  → effectiveStart: 12:00, effectiveEnd: giờ kết thúc ca gốc
    AFTERNOON → effectiveStart: giờ bắt đầu ca gốc, effectiveEnd: 12:00
    │
    ▼
Employee check-in bình thường (multipart + ảnh selfie)
    POST /v1/attendance/check-in  photo + latitude + longitude
    │
    └─ Response: AttendanceRecordDetail với
           isHalfDay: true
           effectiveStart: "1970-01-01T12:00:00.000Z"  ← parse bằng getUTCHours()
           effectiveEnd: "1970-01-01T17:00:00.000Z"
```

> **Frontend không cần xử lý EffectiveShiftOverride trực tiếp.**  
> Chỉ đọc `isHalfDay`, `effectiveStart`, `effectiveEnd` từ `AttendanceRecordDetail`.

---

## Các trường hợp check-in thất bại

| Lỗi | Nguyên nhân | Cách xử lý trên UI |
|-----|-------------|-------------------|
| `NO_VALID_LOCATION` | GPS ngoài bán kính mọi địa điểm được gán, hoặc chưa được gán địa điểm | "Vị trí không hợp lệ. Hãy đến gần văn phòng hơn." |
| `NO_SHIFT_TODAY` | Không có ca (không có schedule cụ thể lẫn default shift) | "Bạn không có ca làm việc hôm nay." |
| `OUTSIDE_WINDOW` | Ngoài cửa sổ ±30 phút xung quanh giờ bắt đầu ca thực tế | "Ngoài khung giờ chấm công. Vui lòng thử lại đúng giờ." |
| `ATTENDANCE_ALREADY_CHECKED_IN` | Đã check-in hôm nay (409) | "Bạn đã check-in hôm nay rồi." |
| `isLocked` | Bản ghi ngày đó đã bị khóa (400) | "Bản ghi đã bị khóa. Hãy tạo đơn bù công." |

---

## Bridge docs chi tiết

| File | Nội dung |
|------|---------|
| [attendance-locations.md](./attendance-locations.md) | CRUD địa điểm, gán nhân viên, tích hợp Leaflet |
| [attendance-shifts.md](./attendance-shifts.md) | Khuôn ca, gán lịch ca, ca mặc định |
| [attendance.md](./attendance.md) | Check-in/out, lịch sử, chỉnh sửa thủ công |
| [makeup-attendance.md](./makeup-attendance.md) | Đơn bù công — tạo, duyệt, từ chối |
