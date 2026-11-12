# PERFORMANCE TEST REPORT

## 1. Tóm tắt kết luận

| Mục | Nội dung |
|---|---|
| Dự án / phiên bản build | HR System (HRM) / |
| Thời gian test | 2026-11-02T11:14:58+07:00 – 2026-11-03T11:00:00+07:00 |
| Người thực hiện | Lưu Bách Tùng |
| Môi trường | Dev (`https://hrs-main-dev.sonthanh.net.vn`) |
| Công cụ | k6 v2.3.0 |
| Kết luận | **Không đạt** |
| Năng lực tối đa đo được | Login: 173 lượt rải trong 30 giây (PERF-006) và tải ổn định 10.599981761732439 req/s trong 15 phút (PERF-002 lần 4). Check-in: 200 tài khoản login rồi check-in rải trong 15 phút, 0.22313068621666574 req/s (PERF-017). Các mức này đạt toàn bộ threshold. |
| Lỗi nghiêm trọng | 32 lần vượt threshold trên 14 lần chạy: `http_req_duration{api:login,scenario:burst}` p95, p99 (PERF-007 ×3, PERF-014 ×3); `http_req_duration{api:login}` p95, p99 (PERF-014 ×3, PERF-002 lần 5); `http_req_duration{api:checkin}` p95, p99 (PERF-015); `http_req_duration{api:checkout}` p95, p99 (PERF-016), p95 (PERF-018); `attendance_success_count` (PERF-009 ×2, PERF-010, PERF-016); `data_integrity_errors` (PERF-009 ×2); `expected_response_rate` (PERF-003 lần 4). Không có lỗi 5xx hay timeout; không có sai dữ liệu chấm công. |
| Khuyến nghị phát hành | Không. Login, check-in, check-out đều chậm nghiêm trọng khi nhiều người gửi trong vài giây (PERF-007, PERF-014, PERF-015, PERF-016, p95 6–11 giây). Cần dev xác định điểm nghẽn trên server, sửa và chạy lại các case này. |

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
| `POST /v1/attendance/check-in` | Check-in kèm ảnh khoảng 500KB và GPS | Smoke, Load, Concurrency, Resilience, Spike, Peak |
| `POST /v1/attendance/check-out` | Check-out kèm ảnh khoảng 500KB và GPS | Smoke, Load, Concurrency, Spike, Peak |

### Ngoài phạm vi

- Các API khác ngoài login, check-in, check-out (người dùng thu hẹp phạm vi).
- Soak test (người dùng bỏ vì ngoài phạm vi).
- PERF-011, PERF-007 pha check-in và việc chạy lại PERF-003 (người dùng bỏ ngày 03/11/2026).

## 3. Môi trường và dữ liệu test

| Hạng mục | Môi trường test | Production | Chênh lệch / ảnh hưởng đến kết quả |
|---|---|---|---|
| Backend |  |  | Chưa có thông tin cấu hình server dev |
| Database |  |  |  |
| Cache/Queue |  |  |  |
| Dữ liệu | Tài khoản `.env` (bachtungluu@gmail.com, Ca hành chính HN 08:30–18:00) cho case 1 tài khoản; 200 tài khoản test EMP202–EMP401 (Phòng Sản Xuất Phần Mềm, ca 10) cho case nhiều tài khoản |  | Khung chấm công ca 10 được người dùng chỉnh để test: ngày 02/11 check-in 08:00–11:00, check-out 13:00–18:00; ngày 03/11 ca 08:00–10:30, check-in 08:00–10:00, check-out 10:30–11:00 |
| Máy chạy k6 | Windows, k6 v2.3.0 | Không áp dụng | CPU máy chạy test tối đa 42.40% nên không phải điểm nghẽn |
| Dịch vụ ngoài | Lưu ảnh chấm công thật trên `r2.cloudflarestorage.com` |  |  |

> Không dùng kết quả local để kết luận trực tiếp năng lực của production. Chỉ so sánh được khi cấu hình, dữ liệu, mạng và dịch vụ phụ trợ tương đương.

## 4. Tiêu chí chấp nhận

| Chỉ số | Tiêu chí |
|---|---|
| Tỷ lệ lỗi HTTP | Lỗi kỹ thuật (5xx, timeout, mất kết nối) `< 1%` |
| Kiểm tra nghiệp vụ đạt | Số lần chấm công thành công đúng như case, sai dữ liệu = 0, số lần không bị 429 ≤ 5 mỗi người mỗi ngày |
| p95 API đọc thông thường | Không đặt riêng; dùng chung p95 `< 1 giây` cho cả 3 API |
| p95 API ghi/thao tác nghiệp vụ | `< 1 giây` (mức 2 thang B); mức 1: `< 2 giây` |
| p99 API ghi/thao tác nghiệp vụ | `< 2,5 giây` (mức 2 thang B); mức 1: `< 6 giây` |
| p95 thanh toán/BHYT | Không áp dụng |
| CPU backend | Chưa có tiêu chí, chưa đo |
| Database | Chưa có tiêu chí, chưa đo |
| Tính đúng nghiệp vụ | Mỗi tài khoản 1 bản ghi chấm công mỗi ngày; check-in, check-out được ghi đè giờ |

## 5. Tổng hợp theo test case

| ID | Nhóm test | Flow | Kịch bản tải | Thời lượng | RPS/TPS | p95 | p99 | Lỗi | Tiêu chí | Kết quả | Ghi chú |
|---|---|---|---|---|---:|---:|---:|---:|---|---|---|
| PERF-001 | Smoke | Login → check-in | `smoke-attendance.js` PHASE=checkin, 1 VU | 2026-11-03 08:30:59–08:31:02 | 2.811280589473812 | 924.6688 | 924.6688 | 0.00% | 100% checks đạt, sai dữ liệu = 0 | Pass | Lượt sáng, tài khoản `.env`. Login p95 184.74409. Lượt check-out (login → check-out) Pending: chạy trong khung check-out của ca HN chiều 03/11. |
| PERF-002 | Load | Login | `load-login.js` HOLD=5m | 2026-11-02 11:14:58–11:22:14 | 9.605311116905611 | 574ms | 1025ms | 0.02% | p95 < 1000, p99 < 2500, lỗi < 1% | Pass | Lần 3, 4182 request. |
| PERF-002 | Load | Login | `load-login.js` HOLD=15m | 2026-11-02 11:24:04–11:41:20 | 10.599981761732439 | 550ms | 1103ms | 0.00% | p95 < 1000, p99 < 2500, lỗi < 1% | Pass | Lần 4, 10972 request. |
| PERF-002 | Load | Login | `load-login.js` HOLD=5m | 2026-11-03 08:19:53–08:27:09 | 9.435896207051883 | 2186.310175 | 3736.4313549999993 | 0.00% | p95 < 1000, p99 < 2500, lỗi < 1% | Fail | Lần 5, 4106 request, cùng tải với lần 3 nhưng chậm hơn; chạy trong giờ check-in buổi sáng. |
| PERF-003 | Load | Check-in lặp, nhánh đã check-in | `load-repeat-attendance.js` ACTION=checkin, 1 req/s | 2026-11-03 09:36:09–09:41:10 | 1.0129986656937677 | 97.6604 | 586.9473 | 0.00% | Phản hồi mong đợi ≥ 99%, số lần không bị 429 ≤ 5, sai dữ liệu = 0, p95 < 1000, p99 < 2500 | Fail | Lần 4. Chạy sau hạn check-in 09:30 của ca HN: 4 lần 400, 297 lần 429. Không hợp lệ để nghiệm thu; người dùng bỏ việc chạy lại. Xác nhận rule 5 lần/ngày (`checkin_not_limited` 4). |
| PERF-004 | Load | Check-out lặp, nhánh đã check-out | `load-repeat-attendance.js` ACTION=checkout, 1 req/s | 2026-11-02 16:20:25–16:25:27 | 1.0129727494335397 | 100ms | 111ms | 0.00% | Phản hồi mong đợi ≥ 99%, lỗi < 1%, p95 < 1000, p99 < 2500, sai dữ liệu = 0 | Pass | Lần 3, EMP202. 301/301 lần 429 (đã dùng hết 5 lượt); chỉ đo nhánh từ chối. |
| PERF-005 | Peak | Login trong khung check-in | `peak-login.js` | 2026-11-02 14:01:13–14:16:13 | 0.19222179015035393 | 281ms | 538ms | 0.00% | p95 < 1000, p99 < 2500, lỗi < 1% | Pass | Lần 2, 173 request. |
| PERF-006 | Spike | Login dồn đầu ca | `spike-login.js`, 173 lượt trong 30 giây | 2026-11-02 14:17:28–14:25:29 | 1.3639059213269467 | 244ms | 276ms | 0.00% | Lỗi < 1%, phục hồi | Pass | Lần 2, đã phục hồi. |
| PERF-007 | Spike | Login burst 173 VU trong 5 giây | `burst-173vu.js` PHASE=login | 2026-11-02 11:53:31–12:01:32 | 1.3520724742195929 | 7374.529700000028 | 10737.998408 | 0.00% | Burst: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 2; p95, p99 là riêng 173 lượt burst. Đã phục hồi. |
| PERF-007 | Spike | Login burst 173 VU trong 5 giây | `burst-173vu.js` PHASE=login | 2026-11-02 13:35:54–13:43:55 | 1.35832290933694 | 7028.0116 | 10808.067424 | 0.00% | Burst: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 3. Đã phục hồi. |
| PERF-007 | Spike | Login burst 173 VU trong 5 giây | `burst-173vu.js` PHASE=login | 2026-11-02 13:45:00–13:53:01 | 1.3600130728705304 | 6245.80274 | 11104.328164 | 0.00% | Burst: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 5. Pha check-in người dùng bỏ khỏi phạm vi. |
| PERF-008 | Stress | Login tăng bậc đến 1000 VU | Các bậc 50, 100, 173, 300, 500, 1000 |  |  |  |  |  | Bậc ≤ 173 giữ tiêu chí nghiệm thu | Pending | Chưa chạy. VU đóng không nghỉ, bậc 50, 100, 173 không tự dừng nên dồn tải lên dev khoảng 16 phút; cần dev theo dõi CPU, DB server khi chạy. |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | `race-attendance.js` ACTION=checkin, 10 VU | 2026-11-02 15:50:18–15:50:23 | 2.760772832908004 | 872.187715 | 894.7573030000001 | 0.00% | Thành công đúng 1 lần (threshold lúc chạy), sai dữ liệu = 0 | Fail | Lần 3, tài khoản `.env`. 0 lần thành công, 5 lần 429. Không hợp lệ để nghiệm thu. |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | `race-attendance.js` ACTION=checkin, 10 VU | 2026-11-02 16:11:55–16:12:01 | 2.521576499713927 | 1165.9910949999996 | 1260.767899 | 0.00% | Thành công đúng 1 lần (threshold lúc chạy), sai dữ liệu = 0 | Fail | Lần 4, EMP202. 5 lần 400 hết giờ check-in, 5 lần 429. Không hợp lệ để nghiệm thu; chưa có lần chạy hợp lệ. Tiêu chí đã đổi thành 1–5 lần thành công do check-in được ghi đè giờ. |
| PERF-010 | Concurrency | Bấm check-out nhiều lần | `race-attendance.js` ACTION=checkout, 10 VU | 2026-11-02 16:15:27–16:15:33 | 2.5525462758477464 | 1008ms | 1071ms | 0.00% | Thành công đúng 1 lần (threshold lúc chạy), sai dữ liệu = 0 | Fail | Lần 5, EMP202. 5 lần 200, 5 lần 429, 1 bản ghi. Theo tiêu chí mới (1–5 lần thành công, check-out ghi đè giờ) đạt về dữ liệu, thời gian mức 1 (A1 B1). |
| PERF-011 | Concurrency | Check-in và check-out gửi cùng lúc | 2 VU |  |  |  |  |  |  | Bỏ | Người dùng bỏ khỏi phạm vi ngày 03/11/2026. |
| PERF-012 | Resilience | S3 chậm khi check-in | 20 VU check-in, 3 phút nền, 7 phút S3 lỗi, 5 phút phục hồi |  |  |  |  |  | Login không bị ảnh hưởng, phục hồi | Pending | Chưa chạy. Cần đội vận hành gây lỗi S3; thiếu `CHECKIN_THINK_SECONDS`. |
| PERF-013 | Recovery | Restart app khi đang đăng nhập | Restart app ở phút 5 |  |  |  |  |  | Phục hồi | Pending | Chưa chạy. Cần người có quyền restart app trên dev. |
| PERF-014 | Spike | Login burst 200 tài khoản trong 5 giây | `burst-login-200.js` | 2026-11-02 14:49:36–14:57:37 | 1.41407556118884 | 8061.739714999998 | 12939.488974 | 0.00% | Burst và toàn bài: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 1; p95, p99 là riêng 200 lượt burst. Đã phục hồi. |
| PERF-014 | Spike | Login burst 200 tài khoản trong 5 giây | `burst-login-200.js` | 2026-11-02 15:15:29–15:23:29 | 1.4124990227272387 | 7158.716654999999 | 12624.251796 | 0.00% | Burst và toàn bài: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 2. Đã phục hồi. |
| PERF-014 | Spike | Login burst 200 tài khoản trong 5 giây | `burst-login-200.js` | 2026-11-02 15:37:36–15:45:36 | 1.4104141358548017 | 11244.58679 | 11474.298740999999 | 0.00% | Burst và toàn bài: p95 < 1000, p99 < 2500; lỗi < 1% | Fail | Lần 3. Trung vị burst 6694.00005. Đã phục hồi. |
| PERF-015 | Spike | 200 tài khoản cùng check-in trong 5 giây | `burst-attendance-200.js` ACTION=checkin | 2026-11-03 08:33:29–08:42:16 | 2.0546788278589108 | 11190.159865000001 | 11386.606643 | 0.00% | `attendance_success_count` == 200, p95 < 1000, p99 < 2500, lỗi < 1% | Fail | Lần 2 (lần 1 ghi tên file nhưng là PERF-016). 200/200 thành công; đối soát 200/200 đã check-in. Trung vị 9525.676899999999. Đã phục hồi. |
| PERF-016 | Spike | 200 tài khoản cùng check-out trong 5 giây | `burst-attendance-200.js` ACTION=checkout | 2026-11-02 17:14:56–17:23:43 | 2.052422058182525 | 10495.50037 | 10633.243754 | 0.00% | `attendance_success_count` == 200, p95 < 1000, p99 < 2500, lỗi < 1% | Fail | 199 thành công, 1 lần 429 (EMP202 đã dùng hết 5 lượt); đối soát 200/200 đã check-out. Trung vị 9260.95025. Đã phục hồi. |
| PERF-017 | Peak | 200 tài khoản login → check-in rải đều 15 phút | `peak-attendance-200.js` ACTION=checkin | 2026-11-03 08:48:08–09:03:05 | 0.6693920586499972 | 950.1726949999987 | 1266.5959189999992 | 0.00% | Mỗi API p95 < 1000, p99 < 2500; lỗi < 1%; 200/200 thành công | Pass | Lần 1. Login p95 261.97833499999996. Bắt đầu 08:48 thay vì 08:30, và chạy trên tài khoản đã check-in từ PERF-015 (check-in ghi đè giờ). |
| PERF-018 | Peak | 200 tài khoản login → check-out rải đều 30 phút | `peak-attendance-200.js` ACTION=checkout | 2026-11-03 10:30:07–11:00:00 | 0.33480636361158683 | 1134.6510549999998 | 1484.280821999997 | 0.00% | Mỗi API p95 < 1000, p99 < 2500; lỗi < 1%; 200/200 thành công | Fail | Lần 2. Check-out p95 vượt 1000, p99 đạt; mức 1 (A1 B1). Login p95 245.837285. 200/200 thành công; đối soát 200/200 đã check-out. Chạy 10:30–11:00 theo khung check-out ca 10 đã chỉnh. |

Số p95, p99 không ghi đơn vị là ms, chép nguyên từ file JSON. Cột Ghi chú được thêm để ghi lý do Pending và Bỏ.

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
| `POST /v1/auth/login` (PERF-002 lần 5) | 4106 | 9.435896207051883 | 503.935107476862 | 2186.310175 | 3736.4313549999993 | 5376.6552 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/auth/login` (PERF-005 lần 2) | 173 | 0.19222179015035393 | 209.00047456647403 | 280.77048 | 538.407852 | 812.8294 | 0 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/auth/login` (PERF-006 lần 2) | 655 | 1.3639059213269467 | 176.1487366412214 | 244.05587 | 275.94232200000005 | 628.14 | 0 |  |  |
| `POST /v1/auth/login` (PERF-007 lần 2) | 649 | 1.3520724742195929 | 1155.3989326656388 | 4908.279640000001 | 10613.622467999998 | 12383.04 | 0 |  |  |
| `POST /v1/auth/login` (PERF-007 lần 3) | 652 | 1.35832290933694 | 1328.2543466257675 | 6557.827779999998 | 8436.140928000023 | 11209.9678 | 0 |  |  |
| `POST /v1/auth/login` (PERF-007 lần 5) | 653 | 1.3600130728705304 | 1124.4703889739644 | 5175.44476 | 10006.107756000016 | 11372.5559 | 0 |  |  |
| `POST /v1/auth/login` (PERF-014 lần 1) | 679 | 1.41407556118884 | 1514.7907942562586 | 6693.174230000003 | 11798.702126000006 | 13005.4634 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/auth/login` (PERF-014 lần 2) | 678 | 1.4124990227272387 | 1501.1743361356944 | 6600.818829999999 | 12309.507345 | 12741.7934 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/auth/login` (PERF-014 lần 3) | 677 | 1.4104141358548017 | 2268.7242242245206 | 9858.522859999995 | 11425.729308 | 11514.3368 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/auth/login` (PERF-017 lần 1) | 200 | 0.22313068621666574 | 186.7795489999999 | 261.97833499999996 | 289.87566999999973 | 366.8995 | 0 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/auth/login` (PERF-018 lần 2) | 200 | 0.11160212120386227 | 236.18628900000004 | 245.837285 | 299.0291369999932 | 9984.9339 | 0 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/attendance/check-in` (PERF-001 lần 2) | 1 | 0.5622561178947624 | 924.6688 | 924.6688 | 924.6688 | 924.6688 |  |  |  |
| `POST /v1/attendance/check-in` (PERF-003 lần 4) | 301 | 0.9997134372912264 | 83.08911029900332 | 97.6604 | 586.9473 | 939.9808 | 0.013289036544850499 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/attendance/check-in` (PERF-009 lần 3) | 10 | 2.123671409929234 | 399.18845 | 872.187715 | 894.7573030000001 | 900.3997 |  |  |  |
| `POST /v1/attendance/check-in` (PERF-009 lần 4) | 10 | 1.9396742305491745 | 580.1119299999999 | 1165.9910949999996 | 1260.767899 | 1284.4621 |  |  |  |
| `POST /v1/attendance/check-in` (PERF-015 lần 2) | 200 | 0.38014409396094556 | 8316.639605999997 | 11190.159865000001 | 11386.606643 | 11467.0705 | 0 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/attendance/check-in` (PERF-017 lần 1) | 200 | 0.22313068621666574 | 638.2214389999999 | 950.1726949999987 | 1266.5959189999992 | 1358.5233 | 0 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/attendance/check-out` (PERF-004 lần 3) | 301 | 0.9996878609163784 | 72.81186046511627 | 99.5687 | 110.9309 | 129.8676 | 0 | p95 < 1000, p99 < 2500 | Pass |
| `POST /v1/attendance/check-out` (PERF-010 lần 5) | 10 | 1.9634971352674973 | 465.81059999999997 | 1008.4672449999998 | 1071.125209 | 1086.7897 |  |  |  |
| `POST /v1/attendance/check-out` (PERF-016 lần 1) | 200 | 0.3797265602557863 | 8101.3950775 | 10495.50037 | 10633.243754 | 10663.9095 | 0.005 | p95 < 1000, p99 < 2500 | Fail |
| `POST /v1/attendance/check-out` (PERF-018 lần 2) | 200 | 0.11160212120386227 | 811.5331069999996 | 1134.6510549999998 | 1484.280821999997 | 2050.2042 | 0 | p95 < 1000, p99 < 2500 | Fail |

Đơn vị thời gian là ms. Dòng login của PERF-006, PERF-007, PERF-014 gồm cả lượt thăm dò khoảng 1 req/s; số riêng của burst ở mục 5. Cột Lỗi của PERF-003, PERF-016 là tỷ lệ phản hồi khác 2xx (400, 429), không phải lỗi kỹ thuật.

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
| Check-in lặp không ghi trùng (PERF-003 lần 4, `data_integrity_errors`) | 1 bản ghi, giờ check-out không đổi |  | 0 | 4 lần 400, 297 lần 429 | Pass |
| Check-in đồng thời ghi được (PERF-009 lần 3, 4, `data_integrity_errors`) | Có giờ check-in sau bài |  | 1 | Không lần nào check-in thành công (ngoài khung giờ và vượt 5 lần/ngày) | Fail |
| 200 tài khoản check-in đủ (PERF-015, đối soát `check-accounts` EXPECT=checkedIn) | 200/200 đã check-in | 200 | 0 | `"ok":200` | Pass |
| 200 tài khoản check-out đủ (PERF-016, PERF-018, đối soát `check-accounts` EXPECT=checkedOut) | 200/200 đã check-out | 200 | 0 | `"ok":200` ở cả 2 lần đối soát | Pass |
| Rule tối đa 5 lần/ngày (`checkin_not_limited`, PERF-003 lần 4) | Số lần không bị 429 ≤ 5 |  |  | 4 | Pass |

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
| Máy chạy k6 | CPU (PERF-003 lần 4, đỉnh cao nhất các lần chạy) | 42.40% | 6.65% |  |  | Máy chạy test không phải điểm nghẽn; các lần burst 14.20–30.80% |

Kèm link hoặc ảnh biểu đồ có cùng trục thời gian:

- RPS/TPS, VU, p95/p99 và tỷ lệ lỗi.
- CPU/RAM backend.
- Database CPU, connection pool, slow query và lock.
- Queue backlog hoặc thời gian xử lý tác vụ nền.

## 10. Phát hiện và điểm nghẽn

| ID | Mức độ | Mô tả | Bằng chứng | Nguyên nhân | Trạng thái nguyên nhân | Đề xuất | Trạng thái |
|---|---|---|---|---|---|---|---|
| PERF-ISSUE-01 | Cao | Login chậm khi nhiều người đăng nhập trong vài giây: burst p95 6245.80274–11244.58679 ms, p99 10737.998408–12939.488974 ms. Không lỗi, phục hồi ngay phút sau. Rải 173 lượt trong 30 giây thì đạt (p95 244ms). | `burst-173vu (lần 2, 3, 5).json`, `burst-login-200 (lần 1–3).json`; bậc rate limit login 12/s p95 391ms, 35/s p95 6414ms | Server xếp hàng khi vượt khoảng vài chục lượt/s; có thể do login tốn CPU (băm mật khẩu) hoặc thiếu worker, connection pool | Giả thuyết | Dev đo CPU app, DB trong phút burst; profiling hàm login; sửa rồi chạy lại PERF-007, PERF-014 | Mở |
| PERF-ISSUE-02 | Cao | Check-in, check-out hàng loạt chậm: 200 người gửi trong 5 giây thì check-in p95 11190.159865000001 ms, check-out p95 10495.50037 ms; trung vị trên 9 giây. Dữ liệu vẫn đúng 200/200. Rải đều thì check-in p95 950.1726949999987 ms, check-out p95 1134.6510549999998 ms. | `burst-attendance-200 (lần 1, 2).json`, `peak-attendance-200 (lần 1, 2).json` | Cùng kiểu xếp hàng như login; có thể thêm chi phí upload ảnh khoảng 500KB lên storage | Giả thuyết | Đo tách thời gian upload ảnh và ghi DB; xem cấu hình worker, connection pool; chạy lại PERF-015, PERF-016, PERF-018 | Mở |
| PERF-ISSUE-03 | Trung bình | Login lúc 08:19–08:27 ngày 03/11 chậm gấp khoảng 4 lần so với 11:14 ngày 02/11 ở cùng tải: p95 2186.310175 ms so với 574.1670949999999 ms. | `load-login (lần 3).json`, `load-login (lần 5).json` | Tải nền buổi sáng trên dev (người dùng khác, tác vụ đầu ngày) hoặc thay đổi build | Giả thuyết | Chạy lại PERF-002 ngoài giờ cao điểm để so sánh; hỏi dev có deploy mới không | Mở |
| PERF-ISSUE-04 | Trung bình | Mỗi người chỉ được gửi check-in, check-out tối đa 5 lần/ngày, tính cả lần bị từ chối; lần thứ 6 trả 429 mã `UNKNOWN_ERROR`. | `race-attendance (lần 4).txt`, `load-repeat-attendance (lần 3, 4).json` | Quy tắc nghiệp vụ; mã lỗi chưa được map | Đã xác minh | Đổi mã lỗi 429 thành mã riêng; ghi rule vào tài liệu | Mở |
| PERF-ISSUE-05 | Thấp | Check-in và check-out lần 2 trong ngày được nhận và ghi đè giờ, vẫn 1 bản ghi; tài liệu `attendance.md` ghi lần 2 trả 409/400. | PERF-010 lần 5 (5 lần 200, 1 bản ghi); PERF-017 chạy sau PERF-015, 200/200 thành công | Tài liệu bridge chưa cập nhật | Đã xác minh | Cập nhật tài liệu bridge | Mở |

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
- Khung giờ và giờ ca 10 được người dùng chỉnh để test; bản ghi tạo ra bị tính đi muộn hoặc về sớm.
- Tiêu chí nghiệm thu do tester đề xuất vì không có tài liệu yêu cầu, PO đã chấp nhận.
- PERF-011, PERF-007 pha check-in và việc chạy lại PERF-003: bỏ khỏi phạm vi.
