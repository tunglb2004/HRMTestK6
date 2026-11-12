# Bridge: System Logs

> Dành cho frontend agents (hr-system-web, hr-system-mobile)

---

## Mục đích

`/v1/logs` cung cấp lịch sử toàn bộ hành vi mutation trong hệ thống. Chỉ ADMIN và HR mới có thể truy cập.

---

## Endpoints

### GET /v1/logs

Danh sách log, hỗ trợ filter và phân trang.

**Query params:**

| Param       | Type             | Mô tả                              |
| ----------- | ---------------- | ---------------------------------- |
| `actorId`   | number           | Lọc theo ID người thực hiện        |
| `actorType` | `USER` / `SYSTEM`| Lọc theo loại tác nhân             |
| `action`    | string           | Partial match — vd `employee`      |
| `targetType`| string           | `employee`, `department`, `position`, `role` |
| `targetId`  | number           | ID đối tượng bị tác động           |
| `status`    | `SUCCESS` / `FAILURE` | Kết quả hành vi              |
| `dateFrom`  | ISO date string  | Từ ngày — vd `2026-05-01`          |
| `dateTo`    | ISO date string  | Đến ngày — vd `2026-05-31`         |
| `page`      | number (default 1)    | Số trang                      |
| `limit`     | number (default 20, max 100) | Số mục/trang           |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "createdAt": "2026-05-18T08:00:00.000Z",
      "actor": {
        "type": "USER",
        "id": 2,
        "name": "Trần Thị HR",
        "email": "hr@company.com",
        "role": "HR"
      },
      "action": "employee.update",
      "targetType": "employee",
      "targetId": 4,
      "payload": {
        "before": { "fullName": "Nguyễn Văn A", "status": "ACTIVE" },
        "after":  { "fullName": "Nguyễn Văn Anh", "status": "ACTIVE" }
      },
      "status": "SUCCESS",
      "errorMessage": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

### GET /v1/logs/:id

Chi tiết một log entry. Response shape giống phần tử trong mảng ở trên.

**404** nếu không tìm thấy.

---

## Danh sách action strings

| Action                    | Mô tả                              |
| ------------------------- | ---------------------------------- |
| `auth.login`              | Đăng nhập (SUCCESS hoặc FAILURE)   |
| `auth.logout`             | Đăng xuất                          |
| `auth.change_password`    | Đổi mật khẩu                       |
| `employee.create`         | Tạo nhân viên                      |
| `employee.update`         | Cập nhật nhân viên                  |
| `employee.deactivate`     | Vô hiệu hóa nhân viên              |
| `department.create`       | Tạo phòng ban                      |
| `department.update`       | Cập nhật phòng ban                  |
| `department.deactivate`   | Vô hiệu hóa phòng ban              |
| `position.create`         | Tạo chức vụ                        |
| `position.update`         | Cập nhật chức vụ                    |
| `position.deactivate`     | Vô hiệu hóa chức vụ               |
| `role.create`             | Tạo vai trò                        |
| `role.update`             | Cập nhật vai trò                    |
| `role.delete`             | Xóa vai trò (chỉ CUSTOM)           |
| `role.assign_permissions` | Thay thế toàn bộ quyền của vai trò |
| `role.add_employees`      | Thêm nhân viên vào vai trò         |
| `role.remove_employee`    | Xóa nhân viên khỏi vai trò        |

---

## Cấu trúc `payload`

`payload` là JSON tự do, phụ thuộc vào `action`:

- **create**: `{ data: { ...fields } }`
- **update**: `{ before: { ...fields }, after: { ...fields } }`
- **deactivate / delete**: `{ before: { ... }, after: { ... } }` hoặc `{ data: { ... } }`
- **auth.login FAILURE**: `{ email, failedAttempts?, locked? }`

Không phải lúc nào `payload` cũng có đủ tất cả fields — chỉ ghi những gì thay đổi.

---

## Actor

- `actor.type = "USER"`: hành vi do người dùng đã đăng nhập thực hiện — `id`, `name`, `email`, `role` đều có giá trị.
- `actor.type = "SYSTEM"`: hành vi tự động hoặc login failure (chưa xác thực) — `id`, `name`, `email`, `role` có thể là `null`.

---

## Ghi chú quan trọng

- Log failures (lỗi ghi DB) không bao giờ làm fail request chính — chúng được swallow và in ra console.
- `auth.login` FAILURE được ghi ngay cả khi không tìm thấy employee (actor = null).
- Mọi mutation API đều ghi log — tìm kiếm (GET) không được log.
