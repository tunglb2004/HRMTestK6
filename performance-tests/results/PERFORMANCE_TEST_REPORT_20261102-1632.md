# PERFORMANCE TEST REPORT

## 1. Tóm tắt kết luận

| Mục | Nội dung |
|---|---|
| Dự án / phiên bản build | HR System (HRM) / |
| Thời gian test | 2026-11-02T11:14:58+07:00 – 2026-11-02T16:25:27+07:00 |
| Người thực hiện | Lưu Bách Tùng |
| Môi trường | Dev (`https://hrs-main-dev.sonthanh.net.vn`) |
| Công cụ | k6 v2.3.0 |
| Kết luận | **Không đạt** |
| Năng lực tối đa đo được | Login: 173 lượt rải trong 30 giây (PERF-006) và tải ổn định 10.599981761732439 req/s trong 15 phút (PERF-002 lần 4) vẫn đạt toàn bộ threshold. Chưa có mức tải check-in, check-out ghi thành công nào đạt toàn bộ threshold. |
| Lỗi nghiêm trọng | 23 lần vượt threshold trên 8 lần chạy: `http_req_duration{api:login,scenario:burst}` p95, p99 (PERF-007 ×3, PERF-014 ×3), `http_req_duration{api:login}` p95, p99 (PERF-014 ×3), `attendance_success_count` (PERF-009 ×2, PERF-010 ×1), `data_integrity_errors` (PERF-009 ×2). Không có lỗi 5xx, timeout hay 429 ở login. |
| Khuyến nghị phát hành | Không. Cần xử lý login chậm khi nhiều người đăng nhập trong vài giây (PERF-007, PERF-014), chạy đủ các case check-in và 200 tài khoản (PERF-015 đến PERF-018) rồi đánh giá lại. |

### Định nghĩa kết luận

| Kết luận | Điều kiện |
|---|---|
| Đạt | Tất cả case trong phạm vi đạt threshold; không có lỗi nghiệp vụ nghiêm trọng |
| Đạt có điều kiện | Flow chính đạt, nhưng còn rủi ro hoặc issue đã được chấp nhận kèm điều kiện rõ ràng |
| Không đạt | Vượt SLA, tỷ lệ lỗi cao, sai dữ liệu nghiệp vụ, hoặc chưa đủ bằng chứng để kết luận |

## 2. Phạm vi và mục tiêu

### Mục tiêu

Xác định đăng nhập, check-in, check-out của HRM có đáp ứng tải công ty 150 nhân sự (173 người đồng thời sau buffer 15%, dồn trong cửa sổ 5 giây) với tiêu chí PO đã chấp nhận: p95 < 1s, p99 < 2,5s, lỗi kỹ thuật < 1%, không sai dữ liệu chấm công.

### Trong phạm vi

| Flow/API | Mô tả | Loại test |
|---|---|---|
| `POST /v1/auth/login` | Đăng nhập nhân viên | Load, Peak, Spike, Stress, Recovery |
| `POST /v1/attendance/check-in` | Check-in kèm ảnh khoảng 500KB và GPS | Smoke, Load, Spike, Concurrency, Resilience, Peak |
| `POST /v1/attendance/check-out` | Check-out kèm ảnh khoảng 500KB và GPS | Smoke, Load, Concurrency, Spike, Peak |

### Ngoài phạm vi

- Các API khác ngoài login, check-in, check-out (người dùng thu hẹp phạm vi).
- Soak test (người dùng bỏ vì ngoài phạm vi).

## 3. Môi trường và dữ liệu test

| Hạng mục | Môi trường test | Production | Chênh lệch / ảnh hưởng đến kết quả |
|---|---|---|---|
| Backend |  |  | Chưa có thông tin cấu hình server dev |
| Database |  |  |  |
| Cache/Queue |  |  |  |
| Dữ liệu | 200 tài khoản test EMP202–EMP401 (Phòng Sản Xuất Phần Mềm), ca 10 "Ca test hiệu năng" 08:00–17:30; 1 tài khoản nhân viên trong `.env` cho các bài login |  | Khung chấm công ca 10 được nới tạm: check-in 08:00–11:00, check-out 13:00–18:00 |
| Máy chạy k6 | Windows, k6 v2.3.0 | Không áp dụng | CPU máy chạy test tối đa 36.50% nên không phải điểm nghẽn |
| Dịch vụ ngoài | Lưu ảnh chấm công thật trên `r2.cloudflarestorage.com` |  |  |

> Không dùng kết quả local để kết luận trực tiếp năng lực của production. Chỉ so sánh được khi cấu hình, dữ liệu, mạng và dịch vụ phụ trợ tương đương.

## 4. Tiêu chí chấp nhận

| Chỉ số | Tiêu chí |
|---|---|
| Tỷ lệ lỗi HTTP | Lỗi kỹ thuật (5xx, timeout, mất kết nối) `< 1%` |
| Kiểm tra nghiệp vụ đạt | Số lần chấm công thành công đúng như case, sai dữ liệu = 0 |
| p95 API đọc thông thường | Không đặt riêng; dùng chung p95 `< 1 giây` cho cả 3 API |
| p95 API ghi/thao tác nghiệp vụ | `< 1 giây` (mức 2 thang B); mức 1: `< 2 giây` |
| p99 API ghi/thao tác nghiệp vụ | `< 2,5 giây` (mức 2 thang B); mức 1: `< 6 giây` |
| p95 thanh toán/BHYT | Không áp dụng |
| CPU backend | Chưa có tiêu chí, chưa đo |
| Database | Chưa có tiêu chí, chưa đo |
| Tính đúng nghiệp vụ | Không ghi trùng bản ghi chấm công; mỗi tài khoản 1 bản ghi mỗi ngày |

## 5. Tổng hợp theo test case

| ID | Nhóm test | Flow | Kịch bản tải | Thời lượng | RPS/TPS | p95 | p99 | Lỗi | Tiêu chí | Kết quả | Ghi chú |
|---|---|---|---|---|---:|---:|---:|---:|---|---|---|
| PERF-001 | Smoke | Login → check-in; login → check-out | 1 VU, 1 lượt mỗi pha |  |  |  |  |  | 100% checks đạt, đúng trạng thái sau bài | Pending | Chưa chạy. Check-in và check-out có khung giờ khác nhau nên case được tách 2 lượt sáng và chiều; khung check-in hôm nay đã đóng lúc 11:00. |
| PERF-002 | Load | Login | `load-login.js` HOLD=5m | 11:14:58–11:22:14 | 9.605311116905611 | 574ms | 1025ms | 0.02% | p95 < 1000ms, p99 < 2500ms, lỗi < 1% | Pass | Lần 3, 4182 request, A2 B2. |
| PERF-002 | Load | Login | `load-login.js` HOLD=15m | 11:24:04–11:41:20 | 10.599981761732439 | 550ms | 1103ms | 0.00% | p95 < 1000ms, p99 < 2500ms, lỗi < 1% | Pass | Lần 4, 10972 request, A2 B2. |
| PERF-003 | Load | Check-in lặp, nhánh đã check-in | 1 req/s, 5 phút |  |  |  |  |  | Phản hồi mong đợi ≥ 99%, lỗi < 1% | Pending | Chưa chạy. Cần khung check-in (08:00–11:00) và tài khoản đã check-in. Mỗi tài khoản chỉ được gửi check-in 5 lần/ngày, script check-in chưa coi 429 là phản hồi mong đợi. |
| PERF-004 | Load | Check-out lặp, nhánh đã check-out | `load-repeat-attendance.js` ACTION=checkout, 1 req/s | 16:20:25–16:25:27 | 1.0129727494335397 | 100ms | 111ms | 0.00% | Phản hồi mong đợi ≥ 99%, lỗi < 1%, p95 < 1000ms, p99 < 2500ms, sai dữ liệu = 0 | Pass | Lần 3, EMP202. 301/301 request trả 429 do đã dùng hết 5 lượt check-out; chỉ đo nhánh từ chối. |
| PERF-005 | Peak | Login trong khung check-in | `peak-login.js` | 14:01:13–14:16:13 | 0.19222179015035393 | 281ms | 538ms | 0.00% | p95 < 1000ms, p99 < 2500ms, lỗi < 1% | Pass | Lần 2, 173 request, A3 B3. |
| PERF-006 | Spike | Login dồn đầu ca | `spike-login.js`, 173 lượt trong 30 giây | 14:17:28–14:25:29 | 1.3639059213269467 | 244ms | 276ms | 0.00% | Lỗi < 1%, phục hồi | Pass | Lần 2, 655 request gồm lượt thăm dò; đã phục hồi. |
| PERF-007 | Spike | Login burst 173 VU trong 5 giây | `burst-173vu.js` PHASE=login | 11:53:31–12:01:32 | 1.3520724742195929 | 7374.529700000028 | 10737.998408 | 0.00% | Burst: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 2. p95, p99 là riêng 173 lượt burst. Đã phục hồi. |
| PERF-007 | Spike | Login burst 173 VU trong 5 giây | `burst-173vu.js` PHASE=login | 13:35:54–13:43:55 | 1.35832290933694 | 7028.0116 | 10808.067424 | 0.00% | Burst: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 3. Đã phục hồi. |
| PERF-007 | Spike | Login burst 173 VU trong 5 giây | `burst-173vu.js` PHASE=login | 13:45:00–13:53:01 | 1.3600130728705304 | 6245.80274 | 11104.328164 | 0.00% | Burst: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 5 (lần 4 là file rỗng, không tính). Pha check-in chưa chạy: cần khung check-in và trạng thái chưa check-in. |
| PERF-008 | Stress | Login tăng bậc đến 1000 VU | Các bậc 50, 100, 173, 300, 500, 1000 |  |  |  |  |  | Bậc ≤ 173 giữ tiêu chí nghiệm thu | Pending | Chưa chạy. VU đóng không nghỉ, các bậc 50, 100, 173 không tự dừng nên dồn tải lên dev khoảng 16 phút; cần báo dev và theo dõi CPU, DB server khi chạy. |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | `race-attendance.js` ACTION=checkin, 10 VU | 15:50:18–15:50:23 | 2.760772832908004 | 872.187715 | 894.7573030000001 | 0.00% | Thành công đúng 1 lần, sai dữ liệu = 0 | Fail | Lần 3, tài khoản `.env`. 0 lần thành công, 5 lần 429, 5 lần bị từ chối khác. Không hợp lệ để nghiệm thu. |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | `race-attendance.js` ACTION=checkin, 10 VU | 16:11:55–16:12:01 | 2.521576499713927 | 1165.9910949999996 | 1260.767899 | 0.00% | Thành công đúng 1 lần, sai dữ liệu = 0 | Fail | Lần 4, EMP202. 5 lần 400 "Đã hết giờ check-in (quá 11:00)", 5 lần 429 vượt 5 lần/ngày. Không hợp lệ để nghiệm thu; cần chạy lại trong khung check-in bằng tài khoản khác. |
| PERF-010 | Concurrency | Bấm check-out nhiều lần | `race-attendance.js` ACTION=checkout, 10 VU | 16:15:27–16:15:33 | 2.5525462758477464 | 1008ms | 1071ms | 0.00% | Thành công đúng 1 lần (threshold lúc chạy), sai dữ liệu = 0 | Fail | Lần 5, EMP202. 5 lần 200, 5 lần 429, 1 bản ghi. Sau lần chạy, người dùng xác nhận check-out được ghi đè giờ nên tiêu chí đổi thành 1–5 lần thành công; theo tiêu chí mới đạt về dữ liệu, thời gian mức 1 (A1 B1). |
| PERF-011 | Concurrency | Check-in và check-out gửi cùng lúc | 2 VU |  |  |  |  |  | Ít nhất 1 thành công, sai dữ liệu = 0 | Pending | Chưa chạy. Cần khung check-in (08:00–11:00) và trạng thái chưa check-in. |
| PERF-012 | Resilience | S3 chậm khi check-in | 20 VU check-in, 3 phút nền, 7 phút S3 lỗi, 5 phút phục hồi |  |  |  |  |  | Login không bị ảnh hưởng, phục hồi | Pending | Chưa chạy. Cần đội vận hành gây lỗi S3; bộ case thiếu `CHECKIN_THINK_SECONDS`. |
| PERF-013 | Recovery | Restart app khi đang đăng nhập | Restart app ở phút 5 |  |  |  |  |  | Phục hồi | Pending | Chưa chạy. Cần người có quyền restart app trên dev. |
| PERF-014 | Spike | Login burst 200 tài khoản trong 5 giây | `burst-login-200.js` | 14:49:36–14:57:37 | 1.41407556118884 | 8061.739714999998 | 12939.488974 | 0.00% | Burst và toàn bài: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 1. p95, p99 là riêng 200 lượt burst. Đã phục hồi. |
| PERF-014 | Spike | Login burst 200 tài khoản trong 5 giây | `burst-login-200.js` | 15:15:29–15:23:29 | 1.4124990227272387 | 7158.716654999999 | 12624.251796 | 0.00% | Burst và toàn bài: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 2. Đã phục hồi. |
| PERF-014 | Spike | Login burst 200 tài khoản trong 5 giây | `burst-login-200.js` | 15:37:36–15:45:36 | 1.4104141358548017 | 11244.58679 | 11474.298740999999 | 0.00% | Burst và toàn bài: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 3. Trung vị burst 6694.00005. Đã phục hồi. |
| PERF-015 | Spike | 200 tài khoản cùng check-in | 200 VU trong 5 giây |  |  |  |  |  | 200/200 thành công, p95 < 1s, p99 < 2,5s | Pending | Chưa chạy. Lúc 13:55 cả 200 tài khoản chưa có ca và địa điểm; sau đó đã gán ca 10, địa điểm mới gán một phần. Cần khung check-in và ngày không chạy bài 1 tài khoản. |
| PERF-016 | Spike | 200 tài khoản cùng check-out | `burst-attendance-200.js` ACTION=checkout, 200 VU trong 5 giây | 17:14:56–17:23:43 | 0.3797265602557863 | 10495.50037 | 10633.243754 | 0.00% | `attendance_success_count` == 200, p95 < 1000, p99 < 2500, lỗi < 1% | Fail | Lần 1 (chạy sau khi báo cáo này được lập lúc 16:32). 199 lần thành công, 1 lần 429 (EMP202 đã dùng hết 5 lượt check-out); đối soát sau bài 200/200 tài khoản đã check-out. Trung vị 9260.95025. Đã phục hồi. |
| PERF-017 | Peak | Check-in cao điểm 200 tài khoản | Rải đều 08:30–08:45 | 15 phút |  |  |  |  | 200/200 thành công, p95 < 1s, p99 < 2,5s | Pending | Chưa chạy. Phải bắt đầu đúng 08:30; chưa đủ địa điểm cho 200 tài khoản. |
| PERF-018 | Peak | Check-out cao điểm 200 tài khoản | Rải đều 18:00–18:30 | 30 phút |  |  |  |  | 200/200 thành công, p95 < 1s, p99 < 2,5s | Pending | Chưa chạy. Khung check-out hiện là 13:00–18:00, không bao 18:00–18:30; cần nới khung hoặc trả về khung cũ trước khi chạy. |

Số p95, p99 không ghi đơn vị là ms, chép nguyên từ file JSON. Cột Ghi chú được thêm theo yêu cầu, để ghi lý do Pending.

## 6. Chi tiết flow và API trọng yếu

| Flow | Chuỗi API theo thứ tự | API trọng yếu |
|---|---|---|
| Đăng nhập | `POST /v1/auth/login` | `POST /v1/auth/login` |
| Check-in | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-in` | `POST /v1/attendance/check-in` |
| Check-out | `POST /v1/auth/login` → `GET /v1/attendance/today-info` → `POST /v1/attendance/check-out` | `POST /v1/attendance/check-out` |

## 7. Kết quả theo API trọng yếu

| API | Số request | RPS | Avg | p95 | p99 | Max | Lỗi | Chỉ tiêu | Kết quả |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `POST /v1/auth/login` (PERF-002 lần 3) | 4182 | 9.605311116905611 | 240.42957599234865 | 574.1670949999999 | 1025.311088999998 | 3914.459 | 0.00023912003825920613 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/auth/login` (PERF-002 lần 4) | 10972 | 10.599981761732439 | 252.25586685198698 | 549.7435349999998 | 1102.9513479999982 | 4780.8907 | 0 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/auth/login` (PERF-005 lần 2) | 173 | 0.19222179015035393 | 209.00047456647403 | 280.77048 | 538.407852 | 812.8294 | 0 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/auth/login` (PERF-006 lần 2) | 655 | 1.3639059213269467 | 176.1487366412214 | 244.05587 | 275.94232200000005 | 628.14 | 0 |  |  |
| `POST /v1/auth/login` (PERF-007 lần 2) | 649 | 1.3520724742195929 | 1155.3989326656388 | 4908.279640000001 | 10613.622467999998 | 12383.04 | 0 |  |  |
| `POST /v1/auth/login` (PERF-007 lần 3) | 652 | 1.35832290933694 | 1328.2543466257675 | 6557.827779999998 | 8436.140928000023 | 11209.9678 | 0 |  |  |
| `POST /v1/auth/login` (PERF-007 lần 5) | 653 | 1.3600130728705304 | 1124.4703889739644 | 5175.44476 | 10006.107756000016 | 11372.5559 | 0 |  |  |
| `POST /v1/auth/login` (PERF-014 lần 1) | 679 | 1.41407556118884 | 1514.7907942562586 | 6693.174230000003 | 11798.702126000006 | 13005.4634 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/auth/login` (PERF-014 lần 2) | 678 | 1.4124990227272387 | 1501.1743361356944 | 6600.818829999999 | 12309.507345 | 12741.7934 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/auth/login` (PERF-014 lần 3) | 677 | 1.4104141358548017 | 2268.7242242245206 | 9858.522859999995 | 11425.729308 | 11514.3368 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/attendance/check-in` (PERF-009 lần 3) | 10 | 2.123671409929234 | 399.18845 | 872.187715 | 894.7573030000001 | 900.3997 |  |  |  |
| `POST /v1/attendance/check-in` (PERF-009 lần 4) | 10 | 1.9396742305491745 | 580.1119299999999 | 1165.9910949999996 | 1260.767899 | 1284.4621 |  |  |  |
| `POST /v1/attendance/check-out` (PERF-010 lần 5) | 10 | 1.9634971352674973 | 465.81059999999997 | 1008.4672449999998 | 1071.125209 | 1086.7897 |  |  |  |
| `POST /v1/attendance/check-out` (PERF-004 lần 3) | 301 | 0.9996878609163784 | 72.81186046511627 | 99.5687 | 110.9309 | 129.8676 | 0 | p95 < 1000, p99 < 2500 | Pass |

Đơn vị thời gian là ms. Các dòng login của PERF-006, PERF-007, PERF-014 gồm cả lượt thăm dò khoảng 1 req/s; số riêng của burst ở mục 5.

## 8. Tính đúng nghiệp vụ dưới tải

| Kiểm tra | Mong đợi | Số lần kiểm tra | Số lỗi | Thực tế | Kết quả |
|---|---|---:|---:|---|---|
| Không đặt quá sức chứa | Không vượt số chỗ của slot |  |  |  |  |
| Không đặt trùng lịch | Một slot chỉ có số lịch hợp lệ |  |  |  |  |
| Không thu tiền hai lần | Một hóa đơn có đúng một giao dịch hợp lệ |  |  |  |  |
| Chuyển trạng thái đúng | Appointment → Check-in → Paid → Waiting → In-progress → Completed |  |  |  |  |
| Không mất chỉ định/kết quả | Chỉ định và kết quả được liên kết đúng ca khám |  |  |  |  |
| Check-out đồng thời không ghi trùng (PERF-010 lần 5, `data_integrity_errors`) | 1 bản ghi trong ngày, có giờ check-out |  | 0 | 5 lần 200, 5 lần 429, 1 bản ghi | Pass |
| Check-out lặp không ghi trùng (PERF-004 lần 3, `data_integrity_errors`) | 1 bản ghi, giờ check-in không đổi |  | 0 | 301 lần 429 | Pass |
| Check-in đồng thời ghi đúng 1 lần (PERF-009 lần 3, 4, `data_integrity_errors`) | Có giờ check-in sau bài |  | 1 | Không lần nào check-in thành công (ngoài khung giờ và vượt 5 lần/ngày) | Fail |

## 9. Tài nguyên hệ thống

| Thành phần | Chỉ số | Đỉnh | Trung bình | Ngưỡng | Thời điểm đỉnh | Nhận xét |
|---|---|---:|---:|---:|---|---|
| Backend | CPU |  |  | 85% |  | Chưa đo |
| Backend | RAM |  |  |  |  | Chưa đo |
| Backend | GC pause / thread |  |  |  |  |  |
| Database | CPU |  |  | 85% |  | Chưa đo |
| Database | Connections |  |  |  |  |  |
| Database | Slow query / lock / deadlock |  |  | 0 |  |  |
| Connection pool | Đang dùng / tối đa |  |  |  |  |  |
| Queue/Cache | Backlog / cache hit rate |  |  |  |  |  |
| Máy chạy k6 | CPU (PERF-005 lần 2, đỉnh cao nhất các lần chạy) | 36.50% | 7.31% |  |  | Máy chạy test không phải điểm nghẽn; các lần burst chỉ 14.20–30.80% |

Kèm link hoặc ảnh biểu đồ có cùng trục thời gian:

- RPS/TPS, VU, p95/p99 và tỷ lệ lỗi.
- CPU/RAM backend.
- Database CPU, connection pool, slow query và lock.
- Queue backlog hoặc thời gian xử lý tác vụ nền.

## 10. Phát hiện và điểm nghẽn

| ID | Mức độ | Mô tả | Bằng chứng | Nguyên nhân | Trạng thái nguyên nhân | Đề xuất | Trạng thái |
|---|---|---|---|---|---|---|---|
| PERF-ISSUE-01 | Cao | Login chậm khi nhiều người đăng nhập trong vài giây: burst p95 6245.80274–11244.58679 ms, p99 10737.998408–12939.488974 ms, gấp nhiều lần ngưỡng 1s / 2,5s. Không có lỗi, hệ thống phục hồi ngay phút sau. Rải 173 lượt trong 30 giây thì đạt (p95 244ms). | `burst-173vu (lần 2, 3, 5).json`, `burst-login-200 (lần 1–3).json`; bậc rate limit login 12/s p95 391ms, 35/s p95 6414ms | Server xử lý login tuần tự hoặc tốn CPU (ví dụ băm mật khẩu), các request xếp hàng khi vượt khoảng vài chục lượt/s; CPU máy chạy test thấp nên không do phía test | Giả thuyết | Dev đo CPU app, DB trong phút burst (khoảng 11:55, 13:38, 13:47, 14:51, 15:17, 15:39 ngày 02/11); xem chi phí băm mật khẩu, số worker, connection pool; chạy lại PERF-007, PERF-014 sau khi sửa | Mở |
| PERF-ISSUE-02 | Trung bình | Mỗi tài khoản chỉ được gửi check-in và check-out tối đa 5 lần/ngày, tính cả lần bị từ chối; lần thứ 6 trả 429 với mã `UNKNOWN_ERROR`. | `race-attendance (lần 4).txt`, `race-attendance (lần 5).json`, `load-repeat-attendance (lần 3).json` (301 lần 429) | Quy tắc nghiệp vụ chống spam; mã lỗi chưa được map | Giả thuyết | Xác nhận quy tắc với BA; đổi mã lỗi 429 thành mã riêng; sửa script check-in để coi 429 là từ chối hợp lệ | Mở |
| PERF-ISSUE-03 | Trung bình | Check-out đồng thời 10 lần được nhận 5 lần (ghi đè giờ), bộ case ban đầu mong đợi chỉ 1 lần; tài liệu `attendance.md` ghi lần 2 trả 400. | `race-attendance (lần 5).json`: `attendance_success_count` 5, `data_integrity_errors` 0 | Người dùng xác nhận check-out được ghi đè giờ; tài liệu bridge chưa cập nhật | Đã xác minh | Cập nhật tài liệu bridge; giữ tiêu chí mới 1–5 lần thành công, 1 bản ghi | Mở |

## 11. So sánh với baseline

| Chỉ số | Baseline/lần trước | Lần này | Thay đổi | Đánh giá |
|---|---:|---:|---:|---|
| p95 flow đặt lịch |  |  |  |  |
| p95 thanh toán |  |  |  |  |
| Tỷ lệ lỗi |  |  |  |  |
| RPS/TPS đạt SLA |  |  |  |  |
| CPU backend |  |  |  |  |

## 12. Rủi ro và hạn chế

- Test chạy trực tiếp trên môi trường dev theo yêu cầu, cấu hình khác production.
- Khung chấm công ca 10 được nới tạm (check-in 08:00–11:00, check-out 13:00–18:00) để test; bản ghi tạo ra bị tính đi muộn hoặc về sớm.
- Tiêu chí nghiệm thu do tester đề xuất vì không có tài liệu yêu cầu, PO đã chấp nhận.

## 13. Khuyến nghị và hành động tiếp theo

| Ưu tiên | Việc cần làm | Người phụ trách | Hạn hoàn thành | Cần test lại? | Trạng thái |
|---:|---|---|---|---|---|
| P1 | Điều tra và giảm thời gian login khi dồn tải (PERF-ISSUE-01), kèm số liệu CPU, DB server; chạy lại PERF-007, PERF-014 |  |  | Có | Chưa làm |
| P2 | Gán đủ địa điểm cho 200 tài khoản, chạy PERF-015 đến PERF-018; chạy các case check-in (PERF-001, 003, 007 pha check-in, 009, 011) trong khung giờ sau khi sửa script nhận 429 |  |  | Có | Chưa làm |
| P3 | Chạy PERF-008 khi có giám sát server, PERF-012, PERF-013 cùng đội vận hành; cập nhật tài liệu bridge về khung giờ và check-out ghi đè; sửa mã lỗi 429 |  |  | Có | Chưa làm |

## 14. Phụ lục

| Hạng mục | Link/Thông tin |
|---|---|
| Script k6 và commit | `G:\TestK6\performance-tests` (chưa dùng git) |
| Lệnh chạy | `.\run.ps1 tests/load-login.js -e HOLD=5m`, `-e HOLD=15m`; `.\run.ps1 tests/peak-login.js`; `.\run.ps1 tests/spike-login.js`; `.\run.ps1 tests/burst-173vu.js -e PHASE=login`; `.\run.ps1 tests/burst-login-200.js`; `.\run.ps1 tests/race-attendance.js -e ACTION=checkin`, `-e ACTION=checkout`; `.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkout`; biến `CONFIRM_ALLOWED=yes`, mật khẩu nạp từ `.env` (`HRM_PASSWORD=***`) |
| Cấu hình k6 | `options` trong từng file `tests/*.js`; tiêu chí trong `config/thresholds.js` |
| File kết quả gốc | `G:\TestK6\performance-tests\results\` (file `.txt`, `.json`, `- tài nguyên.txt` theo từng lần; `LICH_SU_CHAY.md`) |
| Dashboard Grafana |  |
| Log backend/database liên quan |  |
| Version API/build đã test |  |
| Tài khoản/dữ liệu test sử dụng | Tài khoản nhân viên trong `.env` (PERF-002, 005, 006, 007, PERF-009 lần 3); 200 tài khoản EMP202–EMP401 trong `G:\TestK6\accounts-200.csv` (PERF-014, PERF-009 lần 4, PERF-010, PERF-004 dùng EMP202). Không ghi mật khẩu hoặc token thật |
