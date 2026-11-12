# Bộ test case hiệu năng — HR System (đăng nhập, check-in, check-out)

_Tạo lúc 2026-11-02 12:00 từ báo cáo API `BAO_CAO_API.md` và tài liệu nghiệp vụ `bridges/bridges/*.md` (thay cho SRS). Tổng 18 case._

## Tóm tắt

- **Quy mô mục tiêu:** 173 người đồng thời, từ 150 nhân sự × 1,15 = 172,5, làm tròn lên, thay cho mốc 200 trước đây. Mỗi lần chấm công phải login lại. Cao điểm check-in 08:30–08:45, check-out 18:00–18:30, theo ca 08:30–18:00 của tài khoản test.
- **Thời lượng chịu tải:** 1 phút chỉ tham khảo, 5 phút là chuẩn, 15 phút là khắt khe, với điều kiện tải được duy trì suốt thời gian đó.
- **Phạm vi:** chỉ 3 API `POST /v1/auth/login`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out`, theo yêu cầu thu hẹp. Các API khác cố ý không test.
- **Đây là bản nháp kế hoạch test, chưa có kết quả đo, chưa đủ để nghiệm thu.** Mọi case đang ở trạng thái `Chưa chạy`.
- **Case 200 tài khoản thật:** PERF-014 đến PERF-018 đo đăng nhập, check-in, check-out với 200 tài khoản riêng, nên lần này đo được chấm công thành công hàng loạt. PERF-015 đến PERF-018 là nghiệm thu chính.
- **Hai mốc tải:** các case bằng 1 tài khoản giữ 173 người; các case 200 tài khoản dùng 200 người theo yêu cầu mới.
- **Case phụ:** PERF-003, PERF-004 chỉ đo nhánh từ chối.
- **Tiêu chí nghiệm thu:** do chưa có tài liệu, dùng tiêu chí đã được PO chấp nhận ở mục Tiêu chí nghiệm thu. Đo riêng từng API, dùng chung một thang, đánh giá theo cả 2 thang.
- **Tài khoản test:** 1 tài khoản EMPLOYEE, lưu trong `.env` (`HRM_BASE_URL`, `HRM_EMAIL`, `HRM_PASSWORD`).
- **Tài khoản:** case 1 tài khoản (smoke, login, chấm công 1 người: PERF-001 đến PERF-011, PERF-013) dùng tài khoản trong `.env` (`HRM_EMAIL`); case nhiều tài khoản cùng login rồi check-in hoặc check-out (PERF-012, PERF-014 đến PERF-018) dùng 200 tài khoản trong `accounts-200.csv`.
- **Rule 5 lần/ngày (NFR-28), check-in và check-out ghi đè giờ (NFR-25, NFR-29):** mỗi người chỉ được gửi check-in tối đa 5 lần và check-out tối đa 5 lần mỗi ngày, tính cả lần bị từ chối; từ lần thứ 6 server trả 429. Case gửi nhiều lần trên 1 tài khoản (PERF-003, PERF-004, PERF-007 pha 2, PERF-009, PERF-010, PERF-011) coi 429 là phản hồi mong đợi và kiểm tra số lần không bị 429 ≤ 5. Mỗi lần chạy thử hoặc chạy ngoài khung giờ cũng tiêu tốn lượt của tài khoản trong ngày.
- **Giới hạn:** mỗi tài khoản chỉ check-in, check-out thành công 1 lần mỗi ngày, nên PERF-015, 016 và PERF-017, 018 cần 2 ngày khác nhau hoặc dữ liệu được dọn. Với 1 tài khoản chạy được: PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, PERF-006, PERF-007, PERF-008, PERF-009, PERF-010, PERF-011, PERF-013.
- **Thứ tự chạy:** quyết định bởi trạng thái dữ liệu đầu mỗi case, không phải theo ngày. PERF-009 rồi PERF-010 có thể chạy cùng ngày. PERF-011 và PERF-001 cần trạng thái chưa check-in.
- **Trước khi chạy tải:** chủ hệ thống đã đồng ý cho chạy trên `hrs-main-dev`. Đã chạy `performance-tests/seed/check-rate-limit.js`: không gặp 429 tới 35 lần/giây. Check-in và check-out tạo dữ liệu chấm công thật cho tài khoản này.

| Nhóm | Số case | Case |
| --- | --- | --- |
| Smoke | 1 | PERF-001 |
| Load | 3 | PERF-002, PERF-003, PERF-004 |
| Peak | 3 | PERF-005, PERF-017, PERF-018 |
| Spike | 5 | PERF-006, PERF-007, PERF-014, PERF-015, PERF-016 |
| Stress | 1 | PERF-008 |
| Concurrency | 3 | PERF-009, PERF-010, PERF-011 |
| Resilience | 1 | PERF-012 |
| Recovery | 1 | PERF-013 |

## Nguồn yêu cầu

| Mã | Vị trí trong tài liệu | Nội dung nguyên văn | Case áp dụng |
| --- | --- | --- | --- |
| NFR-01 | Thông tin nghiệp vụ được cung cấp | Mục tiêu sinh ra phụ vụ cho các công ty SME 150 < nhân sự. | Toàn bộ |
| NFR-02 | Thông tin nghiệp vụ được cung cấp | buffer thêm 15% | 150 × 1,15 = 172,5, làm tròn 173 |
| NFR-03 | Thông tin nghiệp vụ được cung cấp | Giả định đồng thời HRM có khoảng 200 ngừoi dùng cùng sử dụng và chấm công. | Thay bằng 173 theo trả lời mới |
| NFR-04 | Thông tin nghiệp vụ được cung cấp | khunng giờ checkin cao điểm là từ 8h đến 8h15 | Thay bằng 08:30–08:45 theo trả lời mới |
| NFR-05 | Thông tin nghiệp vụ được cung cấp | khung giờ check out cao điểm là từ 17h30-17h45 | Thay bằng 18:00–18:30 theo trả lời mới |
| NFR-06 | Trả lời của người dùng | < = 150 nhân sự | Toàn bộ |
| NFR-07 | Trả lời của người dùng | có cần login lại trước khi checkin hay checkout | Mọi case có check-in, check-out |
| NFR-08 | Trả lời của người dùng | có khớp, lệch checkin vẫn được chấp nhận | Mọi case có check-in |
| NFR-09 | Thông tin nghiệp vụ được cung cấp | p95:2s, p99 6s -> tăng độ khó -> p95 1s , p99 3s -> Tăng tiếp độ khó p95 500ms, p99 1.5s | Toàn bộ, thang A |
| NFR-10 | Thông tin nghiệp vụ được cung cấp | p95:2s, p99 6s -> tăng độ khó -> p95 1s , p99 2.5s -> Tăng tiếp độ khó p95 500ms, p99 1s | Toàn bộ, thang B |
| NFR-11 | Thông tin nghiệp vụ được cung cấp | 1p -> Smoke test hoặc test nhanh -> Chỉ để tham khảo thường không có giá trị đánh giá | PERF-001 |
| NFR-12 | Thông tin nghiệp vụ được cung cấp | 5p -> Thời gian tiêu chuẩn -> Có thể tin cậy và có thể sử dụng để đánh giá. | Load, Stress mỗi bậc |
| NFR-13 | Thông tin nghiệp vụ được cung cấp | 15p -> Yêu cầu khắt khe hơn -> Dùng để đánh giá và có thể kiểm soát được các hiện tượng xảy ra định kỳ trong hệ thống. | Load login, Peak, Resilience, Recovery |
| NFR-14 | Thông tin nghiệp vụ được cung cấp | Thao tác chấm công trên ứng dụng thường diễn ra <5p tính từ thời điểm mở ứng dụng. | Mô tả thao tác, không dùng làm ngưỡng API |
| NFR-15 | Trả lời của người dùng | “Cùng lúc” là cửa sổ 5 giây: đúng | PERF-007 |
| NFR-16 | Trả lời của người dùng | Ảnh 500KB: đúng rồi chỉ trong khoảng này thôi | Mọi case có check-in, check-out |
| NFR-17 | Trả lời của người dùng | chỉ để lại case cùng lúc tải trong khoảng 150 người buffer dôi ra thêm 15% | Toàn bộ |
| NFR-18 | Trả lời của người dùng | tự đề xuất, vì hiện tại không có tài liệu nào cả | Tiêu chí nghiệm thu |
| NFR-19 | Trả lời của người dùng | checkin 8:30 - 8:45  checkout: 18:00 - 18:30 | PERF-005; check-out cao điểm đang tạm bỏ |
| NFR-20 | Trả lời của người dùng | Quyền chạy tải: đống ý rồi | Toàn bộ |
| NFR-21 | Swagger info.description | hệ thống quản lý nhân sự nội bộ (~50 nhân viên) | Mâu thuẫn quy mô, xem Điểm cần xác nhận |
| NFR-22 | attendance-overview.md, Các trường hợp check-in thất bại | Ngoài cửa sổ ±30 phút xung quanh giờ bắt đầu ca thực tế | PERF-005, PERF-017, PERF-018 |
| NFR-23 | Swagger `POST /v1/employees/me/identity` | Sai mật khẩu 5 lần sẽ khoá tài khoản 30 phút | PERF-002, PERF-003, PERF-004, PERF-006, PERF-007, PERF-014, PERF-015, PERF-016, PERF-008 |
| NFR-24 | attendance.md, Edge cases | Check-in lần 2 trong ngày 409 `ATTENDANCE_ALREADY_CHECKED_IN` | PERF-003, PERF-009 |
| NFR-29 | Kết quả chạy thật 03/11/2026 (PERF-017 chạy sau PERF-015 trên cùng 200 tài khoản), xác nhận người dùng 03/11/2026 | Check-in lần 2 trong ngày cũng trả 201 và ghi đè giờ check-in, vẫn chỉ 1 bản ghi; tài liệu attendance.md ghi 409 là đã cũ | PERF-003, PERF-007, PERF-009 |
| NFR-28 | Kết quả chạy thật 02/11/2026, xác nhận người dùng 03/11/2026 | Mỗi người chỉ được check-in hoặc check-out tối đa 5 lần/ngày; lần thứ 6 trả 429 "Đã vượt quá số lần check-in/check-out cho phép trong ngày (tối đa 5 lần)" | PERF-003, PERF-004, PERF-007, PERF-009, PERF-010, PERF-011 |
| NFR-25 | attendance.md, Edge cases; xác nhận người dùng 02/11/2026 | Tài liệu ghi check-out lần 2 trong ngày 400 Bad Request; thực tế check-out được ghi đè giờ, tối đa 5 lần/ngày, lần thứ 6 trả 429 | PERF-004, PERF-010 |
| NFR-26 | attendance.md, POST check-in | Ảnh selfie, JPG hoặc PNG, tối đa 5MB | Mọi case check-in, check-out |
| NFR-27 | Phiên làm việc, yêu cầu của người dùng | có thể tạo ra 1000 request cùng lúc không? | PERF-008 |

## Mô hình tải

| Thông số | Giá trị | Cách tính | Nguồn |
| --- | --- | --- | --- |
| Quy mô sản phẩm | Tối đa 150 nhân sự | Người dùng xác nhận | Theo tài liệu: trả lời của người dùng |
| Người dùng đồng thời | 173 | 150 × 1,15 = 172,5, làm tròn lên | Theo tài liệu: trả lời của người dùng |
| Cao điểm login | 173 lượt trong 15 phút, 0,192 lượt/s | 173 ÷ 900 giây | Theo tài liệu: số người và khung giờ |
| Burst đồng thời | 173 VU trong 5 giây, 34,6 lượt/s | 173 ÷ 5 | Theo tài liệu: người dùng xác nhận cửa sổ 5 giây |
| Burst 200 tài khoản | 200 người trong 5 giây, 40 lượt/s | 200 ÷ 5 | Theo tài liệu: yêu cầu của người dùng |
| Check-in cao điểm 200 tài khoản | 200 lượt trong 15 phút, 0,222 lượt/s | 200 ÷ 900 giây | Theo tài liệu: yêu cầu của người dùng |
| Check-out cao điểm 200 tài khoản | 200 lượt trong 30 phút, 0,111 lượt/s | 200 ÷ 1800 giây | Theo tài liệu: yêu cầu của người dùng |
| Spike login | 173 VU trong 30 giây, 5,77 lượt/s | 173 ÷ 30 | Đề xuất |
| Tải 173 VU đồng thời | Khoảng 11,5 req/s | 173 ÷ 15 giây nghỉ | Đề xuất: số nghỉ mặc định |
| Tải thăm dò | 1 req/s login | Tạo mẫu đo trước, trong, sau sự kiện | Đề xuất |
| Ảnh mẫu | Khoảng 500KB | Người dùng xác nhận kích thước ảnh thật từ app | Theo tài liệu: trả lời của người dùng |
| Tìm giới hạn đăng nhập | Đến 1000 VU | Mốc người dùng hỏi | Theo yêu cầu người dùng |

Tỷ lệ lỗi đề xuất: < 1% ở load, < 5% ở stress trước điểm gãy; sai nghiệp vụ 0. Mọi API dùng chung một thang p95, p99.

## Mốc thời lượng

| Mốc | Mức | Giá trị đánh giá | Case áp dụng |
| --- | --- | --- | --- |
| 1 phút | Smoke, test nhanh | Chỉ để tham khảo | PERF-001 |
| 5 phút | Tiêu chuẩn | Tin cậy, dùng để đánh giá | PERF-002 lần 1, PERF-003, PERF-004, mỗi bậc PERF-008 |
| 15 phút | Khắt khe | Dùng để đánh giá, thấy được hiện tượng định kỳ | PERF-002 lần 2, PERF-005, PERF-012, PERF-013, PERF-017 |

Thời lượng chỉ có ý nghĩa khi tải được duy trì và có đủ giao dịch thành công: burst 30 giây rồi chờ hết 15 phút vẫn chỉ là một burst, nên PERF-006, PERF-007, PERF-014, PERF-015, PERF-016 không tính theo mốc này; PERF-018 chạy 30 phút theo khung check-out. Thời gian thao tác dưới 5 phút của người dùng không phải ngưỡng phản hồi API. Các case Concurrency theo lượt không tính thời lượng. Không có Soak trong bộ case này.

## Cách đo và đánh giá

- Đo percentile riêng cho từng API, đồng thời đo tổng thời gian flow login → chấm công. Không gộp login nhanh với upload ảnh chậm.
- Mọi kết quả báo kèm số mẫu thành công. Với khoảng 200 mẫu, p99 chỉ phụ thuộc khoảng 2 mẫu chậm nhất nên dễ dao động; lặp 3 lần bằng dữ liệu sạch.
- Tách 3 chỉ số: tỷ lệ phản hồi mong đợi, lỗi kỹ thuật (5xx, timeout, mất kết nối), toàn vẹn dữ liệu (không dung sai).
- Các case chấm công dùng ảnh khoảng 500KB, đúng kích thước ảnh thật từ app.

## Tiêu chí nghiệm thu

Do chưa có tài liệu nên tiêu chí này được đề xuất, và PO đã chấp nhận.

| Kết luận | Điều kiện tại 173 người |
| --- | --- |
| Đạt | Mức 2 thang B: p95 < 1s, p99 < 2,5s; lỗi kỹ thuật < 1%; sai dữ liệu 0 |
| Đạt có điều kiện | Chỉ qua mức 1: p95 < 2s, p99 < 6s; lỗi kỹ thuật < 1%; sai dữ liệu 0; cần kế hoạch cải thiện |
| Không đạt | Không qua mức 1, hoặc lỗi kỹ thuật ≥ 1%, hoặc có sai dữ liệu |
| Mục tiêu tốt | Mức 3 thang B: p95 < 500ms, p99 < 1s |

Chọn mức 2 thang B vì đạt mức này tự động đạt mức 2 thang A; người dùng đang đứng chấm công nên 1 giây vẫn phản hồi nhanh; thang B giữ đuôi chậm chặt hơn.

## Thang độ khó p95, p99

Dùng để phân mức kết quả cho mục Tiêu chí nghiệm thu.

| Mức | Thang A: tuyến tính, p99 = 3 lần p95 | Thang B: siết thêm p99 |
| --- | --- | --- |
| Mức 1, cơ bản | p95 < 2s, p99 < 6s | p95 < 2s, p99 < 6s |
| Mức 2 | p95 < 1s, p99 < 3s | p95 < 1s, p99 < 2,5s |
| Mức 3 | p95 < 500ms, p99 < 1,5s | p95 < 500ms, p99 < 1s |

Dùng cả hai thang, áp dụng chung cho login, check-in, check-out. Một lần chạy được đối chiếu với cả 6 ngưỡng, không cần chạy lại cho từng mức. Thang B khó hơn thang A vì đuôi chậm bị giới hạn chặt hơn. Ghi kết quả dạng `A2, B1`.

## Performance Test Case Checklist

| ID | Nhóm test | Flow cần test | Chuỗi API trong flow (theo thứ tự) | Mục tiêu | Tải/kịch bản | Thời lượng | Tiêu chí đạt | Kết quả | Trạng thái | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PERF-001 | Smoke | Đăng nhập, check-in, check-out | `POST /v1/auth/login` → `POST /v1/attendance/check-in` → `POST /v1/attendance/check-out` | Xác nhận login, ảnh, GPS, ca và dữ liệu ghi đúng | 1 người, 1 lượt | Tối đa 1 phút | Login 200, check-in 201, check-out 200, `checkInAt`, `checkOutAt`, ảnh được lưu đúng, lỗi 0% |  | Chưa chạy | Kết hợp: theo tài liệu mốc thời lượng được cung cấp cho 1 phút, chỉ để tham khảo; đề xuất 1 người 1 lượt; lý do: check-in thật chỉ được 1 lần mỗi ngày. |
| PERF-002 | Load | Đăng nhập tải ổn định | `POST /v1/auth/login` | Đăng nhập duy trì được 173 VU | 173 VU, mỗi VU login rồi nghỉ 15 giây, khoảng 11,5 req/s, ramp 2 phút. Chạy 2 lần: giữ tải 5 phút, sau đó giữ tải 15 phút | 5 phút, rồi 15 phút | p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), tốc độ đạt ≥ 90% của 11,5 req/s; báo cáo số VU, req/s đạt được, số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người, thông tin nghiệp vụ được cung cấp cho các mốc 5, 15 phút; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất nghỉ 15 giây, lỗi < 1%, tốc độ ≥ 90%; lý do: số nghỉ mặc định, VU đóng có thể tự giảm tải khi hệ thống chậm. |
| PERF-003 | Load | Check-in lặp, nhánh đã check-in | `POST /v1/auth/login` → `POST /v1/attendance/check-in` | Case phụ: đo nhánh từ chối của check-in, không dùng để nghiệm thu | 1 req/s tải mở sau khi đã check-in thật | 5 phút | Phản hồi mong đợi 201 (ghi đè giờ), 409 hoặc 429 (quá 5 lần/ngày) ≥ 99%; số lần không bị 429 ≤ 5; giờ check-out không đổi; lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); toàn vẹn: vẫn đúng 1 bản ghi; p95 < 1s, p99 < 2,5s (mức 2 thang B) |  | Chưa chạy | Kết hợp: theo tài liệu attendance.md cho 409 khi check-in lần 2; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất 1 req/s, tỷ lệ 99%, lỗi < 1%; lý do: chỉ đo nhánh 409, không đại diện upload ảnh và ghi thành công. |
| PERF-004 | Load | Check-out lặp, nhánh đã check-out | `POST /v1/auth/login` → `POST /v1/attendance/check-out` | Case phụ: đo nhánh từ chối của check-out, không dùng để nghiệm thu | 1 req/s tải mở sau khi đã check-out thật | 5 phút | Phản hồi mong đợi 200 (ghi đè giờ) hoặc 429 (quá 5 lần/ngày) ≥ 99%; số lần không bị 429 ≤ 5; lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); toàn vẹn: 1 bản ghi trong ngày, `checkInAt` không đổi; p95 < 1s, p99 < 2,5s (mức 2 thang B) |  | Chưa chạy | Kết hợp: theo xác nhận của người dùng ngày 02/11/2026, check-out được ghi đè giờ; theo kết quả chạy thật ngày 02/11/2026, giới hạn 5 lần/ngày trả 429 (thay cho 400 trong attendance.md); theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất 1 req/s, tỷ lệ 99%, lỗi < 1%; lý do: sau 5 lần chủ yếu đo nhánh 429, không đại diện ghi thành công. |
| PERF-005 | Peak | Đăng nhập trong khung check-in | `POST /v1/auth/login` | Đăng nhập trong khung 08:30–08:45 | 173 lượt rải đều trong 15 phút, 0,192 req/s tải mở | 15 phút | p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), không khoá tài khoản, báo cáo số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người, thông tin nghiệp vụ được cung cấp cho khung 08:30–08:45; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| PERF-006 | Spike | Đăng nhập dồn đầu ca | `POST /v1/auth/login` | Đăng nhập chịu được đợt dồn và phục hồi | Tải thăm dò login 1 req/s chạy suốt: 2 phút nền, 173 VU login trong 30 giây, 5 phút sau spike | Khoảng 8 phút | Không 5xx, lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |  | Chưa chạy | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người; đề xuất tăng trong 30 giây, tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: spike chỉ một lượt nên cần tải thăm dò để có mẫu đo phục hồi. |
| PERF-007 | Spike | Burst đồng thời 173 VU | `POST /v1/auth/login` → `POST /v1/attendance/check-in` | Kiểm tra hệ thống khi 173 người gửi cùng lúc, trong giới hạn 1 tài khoản | Pha 1: 173 VU login trong 5 giây, trung bình 34,6 lượt/s. Pha 2: 173 VU gửi check-in trong 5 giây, ảnh khoảng 500KB. Tải thăm dò login 1 req/s trước, trong và 5 phút sau | Cửa sổ gửi 5 giây, quan sát khoảng 8 phút mỗi pha | Pha 1: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối). Pha 2: 1–5 lần 201 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, không 5xx, đúng 1 bản ghi. phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần |  | Chưa chạy | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người và cửa sổ 5 giây; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: chỉ có 1 tài khoản nên pha 2 đo tranh chấp và nhánh 409, không đo 173 lượt ghi thành công. |
| PERF-008 | Stress | Đăng nhập tăng bậc đến 1000 VU | `POST /v1/auth/login` | Xác nhận bậc 173 giữ tiêu chí nghiệm thu, sau đó tìm giới hạn đăng nhập | VU đóng, bậc 50, 100, 173 rồi 300, 500, 1000; dừng khi vi phạm giới hạn an toàn | 5 phút mỗi bậc | Bậc ≤ 173: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1%. Bậc > 173 chỉ tìm giới hạn: ghi bậc đầu tiên có lỗi ≥ 5% hoặc p95 ≥ 1s và mã lỗi; không tự sập |  | Chưa chạy | Kết hợp: theo tài liệu thông tin nghiệp vụ được cung cấp cho bậc 173, yêu cầu của người dùng cho mốc 1000, tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất các bậc còn lại, lỗi < 1%, giới hạn 5%; lý do: bậc mục tiêu phải cùng tiêu chí nghiệm thu, login băm mật khẩu tốn CPU nên dễ gãy sớm. |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | `POST /v1/auth/login` → `POST /v1/attendance/check-in` | Không tạo hai bản ghi chấm công trong một ngày | 10 VU gửi trong 1 giây | 1 lượt | 1–5 lần 201 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, đúng 1 bản ghi trong ngày và có `checkInAt`, không 5xx |  | Chưa chạy | Kết hợp: theo tài liệu attendance.md cho 409 khi check-in lần 2; đề xuất 10 VU; lý do: mô phỏng bấm đúp và app gửi lại. |
| PERF-010 | Concurrency | Bấm check-out nhiều lần | `POST /v1/auth/login` → `POST /v1/attendance/check-out` | Không tạo bản ghi trùng khi bấm nhiều lần | 10 VU gửi trong 1 giây | 1 lượt | 1–5 lần 200 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, chỉ 1 bản ghi trong ngày và có `checkOutAt`, không 5xx |  | Chưa chạy | Kết hợp: theo xác nhận của người dùng ngày 02/11/2026, check-out được ghi đè giờ; theo kết quả chạy thật ngày 02/11/2026, giới hạn 5 lần/ngày; đề xuất 10 VU; lý do: mô phỏng bấm đúp. |
| PERF-011 | Concurrency | Check-in và check-out gửi cùng lúc | `POST /v1/auth/login` → `POST /v1/attendance/check-in` → `POST /v1/attendance/check-out` | Bản ghi cuối cùng nhất quán | 2 VU gửi trong cùng 100ms | 1 lượt | Không 5xx; ít nhất 1 thành công; số lần không bị 429 ≤ 5 mỗi API; 1 bản ghi trong ngày (server nhận check-out khi chưa check-in, ghi `MISSING_CHECKIN`) |  | Chưa chạy | Kết hợp: theo tài liệu attendance.md cho 400 khi chưa check-in; đề xuất 2 VU, độ lệch 100ms; lý do: app gửi lại khi mạng yếu. |
| PERF-012 | Resilience | S3 chậm khi check-in | `POST /v1/auth/login` → `POST /v1/attendance/check-in` | S3 lỗi không kéo chậm login, và tự phục hồi | Nhóm 1: login độc lập 1 req/s chạy suốt. Nhóm 2: 20 VU check-in. 3 phút nền, 7 phút S3 trễ 5 giây rồi trả lỗi, 5 phút phục hồi | 15 phút | Nhóm login giữ p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1%; check-in báo lỗi rõ ràng, không treo quá 30 giây, không có bản ghi thiếu ảnh; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |  | Chưa chạy | Kết hợp: theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất 20 VU, trễ 5 giây, timeout 30 giây, phân pha 3, 7, 5 phút; lý do: check-in phụ thuộc S3, tài liệu chưa có số. |
| PERF-013 | Recovery | Restart app khi đang đăng nhập | `POST /v1/auth/login` | Đăng nhập tự phục hồi sau restart | Tải thăm dò 1 req/s tải mở: 4 phút nền, restart app ở phút 5, quan sát đến phút 15 | 15 phút | Lỗi chỉ xuất hiện trong lúc restart; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |  | Chưa chạy | Đề xuất: 1 req/s, restart phút 5, cửa sổ 1 phút, 120%, phục hồi trong 5 phút; lý do: mốc phục hồi trong hướng dẫn, cần tải nền để có mẫu đo. |
| PERF-014 | Spike | Burst đăng nhập 200 tài khoản | `POST /v1/auth/login` | Chứng minh 200 người khác nhau cùng đăng nhập | 200 tài khoản riêng gửi login trong 5 giây, trung bình 40 lượt/s; tải thăm dò login 1 req/s trước, trong và 5 phút sau | Cửa sổ gửi 5 giây, quan sát khoảng 8 phút | Login p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản thật và cửa sổ 5 giây; theo tài liệu {TL}; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: mỗi tài khoản khác nhau mới phản ánh tra cứu nhiều user. |
| PERF-015 | Spike | Burst check-in 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-in` | Nghiệm thu chính: 200 người cùng check-in thành công | Login và đọc thông tin trước trong setup; 200 tài khoản gửi check-in trong 5 giây, trung bình 40 lượt/s, ảnh khoảng 500KB; tải thăm dò login 1 req/s | Cửa sổ gửi 5 giây, quan sát khoảng 8 phút | Check-in p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đúng 200 bản ghi; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần bằng dữ liệu sạch |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản thật và cửa sổ 5 giây; theo tài liệu {TL}; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: đây là lần đầu đo được ghi chấm công thành công hàng loạt. |
| PERF-016 | Spike | Burst check-out 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-out` | Nghiệm thu chính: 200 người cùng check-out thành công | Login và đọc thông tin trước trong setup; 200 tài khoản gửi check-out trong 5 giây, trung bình 40 lượt/s, ảnh khoảng 500KB; tải thăm dò login 1 req/s | Cửa sổ gửi 5 giây, quan sát khoảng 8 phút | Check-out p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần bằng dữ liệu sạch |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản thật và cửa sổ 5 giây; theo tài liệu {TL}; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: check-out cũng có upload ảnh và ghi bản ghi. |
| PERF-017 | Peak | Check-in cao điểm 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-in` | Nghiệm thu chính: 200 người check-in thành công trong khung cao điểm | 200 tài khoản, mỗi người 1 lượt thành công, rải đều 08:30–08:45, 0,222 lượt/s, ảnh khoảng 500KB | 15 phút | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đúng 200 bản ghi; báo cáo tổng thời gian flow và số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản và khung 08:30–08:45; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| PERF-018 | Peak | Check-out cao điểm 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-out` | Nghiệm thu chính: 200 người check-out thành công trong khung cao điểm | 200 tài khoản, mỗi người 1 lượt thành công, rải đều 18:00–18:30, 0,111 lượt/s, ảnh khoảng 500KB | 30 phút | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; báo cáo tổng thời gian flow và số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản và khung 18:00–18:30; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |

## Form chi tiết từng test case

### PERF-001

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-001 |
| Tên flow | Đăng nhập, check-in, check-out |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `POST /v1/attendance/check-in`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| API 3 | `POST /v1/attendance/check-out`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | `LATE` là kết quả hợp lệ. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Chưa check-in hôm nay. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | 1 người, 1 lượt; thời lượng Tối đa 1 phút. |
| Tiêu chí đạt | Login 200, check-in 201, check-out 200, `checkInAt`, `checkOutAt`, ảnh được lưu đúng, lỗi 0% |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu mốc thời lượng được cung cấp cho 1 phút, chỉ để tham khảo; đề xuất 1 người 1 lượt; lý do: check-in thật chỉ được 1 lần mỗi ngày. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-002

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-002 |
| Tên flow | Đăng nhập tải ổn định |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| Điều kiện rẽ nhánh | Lỗi 429 ghi riêng, có thể là rate limit. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/auth/login` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Cùng tài khoản đăng nhập lặp, mật khẩu đúng. Không dùng mật khẩu sai vì sai 5 lần khoá 30 phút. |
| Kịch bản tải | 173 VU, mỗi VU login rồi nghỉ 15 giây, khoảng 11,5 req/s, ramp 2 phút. Chạy 2 lần: giữ tải 5 phút, sau đó giữ tải 15 phút; thời lượng 5 phút, rồi 15 phút. |
| Tiêu chí đạt | p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), tốc độ đạt ≥ 90% của 11,5 req/s; báo cáo số VU, req/s đạt được, số mẫu |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người, thông tin nghiệp vụ được cung cấp cho các mốc 5, 15 phút; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất nghỉ 15 giây, lỗi < 1%, tốc độ ≥ 90%; lý do: số nghỉ mặc định, VU đóng có thể tự giảm tải khi hệ thống chậm. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-003

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-003 |
| Tên flow | Check-in lặp, nhánh đã check-in |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `POST /v1/attendance/check-in`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | 409 là phản hồi mong đợi. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Đã check-in thật trong ngày. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. Không được báo cáo là năng lực check-in. |
| Kịch bản tải | 1 req/s tải mở sau khi đã check-in thật; thời lượng 5 phút. |
| Tiêu chí đạt | Phản hồi mong đợi 201 (ghi đè giờ), 409 hoặc 429 (quá 5 lần/ngày) ≥ 99%; số lần không bị 429 ≤ 5; giờ check-out không đổi; lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); toàn vẹn: vẫn đúng 1 bản ghi; p95 < 1s, p99 < 2,5s (mức 2 thang B) |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu attendance.md cho 409 khi check-in lần 2; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất 1 req/s, tỷ lệ 99%, lỗi < 1%; lý do: chỉ đo nhánh 409, không đại diện upload ảnh và ghi thành công. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-004

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-004 |
| Tên flow | Check-out lặp, nhánh đã check-out |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `POST /v1/attendance/check-out`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | 200 (ghi đè giờ) và 429 (quá 5 lần/ngày) là phản hồi mong đợi. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/attendance/check-out` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Đã check-out thật trong ngày. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. Không được báo cáo là năng lực check-out. |
| Kịch bản tải | 1 req/s tải mở sau khi đã check-out thật; thời lượng 5 phút. |
| Tiêu chí đạt | Phản hồi mong đợi 200 hoặc 429 ≥ 99%; số lần không bị 429 ≤ 5; lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); toàn vẹn: 1 bản ghi trong ngày, `checkInAt` không đổi; p95 < 1s, p99 < 2,5s (mức 2 thang B) |
| Ghi chú nguồn số liệu | Kết hợp: theo xác nhận của người dùng ngày 02/11/2026, check-out được ghi đè giờ; theo kết quả chạy thật ngày 02/11/2026, giới hạn 5 lần/ngày trả 429 (thay cho 400 trong attendance.md); theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất 1 req/s, tỷ lệ 99%, lỗi < 1%; lý do: sau 5 lần chủ yếu đo nhánh 429, không đại diện ghi thành công. |
| Kết quả | 02/11/2026 16:20, EMP202 đã dùng hết 5 lượt check-out: 301/301 lần 429, 0 lỗi kỹ thuật, 1 bản ghi trong ngày; p95 100ms, p99 111ms |
| Kết luận | Đạt (A3, B3), chỉ đo nhánh 429 |

### PERF-005

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-005 |
| Tên flow | Đăng nhập trong khung check-in |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| Điều kiện rẽ nhánh | Không rẽ nhánh. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/auth/login` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Với 1 tài khoản, mọi lượt dùng chung email nên chỉ mang tính tham khảo cho nhiều user. |
| Kịch bản tải | 173 lượt rải đều trong 15 phút, 0,192 req/s tải mở; thời lượng 15 phút. |
| Tiêu chí đạt | p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), không khoá tài khoản, báo cáo số mẫu |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người, thông tin nghiệp vụ được cung cấp cho khung 08:30–08:45; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-006

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-006 |
| Tên flow | Đăng nhập dồn đầu ca |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| Điều kiện rẽ nhánh | Không rẽ nhánh. |
| API chạy song song | Tải thăm dò login chạy song song với spike. |
| API trọng yếu | `POST /v1/auth/login` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Cùng tài khoản, mật khẩu đúng. |
| Kịch bản tải | Tải thăm dò login 1 req/s chạy suốt: 2 phút nền, 173 VU login trong 30 giây, 5 phút sau spike; thời lượng Khoảng 8 phút. |
| Tiêu chí đạt | Không 5xx, lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người; đề xuất tăng trong 30 giây, tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: spike chỉ một lượt nên cần tải thăm dò để có mẫu đo phục hồi. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-007

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-007 |
| Tên flow | Burst đồng thời 173 VU |
| API 1 | `POST /v1/auth/login`: pha 1: 173 VU đồng bộ gửi trong cửa sổ 5 giây |
| API 2 | `POST /v1/attendance/check-in`: pha 2: 173 VU dùng chung token, đồng bộ gửi trong cửa sổ 5 giây |
| Điều kiện rẽ nhánh | Pha 2 không phải năng lực chấm công thành công. |
| API chạy song song | 173 request chạy song song; tải thăm dò login chạy nền. |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Trạng thái đầu của pha 2: chưa check-in. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | Pha 1: 173 VU login trong 5 giây, trung bình 34,6 lượt/s. Pha 2: 173 VU gửi check-in trong 5 giây, ảnh khoảng 500KB. Tải thăm dò login 1 req/s trước, trong và 5 phút sau; thời lượng Cửa sổ gửi 5 giây, quan sát khoảng 8 phút mỗi pha. |
| Tiêu chí đạt | Pha 1: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối). Pha 2: 1–5 lần 201 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, không 5xx, đúng 1 bản ghi. phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người và cửa sổ 5 giây; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: chỉ có 1 tài khoản nên pha 2 đo tranh chấp và nhánh 409, không đo 173 lượt ghi thành công. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-008

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-008 |
| Tên flow | Đăng nhập tăng bậc đến 1000 VU |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| Điều kiện rẽ nhánh | 429 tính riêng là lớp bảo vệ. Tất cả request từ một IP. Chỉ đánh giá giới hạn login, không phải chấm công. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/auth/login` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Phải có xác nhận của chủ hệ thống, vì case này có thể làm dev ngừng phục vụ. |
| Kịch bản tải | VU đóng, bậc 50, 100, 173 rồi 300, 500, 1000; dừng khi vi phạm giới hạn an toàn; thời lượng 5 phút mỗi bậc. |
| Tiêu chí đạt | Bậc ≤ 173: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1%. Bậc > 173 chỉ tìm giới hạn: ghi bậc đầu tiên có lỗi ≥ 5% hoặc p95 ≥ 1s và mã lỗi; không tự sập |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu thông tin nghiệp vụ được cung cấp cho bậc 173, yêu cầu của người dùng cho mốc 1000, tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất các bậc còn lại, lỗi < 1%, giới hạn 5%; lý do: bậc mục tiêu phải cùng tiêu chí nghiệm thu, login băm mật khẩu tốn CPU nên dễ gãy sớm. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-009

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-009 |
| Tên flow | Bấm check-in nhiều lần |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `POST /v1/attendance/check-in`: **nhiều VU đồng thời** cùng tài khoản |
| Điều kiện rẽ nhánh | Không rẽ nhánh. |
| API chạy song song | `POST /v1/attendance/check-in` chạy song song. |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Trạng thái đầu: chưa check-in. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | 10 VU gửi trong 1 giây; thời lượng 1 lượt. |
| Tiêu chí đạt | 1–5 lần 201 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, đúng 1 bản ghi trong ngày và có `checkInAt`, không 5xx |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu attendance.md cho 409 khi check-in lần 2; đề xuất 10 VU; lý do: mô phỏng bấm đúp và app gửi lại. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-010

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-010 |
| Tên flow | Bấm check-out nhiều lần |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `POST /v1/attendance/check-out`: **nhiều VU đồng thời** cùng tài khoản |
| Điều kiện rẽ nhánh | Không rẽ nhánh. |
| API chạy song song | `POST /v1/attendance/check-out` chạy song song. |
| API trọng yếu | `POST /v1/attendance/check-out` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Trạng thái đầu: đã check-in, chưa check-out, có thể chạy nối sau case check-in cùng ngày. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | 10 VU gửi trong 1 giây; thời lượng 1 lượt. |
| Tiêu chí đạt | 1–5 lần 200 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, chỉ 1 bản ghi trong ngày và có `checkOutAt`, không 5xx |
| Ghi chú nguồn số liệu | Kết hợp: theo xác nhận của người dùng ngày 02/11/2026, check-out được ghi đè giờ; theo kết quả chạy thật ngày 02/11/2026, giới hạn 5 lần/ngày; đề xuất 10 VU; lý do: mô phỏng bấm đúp. |
| Kết quả | 02/11/2026 16:15, EMP202, trạng thái đầu chưa check-in: 5 lần 200, 5 lần 429, 0 lỗi kỹ thuật, 1 bản ghi (id 4746); p95 1,01s, p99 1,07s |
| Kết luận | Đạt về dữ liệu theo tiêu chí mới; thời gian mức 1 (A1, B1) |

### PERF-011

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-011 |
| Tên flow | Check-in và check-out gửi cùng lúc |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `POST /v1/attendance/check-in`: gửi **song song** với check-out |
| API 3 | `POST /v1/attendance/check-out`: gửi **song song** với check-in |
| Điều kiện rẽ nhánh | Thứ tự xử lý quyết định kết quả; cả hai thứ tự đều phải nhất quán. |
| API chạy song song | Check-in và check-out chạy song song. |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Trạng thái đầu: chưa check-in. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | 2 VU gửi trong cùng 100ms; thời lượng 1 lượt. |
| Tiêu chí đạt | Không 5xx; ít nhất 1 thành công; số lần không bị 429 ≤ 5 mỗi API; 1 bản ghi trong ngày (server nhận check-out khi chưa check-in, ghi `MISSING_CHECKIN`) |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu attendance.md cho 400 khi chưa check-in; đề xuất 2 VU, độ lệch 100ms; lý do: app gửi lại khi mạng yếu. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-012

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-012 |
| Tên flow | S3 chậm khi check-in |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `POST /v1/attendance/check-in`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | Không rẽ nhánh. |
| API chạy song song | Nhóm login chạy song song độc lập với nhóm check-in. |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Cần 20 tài khoản và quyền giả lập lỗi hạ tầng; hiện chưa chạy được. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | Nhóm 1: login độc lập 1 req/s chạy suốt. Nhóm 2: 20 VU check-in. 3 phút nền, 7 phút S3 trễ 5 giây rồi trả lỗi, 5 phút phục hồi; thời lượng 15 phút. |
| Tiêu chí đạt | Nhóm login giữ p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1%; check-in báo lỗi rõ ràng, không treo quá 30 giây, không có bản ghi thiếu ảnh; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất 20 VU, trễ 5 giây, timeout 30 giây, phân pha 3, 7, 5 phút; lý do: check-in phụ thuộc S3, tài liệu chưa có số. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-013

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-013 |
| Tên flow | Restart app khi đang đăng nhập |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| Điều kiện rẽ nhánh | Không rẽ nhánh. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/auth/login` |
| Tiền điều kiện | Chạy được với 1 tài khoản trong `.env`. Cần thêm quyền restart trên môi trường riêng. |
| Kịch bản tải | Tải thăm dò 1 req/s tải mở: 4 phút nền, restart app ở phút 5, quan sát đến phút 15; thời lượng 15 phút. |
| Tiêu chí đạt | Lỗi chỉ xuất hiện trong lúc restart; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |
| Ghi chú nguồn số liệu | Đề xuất: 1 req/s, restart phút 5, cửa sổ 1 phút, 120%, phục hồi trong 5 phút; lý do: mốc phục hồi trong hướng dẫn, cần tải nền để có mẫu đo. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-014

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-014 |
| Tên flow | Burst đăng nhập 200 tài khoản |
| API 1 | `POST /v1/auth/login`: 200 tài khoản riêng, đồng bộ gửi trong cửa sổ 5 giây |
| Điều kiện rẽ nhánh | 429 ghi riêng ở `rate_limited`. |
| API chạy song song | 200 request login chạy song song; tải thăm dò chạy nền. |
| API trọng yếu | `POST /v1/auth/login` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã import, đã gán ca và địa điểm. |
| Kịch bản tải | 200 tài khoản riêng gửi login trong 5 giây, trung bình 40 lượt/s; tải thăm dò login 1 req/s trước, trong và 5 phút sau; thời lượng Cửa sổ gửi 5 giây, quan sát khoảng 8 phút. |
| Tiêu chí đạt | Login p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản thật và cửa sổ 5 giây; theo tài liệu {TL}; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: mỗi tài khoản khác nhau mới phản ánh tra cứu nhiều user. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-015

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-015 |
| Tên flow | Burst check-in 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ, kiểm tra trạng thái đầu |
| API 3 | `POST /v1/attendance/check-in`: 200 tài khoản đồng bộ gửi trong cửa sổ 5 giây |
| Điều kiện rẽ nhánh | `LATE` là kết quả hợp lệ. |
| API chạy song song | 200 request check-in chạy song song; tải thăm dò chạy nền. |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã import, đã gán ca và địa điểm. Trạng thái đầu của cả 200 tài khoản: chưa check-in. Kiểm tra bằng `seed/check-accounts.js`. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | Login và đọc thông tin trước trong setup; 200 tài khoản gửi check-in trong 5 giây, trung bình 40 lượt/s, ảnh khoảng 500KB; tải thăm dò login 1 req/s; thời lượng Cửa sổ gửi 5 giây, quan sát khoảng 8 phút. |
| Tiêu chí đạt | Check-in p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đúng 200 bản ghi; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần bằng dữ liệu sạch |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản thật và cửa sổ 5 giây; theo tài liệu {TL}; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: đây là lần đầu đo được ghi chấm công thành công hàng loạt. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-016

> Kết quả 02/11/2026 17:14–17:23: 199/200 lần 200, 1 lần 429 (EMP202 đã dùng hết 5 lượt check-out trong ngày); p95 10495.50037 ms, p99 10633.243754 ms; đối soát 200/200 đã check-out. Không đạt.

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-016 |
| Tên flow | Burst check-out 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ, kiểm tra trạng thái đầu |
| API 3 | `POST /v1/attendance/check-out`: 200 tài khoản đồng bộ gửi trong cửa sổ 5 giây |
| Điều kiện rẽ nhánh | `LATE` hoặc về sớm là kết quả hợp lệ. |
| API chạy song song | 200 request check-out chạy song song; tải thăm dò chạy nền. |
| API trọng yếu | `POST /v1/attendance/check-out` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã import, đã gán ca và địa điểm. Trạng thái đầu của cả 200 tài khoản: đã check-in, chưa check-out. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | Login và đọc thông tin trước trong setup; 200 tài khoản gửi check-out trong 5 giây, trung bình 40 lượt/s, ảnh khoảng 500KB; tải thăm dò login 1 req/s; thời lượng Cửa sổ gửi 5 giây, quan sát khoảng 8 phút. |
| Tiêu chí đạt | Check-out p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần bằng dữ liệu sạch |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản thật và cửa sổ 5 giây; theo tài liệu {TL}; đề xuất tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: check-out cũng có upload ảnh và ghi bản ghi. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-017

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-017 |
| Tên flow | Check-in cao điểm 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ |
| API 3 | `POST /v1/attendance/check-in`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | `LATE` là kết quả hợp lệ. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã import, đã gán ca và địa điểm. Trạng thái đầu: chưa check-in. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | 200 tài khoản, mỗi người 1 lượt thành công, rải đều 08:30–08:45, 0,222 lượt/s, ảnh khoảng 500KB; thời lượng 15 phút. |
| Tiêu chí đạt | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đúng 200 bản ghi; báo cáo tổng thời gian flow và số mẫu |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản và khung 08:30–08:45; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-018

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-018 |
| Tên flow | Check-out cao điểm 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ |
| API 3 | `POST /v1/attendance/check-out`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | Không rẽ nhánh. |
| API chạy song song | Không có |
| API trọng yếu | `POST /v1/attendance/check-out` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã import, đã gán ca và địa điểm. Trạng thái đầu: đã check-in, chưa check-out. Được phép dùng GPS và ảnh mẫu trên tài khoản này. Lấy trước toạ độ địa điểm được gán và chuẩn bị ảnh JPG/PNG khoảng 500KB, đây là fixture, không đo tải. |
| Kịch bản tải | 200 tài khoản, mỗi người 1 lượt thành công, rải đều 18:00–18:30, 0,111 lượt/s, ảnh khoảng 500KB; thời lượng 30 phút. |
| Tiêu chí đạt | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; báo cáo tổng thời gian flow và số mẫu |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản và khung 18:00–18:30; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| Kết quả | |
| Kết luận | Chưa chạy |

## Checklist độ đầy đủ trước khi chạy

- [x] Có smoke test cho từng API/flow quan trọng. Case: PERF-001
- [x] Có load test theo tải cao điểm dự kiến. Case: PERF-002, PERF-003, PERF-004
- [x] Có peak hoặc spike test cho giờ cao điểm. Case: PERF-005, PERF-017, PERF-018, PERF-006, PERF-007, PERF-014, PERF-015, PERF-016
- [x] Có stress/capacity test để biết giới hạn. Case: PERF-008
- [ ] Có soak test cho luồng chính. Đã bỏ theo yêu cầu vì nằm ngoài các mốc 1, 5, 15 phút.
- [x] Có case tranh chấp dữ liệu. Case: PERF-009, PERF-010, PERF-011
- [x] Có kiểm tra response và trạng thái nghiệp vụ, không chỉ đo thời gian. Case: PERF-009, PERF-010, PERF-011
- [x] Có threshold rõ ràng cho p95, p99 và tỷ lệ lỗi. Case: PERF-002, PERF-003, PERF-004, PERF-005, PERF-017, PERF-018, PERF-008
- [ ] Có theo dõi API, database, cache, queue và server cùng lúc. Kế hoạch: k6 đo phía client; CPU, RAM, connection pool cần quyền server, hiện chưa có.
- [ ] Có dữ liệu test an toàn và quyền chạy test trên môi trường đó. Kế hoạch: `hrs-main-dev`, chưa có người cho phép.

## Điểm cần xác nhận

| Nội dung | Giả định đang dùng | Ảnh hưởng nếu sai | Hỏi ai |
| --- | --- | --- | --- |
| Swagger ghi ~50 nhân viên, thông tin mới là tối đa 150 | Dùng 150 và 173 người | Sai quy mô | PO |
| Check-in ngoài khung giờ | Được chấp nhận theo trả lời mới; bridge ghi lỗi `OUTSIDE_WINDOW` | Case chạy ngoài giờ bị 400, kiểm chứng ở lần Smoke đầu tiên | Backend |
| Rate limit của `POST /v1/auth/login` | Không gặp 429 tới 35 lần/giây trong 5 giây; login chậm rõ ở 35 lần/giây | PERF-007 có nguy cơ không đạt | Backend, DevOps |
| Body check-out có cần GPS không | Theo Swagger: bắt buộc `photo`, `latitude`, `longitude`; bridge chỉ `photo` | Check-out trả 400 | Backend |
| Check-in lặp có lưu ảnh lên S3 trước khi trả 409 không | Mỗi request đều gửi ảnh theo trả lời của người dùng; chưa biết server lưu ảnh trước hay sau khi kiểm tra trùng | PERF-003, PERF-007 tạo rác S3 | Backend |
| 200 tài khoản đã được import, gán ca và địa điểm chưa | Chưa kiểm chứng; file chỉ là danh sách import. Chạy `seed/check-accounts.js` trước | Case 200 tài khoản dừng ở setup | Quản trị hệ thống |
| Cách dọn dữ liệu để lặp 3 lần trong ngày | Chạy 1 lần mỗi ngày | Khó lặp 3 lần | HR, Backend |
