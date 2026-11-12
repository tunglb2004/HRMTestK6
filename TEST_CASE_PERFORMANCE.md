# Bộ test case hiệu năng — HR System (đăng nhập, check-in, check-out)

_Tạo lúc 2026-11-02 12:00 từ báo cáo API `BAO_CAO_API.md` và tài liệu nghiệp vụ `bridges/bridges/*.md` (thay cho SRS). Rà soát theo quy mô ngày 2026-11-04: giữ 9 case, bỏ 9 case, bổ sung 4 case. Tổng 13 case. Bản trước rà soát lưu ở `TEST_CASE_PERFORMANCE_2026-11-03.md`._

## Tóm tắt

- **Quy mô thật:** công ty tối đa 150 nhân sự, test bằng 200 tài khoản. Mỗi lần chấm công phải login lại. Cao điểm check-in 08:30–08:45 (15 phút), check-out 18:00–18:30 (30 phút).
- **Rà soát theo quy mô (04/11/2026):** theo yêu cầu của người dùng, các case dồn 173–200 người trong 5 giây và stress 1000 VU bị bỏ vì gấp 50–120 lần tải thật (xem mục Rà soát theo quy mô). Thay bằng case rải đúng khung giờ, case dồn thực tế (một nửa số người dồn vào 1/6 khung) và Spike ở mức 3 lần thực tế.
- **Vai trò:** chỉ case `Nghiệm thu` dùng để kết luận phát hành: PERF-001, PERF-005, PERF-009, PERF-010, PERF-017, PERF-018, PERF-019, PERF-021. Case `Tham khảo` (PERF-002, PERF-006, PERF-013, PERF-020, PERF-022) cho biết biên an toàn và hành vi khi quá tải, không làm bộ test thành Không đạt.
- **Thời lượng chịu tải:** 1 phút chỉ tham khảo, 5 phút là chuẩn, 15 phút là khắt khe, với điều kiện tải được duy trì suốt thời gian đó.
- **Phạm vi:** chỉ 3 API `POST /v1/auth/login`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out`, theo yêu cầu thu hẹp. Các API khác cố ý không test.
- **Tiêu chí nghiệm thu:** do chưa có tài liệu, dùng tiêu chí đã được PO chấp nhận ở mục Tiêu chí nghiệm thu. Đo riêng từng API, dùng chung một thang, đánh giá theo cả 2 thang. Case Spike tham khảo dùng mức 1.
- **Tài khoản:** case 1 tài khoản (PERF-001, PERF-002, PERF-005, PERF-006, PERF-009, PERF-010, PERF-013) dùng tài khoản trong `.env` (`HRM_EMAIL`); case nhiều tài khoản (PERF-017 đến PERF-022) dùng 200 tài khoản trong `accounts-200.csv`.
- **Rule 5 lần/ngày (NFR-28), check-in và check-out ghi đè giờ (NFR-25, NFR-29):** mỗi người chỉ được gửi check-in tối đa 5 lần và check-out tối đa 5 lần mỗi ngày, tính cả lần bị từ chối; từ lần thứ 6 server trả 429. PERF-009, PERF-010 coi 429 là phản hồi mong đợi. Mỗi case 200 tài khoản tốn 1 lượt của mỗi tài khoản, nên một ngày chạy tối đa 5 case check-in và 5 case check-out, kể cả chạy thử.
- **Thứ tự chạy:** quyết định bởi khung giờ và trạng thái dữ liệu đầu mỗi case. PERF-017, PERF-019, PERF-020 đều phải chạy trong khung check-in của ca; PERF-018, PERF-021, PERF-022 trong khung check-out.
- **Trước khi chạy tải:** chủ hệ thống đã đồng ý cho chạy trên `hrs-main-dev`. Check-in và check-out tạo dữ liệu chấm công thật.

| Nhóm | Số case | Case |
| --- | --- | --- |
| Smoke | 1 | PERF-001 |
| Load | 3 | PERF-005, PERF-017, PERF-018 |
| Peak | 2 | PERF-019, PERF-021 |
| Spike | 3 | PERF-006, PERF-020, PERF-022 |
| Capacity | 1 | PERF-002 |
| Concurrency | 2 | PERF-009, PERF-010 |
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
| NFR-15 | Trả lời của người dùng | “Cùng lúc” là cửa sổ 5 giây: đúng | Thay bằng NFR-30 ngày 04/11/2026; các case cửa sổ 5 giây đã bỏ |
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
| NFR-27 | Phiên làm việc, yêu cầu của người dùng | có thể tạo ra 1000 request cùng lúc không? | Bỏ theo rà soát 04/11/2026; biên an toàn đo ở PERF-002 |
| NFR-30 | Yêu cầu của người dùng 04/11/2026 | với quy mô công ty chỉ có 200 người thì các case như trong 5s 200 người checkin checkout cùng lúc ,.... thì case này không quá là hợp lý ... nên có các case như là trogn 15 phút có 200 người cùng nhau truy cập vào checkin hay checkout | Rà soát theo quy mô; PERF-017 đến PERF-022 |

## Mô hình tải

| Thông số | Giá trị | Cách tính | Nguồn |
| --- | --- | --- | --- |
| Số người dùng thật | Tối đa 150 nhân sự; test bằng 200 tài khoản | Người dùng xác nhận; 150 × 1,15 = 172,5, làm tròn 173 cho case 1 tài khoản | Theo tài liệu: trả lời của người dùng |
| Khung giờ cao điểm | Check-in 08:30–08:45 (900 giây); check-out 18:00–18:30 (1800 giây) | Người dùng xác nhận | Theo tài liệu: trả lời của người dùng |
| Tốc độ trung bình trong khung | Check-in 0,222 người/giây; check-out 0,111 người/giây | 200 ÷ 900; 200 ÷ 1800 | Theo tài liệu: số người và khung giờ |
| Tốc độ dồn thực tế | Check-in 0,67 người/giây; check-out 0,33 người/giây | Trung bình × 3: một nửa số người (100) dồn vào 1/6 khung (150 giây cho check-in, 300 giây cho check-out) | Đề xuất: mô hình dồn mặc định |
| Login | Cùng tốc độ với chấm công | Mỗi lần chấm công login lại 1 lần | Theo tài liệu: trả lời của người dùng |
| Thời gian thao tác của người dùng | 10–30 giây mỗi người (mở app, định vị, chụp ảnh) | Các lượt gửi tự rải ra, không dồn đúng cùng giây | Đề xuất: kinh nghiệm |
| Biên an toàn login | Khoảng 11,5 req/s (hệ số khoảng 17) | 173 VU, nghỉ 15 giây | Đề xuất: số nghỉ mặc định |
| Spike | 3 lần tốc độ dồn thực tế: check-in 2 người/giây, check-out 1 người/giây | 200 người trong 100 giây; 200 người trong 200 giây | Đề xuất: mức 1,5–5 lần theo hướng dẫn |
| Tải thăm dò | 1 req/s login | Tạo mẫu đo trước, trong, sau sự kiện | Đề xuất |
| Ảnh mẫu | Khoảng 500KB | Người dùng xác nhận kích thước ảnh thật từ app | Theo tài liệu: trả lời của người dùng |

Tỷ lệ lỗi đề xuất: < 1% ở load, peak và spike; sai nghiệp vụ 0. Mọi API dùng chung một thang p95, p99.

## Rà soát theo quy mô

Hệ số = tải của case ÷ tốc độ dồn thực tế của cùng khung (0,67 người/giây cho login, check-in; 0,33 người/giây cho check-out). Quy tắc: ≤ 1,5 là nghiệm thu; 1,5–5 giữ làm Spike tham khảo; 5–20 chỉ giữ một case biên an toàn tham khảo; > 20 bỏ.

| Case | Nhóm test | Tải quy đổi | Hệ số so với thực tế | Quyết định | Vai trò | Lý do |
| --- | --- | --- | --- | --- | --- | --- |
| PERF-001 | Smoke | 1 người, 1 lượt | - | Giữ | Nghiệm thu | Xác nhận luồng chính chạy đúng |
| PERF-002 | Capacity | 11,5 req/s login | 17 | Đổi | Tham khảo | Bản đầu là Load nghiệm thu; giữ làm case biên an toàn duy nhất của login, không tính vào kết luận |
| PERF-005 | Load | 0,192 người/giây (173 người / 15 phút) | 0,3 | Giữ | Nghiệm thu | Đúng khung login trước check-in |
| PERF-006 | Spike | 2,9 người/giây (173 người / 60 giây) | 4,3 | Đổi | Tham khảo | Bản đầu 173 người / 30 giây, hệ số 8,6; đổi về mức dưới 5 lần |
| PERF-009 | Concurrency | 10 request trên 1 tài khoản | - | Giữ | Nghiệm thu | Bấm đúp và app gửi lại là tình huống thật; kiểm tra không trùng bản ghi |
| PERF-010 | Concurrency | 10 request trên 1 tài khoản | - | Giữ | Nghiệm thu | Như PERF-009 cho check-out |
| PERF-013 | Recovery | 1 req/s login | 1,5 | Giữ | Tham khảo | Deploy có thể xảy ra giữa giờ làm; chỉ cần login nên rẻ |
| PERF-017 | Load | 0,222 người/giây (200 người / 15 phút) | 0,3 | Giữ | Nghiệm thu | Đúng khung check-in thật, đổi nhóm Peak thành Load |
| PERF-018 | Load | 0,111 người/giây (200 người / 30 phút) | 0,3 | Giữ | Nghiệm thu | Đúng khung check-out thật, đổi nhóm Peak thành Load |
| PERF-019 | Peak | 0,67 người/giây (100 người / 150 giây cuối khung) | 1 | Giữ | Nghiệm thu | Bổ sung: người đến sát hạn check-in |
| PERF-020 | Spike | 2 người/giây (200 người / 100 giây) | 3 | Giữ | Tham khảo | Bổ sung: biên an toàn check-in, ví dụ sau thông báo nhắc hoặc hệ thống vừa hồi phục |
| PERF-021 | Peak | 0,33 người/giây (100 người / 300 giây đầu khung) | 1 | Giữ | Nghiệm thu | Bổ sung: mọi người về ngay khi hết giờ |
| PERF-022 | Spike | 1 người/giây (200 người / 200 giây) | 3 | Giữ | Tham khảo | Bổ sung: biên an toàn check-out |
| Bỏ-01 (PERF-003 cũ) | Load | 1 req/s trên 1 tài khoản suốt 5 phút (300 lần) | - | Bỏ | - | Người thật tối đa 5 lần/ngày; sau lần thứ 5 chỉ đo nhánh 429; rule 5 lần đã kiểm tra ở PERF-009; người dùng đã bỏ chạy lại ngày 03/11 |
| Bỏ-02 (PERF-004 cũ) | Load | 1 req/s trên 1 tài khoản suốt 5 phút (301 lần) | - | Bỏ | - | Như Bỏ-01 cho check-out; kết quả 02/11 chỉ đo nhánh 429, rule đã kiểm tra ở PERF-010 |
| Bỏ-03 (PERF-007 cũ) | Spike | 34,6 người/giây (173 người / 5 giây) | 52 | Bỏ | - | Không có tình huống nào 173 người gửi trong cùng 5 giây; pha check-in đã bỏ ngày 03/11 |
| Bỏ-04 (PERF-008 cũ) | Stress | VU đóng tăng đến 1000 VU | > 100 | Bỏ | - | Công ty tối đa 150 người; biên an toàn login đã có ở PERF-002 |
| Bỏ-05 (PERF-011 cũ) | Concurrency | Check-in và check-out cùng lúc trên 1 tài khoản | - | Bỏ | - | Hai khung giờ không giao nhau nên không xảy ra thật; người dùng đã bỏ ngày 03/11 |
| Bỏ-06 (PERF-012 cũ) | Resilience | 20 người check-in khi S3 lỗi | - | Bỏ | - | Chỉ cần 1 người để thấy hành vi khi S3 lỗi; chuyển sang kiểm thử chức năng chịu lỗi cùng dev; cần sửa cấu hình backend và vướng 5 lượt/ngày |
| Bỏ-07 (PERF-014 cũ) | Spike | 40 người/giây login (200 người / 5 giây) | 60 | Bỏ | - | Gấp 60 lần tải thật; thay bằng PERF-019, PERF-020 |
| Bỏ-08 (PERF-015 cũ) | Spike | 40 người/giây check-in (200 người / 5 giây) | 60 | Bỏ | - | Gấp 60 lần tải thật; thay bằng PERF-019, PERF-020 |
| Bỏ-09 (PERF-016 cũ) | Spike | 40 người/giây check-out (200 người / 5 giây) | 120 | Bỏ | - | Gấp 120 lần tải thật; thay bằng PERF-021, PERF-022 |
| Bỏ-10 | Soak | Tải đều nhiều giờ | - | Bỏ | - | Ngoài 2 khung chấm công gần như không có tải; không có yêu cầu chạy liên tục |

Kết quả đã đo của các case bị bỏ vẫn giữ trong báo cáo ngày 02/11 và 03/11 làm thông tin tham khảo về hành vi khi quá tải.

## Mốc thời lượng

| Mốc | Mức | Giá trị đánh giá | Case áp dụng |
| --- | --- | --- | --- |
| 1 phút | Smoke, test nhanh | Chỉ để tham khảo | PERF-001 |
| 5 phút | Tiêu chuẩn | Tin cậy, dùng để đánh giá | PERF-002 lần 1 |
| 15 phút | Khắt khe | Dùng để đánh giá, thấy được hiện tượng định kỳ | PERF-002 lần 2, PERF-005, PERF-013, PERF-017, PERF-019 |

Thời lượng chỉ có ý nghĩa khi tải được duy trì và có đủ giao dịch thành công, nên các case Spike (PERF-006, PERF-020, PERF-022) không tính theo mốc này. PERF-018, PERF-021 chạy 30 phút theo khung check-out. Thời gian thao tác dưới 5 phút của người dùng không phải ngưỡng phản hồi API. Các case Concurrency theo lượt không tính thời lượng. Không có Soak trong bộ case này (xem Bỏ-10).

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

Chỉ case có vai trò `Nghiệm thu` ở mục Rà soát theo quy mô được dùng cho bảng này. Case `Tham khảo` vẫn ghi mức đạt, nhưng không làm kết luận chung thành Không đạt.

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
| PERF-001 | Smoke | Đăng nhập, check-in, check-out | `POST /v1/auth/login` → `POST /v1/attendance/check-in` → `POST /v1/attendance/check-out` | Nghiệm thu: xác nhận login, ảnh, GPS, ca và dữ liệu ghi đúng | 1 người, 1 lượt | Tối đa 1 phút | Login 200, check-in 201, check-out 200, `checkInAt`, `checkOutAt`, ảnh được lưu đúng, lỗi 0% |  | Chưa chạy | Kết hợp: theo tài liệu mốc thời lượng được cung cấp cho 1 phút, chỉ để tham khảo; đề xuất 1 người 1 lượt; lý do: check-in thật chỉ được 1 lần mỗi ngày. |
| PERF-002 | Capacity | Đăng nhập tải ổn định | `POST /v1/auth/login` | Tham khảo: biên an toàn của login, khoảng 17 lần tải thật | 173 VU, mỗi VU login rồi nghỉ 15 giây, khoảng 11,5 req/s, ramp 2 phút. Chạy 2 lần: giữ tải 5 phút, sau đó giữ tải 15 phút | 5 phút, rồi 15 phút | p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), tốc độ đạt ≥ 90% của 11,5 req/s; báo cáo số VU, req/s đạt được, số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người, thông tin nghiệp vụ được cung cấp cho các mốc 5, 15 phút; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất nghỉ 15 giây, lỗi < 1%, tốc độ ≥ 90%; lý do: số nghỉ mặc định, VU đóng có thể tự giảm tải khi hệ thống chậm. |
| PERF-005 | Load | Đăng nhập trong khung check-in | `POST /v1/auth/login` | Nghiệm thu: đăng nhập trong khung 08:30–08:45 | 173 lượt rải đều trong 15 phút, 0,192 req/s tải mở | 15 phút | p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), không khoá tài khoản, báo cáo số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người, thông tin nghiệp vụ được cung cấp cho khung 08:30–08:45; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| PERF-006 | Spike | Đăng nhập dồn đầu ca | `POST /v1/auth/login` | Tham khảo: đăng nhập chịu được đợt dồn 4,3 lần thực tế và phục hồi | Tải thăm dò login 1 req/s chạy suốt: 2 phút nền, 173 VU login trong 60 giây (khoảng 2,9 lượt/s), 5 phút sau spike | Khoảng 8 phút | p95 < 2s, p99 < 6s (mức 1), không 5xx, lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |  | Chưa chạy | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho mức 1; đề xuất 60 giây, tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: rà soát 04/11/2026 đổi từ 30 giây (hệ số 8,6) về dưới 5 lần tải dồn thực tế. |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | `POST /v1/auth/login` → `POST /v1/attendance/check-in` | Nghiệm thu: không tạo hai bản ghi chấm công trong một ngày | 10 VU gửi trong 1 giây | 1 lượt | 1–5 lần 201 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, đúng 1 bản ghi trong ngày và có `checkInAt`, không 5xx |  | Chưa chạy | Kết hợp: theo tài liệu attendance.md cho 409 khi check-in lần 2; đề xuất 10 VU; lý do: mô phỏng bấm đúp và app gửi lại. |
| PERF-010 | Concurrency | Bấm check-out nhiều lần | `POST /v1/auth/login` → `POST /v1/attendance/check-out` | Nghiệm thu: không tạo bản ghi trùng khi bấm nhiều lần | 10 VU gửi trong 1 giây | 1 lượt | 1–5 lần 200 (ghi đè giờ), còn lại 429 (quá 5 lần/ngày), số lần không bị 429 ≤ 5, chỉ 1 bản ghi trong ngày và có `checkOutAt`, không 5xx |  | Chưa chạy | Kết hợp: theo xác nhận của người dùng ngày 02/11/2026, check-out được ghi đè giờ; theo kết quả chạy thật ngày 02/11/2026, giới hạn 5 lần/ngày; đề xuất 10 VU; lý do: mô phỏng bấm đúp. |
| PERF-013 | Recovery | Restart app khi đang đăng nhập | `POST /v1/auth/login` | Tham khảo: đăng nhập tự phục hồi sau restart | Tải thăm dò 1 req/s tải mở: 4 phút nền, restart app ở phút 5, quan sát đến phút 15 | 15 phút | Lỗi chỉ xuất hiện trong lúc restart; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |  | Chưa chạy | Đề xuất: 1 req/s, restart phút 5, cửa sổ 1 phút, 120%, phục hồi trong 5 phút; lý do: mốc phục hồi trong hướng dẫn, cần tải nền để có mẫu đo. |
| PERF-017 | Load | Check-in cao điểm 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-in` | Nghiệm thu: 200 người check-in thành công, rải đều trong khung cao điểm | 200 tài khoản, mỗi người 1 lượt thành công, rải đều 08:30–08:45, 0,222 lượt/s, ảnh khoảng 500KB | 15 phút | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đúng 200 bản ghi; báo cáo tổng thời gian flow và số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản và khung 08:30–08:45; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| PERF-018 | Load | Check-out cao điểm 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-out` | Nghiệm thu: 200 người check-out thành công, rải đều trong khung cao điểm | 200 tài khoản, mỗi người 1 lượt thành công, rải đều 18:00–18:30, 0,111 lượt/s, ảnh khoảng 500KB | 30 phút | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; báo cáo tổng thời gian flow và số mẫu |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng cho 200 tài khoản và khung 18:00–18:30; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất lỗi < 1%; lý do: tài liệu chưa có ngưỡng lỗi. |
| PERF-019 | Peak | Check-in dồn sát hạn 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-in` | Nghiệm thu: chịu được người đến sát hạn check-in | 100 người rải đều 08:30–08:42:30 (0,133 người/giây), 100 người rải đều 08:42:30–08:45 (0,67 người/giây); mỗi người 1 lượt, ảnh khoảng 500KB | 15 phút | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 bản ghi trong ngày; báo cáo riêng p95 của pha dồn |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng 04/11/2026 (NFR-30) cho 200 người trong khung 15 phút; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất một nửa số người dồn vào 1/6 khung cuối, lỗi < 1%; lý do: mô hình dồn thực tế ở mục Mô hình tải. |
| PERF-020 | Spike | Check-in dồn 3 lần thực tế 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-in` | Tham khảo: biên an toàn check-in khi nhiều người bấm cùng lúc | Login và đọc thông tin trước trong setup; 200 người gửi check-in rải đều trong 100 giây (2 người/giây), ảnh khoảng 500KB; tải thăm dò login 1 req/s trước, trong và 5 phút sau | 100 giây gửi, quan sát khoảng 8 phút | Mỗi API riêng p95 < 2s, p99 < 6s (mức 1); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 bản ghi; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |  | Chưa chạy | Kết hợp: theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho mức 1; đề xuất 3 lần tốc độ dồn thực tế, tải thăm dò 1 req/s, lỗi < 1%; lý do: thay cho case 200 người trong 5 giây (hệ số 60) theo NFR-30. |
| PERF-021 | Peak | Check-out dồn đầu khung 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-out` | Nghiệm thu: chịu được mọi người về ngay khi hết giờ | 100 người rải đều 18:00–18:05 (0,33 người/giây), 100 người rải đều 18:05–18:30 (0,067 người/giây); mỗi người 1 lượt, ảnh khoảng 500KB | 30 phút | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; báo cáo riêng p95 của pha dồn |  | Chưa chạy | Kết hợp: theo tài liệu yêu cầu của người dùng 04/11/2026 (NFR-30) và khung 18:00–18:30; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất một nửa số người dồn vào 1/6 khung đầu, lỗi < 1%; lý do: mô hình dồn thực tế ở mục Mô hình tải. |
| PERF-022 | Spike | Check-out dồn 3 lần thực tế 200 tài khoản | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-out` | Tham khảo: biên an toàn check-out khi nhiều người bấm cùng lúc | Login và đọc thông tin trước trong setup; 200 người gửi check-out rải đều trong 200 giây (1 người/giây), ảnh khoảng 500KB; tải thăm dò login 1 req/s trước, trong và 5 phút sau | 200 giây gửi, quan sát khoảng 9 phút | Mỗi API riêng p95 < 2s, p99 < 6s (mức 1); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |  | Chưa chạy | Kết hợp: theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho mức 1; đề xuất 3 lần tốc độ dồn thực tế, tải thăm dò 1 req/s, lỗi < 1%; lý do: thay cho case 200 người trong 5 giây (hệ số 120) theo NFR-30. |

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
| Tên flow | Đăng nhập tải ổn định (biên an toàn, Tham khảo) |
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
| Kịch bản tải | Tải thăm dò login 1 req/s chạy suốt: 2 phút nền, 173 VU login trong 60 giây (khoảng 2,9 lượt/s), 5 phút sau spike; thời lượng Khoảng 8 phút. |
| Tiêu chí đạt | p95 < 2s, p99 < 6s (mức 1), không 5xx, lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu trả lời của người dùng cho 173 người; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho mức 1; đề xuất 60 giây, tải thăm dò 1 req/s, cửa sổ 1 phút, 120%, lỗi < 1%; lý do: rà soát 04/11/2026 đổi từ 30 giây (hệ số 8,6) về dưới 5 lần tải dồn thực tế. Kết quả 02/11/2026 ở 30 giây (khắt khe hơn) đạt p95 244ms. |
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

### PERF-019

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-019 |
| Tên flow | Check-in dồn sát hạn 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ địa điểm được gán |
| API 3 | `POST /v1/attendance/check-in`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | `LATE` là kết quả hợp lệ. |
| API chạy song song | Các tài khoản gửi độc lập theo lịch rải; tải thăm dò login chạy nền nếu có. |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã gán ca và địa điểm; chạy trong khung giờ của ca. Trạng thái đầu: chưa check-in hoặc đã check-in (check-in được ghi đè giờ). Mỗi tài khoản còn ít nhất 1 lượt trong 5 lượt/ngày. Ảnh JPG/PNG khoảng 500KB là fixture, không đo tải. |
| Kịch bản tải | 100 người rải đều 08:30–08:42:30 (0,133 người/giây), 100 người rải đều 08:42:30–08:45 (0,67 người/giây); mỗi người 1 lượt, ảnh khoảng 500KB; thời lượng 15 phút. |
| Tiêu chí đạt | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 bản ghi trong ngày; báo cáo riêng p95 của pha dồn |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu yêu cầu của người dùng 04/11/2026 (NFR-30) cho 200 người trong khung 15 phút; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất một nửa số người dồn vào 1/6 khung cuối, lỗi < 1%; lý do: mô hình dồn thực tế ở mục Mô hình tải. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-020

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-020 |
| Tên flow | Check-in dồn 3 lần thực tế 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ địa điểm được gán |
| API 3 | `POST /v1/attendance/check-in`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | `LATE` là kết quả hợp lệ. |
| API chạy song song | Các tài khoản gửi độc lập theo lịch rải; tải thăm dò login chạy nền nếu có. |
| API trọng yếu | `POST /v1/attendance/check-in` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã gán ca và địa điểm; chạy trong khung giờ của ca. Trạng thái đầu: chưa check-in hoặc đã check-in (check-in được ghi đè giờ). Mỗi tài khoản còn ít nhất 1 lượt trong 5 lượt/ngày. Ảnh JPG/PNG khoảng 500KB là fixture, không đo tải. |
| Kịch bản tải | Login và đọc thông tin trước trong setup; 200 người gửi check-in rải đều trong 100 giây (2 người/giây), ảnh khoảng 500KB; tải thăm dò login 1 req/s trước, trong và 5 phút sau; thời lượng 100 giây gửi, quan sát khoảng 8 phút. |
| Tiêu chí đạt | Mỗi API riêng p95 < 2s, p99 < 6s (mức 1); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 bản ghi; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho mức 1; đề xuất 3 lần tốc độ dồn thực tế, tải thăm dò 1 req/s, lỗi < 1%; lý do: thay cho case 200 người trong 5 giây (hệ số 60) theo NFR-30. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-021

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-021 |
| Tên flow | Check-out dồn đầu khung 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ địa điểm được gán |
| API 3 | `POST /v1/attendance/check-out`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | Về sớm là kết quả hợp lệ. |
| API chạy song song | Các tài khoản gửi độc lập theo lịch rải; tải thăm dò login chạy nền nếu có. |
| API trọng yếu | `POST /v1/attendance/check-out` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã gán ca và địa điểm; chạy trong khung giờ của ca. Trạng thái đầu: đã check-in hoặc đã check-out (check-out được ghi đè giờ). Mỗi tài khoản còn ít nhất 1 lượt trong 5 lượt/ngày. Ảnh JPG/PNG khoảng 500KB là fixture, không đo tải. |
| Kịch bản tải | 100 người rải đều 18:00–18:05 (0,33 người/giây), 100 người rải đều 18:05–18:30 (0,067 người/giây); mỗi người 1 lượt, ảnh khoảng 500KB; thời lượng 30 phút. |
| Tiêu chí đạt | Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; báo cáo riêng p95 của pha dồn |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu yêu cầu của người dùng 04/11/2026 (NFR-30) và khung 18:00–18:30; theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho p95, p99; đề xuất một nửa số người dồn vào 1/6 khung đầu, lỗi < 1%; lý do: mô hình dồn thực tế ở mục Mô hình tải. |
| Kết quả | |
| Kết luận | Chưa chạy |

### PERF-022

| Trường | Nội dung |
| --- | --- |
| Test case ID | PERF-022 |
| Tên flow | Check-out dồn 3 lần thực tế 200 tài khoản |
| API 1 | `POST /v1/auth/login`: gửi `identifier`, `password`; lưu `data.accessToken` |
| API 2 | `GET /v1/attendance/today-info`: lấy toạ độ địa điểm được gán |
| API 3 | `POST /v1/attendance/check-out`: multipart `photo`, `latitude`, `longitude`; dùng token của bước login |
| Điều kiện rẽ nhánh | Về sớm là kết quả hợp lệ. |
| API chạy song song | Các tài khoản gửi độc lập theo lịch rải; tải thăm dò login chạy nền nếu có. |
| API trọng yếu | `POST /v1/attendance/check-out` |
| Tiền điều kiện | Cần file `accounts-200.csv` 200 tài khoản EMPLOYEE, đã gán ca và địa điểm; chạy trong khung giờ của ca. Trạng thái đầu: đã check-in hoặc đã check-out (check-out được ghi đè giờ). Mỗi tài khoản còn ít nhất 1 lượt trong 5 lượt/ngày. Ảnh JPG/PNG khoảng 500KB là fixture, không đo tải. |
| Kịch bản tải | Login và đọc thông tin trước trong setup; 200 người gửi check-out rải đều trong 200 giây (1 người/giây), ảnh khoảng 500KB; tải thăm dò login 1 req/s trước, trong và 5 phút sau; thời lượng 200 giây gửi, quan sát khoảng 9 phút. |
| Tiêu chí đạt | Mỗi API riêng p95 < 2s, p99 < 6s (mức 1); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện |
| Ghi chú nguồn số liệu | Kết hợp: theo tài liệu tiêu chí nghiệm thu được PO chấp nhận cho mức 1; đề xuất 3 lần tốc độ dồn thực tế, tải thăm dò 1 req/s, lỗi < 1%; lý do: thay cho case 200 người trong 5 giây (hệ số 120) theo NFR-30. |
| Kết quả | |
| Kết luận | Chưa chạy |

## Checklist độ đầy đủ trước khi chạy

- [x] Có smoke test cho từng API/flow quan trọng. Case: PERF-001
- [x] Có load test theo tải cao điểm dự kiến. Case: PERF-005, PERF-017, PERF-018
- [x] Có peak hoặc spike test cho giờ cao điểm. Case: PERF-019, PERF-021 (dồn thực tế); PERF-006, PERF-020, PERF-022 (spike tham khảo)
- [x] Có stress/capacity test để biết giới hạn. Case: PERF-002 (biên an toàn login, tham khảo); stress 1000 VU đã bỏ theo quy mô (Bỏ-04)
- [x] Có soak test cho luồng chính. Không áp dụng: ngoài 2 khung chấm công gần như không có tải (Bỏ-10)
- [x] Có case tranh chấp dữ liệu. Case: PERF-009, PERF-010
- [x] Có kiểm tra response và trạng thái nghiệp vụ, không chỉ đo thời gian. Case: PERF-009, PERF-010, PERF-017, PERF-018, PERF-019, PERF-021
- [x] Có threshold rõ ràng cho p95, p99 và tỷ lệ lỗi. Case: PERF-002, PERF-005, PERF-006, PERF-017, PERF-018, PERF-019, PERF-020, PERF-021, PERF-022
- [ ] Có theo dõi API, database, cache, queue và server cùng lúc. Kế hoạch: k6 đo phía client; CPU, RAM, connection pool cần quyền server, hiện chưa có.
- [x] Có dữ liệu test an toàn và quyền chạy test trên môi trường đó. Kế hoạch: `hrs-main-dev`, chủ hệ thống đã đồng ý (NFR-20); 200 tài khoản test EMP202–EMP401.

## Điểm cần xác nhận

| Nội dung | Giả định đang dùng | Ảnh hưởng nếu sai | Hỏi ai |
| --- | --- | --- | --- |
| Rà soát theo quy mô thay cửa sổ 5 giây (NFR-15) bằng tải rải theo khung giờ (NFR-30) | Người dùng yêu cầu ngày 04/11/2026; PO chưa xác nhận | Nếu PO vẫn cần tiêu chí 5 giây thì các case Bỏ-03, Bỏ-07, Bỏ-08, Bỏ-09 phải quay lại làm nghiệm thu | PO |
| Mô hình dồn thực tế: một nửa số người trong 1/6 khung | Đề xuất theo kinh nghiệm, chưa có log chấm công thật | Nếu dồn mạnh hơn, PERF-019, PERF-021 đánh giá thấp tải thật; có log chấm công thì thay bằng phân bố thật | PO, HR |
| Swagger ghi ~50 nhân viên, thông tin mới là tối đa 150 | Dùng 150 người, test bằng 200 tài khoản | Sai quy mô | PO |
| Body check-out có cần GPS không | Theo Swagger: bắt buộc `photo`, `latitude`, `longitude`; bridge chỉ `photo` | Check-out trả 400 | Backend |
| Khung giờ của ca 10 cho 200 tài khoản | Khung check-in và check-out phải bao trọn thời gian chạy của PERF-017 đến PERF-022 | Server trả 400 hết giờ và tốn lượt trong ngày | Quản trị hệ thống |
| Số lượt trong ngày | Mỗi case 200 tài khoản tốn 1 lượt mỗi người, tối đa 5 lượt check-in và 5 lượt check-out mỗi ngày | Chạy quá 5 case cùng loại trong một ngày sẽ bị 429 | Người chạy test |
