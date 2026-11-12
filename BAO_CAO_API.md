# Báo cáo API — HR System

_Tạo lúc 2026-11-02 08:44 từ tài liệu nghiệp vụ `bridges/bridges/*.md` (thay cho SRS, xem Quy ước) và Swagger `https://hrs-main-dev.sonthanh.net.vn/api/docs-json`. Phạm vi: 292 API trong 44 nhóm._

## Quy ước đọc báo cáo

- **Nguồn tài liệu:** thư mục làm việc không có file SRS. Báo cáo dùng 21 file bridge doc làm nguồn nghiệp vụ. Đây là tài liệu tích hợp cho frontend, có file cũ hơn Swagger, nên không thay thế hoàn toàn SRS.
- **Thứ tự tin cậy:** Swagger trả lời "hệ thống hiện có gì", bridge trả lời "nghiệp vụ chạy thế nào". Hai bên lệch nhau được ghi ở mục **Điểm cần xác nhận**. Không có mã nguồn backend để xác nhận.
- **Mức xác minh:** chưa đăng nhập và chưa gọi API nghiệp vụ. Chỉ gọi không token các API đọc để kiểm tra đường dẫn: `/v1`, `/v1/health`, một số API trả 401, `/v1/logs` trả 404. Web HRM dev `https://nhan-su-dev.netlify.app/` chưa được đối chiếu.
- **Host:** API `https://hrs-main-dev.sonthanh.net.vn`; đường dẫn trong bảng đã gồm tiền tố `/v1`, trừ 2 API `apple-app-site-association`. Swagger UI nằm ở `/api/docs`, nhưng API không có tiền tố `/api` (`/api/v1/health` trả 404).
- **Xác thực:** header `Authorization: Bearer <accessToken>`, access token hết hạn sau 15 phút. Lấy token qua `POST /v1/auth/login`, làm mới qua `POST /v1/auth/refresh`. 9 API không khai bảo mật trong Swagger: `GET /v1`, `GET /v1/health`, login, refresh, forgot-password, reset-password, `GET /v1/test-reminder-attendance/{userId}` và 2 API `apple-app-site-association`.
- **Role hệ thống:** `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF`, `EMPLOYEE` (enum Swagger). Nguồn role lấy từ bảng "Ai được gọi" của bridge, rồi đến tóm tắt và mô tả Swagger.
- **Cột Role:** `Mọi user đã đăng nhập` nghĩa là tài liệu ghi vậy, hoặc API chỉ phục vụ dữ liệu của người gọi và Swagger không khai 403. `Chưa xác định` nghĩa là không có nguồn; nếu Swagger khai 403 thì API có giới hạn quyền nhưng chưa biết role nào.
- **Cột Trạng thái sau** chỉ ghi khi tài liệu xác nhận API đổi trạng thái. Ô có chữ "suy từ" hoặc "chờ xác nhận" là suy luận từ enum, không phải khẳng định.
- **Phản hồi:** thành công có dạng `{ success: true, data }`, danh sách có thêm `meta`; lỗi có dạng `{ success: false, error: { code, message } }`; 204 không có body; API export trả file nhị phân. Schema trên Swagger không thể hiện lớp bọc này. Số HTTP trong cột Expected result lấy từ Swagger.

**Trạng thái của các đối tượng chính**

| Đối tượng | Trạng thái | Ý nghĩa |
| --- | --- | --- |
| Nhân viên | `ACTIVE`, `INACTIVE`, `ON_LEAVE` | Đang làm, đã vô hiệu hoá, đang nghỉ |
| Bản ghi chấm công | `PRESENT`, `LATE`, `ABSENT`, `HALF_DAY`, `ON_LEAVE`, `HOLIDAY` | Kèm cờ `isLocked` (cron 00:05 khoá), `isManual` |
| Đơn nghỉ phép, đơn bù công | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` | Chờ, duyệt, từ chối, thu hồi |
| Đơn OT | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `AUTO_CANCELLED` | `AUTO_CANCELLED`: quá 7 ngày chưa duyệt |
| Phiếu giải trình | `PENDING`, `PENDING_L2`, `APPROVED`, `REJECTED`, `CANCELLED` | `PENDING_L2` chỉ có trên Swagger |
| Đơn làm online | `PENDING_L1`, `PENDING_L2`, `PENDING_L3`, `COMPLETED`, `REJECTED`, `CANCELLED` | Duyệt tối đa 3 cấp |
| Đơn công tác | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | Báo cáo công tác: `DRAFT`, `SUBMITTED` |
| Đơn văn bản | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` | Từng bước duyệt: `PENDING`, `APPROVED`, `REJECTED`, `WAITING` |
| Hợp đồng | `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED` | `EXPIRED` không có API đổi trực tiếp |
| Thông báo công ty | `ACTIVE`, `RECALLED` | Thu hồi thì ẩn khỏi nhân viên |

## Luồng nghiệp vụ chính: Thiết lập hệ thống và nhận nhân viên mới

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Tạo phòng ban, chức vụ | ADMIN (phòng ban); HR, ADMIN (chức vụ) | `POST /v1/departments`, `POST /v1/positions` | JWT đúng role | Có phòng ban và chức vụ để gán | Phòng ban, chức vụ `isActive = true` |
| Tạo khuôn ca và địa điểm chấm công | HR, ADMIN | `POST /v1/work-shifts`, `POST /v1/check-in-locations` | `radiusMeters` 10–5000 | Có ca và địa điểm | `isActive = true` |
| Tạo nhân viên | HR, ADMIN | `POST /v1/employees` | Email chưa tồn tại | Server sinh `employeeCode` | Nhân viên `ACTIVE` |
| Cấp phép, gán ca, gán địa điểm | HR, ADMIN | `POST /v1/leave-balances/bulk-init/employee/{employeeId}`, `PATCH /v1/shift-schedules/employees/{employeeId}/default-shift`, `POST /v1/check-in-locations/{id}/employees/{employeeId}` | Nhân viên `ACTIVE` | Nhân viên đủ điều kiện check-in và xin nghỉ | Có balance, ca mặc định, địa điểm |
| Tạo và kích hoạt hợp đồng | Chưa xác định | `POST /v1/contracts`, `PATCH /v1/contracts/{id}/activate` | Hợp đồng ở `DRAFT` khi kích hoạt | Hợp đồng có hiệu lực | `ACTIVE` |

## Luồng nghiệp vụ chính: Chấm công hằng ngày và xử lý thiếu công

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Xem thông tin chấm công hôm nay | Nhân viên | `GET /v1/attendance/today-info`, `GET /v1/check-in-locations/me` | Đã được gán ca và địa điểm | Biết ca và nơi được check-in | Không đổi dữ liệu/trạng thái. |
| Check-in | Nhân viên | `POST /v1/attendance/check-in` | Ảnh selfie, GPS trong bán kính, trong khung giờ, chưa check-in | Tạo bản ghi chấm công | Đúng giờ: `PRESENT`; muộn: `LATE` |
| Check-out | Nhân viên | `POST /v1/attendance/check-out` | Đã check-in, bản ghi chưa khoá | Ghi giờ ra | `checkOutAt` được điền |
| Hệ thống khoá bản ghi | Cron 00:05 | Không có API | Bản ghi hôm qua thiếu giờ vào hoặc ra | Khoá bản ghi; quên check-out thì gửi email | `isLocked = true`, `lockReason = AUTO_MIDNIGHT` |
| Tạo đơn bù công | Nhân viên | `POST /v1/makeup-attendance` | Ngày đã qua, bản ghi đã khoá, chưa có đơn PENDING | Tạo đơn | `PENDING` |
| Duyệt đơn bù công | HR, ADMIN, MANAGER | `PATCH /v1/makeup-attendance/{id}/approve`, `PATCH /v1/makeup-attendance/{id}/reject` | Đơn `PENDING`; từ chối cần `reviewNote` | Duyệt: mở khoá và áp giờ; từ chối: giữ khoá | Duyệt: `APPROVED`, `isLocked = false`; từ chối: `REJECTED` |
| Tạo phiếu giải trình | Nhân viên | `GET /v1/violation-requests/me/status`, `POST /v1/violation-requests` | Trước ngày 05 tháng sau, còn quota | Tạo phiếu, gán reviewer | `PENDING` |
| Duyệt phiếu giải trình | Trưởng phòng được phân công | `PATCH /v1/violation-requests/{id}/approve`, `PATCH /v1/violation-requests/{id}/reject` | Phiếu `PENDING`, đúng reviewer | Duyệt: sửa bản ghi chấm công theo loại | `APPROVED` hoặc `REJECTED`; Swagger có thêm `PENDING_L2` |
| HR sửa tay bản ghi | HR, ADMIN | `PATCH /v1/attendance/{id}` | Bản ghi tồn tại | Bản ghi được sửa và mở khoá | `isManual = true`, `isLocked = false` |

## Luồng nghiệp vụ chính: Nghỉ phép

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Xem loại phép và số dư | Nhân viên | `GET /v1/leave-types`, `GET /v1/leave-balances/me` | HR đã cấp phép | Biết số dư | Không đổi dữ liệu/trạng thái. |
| Xem trước P/KL | Nhân viên | `POST /v1/leave-requests/preview` | Đã chọn loại phép và ngày | Trả phần hưởng lương và không lương, không tạo đơn | Không đổi dữ liệu/trạng thái. |
| Tạo đơn | Nhân viên | `POST /v1/leave-requests` | Không trùng đơn PENDING/APPROVED | Tạo đơn, tự gán người duyệt | `PENDING` |
| Thu hồi hoặc xoá đơn | Chủ đơn | `PATCH /v1/leave-requests/{id}/cancel`, `DELETE /v1/leave-requests/{id}` | Đơn `PENDING` | Thu hồi giữ lịch sử; xoá mất hẳn | `CANCELLED` hoặc bị xoá |
| Duyệt hoặc từ chối | Quản lý được giao, HR, ADMIN | `GET /v1/approval/leave-requests`, `PATCH /v1/leave-requests/{id}/approve`, `PATCH /v1/leave-requests/{id}/reject` | Đơn `PENDING`; từ chối cần `rejectNote` | Duyệt: trừ `paidDays`; nửa ngày tạo override ca | `APPROVED` hoặc `REJECTED` |
| Hiệu chỉnh lương | HR, ADMIN | `PATCH /v1/leave-requests/{id}/payroll-split`, `POST /v1/leave-balances/recalculate-requests`, `POST /v1/leave-balances/recalculate` | Đơn đã duyệt; `dryRun` mặc định true | Sửa P/KL rồi tính lại sổ quỹ | Đơn giữ `APPROVED` |

## Luồng nghiệp vụ chính: Làm thêm giờ (OT)

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Xem trước đơn OT | Nhân viên | `GET /v1/overtime-requests/available-locations`, `POST /v1/overtime-requests/preview` | Giới hạn 20 request/60 giây | Trả segment, rate, approver, không lưu DB | Không đổi dữ liệu/trạng thái. |
| Tạo đơn OT | Nhân viên | `POST /v1/overtime-requests` | Trong 30 ngày, 0.5–12 giờ, ngoài giờ ca | Tạo đơn, hạn duyệt 7 ngày | `PENDING` |
| Duyệt hoặc từ chối | ADMIN, MANAGER, CHIEF được phân công | `PATCH /v1/overtime-requests/{id}/approve`, `PATCH /v1/overtime-requests/{id}/reject` | Đơn `PENDING`; HR bị 403 | Cập nhật đơn, gửi push | `APPROVED` hoặc `REJECTED` |
| Xác nhận vị trí OT offline | Chủ đơn | `POST /v1/overtime-requests/{id}/check-location` | `APPROVED`, `OFFLINE`, trong ± 30 phút | Ghi nhận START và END | Chưa xác định |
| Hệ thống tự huỷ | Cron 00:05 | Không có API | `PENDING` quá `autoExpireAt` | Gửi email và push | `AUTO_CANCELLED` |

## Luồng nghiệp vụ chính: Làm việc online

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Tạo đơn | Nhân viên | `POST /v1/online-work-requests` | Có ngày và lý do | Tạo đơn | `PENDING_L1` (chờ xác nhận) |
| Duyệt theo cấp | Approver L1, L2; L3 là CHIEF, DIRECTOR | `GET /v1/approval/online-work-requests`, `PATCH /v1/online-work-requests/{id}/approve` | Đúng cấp | Chuyển cấp hoặc hoàn tất | `PENDING_L2`, `PENDING_L3`, `COMPLETED` (thứ tự chờ xác nhận) |
| Từ chối hoặc huỷ | Approver; chủ đơn | `PATCH /v1/online-work-requests/{id}/reject`, `PATCH /v1/online-work-requests/{id}/cancel` | Huỷ chỉ khi `PENDING_L1` | Dừng luồng | `REJECTED` hoặc `CANCELLED` |

## Luồng nghiệp vụ chính: Công tác

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Tạo và nộp đơn | Nhân viên | `POST /v1/business-trips`, `PATCH /v1/business-trips/{id}/submit` | Sửa, nộp khi `DRAFT` | Đơn gửi người duyệt | `DRAFT`, rồi `PENDING` |
| Duyệt hoặc từ chối | Approver | `GET /v1/approval/business-trips`, `PATCH /v1/business-trips/{id}/approve`, `PATCH /v1/business-trips/{id}/reject` | Đơn `PENDING`; từ chối cần `rejectNote` | Cập nhật đơn | `APPROVED` hoặc `REJECTED` |
| Chuẩn bị phương tiện | HR | `PATCH /v1/business-trips/routes/{routeId}/transport`, `POST /v1/business-trips/routes/{routeId}/upload-ticket` | Lộ trình tồn tại | Lưu phương tiện và vé | Dữ liệu lộ trình được cập nhật |
| Báo cáo công tác | Chưa xác định | `POST /v1/business-trips/{id}/report`, `PATCH /v1/business-trips/{id}/report/submit` | Báo cáo `DRAFT` khi nộp | Nộp báo cáo | Báo cáo `SUBMITTED`; đơn: chưa xác định |

## Luồng nghiệp vụ chính: Đơn văn bản

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Chọn mẫu và tạo đơn | Nhân viên | `GET /v1/general-requests/templates`, `POST /v1/general-requests`, `PATCH /v1/general-requests/{id}/draft` | Mẫu tồn tại | Lưu đơn nháp | `DRAFT` |
| Nộp đơn | Chủ đơn | `GET /v1/general-requests/suggested-approvers`, `PATCH /v1/general-requests/{id}/submit` | Đơn `DRAFT`; có danh sách người duyệt | Đơn vào luồng duyệt | `PENDING` |
| Duyệt theo bước | Người duyệt hiện tại | `PATCH /v1/general-requests/{id}/approve`, `PATCH /v1/general-requests/{id}/reject` | Đến lượt người gọi; từ chối cần `note` | Duyệt bước hoặc dừng | `APPROVED` hoặc `REJECTED` |
| In đơn | Chưa xác định | `POST /v1/general-requests/{id}/print` | Đơn tồn tại | Tăng `printCount` | Trạng thái đơn không đổi |


## Danh mục đầy đủ theo controller

## AI Agent

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Huỷ thao tác agent đã chuẩn bị | Mọi user đã đăng nhập | `POST /v1/agent/actions/{id}/cancel` | JWT hợp lệ. Thao tác agent đang chờ xác nhận, thuộc người gọi. | Huỷ thao tác agent đã chuẩn bị, không thực thi ghi. HTTP 201. | Chưa xác định |
| Xác nhận và thực hiện thao tác agent đã chuẩn bị | Mọi user đã đăng nhập | `POST /v1/agent/actions/{id}/confirm` | JWT hợp lệ. Thao tác còn hiệu lực (bản ghi PENDING tối đa 15 phút); dữ liệu gốc chưa đổi. Body bắt buộc: `payload`. | Thực thi thao tác ghi đúng một lần; bấm hai lần chỉ chạy một lần; dữ liệu gốc đã đổi thì 409 `SUPERSEDED`. HTTP 201. | Thao tác được thực thi; tên trạng thái sau chưa có nguồn. |
| Bảng đánh giá câu trả lời của người dùng | Chưa xác định (Swagger có 403) | `GET /v1/agent/analytics/feedback` | JWT hợp lệ. Mặc định 30 ngày gần nhất. | Trả số lượt theo mức, điểm trung bình thang 1–4, theo chủ đề và tier router, góp ý mới nhất; không trả nội dung hội thoại. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Mức dùng token của chính tôi | Mọi user đã đăng nhập | `GET /v1/agent/analytics/me` | JWT hợp lệ. `employeeId` trong query bị bỏ qua. | Chỉ trả số liệu token của người gọi. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Bảng đo token & chủ đề được hỏi (toàn hệ thống) | Chưa xác định (Swagger có 403) | `GET /v1/agent/analytics/overview` | JWT hợp lệ. Tối đa 366 ngày mỗi lần truy vấn; mặc định 30 ngày. | Trả token, chi phí, chuỗi theo ngày, phân bổ model, chủ đề, top người dùng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Hỏi trợ lý nhân sự | Chưa xác định (Swagger có 403) | `POST /v1/agent/chat` | JWT hợp lệ. Bỏ trống `conversationId` để mở hội thoại mới. Body bắt buộc: `message`. | Trợ lý trả lời, chỉ dùng dữ liệu người gọi có quyền xem. HTTP 201. | Lưu tin nhắn vào hội thoại; không ghi dữ liệu nghiệp vụ nếu chưa confirm. |
| Hỏi trợ lý nhân sự (SSE streaming) | Chưa xác định (Swagger có 403) | `POST /v1/agent/chat/stream` | JWT hợp lệ. Bỏ trống `conversationId` để mở hội thoại mới. Body bắt buộc: `message`. | Trả luồng SSE với sự kiện `status`, `delta`, `done`, `error`. HTTP 200. | Lưu tin nhắn vào hội thoại; không ghi dữ liệu nghiệp vụ nếu chưa confirm. |
| Danh sách hội thoại của tôi | Mọi user đã đăng nhập | `GET /v1/agent/conversations` | JWT hợp lệ. | Chỉ trả hội thoại của người gọi, mới nhất trước; hội thoại đã lưu trữ không hiện. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Đổi tên hội thoại | Mọi user đã đăng nhập | `PATCH /v1/agent/conversations/{id}` | JWT hợp lệ. Hội thoại thuộc người gọi. Body bắt buộc: `title`. | Tên hội thoại được cập nhật. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Lưu trữ hội thoại | Mọi user đã đăng nhập | `DELETE /v1/agent/conversations/{id}` | JWT hợp lệ. Hội thoại thuộc người gọi. | Soft delete, không xoá dữ liệu. HTTP 200. | `ARCHIVED` |
| Toàn bộ tin nhắn của một hội thoại | Mọi user đã đăng nhập | `GET /v1/agent/conversations/{id}/messages` | JWT hợp lệ. Hội thoại thuộc người gọi. | Trả toàn bộ tin nhắn, kèm `feedback` nếu người gọi đã chấm. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Form xác nhận còn hiệu lực của một hội thoại | Mọi user đã đăng nhập | `GET /v1/agent/conversations/{id}/pending-actions` | JWT hợp lệ. Hội thoại thuộc người gọi. | Trả form xác nhận còn hiệu lực để dựng lại sau khi reload. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Đánh giá một câu trả lời của trợ lý | Mọi user đã đăng nhập | `POST /v1/agent/messages/{id}/feedback` | JWT hợp lệ. Câu trả lời thuộc hội thoại của người gọi. Body bắt buộc: `rating`. | Lưu điểm; gửi lại cho cùng câu trả lời là sửa điểm cũ, không tạo bản ghi mới. HTTP 201. | Điểm đánh giá được tạo hoặc ghi đè. |

## App

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Kiểm tra API gốc hoạt động | Công khai | `GET /v1` | Payload, query/path parameter đúng định dạng. | Trả chuỗi xác nhận backend đang chạy. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Kiểm tra trạng thái API và database | Công khai | `GET /v1/health` | Payload, query/path parameter đúng định dạng. | API và DB hoạt động trả 200; DB lỗi trả 503. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Hồ sơ cá nhân của người dùng đang đăng nhập | Mọi user đã đăng nhập | `GET /v1/me` | JWT hợp lệ. | Trả hồ sơ cá nhân của người đang đăng nhập. HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Approval

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Đếm số đơn chờ tôi phê duyệt theo từng module | Mọi user đã đăng nhập | `GET /v1/approval/counts` | JWT hợp lệ. | Trả số đơn PENDING mà người gọi là approver ở mỗi module, dùng cho badge menu. HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Approval - Business Trips

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn công tác chờ tôi phê duyệt | Mọi user đã đăng nhập | `GET /v1/approval/business-trips` | JWT hợp lệ. | Chỉ trả đơn mà người gọi là approver. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn công tác (approver view) | Mọi user đã đăng nhập | `GET /v1/approval/business-trips/{id}` | JWT hợp lệ. Người gọi là approver của đơn. | Chi tiết đơn công tác (approver view). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Approval - Leave Requests

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn nghỉ phép chờ tôi phê duyệt | Mọi user đã đăng nhập | `GET /v1/approval/leave-requests` | JWT hợp lệ. | Trả đơn người gọi là `assignedApprover`; HR thấy thêm đơn `assignedApproverId = null`; ADMIN override không áp dụng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn nghỉ phép (approver view) | Mọi user đã đăng nhập | `GET /v1/approval/leave-requests/{id}` | JWT hợp lệ. Người gọi là approver của đơn. | Chi tiết đơn nghỉ phép (approver view). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Approval - Makeup Attendance

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn bù công chờ tôi phê duyệt | Mọi user đã đăng nhập | `GET /v1/approval/makeup-attendance` | JWT hợp lệ. | Chỉ trả đơn người gọi là `assignedApprover`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn bù công (approver view) | Mọi user đã đăng nhập | `GET /v1/approval/makeup-attendance/{id}` | JWT hợp lệ. Người gọi là approver của đơn. | Chi tiết đơn bù công (approver view). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Approval - Online Work Requests

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn làm online chờ tôi phê duyệt | Mọi user đã đăng nhập | `GET /v1/approval/online-work-requests` | JWT hợp lệ. | Trả đơn được gán L1/L2, đơn đã xử lý ở L3, cộng `PENDING_L3` nếu người gọi là CHIEF/DIRECTOR. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn làm online (approver view) | Mọi user đã đăng nhập | `GET /v1/approval/online-work-requests/{id}` | JWT hợp lệ. Người gọi là approver của đơn. | Chi tiết đơn làm online (approver view). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Approval - Overtime Requests

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn tăng ca chờ tôi phê duyệt | Mọi user đã đăng nhập | `GET /v1/approval/overtime-requests` | JWT hợp lệ. | Chỉ trả đơn người gọi là `assignedApprover`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn tăng ca (approver view) | Mọi user đã đăng nhập | `GET /v1/approval/overtime-requests/{id}` | JWT hợp lệ. Người gọi là approver của đơn. | Chi tiết đơn tăng ca (approver view). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Approval - Violation Requests

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách phiếu giải trình chờ tôi phê duyệt | Mọi user đã đăng nhập | `GET /v1/approval/violation-requests` | JWT hợp lệ. | Chỉ trả phiếu người gọi là `assignedReviewer`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết phiếu giải trình (approver view) | Mọi user đã đăng nhập | `GET /v1/approval/violation-requests/{id}` | JWT hợp lệ. Người gọi là reviewer của phiếu. | Chi tiết phiếu giải trình (approver view). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Attendance

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách chấm công (HR/Admin/Director: toàn công ty, Manager/Chief: phòng ban của mình) | HR, ADMIN, DIRECTOR, MANAGER, CHIEF | `GET /v1/attendance` | JWT hợp lệ. HR/ADMIN/DIRECTOR: toàn công ty; MANAGER/CHIEF: phòng ban của mình. | Trả danh sách bản ghi chấm công có phân trang; EMPLOYEE bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Kiểm tra vị trí GPS so với điểm chấm công gần nhất được gán | Mọi user đã đăng nhập | `GET /v1/attendance/check-attendance` | JWT hợp lệ. Query bắt buộc: `latitude`, `longitude`. | Trả kết quả so vị trí GPS với điểm chấm công gần nhất được gán. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Check-in — Chấm công vào | EMPLOYEE | `POST /v1/attendance/check-in` | JWT hợp lệ. Multipart: ảnh JPG/PNG ≤ 5MB; có ca hôm nay; trong khung giờ; GPS trong bán kính địa điểm được gán; bản ghi chưa khoá; chưa check-in; ngày không phải lịch online. Body bắt buộc: `photo`, `latitude`, `longitude`. | Tạo bản ghi chấm công; lần 2 trả 409 `ATTENDANCE_ALREADY_CHECKED_IN`; bản ghi khoá trả 400. HTTP 201. | Đúng giờ: `PRESENT`; đi muộn: `LATE`; nghỉ nửa ngày: `isHalfDay = true`. |
| Check-out — Chấm công ra | EMPLOYEE | `POST /v1/attendance/check-out` | JWT hợp lệ. Multipart: ảnh JPG/PNG ≤ 5MB; đã check-in; chưa check-out; bản ghi chưa khoá. Body bắt buộc: `photo`, `latitude`, `longitude`. | `checkOutAt` là thời điểm nhận request, `checkOutPhotoUrl` được điền. HTTP 200. | Bản ghi hoàn chỉnh, không bị cron 00:05 khoá. |
| Lịch sử chấm công cá nhân | EMPLOYEE | `GET /v1/attendance/me` | JWT hợp lệ. | Trả lịch sử cá nhân có phân trang, kèm `violationRequests[]`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê chấm công cá nhân theo tháng | Mọi user đã đăng nhập | `GET /v1/attendance/me/stats` | JWT hợp lệ. Query bắt buộc: `year`, `month`. | Trả thống kê chấm công cá nhân theo tháng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy presigned URL để xem ảnh chấm công | Mọi user đã đăng nhập | `GET /v1/attendance/photo-url` | JWT hợp lệ. Query bắt buộc: `fileUrl`. | Trả presigned URL ảnh chấm công, hiệu lực 1 giờ. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Danh sách trạng thái chấm công | Mọi user đã đăng nhập | `GET /v1/attendance/statuses` | JWT hợp lệ. | Trả danh sách trạng thái chấm công. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thông tin chấm công hôm nay | Mọi user đã đăng nhập | `GET /v1/attendance/today-info` | JWT hợp lệ. | Trả ca làm việc, địa điểm chấm công và trạng thái bản ghi hôm nay. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chỉnh sửa thủ công bản ghi chấm công | HR, ADMIN | `PATCH /v1/attendance/{id}` | JWT hợp lệ. Bản ghi tồn tại. | Bản ghi được sửa thủ công, tự mở khoá; EMPLOYEE bị 403. HTTP 200. | `isManual = true`, `isLocked = false`, `distance = null`. |

## attendance

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Test gửi 1 push check-in reminder cho employee | Công khai | `GET /v1/test-reminder-attendance/{userId}` | Endpoint debug; Swagger không khai bảo mật. Không gọi trên dữ liệu thật. | Gửi đúng 1 FCM push tới mọi device token của nhân viên. HTTP 200. | Không đổi dữ liệu; có gửi push thật. |

## Attendance - Locations

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách tất cả địa điểm chấm công | HR, ADMIN | `GET /v1/check-in-locations` | JWT hợp lệ. | Danh sách tất cả địa điểm chấm công. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo địa điểm chấm công mới | HR, ADMIN | `POST /v1/check-in-locations` | JWT hợp lệ. `radiusMeters` trong 10–5000. Body bắt buộc: `name`, `latitude`, `longitude`, `radiusMeters`. | Tạo địa điểm `isActive = true`. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Danh sách địa điểm chấm công được gán cho tôi | EMPLOYEE | `GET /v1/check-in-locations/me` | JWT hợp lệ. | Trả địa điểm được gán; chưa gán trả `[]`; HR/ADMIN gọi bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết địa điểm chấm công | HR, ADMIN | `GET /v1/check-in-locations/{id}` | JWT hợp lệ. | Trả chi tiết địa điểm; không tồn tại trả 404. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật địa điểm chấm công | HR, ADMIN | `PATCH /v1/check-in-locations/{id}` | JWT hợp lệ. Địa điểm tồn tại; `radiusMeters` trong 10–5000. | Địa điểm được cập nhật. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Vô hiệu hóa địa điểm chấm công (soft delete) | HR, ADMIN | `DELETE /v1/check-in-locations/{id}` | JWT hợp lệ. Địa điểm tồn tại. | Soft delete; vẫn thành công khi đang có nhân viên được gán. HTTP 204. | `isActive = false`; nhân viên không check-in được tại đây. |
| Gán toàn bộ nhân viên ACTIVE trong phòng ban vào địa điểm chấm công | HR, ADMIN | `POST /v1/check-in-locations/{id}/departments/{departmentId}` | JWT hợp lệ. Địa điểm và phòng ban tồn tại. | Gán toàn bộ nhân viên ACTIVE của phòng ban vào địa điểm. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Danh sách nhân viên được gán vào địa điểm chấm công | HR, ADMIN | `GET /v1/check-in-locations/{id}/employees` | JWT hợp lệ. Địa điểm tồn tại. | Danh sách nhân viên được gán vào địa điểm chấm công. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Gán nhiều nhân viên vào địa điểm chấm công (bulk) | HR, ADMIN | `POST /v1/check-in-locations/{id}/employees/bulk` | JWT hợp lệ. Địa điểm tồn tại. Body bắt buộc: `employeeIds`. | Gán nhiều nhân viên vào địa điểm. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Gán nhân viên vào địa điểm chấm công | HR, ADMIN | `POST /v1/check-in-locations/{id}/employees/{employeeId}` | JWT hợp lệ. Địa điểm và nhân viên tồn tại; chưa được gán. | Gán nhân viên; đã gán trả 409. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Xóa nhân viên khỏi địa điểm chấm công | HR, ADMIN | `DELETE /v1/check-in-locations/{id}/employees/{employeeId}` | JWT hợp lệ. Nhân viên đang thuộc địa điểm. | Bỏ gán nhân viên khỏi địa điểm. HTTP 204. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## Attendance - Makeup

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn bù công (HR/Admin/Chief: toàn công ty, Manager: phòng ban của mình) | HR, ADMIN, CHIEF, MANAGER | `GET /v1/makeup-attendance` | JWT hợp lệ. HR/ADMIN/CHIEF: toàn công ty; MANAGER: phòng ban của mình. | Trả danh sách đơn bù công có phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo đơn bù công (kèm ảnh evidence tùy chọn) | EMPLOYEE | `POST /v1/makeup-attendance` | JWT hợp lệ. Multipart; ngày đã qua; bản ghi ngày đó tồn tại và đã khoá; có ít nhất giờ vào hoặc giờ ra; giờ ra sau giờ vào; `reason` ≥ 10 ký tự; ảnh JPG/PNG ≤ 5MB nếu có; chưa có đơn PENDING cùng ngày. Body bắt buộc: `attendanceDate`, `reason`. | Tạo đơn bù công; trùng đơn trả 409. HTTP 201. | `PENDING` |
| Danh sách đơn bù công của nhân viên | EMPLOYEE | `GET /v1/makeup-attendance/me` | JWT hợp lệ. | Trả đơn bù công của bản thân có phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn bù công (Owner / HR / Admin / Chief xem tất cả · Manager: phòng ban của mình) | Chính chủ, HR, ADMIN, CHIEF, MANAGER | `GET /v1/makeup-attendance/{id}` | JWT hợp lệ. MANAGER chỉ xem phòng ban của mình. | Chi tiết đơn bù công (Owner / HR / Admin / Chief xem tất cả · Manager: phòng ban của mình). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Duyệt đơn bù công | ADMIN, HR, MANAGER | `PATCH /v1/makeup-attendance/{id}/approve` | JWT hợp lệ. Đơn ở `PENDING`. | Duyệt đơn trong transaction: mở khoá bản ghi và áp giờ từ đơn; gửi email. HTTP 200. | Đơn `APPROVED`; AttendanceRecord `isLocked = false`. |
| Thu hồi đơn bù công (PENDING → CANCELLED, chỉ chính chủ) | Chính chủ | `PATCH /v1/makeup-attendance/{id}/cancel` | JWT hợp lệ. Đơn ở `PENDING`. | Thu hồi đơn. HTTP 200. | `CANCELLED` |
| Từ chối đơn bù công | ADMIN, HR, MANAGER | `PATCH /v1/makeup-attendance/{id}/reject` | JWT hợp lệ. Đơn ở `PENDING`; `reviewNote` bắt buộc theo bridge. | Từ chối đơn; gửi email; nhân viên được tạo đơn mới. HTTP 200. | Đơn `REJECTED`; AttendanceRecord giữ khoá. |

## Attendance - Online Work

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn làm online (HR/Admin: tất cả, Manager: phòng ban) | HR, ADMIN, MANAGER | `GET /v1/online-work-requests` | JWT hợp lệ. HR/ADMIN: tất cả; MANAGER: phòng ban của mình. | Trả danh sách đơn làm online. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo đơn đăng ký làm việc online | Mọi user đã đăng nhập | `POST /v1/online-work-requests` | JWT hợp lệ. Body bắt buộc: `startDate`, `endDate`, `reason`. | Tạo đơn đăng ký làm việc online. HTTP 201. | `PENDING_L1` (cấp đầu theo enum, chờ xác nhận). |
| Danh sách đơn làm online của bản thân | Mọi user đã đăng nhập | `GET /v1/online-work-requests/me` | JWT hợp lệ. | Danh sách đơn làm online của bản thân. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Đơn làm online đang chờ mình duyệt | Chưa xác định (Swagger có 403) | `GET /v1/online-work-requests/pending-for-me` | JWT hợp lệ. | Đơn làm online đang chờ mình duyệt. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Báo cáo đơn làm online theo tháng | Chưa xác định (Swagger có 403) | `GET /v1/online-work-requests/report` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Báo cáo đơn làm online theo tháng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất báo cáo làm online ra Excel | Chưa xác định (Swagger có 403) | `GET /v1/online-work-requests/report/export` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Tải file Excel báo cáo làm online. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn làm online | Chưa xác định (Swagger có 403) | `GET /v1/online-work-requests/{id}` | JWT hợp lệ. | Chi tiết đơn làm online. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Duyệt đơn làm online (service tự validate đúng cấp) | Approver đúng cấp | `PATCH /v1/online-work-requests/{id}/approve` | JWT hợp lệ. Service tự kiểm tra đúng cấp L1/L2/L3; L3 là CHIEF/DIRECTOR. | Duyệt ở cấp hiện tại. HTTP 200. | Sang cấp kế tiếp (`PENDING_L2`, `PENDING_L3`) hoặc `COMPLETED`; thứ tự suy từ enum, chờ xác nhận. |
| Huỷ đơn làm online (chính chủ, chỉ khi PENDING_L1) | Chính chủ | `PATCH /v1/online-work-requests/{id}/cancel` | JWT hợp lệ. Đơn ở `PENDING_L1`. | Huỷ đơn. HTTP 200. | `CANCELLED` |
| Từ chối đơn làm online | Approver đúng cấp | `PATCH /v1/online-work-requests/{id}/reject` | JWT hợp lệ. Đơn đang chờ cấp của người gọi. Body bắt buộc: `rejectNote`. | Từ chối đơn. HTTP 200. | `REJECTED` |

## Attendance - Shifts

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách lịch ca (HR/Admin) | HR, ADMIN | `GET /v1/shift-schedules` | JWT hợp lệ. | Trả lịch ca toàn công ty, không phân trang; EMPLOYEE bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Gán ca làm việc cho nhân viên | HR, ADMIN | `POST /v1/shift-schedules` | JWT hợp lệ. Nhân viên tồn tại; ca tồn tại và `isActive = true`. Body bắt buộc: `employeeId`, `shiftId`, `date`. | Upsert lịch ca ngày đó, trùng ngày thì ghi đè. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Gán ca hàng loạt (tối đa 100 mục) | HR, ADMIN | `POST /v1/shift-schedules/bulk` | JWT hợp lệ. Tối đa 100 mục. Body bắt buộc: `assignments`. | Gán ca hàng loạt, không trả data; quá 100 mục trả 400. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Bulk assign Ca online T7 cho nhân viên trong 1 tháng hoặc cả năm | HR, ADMIN | `POST /v1/shift-schedules/bulk-online-saturday` | JWT hợp lệ. Ca và nhân viên tồn tại. Body bắt buộc: `year`, `employeeIds`, `shiftId`. | Upsert mọi Thứ 7 trong tháng, hoặc cả năm nếu bỏ `month`, với `isOnline = true`. HTTP 201. | Ngày T7 được gán online; cron 23:50 T7 tự tạo `PRESENT`. |
| Gán ca theo khoảng ngày (tối đa 100 nhân viên, 366 ngày) | Chưa xác định (Swagger có 403) | `POST /v1/shift-schedules/bulk-range` | JWT hợp lệ. Tối đa 100 nhân viên, 366 ngày. Body bắt buộc: `fromDate`, `toDate`, `shiftId`, `employeeIds`. | Tự tách thành từng ngày thứ 2–6 và upsert. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Lịch ca theo ngày — calendar view (tối đa 31 ngày) | HR, ADMIN | `GET /v1/shift-schedules/calendar` | JWT hợp lệ. Khoảng tối đa 31 ngày. Query bắt buộc: `startDate`, `endDate`. | Trả lịch theo ngày; `isDefault` phân biệt ca mặc định và override; `shift = null` là không có ca. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Gán ca mặc định cho nhân viên | HR, ADMIN | `PATCH /v1/shift-schedules/employees/{employeeId}/default-shift` | JWT hợp lệ. Nhân viên và ca tồn tại. Body bắt buộc: `shiftId`. | Gán ca mặc định, không trả data. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Lịch ca của tôi (mặc định: tuần hiện tại) — mọi role đã đăng nhập | Mọi user đã đăng nhập | `GET /v1/shift-schedules/me` | JWT hợp lệ. Mặc định tuần hiện tại. | Trả lịch ca của tôi, không phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xóa lịch ca của nhân viên theo ngày | HR, ADMIN | `DELETE /v1/shift-schedules/{employeeId}/{date}` | JWT hợp lệ. Lịch ca ngày đó tồn tại. | Xoá override; nhân viên quay về `defaultShiftId`. HTTP 204. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## Attendance - Violations

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách phiếu giải trình (HR/Admin: tất cả, Manager: phòng ban mình) | HR, ADMIN, MANAGER | `GET /v1/violation-requests` | JWT hợp lệ. HR/ADMIN: tất cả; MANAGER: phòng mình, `departmentId` bị bỏ qua. Mặc định tháng hiện tại. | Trả danh sách phiếu có phân trang; EMPLOYEE bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo phiếu giải trình vi phạm chuyên cần | Mọi user đã đăng nhập | `POST /v1/violation-requests` | JWT hợp lệ. Multipart; trước deadline ngày 05 tháng sau; còn quota; `reason` ≥ 10 ký tự; `FORGOT_CHECKIN` cần `requestedCheckIn`, bản ghi đã khoá, chưa có phiếu PENDING/APPROVED cùng bản ghi. Body bắt buộc: `type`, `violationDate`, `reason`. | Tạo phiếu, gán `assignedReviewer`; trùng phiếu trả 409, quá hạn hoặc hết quota trả 400. HTTP 201. | `PENDING` |
| Danh sách phiếu giải trình của nhân viên | Mọi user đã đăng nhập | `GET /v1/violation-requests/me` | JWT hợp lệ. | Trả phiếu của bản thân có phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Trạng thái duyệt tháng của nhân viên | Mọi user đã đăng nhập | `GET /v1/violation-requests/me/status` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Bridge: `usedCount`, `remaining`, `isBlocked`, `blockedMessage`. Swagger: tổng `slotCost` và `isNextMultiLevel`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê vi phạm theo tháng | HR, ADMIN | `GET /v1/violation-requests/report` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Trả thống kê vi phạm theo nhân viên; số đếm chỉ tính phiếu APPROVED. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết phiếu giải trình | Chưa xác định (Swagger có 403) | `GET /v1/violation-requests/{id}` | JWT hợp lệ. | Chi tiết phiếu giải trình. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Duyệt phiếu giải trình | MANAGER được phân công; HR, ADMIN khi phiếu không có reviewer | `PATCH /v1/violation-requests/{id}/approve` | JWT hợp lệ. Phiếu ở `PENDING`; người gọi là `assignedReviewer`. | Duyệt phiếu và cập nhật bản ghi chấm công theo loại vi phạm. HTTP 200. | Bridge: `APPROVED`; Swagger có thêm `PENDING_L2` với phiếu đa cấp. LATE/EARLY: bản ghi về `PRESENT`; FORGOT_CHECKIN: bản ghi mở khoá. |
| Thu hồi phiếu giải trình (chính chủ) | Chính chủ | `PATCH /v1/violation-requests/{id}/cancel` | JWT hợp lệ. Phiếu ở `PENDING`. | Thu hồi phiếu, trả lại quota; người khác gọi bị 403. HTTP 200. | `CANCELLED` |
| Từ chối phiếu giải trình | MANAGER được phân công; HR, ADMIN khi phiếu không có reviewer | `PATCH /v1/violation-requests/{id}/reject` | JWT hợp lệ. Người gọi là `assignedReviewer`; `reviewNote` bắt buộc theo bridge. | Từ chối phiếu, trả lại quota. HTTP 200. | `REJECTED` |

## auth

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Upload ảnh đại diện (JPG/PNG, tối đa 2MB) | Mọi user đã đăng nhập | `POST /v1/auth/avatar` | JWT hợp lệ. Multipart; JPG/PNG ≤ 2MB. Body bắt buộc: `file`. | Lưu ảnh đại diện, trả profile với `avatarUrl` presigned 1 giờ. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Đổi mật khẩu | Mọi user đã đăng nhập | `PATCH /v1/auth/change-password` | JWT hợp lệ. Body bắt buộc: `currentPassword`, `newPassword`. | Đổi mật khẩu; không có body trả về. HTTP 204. | Mật khẩu mới có hiệu lực. |
| Yêu cầu đặt lại mật khẩu (gửi link qua email) | Công khai | `POST /v1/auth/forgot-password` | Payload, query/path parameter đúng định dạng. Body bắt buộc: `email`. | Gửi link đặt lại mật khẩu qua email; không có body trả về. HTTP 204. | Không đổi mật khẩu; phát sinh token đặt lại. |
| Đăng nhập | Công khai | `POST /v1/auth/login` | Tài khoản hợp lệ. Sai 5 lần khoá 30 phút. Body bắt buộc: `identifier`, `password`. | Trả `accessToken` (15 phút), `token`, `refreshToken`, `user`. HTTP 200. | Phiên đăng nhập được tạo. |
| Đăng xuất | Mọi user đã đăng nhập | `POST /v1/auth/logout` | JWT hợp lệ. | Kết thúc phiên; không có body trả về. HTTP 204. | Phiên đăng xuất; token còn dùng được hay không chưa có nguồn. |
| Thông tin người dùng đang đăng nhập (gồm danh sách permissions) | Mọi user đã đăng nhập | `GET /v1/auth/me` | JWT hợp lệ. | Trả thông tin người dùng gồm `role` và `permissions`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật thông tin cá nhân (họ tên, email, SĐT, ngày sinh, giới tính, địa chỉ) | Mọi user đã đăng nhập | `PATCH /v1/auth/profile` | JWT hợp lệ. `fullName` 2–100 ký tự; `gender` thuộc Nam/Nữ/Khác; ngày dạng `YYYY-MM-DD`. | Chỉ cập nhật field gửi lên của chính mình; email trùng trả 409 `EMPLOYEE_EMAIL_EXISTS`; body rỗng vẫn 200. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Làm mới access token | Công khai | `POST /v1/auth/refresh` | `refreshToken` còn hiệu lực. Body bắt buộc: `refreshToken`. | Trả access token mới. HTTP 200. | Phiên được gia hạn. |
| Đặt lại mật khẩu bằng token từ email | Công khai | `POST /v1/auth/reset-password` | Token từ email còn hiệu lực. Body bắt buộc: `token`, `newPassword`. | Đặt lại mật khẩu; không có body trả về. HTTP 204. | Mật khẩu mới có hiệu lực. |

## Business Trips

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn công tác (HR/Admin: tất cả, Manager: phòng ban) | HR, ADMIN, MANAGER | `GET /v1/business-trips` | JWT hợp lệ. HR/ADMIN: tất cả; MANAGER: phòng ban. | Danh sách đơn công tác (HR/Admin: tất cả, Manager: phòng ban). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo đơn công tác mới | Mọi user đã đăng nhập | `POST /v1/business-trips` | JWT hợp lệ. Body bắt buộc: `title`, `destination`, `purpose`, `startDate`, `endDate`, `routes`. | Tạo đơn công tác, có thể tạo hộ qua `createdForEmployeeId`. HTTP 201. | `DRAFT` (suy từ enum và điều kiện sửa, chờ xác nhận). |
| Danh sách đơn công tác của bản thân | Mọi user đã đăng nhập | `GET /v1/business-trips/me` | JWT hợp lệ. | Danh sách đơn công tác của bản thân. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Đơn công tác đang chờ mình duyệt | Chưa xác định (Swagger có 403) | `GET /v1/business-trips/pending-for-me` | JWT hợp lệ. | Đơn công tác đang chờ mình duyệt. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Đồng bộ lại bản ghi chấm công cho đơn công tác đã duyệt | Chưa xác định (Swagger có 403) | `POST /v1/business-trips/resync-attendance` | JWT hợp lệ. Nên chạy `dryRun = true` trước. | Sửa ngày công tác ghi nhầm ABSENT; idempotent; không ghi đè bản ghi tự check-in hoặc ngày nghỉ phép. HTTP 200. | Bản ghi chấm công ngày công tác được đồng bộ. |
| HR cập nhật phương tiện cho một lộ trình (hoặc đánh dấu tự túc) | HR | `PATCH /v1/business-trips/routes/{routeId}/transport` | JWT hợp lệ. Lộ trình tồn tại. | Cập nhật phương tiện hoặc đánh dấu tự túc. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Upload ảnh vé phương tiện cho lộ trình | Chưa xác định (Swagger có 403) | `POST /v1/business-trips/routes/{routeId}/upload-ticket` | JWT hợp lệ. Multipart; lộ trình tồn tại. Body bắt buộc: `file`. | Lưu ảnh vé cho lộ trình. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Chi tiết đơn công tác | Chưa xác định (Swagger có 403) | `GET /v1/business-trips/{id}` | JWT hợp lệ. | Chi tiết đơn công tác. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật đơn công tác (chỉ khi DRAFT) | Chủ đơn (suy luận, chờ xác nhận) | `PATCH /v1/business-trips/{id}` | JWT hợp lệ. Đơn ở `DRAFT`. | Cập nhật đơn công tác. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Duyệt đơn công tác | Approver của đơn | `PATCH /v1/business-trips/{id}/approve` | JWT hợp lệ. Đơn ở `PENDING`. | Duyệt đơn; chấm công ngày công tác được đồng bộ. HTTP 200. | `APPROVED` |
| Huỷ đơn công tác (khi ở DRAFT hoặc PENDING) | Chủ đơn (suy luận, chờ xác nhận) | `PATCH /v1/business-trips/{id}/cancel` | JWT hợp lệ. Đơn ở `DRAFT` hoặc `PENDING`. | Huỷ đơn. HTTP 200. | `CANCELLED` |
| Từ chối đơn công tác | Approver của đơn | `PATCH /v1/business-trips/{id}/reject` | JWT hợp lệ. Đơn ở `PENDING`. Body bắt buộc: `rejectNote`. | Từ chối đơn. HTTP 200. | `REJECTED` |
| Tạo báo cáo công tác | Chưa xác định (Swagger có 403) | `POST /v1/business-trips/{id}/report` | JWT hợp lệ. Đơn tồn tại; điều kiện trạng thái đơn chưa có nguồn. Body bắt buộc: `summary`, `results`. | Tạo báo cáo công tác. HTTP 201. | Báo cáo `DRAFT` (suy từ điều kiện sửa, chờ xác nhận). |
| Cập nhật báo cáo công tác (chỉ khi DRAFT) | Chưa xác định (Swagger có 403) | `PATCH /v1/business-trips/{id}/report` | JWT hợp lệ. Báo cáo ở `DRAFT`. | Cập nhật báo cáo công tác. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Nộp báo cáo công tác | Chưa xác định (Swagger có 403) | `PATCH /v1/business-trips/{id}/report/submit` | JWT hợp lệ. Báo cáo ở `DRAFT`. | Nộp báo cáo công tác. HTTP 200. | Báo cáo `SUBMITTED`; đơn có sang `COMPLETED` hay không chưa có nguồn. |
| Nộp đơn công tác để duyệt | Chủ đơn (suy luận, chờ xác nhận) | `PATCH /v1/business-trips/{id}/submit` | JWT hợp lệ. Đơn ở `DRAFT`. | Nộp đơn để duyệt, có thể chỉ định `approverId`. HTTP 200. | `PENDING` |
| Upload file đính kèm báo cáo công tác (tối đa 10 files) | Chưa xác định (Swagger có 403) | `POST /v1/business-trips/{id}/upload-attachment` | JWT hợp lệ. Multipart; tối đa 10 file. Body bắt buộc: `files`. | Lưu file đính kèm báo cáo. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## company-announcements

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| ADMIN/HR/DIRECTOR/MANAGER/CHIEF xem danh sách thông báo đã gửi | HR, ADMIN, DIRECTOR, MANAGER, CHIEF | `GET /v1/company-announcements` | JWT hợp lệ. | Trả danh sách tinh gọn; không có body, attachments, links, recipientCount. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| HR/ADMIN tạo thông báo công ty và broadcast | HR, ADMIN | `POST /v1/company-announcements` | JWT hợp lệ. Body bắt buộc: `title`, `body`, `announcementType`. | Tạo thông báo và broadcast tới người nhận. HTTP 201. | `ACTIVE` |
| Xóa comment (soft delete) | Chủ comment, HR, ADMIN | `DELETE /v1/company-announcements/comments/{commentId}` | JWT hợp lệ. Comment tồn tại. | Soft delete: nội dung thành `[Bình luận đã bị xóa]`, `mentionIds` bị xoá. HTTP 204. | `isDeleted = true` |
| Thông báo công ty của tôi (danh sách tinh gọn) | Mọi user đã đăng nhập | `GET /v1/company-announcements/my` | JWT hợp lệ. | Trả danh sách tinh gọn kèm `isRead`, `readAt`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết một thông báo dành cho tôi | Mọi user đã đăng nhập | `GET /v1/company-announcements/my/{id}` | JWT hợp lệ. Người gọi là người nhận; thông báo chưa thu hồi. | Trả full nội dung; không phải người nhận hoặc đã thu hồi trả 404. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Danh sách loại thông báo (metadata) | Mọi user đã đăng nhập | `GET /v1/company-announcements/types` | JWT hợp lệ. | Trả enum `announcementType` kèm nhãn tiếng Việt. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Upload ảnh/video để chèn vào body announcement (WYSIWYG editor) | Chưa xác định (Swagger có 403) | `POST /v1/company-announcements/upload-inline-media` | JWT hợp lệ. Ảnh JPG/PNG/GIF/WebP ≤ 5MB; video MP4/WebM/MOV ≤ 50MB. Body bắt buộc: `file`. | Trả URL vĩnh viễn, file lưu trên disk server. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| ADMIN/HR/DIRECTOR/MANAGER/CHIEF xem chi tiết + trạng thái đọc | HR, ADMIN, DIRECTOR, MANAGER, CHIEF | `GET /v1/company-announcements/{id}` | JWT hợp lệ. | Trả chi tiết và trạng thái đọc. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| HR/ADMIN xoá thông báo (cascade recipients) | HR, ADMIN | `DELETE /v1/company-announcements/{id}` | JWT hợp lệ. Thông báo tồn tại. | Xoá thông báo, cascade recipients. HTTP 204. | Bản ghi bị xoá. |
| Lấy danh sách comments của thông báo | Mọi user đã đăng nhập | `GET /v1/company-announcements/{id}/comments` | JWT hợp lệ. | Trả comment gốc và replies; comment đã xoá không xuất hiện. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thêm comment hoặc reply | Mọi user đã đăng nhập | `POST /v1/company-announcements/{id}/comments` | JWT hợp lệ. Mention dạng `@[fullName](employeeId)`; chỉ reply vào comment gốc. Body bắt buộc: `content`. | Thêm comment; reply của reply trả 400. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Danh sách nhân viên có thể @mention trong comment của announcement | Mọi user đã đăng nhập | `GET /v1/company-announcements/{id}/mentionable-employees` | JWT hợp lệ. | Trả recipients ACTIVE, creator và HR ACTIVE; `avatarUrl` presigned 3600s. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| React hoặc bỏ react thông báo | Người nhận, HR, ADMIN | `POST /v1/company-announcements/{id}/react` | JWT hợp lệ. Body bắt buộc: `emoji`. | Toggle: cùng emoji bỏ react, khác emoji đổi, mới thì thêm. HTTP 200. | Reaction `added`, `changed` hoặc `removed`. |
| Lấy danh sách reactions của thông báo | Mọi user đã đăng nhập | `GET /v1/company-announcements/{id}/reactions` | JWT hợp lệ. | Trả tổng theo emoji, người đã react và reaction của user hiện tại. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Nhân viên đánh dấu thông báo đã đọc | Người nhận | `PATCH /v1/company-announcements/{id}/read` | JWT hợp lệ. | Đánh dấu đã đọc; không có body trả về. HTTP 204. | `isRead = true` |
| ADMIN/HR/DIRECTOR/MANAGER/CHIEF xem ai đã/chưa đọc thông báo | HR, ADMIN, DIRECTOR, MANAGER, CHIEF | `GET /v1/company-announcements/{id}/read-status` | JWT hợp lệ. | Trả ai đã đọc và chưa đọc. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| HR/ADMIN thu hồi thông báo — ẩn khỏi mọi query của employee, giữ nguyên trong DB | HR, ADMIN | `PATCH /v1/company-announcements/{id}/recall` | JWT hợp lệ. Thông báo chưa thu hồi. | Ẩn khỏi mọi query của employee, giữ trong DB. HTTP 200. | `RECALLED` |

## contracts

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách hợp đồng (HR/Admin/Director/Chief: toàn công ty; Manager: phòng mình) | HR, ADMIN, DIRECTOR, CHIEF, MANAGER | `GET /v1/contracts` | JWT hợp lệ. MANAGER chỉ phòng mình. | Trả danh sách hợp đồng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo hợp đồng mới | Chưa xác định | `POST /v1/contracts` | JWT hợp lệ. Số hợp đồng chưa tồn tại (409 nếu trùng). Body bắt buộc: `employeeId`, `contractNumber`, `contractType`, `startDate`. | Tạo hợp đồng. HTTP 201. | `DRAFT` (suy từ API kích hoạt, chờ xác nhận). |
| Import hợp đồng hàng loạt từ file Excel (all-or-nothing) | Chưa xác định | `POST /v1/contracts/import` | JWT hợp lệ. File Excel theo template. Body bắt buộc: `file`. | All-or-nothing: có dòng lỗi thì không tạo gì, lỗi nằm ở `error.errors`; file gốc được lưu. HTTP 201. | Các hợp đồng được tạo. |
| Tải file Excel template dùng để import hợp đồng | Chưa xác định | `GET /v1/contracts/import/template` | JWT hợp lệ. | Tải file Excel template. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Hợp đồng của tôi | Mọi user đã đăng nhập | `GET /v1/contracts/me` | JWT hợp lệ. | Hợp đồng của tôi. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết hợp đồng | Chưa xác định | `GET /v1/contracts/{id}` | JWT hợp lệ. | Chi tiết hợp đồng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật hợp đồng (chỉ khi DRAFT) | Chưa xác định | `PATCH /v1/contracts/{id}` | JWT hợp lệ. Hợp đồng ở `DRAFT`. | Cập nhật hợp đồng. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Kích hoạt hợp đồng DRAFT → ACTIVE | Chưa xác định | `PATCH /v1/contracts/{id}/activate` | JWT hợp lệ. Hợp đồng ở `DRAFT`. | Kích hoạt hợp đồng. HTTP 200. | `ACTIVE` |
| Chấm dứt hợp đồng ACTIVE → TERMINATED | Chưa xác định | `PATCH /v1/contracts/{id}/terminate` | JWT hợp lệ. Hợp đồng ở `ACTIVE`. | Chấm dứt hợp đồng. HTTP 200. | `TERMINATED` |

## Dashboard

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Dashboard stats theo role | HR, ADMIN, DIRECTOR, CHIEF, MANAGER, EMPLOYEE | `GET /v1/dashboard` | JWT hợp lệ. Phạm vi theo role. | HR/ADMIN/DIRECTOR/CHIEF: toàn công ty; MANAGER: phòng ban; EMPLOYEE: cá nhân. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Danh sách nhân viên mới theo khoảng thời gian | Chưa xác định (Swagger có 403) | `GET /v1/dashboard/new-hires` | JWT hợp lệ. Query bắt buộc: `from_date`, `to_date`. | Danh sách nhân viên mới theo khoảng thời gian. HTTP 200. | Không đổi dữ liệu/trạng thái. |

## departments

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách phòng ban | Mọi user đã đăng nhập | `GET /v1/departments` | JWT hợp lệ. | Trả danh sách phân trang; không truyền `isActive` thì gồm cả inactive. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo phòng ban mới | ADMIN | `POST /v1/departments` | JWT hợp lệ. `managerId` nếu có phải tồn tại. Body bắt buộc: `name`. | Tạo phòng ban; không phải ADMIN trả 403. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Chi tiết phòng ban | Mọi user đã đăng nhập | `GET /v1/departments/{id}` | JWT hợp lệ. | Trả chi tiết; không tồn tại trả 404. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật phòng ban | ADMIN | `PATCH /v1/departments/{id}` | JWT hợp lệ. Phòng ban tồn tại. | Cập nhật phòng ban. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Vô hiệu hóa phòng ban (soft delete) | ADMIN | `DELETE /v1/departments/{id}` | JWT hợp lệ. Phòng ban tồn tại. | Soft delete, gọi lại vẫn thành công; nhân viên không bị ảnh hưởng. HTTP 204. | `isActive = false` |
| Chuyển quyền trưởng phòng sang nhân viên khác trong cùng phòng ban | Chưa xác định (Swagger có 403) | `PATCH /v1/departments/{id}/manager` | JWT hợp lệ. Nhân viên mới thuộc cùng phòng ban. Body bắt buộc: `employeeId`. | Chuyển quyền trưởng phòng. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## device-tokens

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Đăng ký FCM device token | Mọi user đã đăng nhập | `POST /v1/device-tokens` | JWT hợp lệ. Body bắt buộc: `token`, `platform`. | Đăng ký FCM device token của user. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Huỷ đăng ký FCM device token (logout / uninstall) | Mọi user đã đăng nhập | `DELETE /v1/device-tokens` | JWT hợp lệ. Query bắt buộc: `token`. | Huỷ đăng ký token khi logout hoặc gỡ app. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## employee-citizen-id

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Xem CCCD của nhân viên | Chưa xác định (Swagger có 403) | `GET /v1/employees/{employeeId}/citizen-id` | JWT hợp lệ. | Xem CCCD của nhân viên. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo CCCD cho nhân viên | Chưa xác định | `POST /v1/employees/{employeeId}/citizen-id` | JWT hợp lệ. Chưa có CCCD; số CCCD không trùng (409). Body bắt buộc: `citizenIdNumber`, `issuedDate`. | Tạo CCCD và ghi log. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Cập nhật CCCD của nhân viên | Chưa xác định | `PATCH /v1/employees/{employeeId}/citizen-id` | JWT hợp lệ. CCCD tồn tại; số CCCD không trùng (409). | Cập nhật CCCD và ghi log. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Xoá CCCD của nhân viên | Chưa xác định | `DELETE /v1/employees/{employeeId}/citizen-id` | JWT hợp lệ. CCCD tồn tại. | Xoá CCCD và ghi log. HTTP 204. | CCCD bị xoá. |
| Lịch sử thay đổi CCCD | Chưa xác định (Swagger có 403) | `GET /v1/employees/{employeeId}/citizen-id/history` | JWT hợp lệ. | Trả log thay đổi: create, update, upload_photos, delete. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Upload ảnh CCCD (mặt trước + mặt sau) | Chưa xác định | `POST /v1/employees/{employeeId}/citizen-id/photos` | JWT hợp lệ. Gửi đủ `front` và `back`; mỗi ảnh ≤ 5MB, JPG/PNG/WebP. Body bắt buộc: `front`, `back`. | Lưu ảnh 2 mặt CCCD. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## employee-identity

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Nhân viên tự xem CCCD + hộ chiếu của mình (phải nhập lại mật khẩu) | Mọi user đã đăng nhập | `POST /v1/employees/me/identity` | JWT hợp lệ. Nhập lại mật khẩu; sai 5 lần khoá 30 phút, chung bộ đếm đăng nhập; giới hạn 30 request/5 phút theo IP. Body bắt buộc: `password`. | Trả CCCD và hộ chiếu của chính mình; mỗi khối có thể `null`. HTTP 201. | Không đổi dữ liệu/trạng thái. |

## employee-passport

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Xem hộ chiếu của nhân viên | Chưa xác định (Swagger có 403) | `GET /v1/employees/{employeeId}/passport` | JWT hợp lệ. | Xem hộ chiếu của nhân viên. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo hộ chiếu cho nhân viên | Chưa xác định | `POST /v1/employees/{employeeId}/passport` | JWT hợp lệ. Chưa có hộ chiếu; số hộ chiếu không trùng (409). Body bắt buộc: `passportNumber`, `fullNameOnPassport`, `passportType`, `issuedDate`, `expiryDate`. | Tạo hộ chiếu. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Cập nhật hộ chiếu của nhân viên | Chưa xác định | `PATCH /v1/employees/{employeeId}/passport` | JWT hợp lệ. Hộ chiếu tồn tại. | Cập nhật hộ chiếu. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Xoá hộ chiếu của nhân viên | Chưa xác định | `DELETE /v1/employees/{employeeId}/passport` | JWT hợp lệ. Hộ chiếu tồn tại. | Xoá hộ chiếu. HTTP 204. | Hộ chiếu bị xoá. |
| Upload 1 ảnh hộ chiếu (front hoặc back) | Chưa xác định | `POST /v1/employees/{employeeId}/passport/photos/{side}` | JWT hợp lệ. `side` là `front` hoặc `back`; ≤ 5MB, JPG/PNG/WebP. Body bắt buộc: `file`. | Lưu 1 mặt ảnh; không bắt buộc đủ 2 mặt. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Xoá 1 ảnh hộ chiếu (front hoặc back) | Chưa xác định | `DELETE /v1/employees/{employeeId}/passport/photos/{side}` | JWT hợp lệ. `side` là `front` hoặc `back`. | Xoá 1 mặt ảnh. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## employees

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách nhân viên toàn công ty | HR, ADMIN | `GET /v1/employees` | JWT hợp lệ. | Trả danh sách có phân trang; `search` theo `fullName`, `email`, `employeeCode`; không truyền `status` thì gồm cả INACTIVE; EMPLOYEE bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo nhân viên mới | HR, ADMIN | `POST /v1/employees` | JWT hợp lệ. Email chưa tồn tại (409); `password` tối thiểu 6 ký tự. Body bắt buộc: `fullName`, `email`, `password`, `joinDate`, `role`. | Tạo nhân viên, server sinh `employeeCode`, không trả password. HTTP 201. | Nhân viên `ACTIVE`. |
| Danh bạ công ty — nhóm theo phòng ban | Mọi user đã đăng nhập | `GET /v1/employees/directory` | JWT hợp lệ. | Trả danh bạ nhóm theo phòng ban. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Import nhân sự hàng loạt từ file Excel (all-or-nothing) | Chưa xác định | `POST /v1/employees/import` | JWT hợp lệ. File Excel; phòng ban phải tồn tại. Body bắt buộc: `file`. | All-or-nothing; chức vụ chưa có được tự tạo; gửi welcome email cho từng nhân viên; file gốc được lưu. HTTP 201. | Các nhân viên được tạo. |
| Hồ sơ cá nhân | Mọi user đã đăng nhập | `GET /v1/employees/me` | JWT hợp lệ. | Trả thông tin bản thân. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tài liệu của tôi | Mọi user đã đăng nhập | `GET /v1/employees/me/documents` | JWT hợp lệ. | Trả tài liệu của mình, mới nhất trước. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xóa tài liệu của nhân viên | HR, ADMIN | `DELETE /v1/employees/{employeeId}/documents/{documentId}` | JWT hợp lệ. Tài liệu tồn tại. | Xoá tài liệu. HTTP 204. | Tài liệu bị xoá. |
| Lấy presigned URL để xem/download tài liệu | Mọi user đã đăng nhập | `GET /v1/employees/{employeeId}/documents/{documentId}/url` | JWT hợp lệ. Tài liệu tồn tại. | Trả `presignedUrl` hiệu lực 1 giờ. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết nhân viên | Bản thân, ADMIN, HR, MANAGER | `GET /v1/employees/{id}` | JWT hợp lệ. | Trả chi tiết; EMPLOYEE xem người khác bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật nhân viên | HR, ADMIN | `PATCH /v1/employees/{id}` | JWT hợp lệ. Nhân viên tồn tại; không đổi được `email`, `password`. | Cập nhật thông tin nhân viên. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Vô hiệu hóa nhân viên (soft delete) | ADMIN | `DELETE /v1/employees/{id}` | JWT hợp lệ. Nhân viên đang chưa INACTIVE (bridge: đã inactive trả 400). | Soft delete, không xoá dữ liệu. HTTP 204. | `INACTIVE` |
| Danh sách tài liệu của nhân viên | HR, ADMIN, MANAGER | `GET /v1/employees/{id}/documents` | JWT hợp lệ. Nhân viên tồn tại. | Trả danh sách tài liệu; EMPLOYEE bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Upload tài liệu cho nhân viên | HR, ADMIN | `POST /v1/employees/{id}/documents` | JWT hợp lệ. Multipart; PDF/DOCX/JPG/PNG ≤ 10MB; tối đa 20 tài liệu mỗi nhân viên. Body bắt buộc: `file`, `type`. | Lưu tài liệu lên S3. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Reset mật khẩu nhân viên về dạng ho_ten@ma_nhanvien | Chưa xác định (Swagger có 403) | `POST /v1/employees/{id}/reset-password` | JWT hợp lệ. Nhân viên tồn tại. | Đặt lại mật khẩu về dạng `ho_ten@ma_nhanvien`. HTTP 200. | Mật khẩu cũ hết hiệu lực. |

## General Requests

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách tất cả đơn văn bản (HR/Admin/Manager) | HR, ADMIN, MANAGER | `GET /v1/general-requests` | JWT hợp lệ. | Danh sách tất cả đơn văn bản (HR/Admin/Manager). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo đơn văn bản mới | Mọi user đã đăng nhập | `POST /v1/general-requests` | JWT hợp lệ. Mẫu văn bản tồn tại. Body bắt buộc: `templateId`, `title`, `fieldValues`. | Tạo đơn văn bản. HTTP 201. | `DRAFT` (suy từ API lưu nháp và nộp đơn, chờ xác nhận). |
| Danh sách đơn văn bản — HR/Admin thấy toàn bộ, Manager/Chief thấy đơn liên quan (tạo hoặc duyệt), Employee thấy đơn của mình | Mọi user đã đăng nhập | `GET /v1/general-requests/me` | JWT hợp lệ. HR/ADMIN: toàn bộ; MANAGER/CHIEF: đơn tạo hoặc duyệt; EMPLOYEE: của mình. | Trả danh sách đơn theo phạm vi role. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Đơn văn bản đang chờ mình duyệt | Chưa xác định (Swagger có 403) | `GET /v1/general-requests/pending-for-me` | JWT hợp lệ. | Đơn văn bản đang chờ mình duyệt. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Gợi ý người duyệt cho đơn văn bản | Mọi user đã đăng nhập | `GET /v1/general-requests/suggested-approvers` | JWT hợp lệ. | Gợi ý người duyệt cho đơn văn bản. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Danh sách mẫu văn bản | Mọi user đã đăng nhập | `GET /v1/general-requests/templates` | JWT hợp lệ. | Danh sách mẫu văn bản. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo mẫu văn bản mới (HR/Admin) | HR, ADMIN | `POST /v1/general-requests/templates` | JWT hợp lệ. Body bắt buộc: `name`, `category`, `fields`, `printTemplate`. | Tạo mẫu văn bản. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Chi tiết mẫu văn bản | Mọi user đã đăng nhập | `GET /v1/general-requests/templates/{id}` | JWT hợp lệ. | Chi tiết mẫu văn bản. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật mẫu văn bản (HR/Admin) | HR, ADMIN | `PATCH /v1/general-requests/templates/{id}` | JWT hợp lệ. Mẫu tồn tại. | Cập nhật mẫu văn bản. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Chi tiết đơn văn bản | Chưa xác định (Swagger có 403) | `GET /v1/general-requests/{id}` | JWT hợp lệ. | Chi tiết đơn văn bản. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Duyệt đơn (người duyệt hiện tại) | Người duyệt hiện tại | `PATCH /v1/general-requests/{id}/approve` | JWT hợp lệ. Đơn ở `PENDING`, đến lượt người gọi. | Duyệt bước hiện tại. HTTP 200. | Bước duyệt `APPROVED`; hết bước thì đơn `APPROVED`, còn bước thì giữ `PENDING` (suy từ `ApproverStepDto`, chờ xác nhận). |
| Thu hồi đơn (chủ nhân, chỉ khi chưa được duyệt hoàn tất) | Chủ đơn | `PATCH /v1/general-requests/{id}/cancel` | JWT hợp lệ. Đơn chưa được duyệt hoàn tất. | Thu hồi đơn. HTTP 200. | `CANCELLED` |
| Lưu nháp đơn (chỉ khi DRAFT) | Chủ đơn (suy luận, chờ xác nhận) | `PATCH /v1/general-requests/{id}/draft` | JWT hợp lệ. Đơn ở `DRAFT`. Body bắt buộc: `fieldValues`. | Lưu nháp `fieldValues`. HTTP 200. | `DRAFT` |
| In đơn — tăng printCount, trả về template + fieldValues | Chưa xác định (Swagger có 403) | `POST /v1/general-requests/{id}/print` | JWT hợp lệ. Đơn tồn tại. | Tăng `printCount`, trả template và `fieldValues`. HTTP 200. | `printCount` tăng 1; trạng thái đơn không đổi. |
| Từ chối đơn (người duyệt hiện tại) | Người duyệt hiện tại | `PATCH /v1/general-requests/{id}/reject` | JWT hợp lệ. Đơn ở `PENDING`, đến lượt người gọi. Body bắt buộc: `note`. | Từ chối đơn. HTTP 200. | `REJECTED` |
| Nộp đơn để duyệt | Chủ đơn (suy luận, chờ xác nhận) | `PATCH /v1/general-requests/{id}/submit` | JWT hợp lệ. Đơn ở `DRAFT`. Body bắt buộc: `approvers`. | Nộp đơn kèm danh sách người duyệt. HTTP 200. | `PENDING` |

## Leave Balances

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách số dư phép của tất cả nhân viên (HR/Admin) | HR, ADMIN | `GET /v1/leave-balances` | JWT hợp lệ. Query bắt buộc: `year`. | Trả balance có phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cấp phát số ngày phép cho nhân viên (HR/Admin) | HR, ADMIN | `POST /v1/leave-balances` | JWT hợp lệ. Loại phép có `daysPerYear != null`; chưa có bản ghi cùng (employee, leaveType, year). Body bắt buộc: `employeeId`, `leaveTypeId`, `year`, `totalDays`. | Cấp phát phép; trùng trả 409; loại không giới hạn trả 400. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Khởi tạo hàng loạt số ngày phép (HR/Admin) | HR, ADMIN | `POST /v1/leave-balances/bulk-init` | JWT hợp lệ. `year` ≥ 2020; mọi `leaveTypeId` có `daysPerYear`. Body bắt buộc: `year`. | Idempotent; trả `created`, `skipped`, `total`. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Khởi tạo số ngày phép cho một nhân viên (HR/Admin) | HR, ADMIN | `POST /v1/leave-balances/bulk-init/employee/{employeeId}` | JWT hợp lệ. Nhân viên `ACTIVE` (không thì 400); tồn tại (không thì 404). | Cấp mọi loại phép có `daysPerYear`, dùng khi onboard; idempotent. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Số dư phép nhóm theo nhân viên (HR/Admin/Manager) | HR, ADMIN, MANAGER | `GET /v1/leave-balances/by-employee` | JWT hợp lệ. MANAGER chỉ phòng ban của mình. Query bắt buộc: `year`. | Trả mỗi nhân viên kèm mảng `balances`, phân trang theo nhân viên. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Số ngày phép còn lại của tôi (năm hiện tại) | Mọi user đã đăng nhập | `GET /v1/leave-balances/me` | JWT hợp lệ. | Trả mảng balance năm hiện tại; chưa cấp trả `[]`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| BƯỚC 2 — Tính lại số ngày phép đã dùng từ các đơn đã duyệt (HR/Admin) | HR, ADMIN | `POST /v1/leave-balances/recalculate` | JWT hợp lệ. Mặc định `dryRun = true`; chạy sau `recalculate-requests`. Body bắt buộc: `year`. | Tính lại `usedDays` từ đơn APPROVED và ghi đè; idempotent. HTTP 201. | `dryRun = false`: `usedDays` bị ghi đè; `dryRun = true`: không đổi. |
| BƯỚC 1 — Tính lại P/KL trên đơn nghỉ đã duyệt (HR/Admin) | HR, ADMIN | `POST /v1/leave-balances/recalculate-requests` | JWT hợp lệ. Mặc định `dryRun = true`. Body bắt buộc: `year`. | Phát lại đơn ANNUAL + HALF_DAY, hết quỹ thì đơn sau thành KL. HTTP 201. | `dryRun = false`: `paidDays`, `unpaidDays`, `leaveCode` đơn được tính lại; `dryRun = true`: không đổi. |
| Điều chỉnh số ngày phép được cấp phát (HR/Admin) | HR, ADMIN | `PATCH /v1/leave-balances/{id}` | JWT hợp lệ. Balance tồn tại. Body bắt buộc: `totalDays`. | Ghi đè `totalDays`; `usedDays` giữ nguyên; `remainingDays` có thể âm. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## Leave Requests

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn nghỉ phép | HR, ADMIN, DIRECTOR, MANAGER, CHIEF | `GET /v1/leave-requests` | JWT hợp lệ. HR/ADMIN/DIRECTOR: toàn bộ; MANAGER/CHIEF: đơn của mình, phòng mình quản lý, cấp dưới trực tiếp. | Trả danh sách có phân trang; EMPLOYEE bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo đơn xin nghỉ phép | EMPLOYEE | `POST /v1/leave-requests` | JWT hợp lệ. Loại phép tồn tại; `endDate` ≥ `startDate`; không trùng đơn PENDING/APPROVED; HALF_DAY/LATE/EARLY chỉ 1 ngày; `lateMinutes`/`earlyMinutes` 1–120. Body bắt buộc: `leaveTypeId`, `startDate`, `endDate`, `reason`. | Tạo đơn, server tính `totalDays`, `paidDays`, `unpaidDays`, `leaveCode` và gán `assignedApprover`; trùng trả 409 `LEAVE_OVERLAP`. HTTP 201. | `PENDING` |
| Danh sách đơn nghỉ phép của tôi | EMPLOYEE | `GET /v1/leave-requests/me` | JWT hợp lệ. | Trả đơn của bản thân có phân trang, kèm `canBeRevoked`, `canBeRemoved`, `timeline`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Preview split P/KL trước khi submit | Mọi user đã đăng nhập | `POST /v1/leave-requests/preview` | JWT hợp lệ. Body bắt buộc: `leaveTypeId`, `startDate`, `endDate`, `reason`. | Trả `paidDays`, `unpaidDays`, `leaveCode`, `warningMessage`, `remainingAfter`; không tạo đơn. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy chi tiết một đơn nghỉ phép | Chưa xác định (Swagger có 403) | `GET /v1/leave-requests/{id}` | JWT hợp lệ. | Lấy chi tiết một đơn nghỉ phép. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xóa đơn nghỉ phép (hard delete, chỉ PENDING, chỉ chính chủ) | Chính chủ | `DELETE /v1/leave-requests/{id}` | JWT hợp lệ. Đơn ở `PENDING`. | Hard delete, không còn trong lịch sử; trạng thái khác trả 400. HTTP 204. | Bản ghi bị xoá. |
| Duyệt đơn nghỉ phép | HR, ADMIN, MANAGER | `PATCH /v1/leave-requests/{id}/approve` | JWT hợp lệ. Đơn ở `PENDING`; MANAGER phải là `assignedApprover`, HR/ADMIN bypass. | Duyệt đơn; trừ `paidDays` vào `usedDays`; nửa ngày thì tạo `EffectiveShiftOverride`. HTTP 200. | `APPROVED` |
| Thu hồi đơn nghỉ phép (PENDING → CANCELLED, chỉ chính chủ) | Chính chủ | `PATCH /v1/leave-requests/{id}/cancel` | JWT hợp lệ. Đơn ở `PENDING`. | Thu hồi, giữ lịch sử; không hoàn balance vì chưa trừ. HTTP 200. | `CANCELLED` |
| Chỉnh tay phần hưởng lương / không hưởng lương của đơn (HR/Admin) | HR, ADMIN | `PATCH /v1/leave-requests/{id}/payroll-split` | JWT hợp lệ. Đơn đã duyệt; `P+KL` phải kèm `paidDays`. Body bắt buộc: `leaveCode`, `note`. | Đặt lại ký hiệu và suy ra số ngày; không đụng `usedDays`; có ghi log. HTTP 200. | `leaveCode`, `paidDays`, `unpaidDays` đổi; trạng thái đơn giữ `APPROVED`. |
| Từ chối đơn nghỉ phép | HR, ADMIN, MANAGER | `PATCH /v1/leave-requests/{id}/reject` | JWT hợp lệ. Đơn ở `PENDING`; cùng điều kiện quyền với duyệt. Body bắt buộc: `rejectNote`. | Từ chối đơn; balance không đổi. HTTP 200. | `REJECTED` |

## Leave Types

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách loại phép đang hoạt động (tất cả role) | Mọi user đã đăng nhập | `GET /v1/leave-types` | JWT hợp lệ. | Trả loại đang active, A–Z, không phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo loại phép mới (HR/Admin) | HR, ADMIN | `POST /v1/leave-types` | JWT hợp lệ. `code` chỉ A-Z, số, gạch dưới, bắt đầu chữ hoa, tối đa 20 ký tự; chưa tồn tại. Body bắt buộc: `name`, `code`, `isPaid`. | Tạo loại phép; trùng `code` trả 409. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Cập nhật loại phép (HR/Admin) | HR, ADMIN | `PATCH /v1/leave-types/{id}` | JWT hợp lệ. Loại phép tồn tại. | Cập nhật loại phép; có thể bật lại bằng `isActive = true`. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Tắt loại phép (HR/Admin) — không xóa, chỉ ẩn khỏi danh sách | HR, ADMIN | `PATCH /v1/leave-types/{id}/deactivate` | JWT hợp lệ. Loại phép đang active (không thì 400). | Ẩn khỏi danh sách, đơn PENDING vẫn xử lý được. HTTP 200. | `isActive = false` |

## meta-data

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Lấy danh sách trạng thái đơn công tác (value + label tiếng Việt) | Mọi user đã đăng nhập | `GET /v1/meta-data/business-trip-statuses` | JWT hợp lệ. | Lấy danh sách trạng thái đơn công tác (value + label tiếng Việt). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy danh sách loại giờ mong muốn (ARRIVAL, PICKUP) cho lộ trình chuyến công tác | Mọi user đã đăng nhập | `GET /v1/meta-data/desired-time-types` | JWT hợp lệ. | Lấy danh sách loại giờ mong muốn (ARRIVAL, PICKUP) cho lộ trình chuyến công tác. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy danh sách loại hình lao động (value + label tiếng Việt) | Mọi user đã đăng nhập | `GET /v1/meta-data/employment-types` | JWT hợp lệ. | Lấy danh sách loại hình lao động (value + label tiếng Việt). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy danh sách loại hộ chiếu (value + label tiếng Việt) | Mọi user đã đăng nhập | `GET /v1/meta-data/passport-types` | JWT hợp lệ. | Lấy danh sách loại hộ chiếu (value + label tiếng Việt). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy danh sách trạng thái của các loại đơn từ | Mọi user đã đăng nhập | `GET /v1/meta-data/request-statuses` | JWT hợp lệ. | Lấy danh sách trạng thái của các loại đơn từ. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy danh sách role trong hệ thống (value + label tiếng Việt) | Mọi user đã đăng nhập | `GET /v1/meta-data/roles` | JWT hợp lệ. | Lấy danh sách role trong hệ thống (value + label tiếng Việt). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy danh sách loại phương tiện dùng cho lộ trình chuyến công tác (value + label tiếng Việt) | Mọi user đã đăng nhập | `GET /v1/meta-data/transport-types` | JWT hợp lệ. | Lấy danh sách loại phương tiện dùng cho lộ trình chuyến công tác (value + label tiếng Việt). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Lấy danh sách loại hình làm việc của chấm công (value + label tiếng Việt) | Mọi user đã đăng nhập | `GET /v1/meta-data/work-types` | JWT hợp lệ. | Lấy danh sách loại hình làm việc của chấm công (value + label tiếng Việt). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Notifications

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách thông báo của tôi | Mọi user đã đăng nhập | `GET /v1/notifications` | JWT hợp lệ. | Trả thông báo của tôi; `meta.unreadCount` là tổng toàn bộ, không theo `category`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xóa tất cả thông báo | Mọi user đã đăng nhập | `DELETE /v1/notifications` | JWT hợp lệ. | Xoá toàn bộ của mình, hoặc theo `category` nếu truyền. HTTP 204. | Thông báo bị xoá. |
| Đánh dấu tất cả đã đọc | Mọi user đã đăng nhập | `PATCH /v1/notifications/read-all` | JWT hợp lệ. | Đánh dấu đã đọc toàn bộ, hoặc theo `category`. HTTP 204. | `isRead = true` |
| Số thông báo chưa đọc theo category | Mọi user đã đăng nhập | `GET /v1/notifications/unread-count` | JWT hợp lệ. | Trả số chưa đọc theo category. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Đánh dấu một thông báo đã đọc | Mọi user đã đăng nhập | `PATCH /v1/notifications/{id}/read` | JWT hợp lệ. | Đánh dấu đã đọc; id của người khác vẫn 204 nhưng không đổi gì. HTTP 204. | `isRead = true` |

## notifications

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Gửi thông báo test tới nhiều platform cùng lúc (ADMIN only) | ADMIN | `POST /v1/notifications/test` | JWT hợp lệ. Nhân viên nhận tồn tại. Body bắt buộc: `employeeId`, `title`, `body`, `platforms`. | Gửi test tới các platform `email`, `in-app`, `fcm`. HTTP 200. | Có thể tạo thông báo in-app; có gửi thật. |
| Gửi email test để kiểm tra pipeline Gmail SMTP | Chưa xác định | `GET /v1/notifications/test-email` | JWT hợp lệ. Dùng địa chỉ nhận test. Query bắt buộc: `to`. | Gửi email test qua Gmail SMTP. HTTP 200. | Không đổi dữ liệu; có gửi email thật. |
| Gửi FCM test tới tất cả device của một nhân viên (ADMIN only) | ADMIN | `POST /v1/notifications/test-fcm` | JWT hợp lệ. Nhân viên nhận tồn tại. Body bắt buộc: `employeeId`, `title`, `body`. | Gửi FCM test tới mọi device của nhân viên. HTTP 200. | Không đổi nghiệp vụ; có gửi push thật. |

## Overtime

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách đơn OT (HR/Admin: tất cả, Manager: phòng ban mình) | ADMIN, HR, MANAGER, CHIEF | `GET /v1/overtime-requests` | JWT hợp lệ. HR/ADMIN: tất cả; MANAGER/CHIEF: tự lọc về phòng mình. | Trả danh sách đơn OT có phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo đơn đăng ký làm thêm giờ | Mọi user đã đăng nhập | `POST /v1/overtime-requests` | JWT hợp lệ. Trong 30 ngày kể từ ngày OT; 0.5–12 giờ; ngoài giờ ca (T2–T7), CN không kiểm tra ca; `reason` ≥ 10 ký tự. Body bắt buộc: `startTime`, `endTime`, `workMode`, `reason`. | Tạo đơn, gán approver, đặt `autoExpireAt` = tạo + 7 ngày; gửi push. HTTP 201. | `PENDING`; quá 7 ngày cron 00:05 chuyển `AUTO_CANCELLED`. |
| Danh sách địa điểm có thể chọn khi tạo đơn OT offline | Mọi user đã đăng nhập | `GET /v1/overtime-requests/available-locations` | JWT hợp lệ. | Trả toàn bộ check-in location ACTIVE. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Danh sách đơn OT của nhân viên | Mọi user đã đăng nhập | `GET /v1/overtime-requests/me` | JWT hợp lệ. | Danh sách đơn OT của nhân viên. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê OT theo tháng của nhân viên | Mọi user đã đăng nhập | `GET /v1/overtime-requests/me/stats` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Trả `totalHours`, `countByStatus` theo tháng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Kiểm tra nhanh đơn OT — trả segments + rate + approver, KHÔNG lưu DB | Mọi user đã đăng nhập | `POST /v1/overtime-requests/preview` | JWT hợp lệ. Giới hạn 20 request/60 giây/user. Body bắt buộc: `startTime`, `endTime`, `workMode`. | Trả segments, rate 150/200/300, tổng giờ, location, approver; không lưu DB. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê OT theo tháng | ADMIN, HR, MANAGER, CHIEF | `GET /v1/overtime-requests/report` | JWT hợp lệ. MANAGER/CHIEF: phòng ban mình. Query bắt buộc: `month`, `year`. | Thống kê OT theo tháng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất báo cáo OT ra Excel | ADMIN, HR, MANAGER, CHIEF | `GET /v1/overtime-requests/report/export` | JWT hợp lệ. MANAGER/CHIEF: phòng ban mình. Query bắt buộc: `month`, `year`. | Tải file Excel. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết đơn OT | Chủ đơn, ADMIN, HR, approver được phân công | `GET /v1/overtime-requests/{id}` | JWT hợp lệ. | Chi tiết đơn OT. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Duyệt đơn OT | ADMIN, MANAGER, CHIEF | `PATCH /v1/overtime-requests/{id}/approve` | JWT hợp lệ. Đơn `PENDING`; MANAGER/CHIEF phải được phân công hoặc đơn chưa giao ai; HR bị 403. | Duyệt đơn; gửi push `overtime.approved`. HTTP 200. | `APPROVED` |
| Thu hồi đơn OT (chính chủ) | Chủ đơn | `PATCH /v1/overtime-requests/{id}/cancel` | JWT hợp lệ. Đơn `PENDING`. | Thu hồi; đơn người khác bị 403. HTTP 200. | `CANCELLED` |
| Xác nhận vị trí OT offline (START hoặc END) | Chủ đơn | `POST /v1/overtime-requests/{id}/check-location` | JWT hợp lệ. Đơn `APPROVED`, `workMode = OFFLINE`, chưa resolve; trong START/END ± 30 phút. Body bắt buộc: `latitude`, `longitude`, `checkType`. | Ghi nhận xác nhận vị trí OT offline. HTTP 200. | Chưa xác định |
| Từ chối đơn OT | ADMIN, MANAGER, CHIEF | `PATCH /v1/overtime-requests/{id}/reject` | JWT hợp lệ. Đơn `PENDING`; quyền như duyệt; `reviewNote` bắt buộc. Body bắt buộc: `reviewNote`. | Từ chối đơn; gửi push `overtime.rejected`. HTTP 200. | `REJECTED` |

## permissions

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách tất cả quyền (nhóm theo module) | Chưa xác định | `GET /v1/permissions` | JWT hợp lệ. | Danh sách tất cả quyền (nhóm theo module). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## positions

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách chức vụ | Mọi user đã đăng nhập | `GET /v1/positions` | JWT hợp lệ. | Trả danh sách A–Z có phân trang; `department` là chuỗi tên. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo chức vụ mới | HR, ADMIN | `POST /v1/positions` | JWT hợp lệ. Phòng ban tồn tại (404); `name` 2–100 ký tự. Body bắt buộc: `name`, `departmentId`. | Tạo chức vụ; EMPLOYEE, MANAGER bị 403. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Chi tiết chức vụ | Mọi user đã đăng nhập | `GET /v1/positions/{id}` | JWT hợp lệ. | Trả chi tiết; `department` là object. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật chức vụ | HR, ADMIN | `PATCH /v1/positions/{id}` | JWT hợp lệ. Chức vụ tồn tại. | Cập nhật tên hoặc phòng ban. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Vô hiệu hóa chức vụ (soft delete) | ADMIN | `DELETE /v1/positions/{id}` | JWT hợp lệ. Chức vụ đang active (không thì 400). | Soft delete; nhân viên giữ nguyên `positionId`; HR bị 403. HTTP 204. | `isActive = false` |

## Reports

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Báo cáo chấm công theo tháng (có phân trang + search theo tên/mã) | ADMIN, HR, MANAGER | `GET /v1/reports/attendance` | JWT hợp lệ. `year` ≥ 2020, `month` 1–12. Query bắt buộc: `year`, `month`. | Trả thống kê theo nhân viên; `attendanceRate = (present + late) / totalWorkDays × 100`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất báo cáo chấm công ra Excel (không phân trang — trả toàn bộ nhân viên match filter) | ADMIN, HR, MANAGER | `GET /v1/reports/attendance/export` | JWT hợp lệ. `year` ≥ 2020, `month` 1–12. Query bắt buộc: `year`, `month`. | Tải `.xlsx`, không phân trang, không bọc envelope. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất bảng chấm công chi tiết (1 dòng/ngày/nhân viên) ra Excel | ADMIN, HR, MANAGER | `GET /v1/reports/attendance/export-detail` | JWT hợp lệ. `year` ≥ 2020, `month` 1–12. Query bắt buộc: `year`, `month`. | Tải `.xlsx` 24 cột, 1 dòng/ngày/nhân viên, gồm cuối tuần. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất bảng công tháng cho toàn nhân sự (1 dòng/nhân viên) ra Excel | Chưa xác định (Swagger có 403) | `GET /v1/reports/employees/monthly/export` | JWT hợp lệ. MANAGER tự scope theo phòng ban. Query bắt buộc: `year`, `month`. | Tải `.xlsx` bảng công tháng, 1 dòng/nhân viên. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Báo cáo công tháng của 1 nhân viên (HR/Admin/Director/Manager/Chief) | HR, ADMIN, DIRECTOR, MANAGER, CHIEF | `GET /v1/reports/employees/{employeeId}/monthly` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Báo cáo công tháng của 1 nhân viên (HR/Admin/Director/Manager/Chief). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Báo cáo nghỉ phép theo năm hoặc tháng | ADMIN, HR, MANAGER | `GET /v1/reports/leave` | JWT hợp lệ. `year` ≥ 2020. Query bắt buộc: `year`. | Trả thống kê theo nhân viên và loại phép; lọc tháng theo `startDate` của đơn. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất báo cáo nghỉ phép ra Excel | ADMIN, HR, MANAGER | `GET /v1/reports/leave/export` | JWT hợp lệ. `year` ≥ 2020. Query bắt buộc: `year`. | Tải `.xlsx` thống kê nghỉ phép. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Báo cáo công tháng cá nhân (EMPLOYEE tự xem) | Mọi user đã đăng nhập | `GET /v1/reports/my/monthly` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Trả báo cáo công tháng của bản thân. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê làm việc online theo tháng | Chưa xác định (Swagger có 403) | `GET /v1/reports/online-work` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Thống kê làm việc online theo tháng. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất báo cáo làm việc online ra Excel | Chưa xác định (Swagger có 403) | `GET /v1/reports/online-work/export` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Tải file Excel. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê OT theo tháng | ADMIN, HR, MANAGER, CHIEF | `GET /v1/reports/overtime` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Cùng dữ liệu với `/v1/overtime-requests/report`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất báo cáo OT ra Excel | Chưa xác định (Swagger có 403) | `GET /v1/reports/overtime/export` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Tải file Excel. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê tổng quan (chỉ HR và Admin) | HR, ADMIN | `GET /v1/reports/summary` | JWT hợp lệ. Query bắt buộc: `year`, `month`. | Trả tổng quan công ty; số hôm nay theo ngày hiện tại, không theo `year`/`month`; MANAGER bị 403. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thống kê vi phạm chuyên cần theo tháng | HR, ADMIN | `GET /v1/reports/violations` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Trả thống kê, cùng shape `/violation-requests/report`. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Xuất báo cáo vi phạm chuyên cần ra Excel | HR, ADMIN | `GET /v1/reports/violations/export` | JWT hợp lệ. Query bắt buộc: `month`, `year`. | Tải file Excel. HTTP 200. | Không đổi dữ liệu/trạng thái. |

## roles

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách vai trò | Chưa xác định | `GET /v1/roles` | JWT hợp lệ. | Danh sách vai trò. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo vai trò mới (CUSTOM) | Chưa xác định (Swagger có 403) | `POST /v1/roles` | JWT hợp lệ. Body bắt buộc: `name`. | Tạo vai trò loại `CUSTOM`, có ghi log. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Chi tiết vai trò (gồm danh sách quyền) | Chưa xác định | `GET /v1/roles/{id}` | JWT hợp lệ. | Trả chi tiết gồm danh sách quyền. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật vai trò | Chưa xác định (Swagger có 403) | `PATCH /v1/roles/{id}` | JWT hợp lệ. Vai trò tồn tại. | Cập nhật vai trò, có ghi log. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Xóa vai trò (chỉ CUSTOM) | Chưa xác định (Swagger có 403) | `DELETE /v1/roles/{id}` | JWT hợp lệ. Vai trò loại `CUSTOM`. | Xoá vai trò; không phải CUSTOM trả 400. HTTP 204. | Vai trò bị xoá. |
| Danh sách nhân viên thuộc vai trò | Chưa xác định | `GET /v1/roles/{id}/employees` | JWT hợp lệ. | Danh sách nhân viên thuộc vai trò. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Thêm nhân viên vào vai trò (bulk) | Chưa xác định (Swagger có 403) | `POST /v1/roles/{id}/employees` | JWT hợp lệ. Vai trò tồn tại. Body bắt buộc: `employeeIds`. | Thêm nhân viên vào vai trò, có ghi log. HTTP 204. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Xóa nhân viên khỏi vai trò | Chưa xác định (Swagger có 403) | `DELETE /v1/roles/{id}/employees/{employeeId}` | JWT hợp lệ. Nhân viên thuộc vai trò. | Xoá nhân viên khỏi vai trò, có ghi log. HTTP 204. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Cập nhật danh sách quyền của vai trò (thay thế toàn bộ) | Chưa xác định (Swagger có 403) | `PUT /v1/roles/{id}/permissions` | JWT hợp lệ. Vai trò tồn tại. Body bắt buộc: `permissionIds`. | Thay thế toàn bộ quyền của vai trò, có ghi log. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## Shifts

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách tất cả ca làm việc | Mọi user đã đăng nhập | `GET /v1/work-shifts` | JWT hợp lệ. | Trả tất cả ca. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo ca làm việc mới | HR, ADMIN | `POST /v1/work-shifts` | JWT hợp lệ. `checkInTime`, `checkOutTime` dạng `HH:mm`. Body bắt buộc: `name`, `checkInTime`, `checkOutTime`, `workDays`. | Tạo ca, ngưỡng muộn/sớm mặc định 15 phút. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Cập nhật ca làm việc | HR, ADMIN | `PATCH /v1/work-shifts/{id}` | JWT hợp lệ. Ca tồn tại. | Cập nhật ca. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Vô hiệu hóa ca làm việc (soft delete) | HR, ADMIN | `DELETE /v1/work-shifts/{id}` | JWT hợp lệ. Ca đang active (không thì 400). | Soft delete. HTTP 204. | `isActive = false` |

## social-insurance

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách thông tin BHXH toàn công ty | Chưa xác định | `GET /v1/social-insurance` | JWT hợp lệ. | Danh sách thông tin BHXH toàn công ty. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Nhân viên tự xem BHXH & thuế của mình (phải nhập lại mật khẩu) | Mọi user đã đăng nhập | `POST /v1/social-insurance/me` | JWT hợp lệ. Nhập lại mật khẩu; sai 5 lần khoá 30 phút, chung bộ đếm đăng nhập; giới hạn 30 request/5 phút theo IP. Body bắt buộc: `password`. | Trả BHXH và thuế của mình; `note` là `null` trừ HR/ADMIN/DIRECTOR/MANAGER/CHIEF. HTTP 201. | Không đổi dữ liệu/trạng thái. |
| Thông tin BHXH & thuế của một nhân viên (dành cho HR) | HR, ADMIN | `GET /v1/social-insurance/{employeeId}` | JWT hợp lệ. | Trả BHXH và thuế; chính chủ không dùng được API này. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo hoặc cập nhật thông tin BHXH & thuế (upsert) | Chưa xác định (Swagger có 403) | `PUT /v1/social-insurance/{employeeId}` | JWT hợp lệ. Nhân viên tồn tại. Body bắt buộc: `socialInsuranceNumber`, `insuranceSalary`. | Upsert BHXH và thuế. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |

## System - Holidays

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách ngày lễ | Mọi user đã đăng nhập | `GET /v1/public-holidays` | JWT hợp lệ. | Trả ngày lễ; bỏ `year` thì trả mọi năm. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Tạo ngày lễ mới | HR, ADMIN | `POST /v1/public-holidays` | JWT hợp lệ. `date` chưa là ngày lễ. Body bắt buộc: `name`, `date`. | Tạo ngày lễ, server tự tính `year`; trùng trả 409. HTTP 201. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Tạo nhanh ngày lễ cố định cho 1 năm | HR, ADMIN | `POST /v1/public-holidays/bulk-year` | JWT hợp lệ. `year` 2000–2100. Body bắt buộc: `year`. | Tạo 5 ngày lễ cố định; idempotent; không gồm Tết âm lịch, Giỗ Tổ. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Tạo khoảng nghỉ lễ từ from_date đến to_date | HR, ADMIN | `POST /v1/public-holidays/range` | JWT hợp lệ. `toDate` ≥ `fromDate`. Body bắt buộc: `name`, `fromDate`, `toDate`. | Tạo 1 bản ghi mỗi ngày; idempotent; trả `created`, `skipped`. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Chi tiết một ngày lễ | HR, ADMIN | `GET /v1/public-holidays/{id}` | JWT hợp lệ. | Trả chi tiết ngày lễ. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Cập nhật ngày lễ | HR, ADMIN | `PATCH /v1/public-holidays/{id}` | JWT hợp lệ. Ngày lễ tồn tại; `date` mới không trùng. | Cập nhật, đổi `date` thì tính lại `year`. HTTP 200. | Dữ liệu cấu hình/nghiệp vụ được tạo hoặc cập nhật; không có trạng thái luồng riêng. |
| Xóa ngày lễ | HR, ADMIN | `DELETE /v1/public-holidays/{id}` | JWT hợp lệ. Ngày lễ tồn tại. | Hard delete. HTTP 204. | Ngày lễ bị xoá. |

## system-logs

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| Danh sách system logs (ADMIN / HR) | HR, ADMIN | `GET /v1/system-logs` | JWT hợp lệ. | Trả log mutation có lọc và phân trang. HTTP 200. | Không đổi dữ liệu/trạng thái. |
| Chi tiết một log entry (ADMIN / HR) | HR, ADMIN | `GET /v1/system-logs/{id}` | JWT hợp lệ. | Trả chi tiết một log. HTTP 200. | Không đổi dữ liệu/trạng thái. |

## well-known

| Bước nghiệp vụ | Role | API thực tế | Điều kiện trước | Expected result | Trạng thái sau |
| --- | --- | --- | --- | --- | --- |
| File Apple App Site Association (Universal Links + lưu mật khẩu iCloud) | Công khai | `GET /.well-known/apple-app-site-association` | Payload, query/path parameter đúng định dạng. | File Apple App Site Association (Universal Links + lưu mật khẩu iCloud). HTTP 200. | Không đổi dữ liệu/trạng thái. |
| AASA tại root (fallback cho iOS < 9.3) | Công khai | `GET /apple-app-site-association` | Payload, query/path parameter đúng định dạng. | AASA tại root (fallback cho iOS < 9.3). HTTP 200. | Không đổi dữ liệu/trạng thái. |

## Điểm cần xác nhận

| API / nghiệp vụ | Vấn đề | SRS nói gì | Swagger hoặc mã nguồn nói gì |
| --- | --- | --- | --- |
| Toàn hệ thống | Không có SRS | Chỉ có bridge doc cho frontend, 114/292 API được nhắc tới | Swagger có 292 API; 178 API không có mô tả nghiệp vụ trong bridge |
| Role toàn hệ thống | Tập role lệch | `api-response-envelope.md`: `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE` | Enum có thêm `DIRECTOR`, `CHIEF` |
| `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out`, `GET /v1/attendance/me`, `GET /v1/check-in-locations/me`, `POST /v1/leave-requests`, `GET /v1/leave-requests/me`, `POST /v1/makeup-attendance`, `GET /v1/makeup-attendance/me` | HR, MANAGER có tự chấm công, xin nghỉ được không | Bridge chỉ ghi `EMPLOYEE`; HR/ADMIN gọi `check-in-locations/me` bị 403 | Swagger không ghi role; `GET /v1/shift-schedules/me` ghi "mọi role đã đăng nhập" |
| Phiếu giải trình | Mô hình duyệt khác nhau | Duyệt 1 cấp; hết 5 phiếu/tháng thì chặn tạo | Có `PENDING_L2`, `currentApprovalLevel`, `slotCost`, `isNextMultiLevel` (≥ 5 thì duyệt 2 cấp) |
| `POST /v1/violation-requests` | Loại vi phạm lệch | 3 loại: `FORGOT_CHECKIN`, `LATE`, `EARLY` | Có thêm `FORGOT_CHECKOUT` |
| `PATCH /v1/violation-requests/{id}/reject`, `PATCH /v1/makeup-attendance/{id}/reject` | `reviewNote` bắt buộc hay không | Bắt buộc | Swagger không đánh dấu required |
| `POST /v1/overtime-requests` | Body lệch | `overtimeDate`, `startTime`, `endTime`, `reason` | `startTime`, `endTime`, `workMode`, `reason` là bắt buộc, thêm `locationId`; không có `overtimeDate` |
| `POST /v1/attendance/check-out` | Body lệch | Chỉ `photo` | Bắt buộc `photo`, `latitude`, `longitude`; Swagger có 429 |
| `POST /v1/leave-requests` | `reason` bắt buộc hay không | Tuỳ chọn | Bắt buộc |
| `POST /v1/leave-requests` loại `ANNUAL` khi hết phép | Bridge tự mâu thuẫn | `leave-requests.md`: luôn tạo được, tự chuyển `KL`; `leave-balances.md`: 400 `LEAVE_INSUFFICIENT_BALANCE` | Swagger không nêu mã lỗi; có 409 |
| `PATCH /v1/leave-requests/{id}/approve` | Số ngày bị trừ | `leave-requests.md`: trừ `paidDays`; `leave-balances.md`: trừ `totalDays` | Swagger không nêu |
| Nghỉ nửa ngày | HALF_DAY có trừ quỹ không | `leave-types.md`: `daysPerYear = null`, không có balance; `leave-requests.md`: "không trừ ngày phép" | `recalculate` ghi HALF_DAY trừ 0.5 ngày vào quỹ phép năm |
| `PATCH /v1/leave-requests/{id}/cancel` | Có huỷ được đơn đã duyệt không | Mục split ghi hoàn `paidDays` khi cancel đơn APPROVED; mục edge case ghi 400 | Swagger: chỉ `PENDING` sang `CANCELLED` |
| Loại phép `UNPAID` | Thiếu trong seed | Có trong bảng hình thức đơn, không có trong seed `leave-types.md` | Swagger không liệt kê |
| Đơn bù công | Trạng thái và quyền lệch | Không có `CANCELLED`, không có API cancel; `MANAGER` gọi danh sách bị 403 | Có `CANCELLED` và API cancel; MANAGER xem phòng ban, CHIEF xem toàn công ty |
| `GET /v1/attendance` | Quyền lệch | Chỉ `ADMIN`, `HR` | Thêm Director toàn công ty, Manager/Chief theo phòng ban; có trạng thái `HOLIDAY` |
| `POST /v1/attendance/check-in` | Khung giờ | Cố định ± 30 phút quanh giờ bắt đầu ca | `work-shifts` có `checkInWindowStart`, `checkInWindowEnd` cấu hình được |
| `GET /v1/system-logs`, `GET /v1/system-logs/{id}` | Bridge sai đường dẫn | `/v1/logs` | `/v1/system-logs`; `GET /v1/logs` đã thử trả 404 |
| `POST /v1/device-tokens` | Bridge có API không tồn tại | `overtime-requests.md`: `PATCH /v1/employees/me/fcm-token` | Không có trong Swagger; dùng `/v1/device-tokens` |
| `GET /v1/notifications/unread-count` | Bridge có 2 dạng phản hồi | `notifications.md`: theo category; `fcm-notifications.md`: `{ unreadCount }` | Category có thêm `REQUEST`, `ANNOUNCEMENT` |
| `GET /v1/test-reminder-attendance/{userId}` | Bảo mật: API debug công khai gửi push thật | Không có | Swagger không khai security. Chưa gọi thử vì có tác dụng phụ |
| `GET /v1/employees/{employeeId}/documents/{documentId}/url` | Bảo mật: nguy cơ IDOR | "Mọi user đã đăng nhập" | Swagger không khai 403; chưa kiểm chứng |
| `POST /v1/employees/{id}/reset-password` | Bảo mật: mật khẩu đoán được | Không có | Reset về `ho_ten@ma_nhanvien`; chưa rõ có bắt đổi khi đăng nhập lại không |
| Nhiều API có giới hạn role | Swagger thiếu mã 403 | `GET /v1/employees`, `DELETE /v1/employees/{id}`, `POST /v1/public-holidays` giới hạn role | Swagger không khai 403 |
| `DELETE /v1/employees/{id}` | Thiếu mã lỗi | Đã inactive trả 400 | Chỉ khai 204, 404 |
| `POST /v1/shift-schedules/bulk-online-saturday` | `month` bắt buộc hay không | Bắt buộc | Tuỳ chọn, bỏ thì gán cả năm |
| Đơn công tác | Cách chuyển `IN_PROGRESS`, `COMPLETED` | Không có | Có enum, không có API rõ ràng |
| Hợp đồng | Cách chuyển `EXPIRED` | Không có | Có enum và `CONTRACT_EXPIRY_WARNING`, không có API; chưa rõ cron |
| Postman `HRM System API.postman_collection.json` | Collection cũ | Không áp dụng | Thiếu 40 API so với Swagger, `baseUrl` là `/` |
| Nhóm AI Agent: `GET /v1/agent/analytics/feedback`, `GET /v1/agent/analytics/overview`, `POST /v1/agent/chat`, `POST /v1/agent/chat/stream` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm Attendance - Online Work: `GET /v1/online-work-requests/pending-for-me`, `GET /v1/online-work-requests/report`, `GET /v1/online-work-requests/report/export`, `GET /v1/online-work-requests/{id}` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm Attendance - Shifts: `POST /v1/shift-schedules/bulk-range` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm Attendance - Violations: `GET /v1/violation-requests/{id}` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm Business Trips: `GET /v1/business-trips/pending-for-me`, `POST /v1/business-trips/resync-attendance`, `POST /v1/business-trips/routes/{routeId}/upload-ticket`, `GET /v1/business-trips/{id}`, `POST /v1/business-trips/{id}/report`, `PATCH /v1/business-trips/{id}/report`, `PATCH /v1/business-trips/{id}/report/submit`, `POST /v1/business-trips/{id}/upload-attachment` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm company-announcements: `POST /v1/company-announcements/upload-inline-media` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm contracts: `POST /v1/contracts`, `POST /v1/contracts/import`, `GET /v1/contracts/import/template`, `GET /v1/contracts/{id}`, `PATCH /v1/contracts/{id}`, `PATCH /v1/contracts/{id}/activate`, `PATCH /v1/contracts/{id}/terminate` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm Dashboard: `GET /v1/dashboard/new-hires` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm departments: `PATCH /v1/departments/{id}/manager` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm employee-citizen-id: `GET /v1/employees/{employeeId}/citizen-id`, `POST /v1/employees/{employeeId}/citizen-id`, `PATCH /v1/employees/{employeeId}/citizen-id`, `DELETE /v1/employees/{employeeId}/citizen-id`, `GET /v1/employees/{employeeId}/citizen-id/history`, `POST /v1/employees/{employeeId}/citizen-id/photos` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm employee-passport: `GET /v1/employees/{employeeId}/passport`, `POST /v1/employees/{employeeId}/passport`, `PATCH /v1/employees/{employeeId}/passport`, `DELETE /v1/employees/{employeeId}/passport`, `POST /v1/employees/{employeeId}/passport/photos/{side}`, `DELETE /v1/employees/{employeeId}/passport/photos/{side}` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm employees: `POST /v1/employees/import`, `POST /v1/employees/{id}/reset-password` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm General Requests: `GET /v1/general-requests/pending-for-me`, `GET /v1/general-requests/{id}`, `POST /v1/general-requests/{id}/print` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm Leave Requests: `GET /v1/leave-requests/{id}` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm notifications: `GET /v1/notifications/test-email` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm permissions: `GET /v1/permissions` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm Reports: `GET /v1/reports/employees/monthly/export`, `GET /v1/reports/online-work`, `GET /v1/reports/online-work/export`, `GET /v1/reports/overtime/export` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm roles: `GET /v1/roles`, `POST /v1/roles`, `GET /v1/roles/{id}`, `PATCH /v1/roles/{id}`, `DELETE /v1/roles/{id}`, `GET /v1/roles/{id}/employees`, `POST /v1/roles/{id}/employees`, `DELETE /v1/roles/{id}/employees/{employeeId}`, `PUT /v1/roles/{id}/permissions` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm social-insurance: `GET /v1/social-insurance`, `PUT /v1/social-insurance/{employeeId}` | Chưa có nguồn về role | Không có trong bridge | Swagger không ghi role |
| Nhóm AI Agent: `POST /v1/agent/actions/{id}/cancel` | Chưa có nguồn về trạng thái sau | Không có trong bridge | Swagger không nêu trạng thái mới |
| Nhóm Overtime: `POST /v1/overtime-requests/{id}/check-location` | Chưa có nguồn về trạng thái sau | Không có trong bridge | Swagger không nêu trạng thái mới |

## Ghi chú kiểm thử

- **Schema chi tiết:** Swagger UI `https://hrs-main-dev.sonthanh.net.vn/api/docs`, file JSON `https://hrs-main-dev.sonthanh.net.vn/api/docs-json`. Khi kiểm tra contract phải tính lớp bọc `{ success, data }`.
- **Thứ tự route:** gọi `/me`, `/report`, `/calendar`, `/bulk` theo đúng đường dẫn tĩnh; server khai các route này trước `/:id`.
- **Multipart:** check-in, check-out, tạo đơn bù công, tạo phiếu giải trình phải gửi `multipart/form-data`, kể cả khi không có ảnh (phiếu giải trình).
- **Múi giờ:** `effectiveStart`, `effectiveEnd` là giờ UTC trên ngày `1970-01-01`, đọc bằng `getUTCHours()`. Cron chạy theo `Asia/Ho_Chi_Minh`.
- **Cron không gọi được qua API:** khoá bản ghi 00:05, tự huỷ OT 00:05, đánh vắng 00:10, tự ghi công online T7 23:50, xoá thông báo quá 90 ngày vào Chủ nhật 02:00. Muốn test phải có cách kích hoạt riêng hoặc chờ đến giờ chạy.
- **Giới hạn tần suất:** `POST /v1/overtime-requests/preview` 20 request/60 giây/user; API nhập lại mật khẩu 30 request/5 phút/IP. Sai mật khẩu 5 lần khoá tài khoản 30 phút, dùng chung bộ đếm với đăng nhập, nên tránh dùng tài khoản test chung cho case sai mật khẩu.
- **API gọi dịch vụ ngoài:** email khi tạo và xử lý đơn, forgot-password, import nhân viên; FCM qua `device-tokens` và các API test; S3 cho ảnh chấm công, tài liệu, avatar. Chỉ gọi các API test thông báo với tài khoản nhận thử.
- **API ghi hàng loạt, cần cẩn trọng trên dev dùng chung:** `POST /v1/leave-balances/recalculate`, `POST /v1/leave-balances/recalculate-requests` (mặc định `dryRun = true`, chạy theo đúng thứ tự: requests trước, recalculate sau), `POST /v1/business-trips/resync-attendance`, `POST /v1/employees/import`, `POST /v1/contracts/import`, `DELETE /v1/notifications`.
- **Khi API thay đổi:** chạy lại `/testapi` với link `https://hrs-main-dev.sonthanh.net.vn/api/docs-json`.
