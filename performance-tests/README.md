# Test hiệu năng HR System bằng k6

Test đăng nhập, check-in, check-out của HRM trên môi trường dev. Căn cứ: `../TEST_CASE_PERFORMANCE.md` (18 case), `../CAU_TRUC_TEST_K6.md`, `../BAO_CAO_API.md`, Swagger `https://hrs-main-dev.sonthanh.net.vn/api/docs`.

**Chỉ chạy trên môi trường đã được phép.** Bài check-in, check-out tạo dữ liệu chấm công thật cho tài khoản test, và chưa có cách tự dọn.

## Bảng case và file

| Case | Nhóm test | Flow | File | Lệnh chạy |
|---|---|---|---|---|
| PERF-001 | Smoke | Đăng nhập, check-in, check-out | `tests/smoke-attendance.js` | `.\run.ps1 tests/smoke-attendance.js -e PHASE=checkin`, chiều `-e PHASE=checkout`, gọi `python tools/run_test.py` |
| PERF-002 | Load | Đăng nhập tải ổn định | `tests/load-login.js` | `.\run.ps1 tests/load-login.js -e HOLD=5m`, rồi `-e HOLD=15m`, gọi `python tools/run_test.py` |
| PERF-003 | Load | Check-in lặp, nhánh đã check-in | `tests/load-repeat-attendance.js` | `.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkin`, gọi `python tools/run_test.py` |
| PERF-004 | Load | Check-out lặp, nhánh đã check-out | `tests/load-repeat-attendance.js` | `.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkout`, gọi `python tools/run_test.py` |
| PERF-005 | Peak | Đăng nhập trong khung check-in | `tests/peak-login.js` | `.\run.ps1 tests/peak-login.js`, gọi `python tools/run_test.py` |
| PERF-006 | Spike | Đăng nhập dồn đầu ca | `tests/spike-login.js` | `.\run.ps1 tests/spike-login.js`, gọi `python tools/run_test.py` |
| PERF-007 | Spike | Burst đồng thời 173 VU | `tests/burst-173vu.js` | `.\run.ps1 tests/burst-173vu.js -e PHASE=login`, rồi `-e PHASE=checkin`, gọi `python tools/run_test.py` |
| PERF-008 | Stress | Đăng nhập tăng bậc đến 1000 VU | `tests/stress-login.js` | `.\run.ps1 tests/stress-login.js`, gọi `python tools/run_test.py` |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | `tests/race-attendance.js` | `.\run.ps1 tests/race-attendance.js -e ACTION=checkin`, gọi `python tools/run_test.py` |
| PERF-010 | Concurrency | Bấm check-out nhiều lần | `tests/race-attendance.js` | `.\run.ps1 tests/race-attendance.js -e ACTION=checkout`, gọi `python tools/run_test.py` |
| PERF-011 | Concurrency | Check-in và check-out gửi cùng lúc | `tests/race-attendance.js` | `.\run.ps1 tests/race-attendance.js -e ACTION=both`, gọi `python tools/run_test.py` |
| PERF-012 | Resilience | S3 chậm khi check-in | `tests/resilience-s3.js` | `.\run.ps1 tests/resilience-s3.js -e ACCOUNTS_FILE=... -e CHECKIN_THINK_SECONDS=...`, gọi `python tools/run_test.py` |
| PERF-013 | Recovery | Restart app khi đang đăng nhập | `tests/recovery-login.js` | `.\run.ps1 tests/recovery-login.js`, gọi `python tools/run_test.py` |
| PERF-014 | Spike | Burst đăng nhập 200 tài khoản | `tests/burst-login-200.js` | `.\run.ps1 tests/burst-login-200.js`, gọi `python tools/run_test.py` |
| PERF-015 | Spike | Burst check-in 200 tài khoản | `tests/burst-attendance-200.js` | `.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkin`, gọi `python tools/run_test.py` |
| PERF-016 | Spike | Burst check-out 200 tài khoản | `tests/burst-attendance-200.js` | `.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkout`, gọi `python tools/run_test.py` |
| PERF-017 | Peak | Check-in cao điểm 200 tài khoản | `tests/peak-attendance-200.js` | `.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkin`, gọi `python tools/run_test.py` |
| PERF-018 | Peak | Check-out cao điểm 200 tài khoản | `tests/peak-attendance-200.js` | `.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkout`, gọi `python tools/run_test.py` |

## Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| HRM_BASE_URL | Có | Địa chỉ API, đặt trong `G:\TestK6\.env` |
| HRM_EMAIL | Có | Tài khoản của các bài 1 tài khoản (smoke, login, chấm công 1 người, preflight, check-rate-limit), đặt trong `.env` |
| HRM_PASSWORD | Có | Mật khẩu, chỉ đặt trong `.env`, không ghi vào code |
| CONFIRM_ALLOWED | Có với bài tải | Đặt `yes` khi chủ môi trường đã đồng ý; thiếu thì bài dừng ở `setup()` |
| HOLD | PERF-002 | Thời gian giữ tải: `5m` hoặc `15m` |
| ACTION | PERF-003, 004, 009, 010, 011 | Nhánh chạy |
| PHASE | PERF-007, PERF-001 | PERF-007: `login` hoặc `checkin`; PERF-001: `checkin` hoặc `checkout` |
| ACCOUNTS_FILE | PERF-012, PERF-014 đến PERF-018, `seed/check-accounts.js` | Đường dẫn CSV tài khoản, theo mẫu `data/accounts.example.csv`, đặt ngoài project; hiện là `G:/TestK6/accounts-200.csv` trong `.env` |
| EXPECT | `seed/check-accounts.js` | Trạng thái mong đợi: `notCheckedIn`, `checkedIn`, `checkedOut` |
| CHECKIN_THINK_SECONDS | PERF-012 | Thời gian nghỉ của 20 VU; bộ case chưa có số này |

## Thứ tự chạy lệnh

Chạy từ trên xuống, tại thư mục `performance-tests`. Nếu PowerShell chặn script, chạy `Set-ExecutionPolicy -Scope Process Bypass` một lần trong cửa sổ đó.

### 1. Cài đặt

Cần có k6, Python. Docker chỉ cần khi dùng Prometheus và Grafana. Dòng dưới cài `psutil` để vẫn đo được CPU/RAM máy chạy test khi Prometheus không chạy.

```bash
pip install psutil
```

### 2. Bật giám sát

Tuỳ chọn. Cần `windows_exporter` ở cổng 9182 để có CPU/RAM trong Grafana.

```bash
docker compose -f monitoring/docker-compose.yml up -d
```

Mở Grafana tại http://localhost:3000, dashboard `k6 và tài nguyên`.

### 3. Chuẩn bị dữ liệu

Kiểm tra ca, địa điểm, trạng thái hôm nay. Lệnh này chỉ đọc:

```powershell
.\run.ps1 seed/preflight.js
```

Khi đã được chủ môi trường đồng ý, đặt xác nhận cho cửa sổ PowerShell hiện tại:

```powershell
$env:CONFIRM_ALLOWED = 'yes'
```

Kiểm tra rate limit của login, bắt buộc trước PERF-002, 005, 006, 007, 008, 013. Nếu gặp 429, xem bậc dừng rồi mới quyết định chạy tiếp:

```powershell
.\run.ps1 seed/check-rate-limit.js
```

### 4. Chạy test

Case chấm công dựa vào trạng thái đầu, sai thì bài tự dừng ở `setup()`. Script không tự kiểm tra giờ; server chỉ nhận chấm công trong khung giờ cấu hình ở ca, ngoài khung thì request bị từ chối và in dòng `WARN`. Ca 10 hiện được nới tạm: check-in 08:00–11:00, check-out 13:00–18:00. Bài 1 tài khoản dùng tài khoản `HRM_EMAIL`; bài nhiều tài khoản dùng 200 tài khoản trong `ACCOUNTS_FILE`. Mỗi người chỉ được gửi check-in tối đa 5 lần và check-out tối đa 5 lần mỗi ngày, tính cả lần bị từ chối; chạy thử hoặc chạy ngoài khung giờ cũng tốn lượt.

Ngày A, buổi sáng trong khung check-in, trạng thái đầu là chưa check-in:

```powershell
.\run.ps1 tests/race-attendance.js -e ACTION=checkin
.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkin
```

Ngày A, buổi chiều trong khung check-out:

```powershell
.\run.ps1 tests/race-attendance.js -e ACTION=checkout
.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkout
```

Ngày B: PERF-001, sáng check-in, chiều check-out:

```powershell
.\run.ps1 tests/smoke-attendance.js -e PHASE=checkin
.\run.ps1 tests/smoke-attendance.js -e PHASE=checkout
```

Mỗi bài dưới đây cần một sáng riêng có trạng thái chưa check-in, trong khung check-in:

```powershell
.\run.ps1 tests/race-attendance.js -e ACTION=both
```

```powershell
.\run.ps1 tests/burst-173vu.js -e PHASE=checkin
```

Bài đăng nhập, chạy lần lượt:

```powershell
.\run.ps1 tests/load-login.js -e HOLD=5m
.\run.ps1 tests/load-login.js -e HOLD=15m
.\run.ps1 tests/peak-login.js
.\run.ps1 tests/spike-login.js
.\run.ps1 tests/burst-173vu.js -e PHASE=login
.\run.ps1 tests/stress-login.js
```

Bài 200 tài khoản thật. Đầu tiên kiểm tra tài khoản, lệnh này chỉ đọc nhưng login 200 lần:

```powershell
.\run.ps1 seed/check-accounts.js -e EXPECT=notCheckedIn
```

Login, chạy bất kỳ lúc nào:

```powershell
.\run.ps1 tests/burst-login-200.js
```

Ngày 1, burst: bắt đầu sớm hơn lúc đóng khung ít nhất 10 phút, vì setup và burst cần khoảng 10 phút. Mỗi bài xong thì đối soát bằng `seed/check-accounts.js`:

```powershell
.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkin
.\run.ps1 seed/check-accounts.js -e EXPECT=checkedIn
.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkout
.\run.ps1 seed/check-accounts.js -e EXPECT=checkedOut
```

Ngày 2, cao điểm. Bắt đầu đúng 08:30 và 18:00; cả 15 phút check-in và 30 phút check-out phải nằm trong khung giờ của ca:

```powershell
.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkin
.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkout
```

Bài cần quyền hạ tầng. PERF-012: gây lỗi S3 từ phút 3 đến phút 10. PERF-013: restart app ở phút 5.

```powershell
.\run.ps1 tests/resilience-s3.js -e ACCOUNTS_FILE=<đường_dẫn> -e CHECKIN_THINK_SECONDS=<số_giây>
.\run.ps1 tests/recovery-login.js
```

### 5. Dọn dữ liệu và tắt giám sát

Chưa có API tự dọn dữ liệu chấm công cho tài khoản nhân viên; cần HR xử lý nếu muốn xoá dấu vết test.

```bash
docker compose -f monitoring/docker-compose.yml down
```

## Kết quả sau mỗi lần chạy

`tools/run_test.py` tự đánh số lần chạy theo từng file test và không ghi đè kết quả cũ:

| File trong `results/` | Nội dung |
|---|---|
| `smoke-attendance (lần 1).txt` | Log và phần tổng kết theo từng API |
| `smoke-attendance (lần 1).json` | Số liệu k6 dạng JSON |
| `smoke-attendance (lần 1) - tài nguyên.txt` | Lệnh chạy, thời gian, CPU, RAM |
| `summary-PERF-001-<thời_gian>.json` | Số mẫu, p95, p99, mức thang A, B, kết luận, phục hồi |
| `LICH_SU_CHAY.md` | Danh sách mọi lần chạy |

Kết luận theo tiêu chí đã chốt tại 173 người: Đạt là mức 2 thang B (p95 < 1s, p99 < 2,5s), Đạt có điều kiện là chỉ qua mức 1, kèm lỗi kỹ thuật < 1% và không sai dữ liệu. Exit code 99 nghĩa là có threshold bị vượt. Đưa các file này cho `/perfreport` để làm báo cáo.

## Xem CPU và RAM

- Nguồn đo: máy chạy k6 qua `windows_exporter` cổng 9182 khi có Prometheus, nếu không thì `psutil`.
- Backend dev ở máy chủ từ xa, chưa có quyền truy cập, nên **không có** CPU, RAM, connection pool, database, queue của server. Muốn có phải nhờ DevOps.
- Máy chạy k6 quá tải sẽ làm sai số đo, cần xem CPU máy khi chạy PERF-007, PERF-008.

## Đối chiếu tài liệu

| Rule | Vị trí trong tài liệu | Áp dụng ở đâu | Trạng thái |
|---|---|---|---|
| Mọi case có đúng một file chạy | CAU_TRUC_TEST_K6.md mục 4 | `tests/`, Bảng case và file | Đã làm, 13/13 |
| Đúng cây thư mục và tên file | CAU_TRUC_TEST_K6.md mục 2 | Toàn project | Đã làm; thêm `tools/`, `monitoring/` của bộ khung và `results/` khi chạy |
| Lệnh chạy qua `run.ps1` | CAU_TRUC_TEST_K6.md mục 4 | `run.ps1` gọi `tools/run_test.py` | Đã làm |
| Không ghi mật khẩu vào script | CAU_TRUC_TEST_K6.md mục 1, 6 | `config/env.js`, `run.ps1` | Đã làm |
| Tiêu chí mức 2 thang B | TEST_CASE_PERFORMANCE.md mục Tiêu chí nghiệm thu | `config/thresholds.js` | Đã làm |
| Đo p95, p99 riêng từng API | TEST_CASE_PERFORMANCE.md mục Cách đo | Tag `api`, `name` | Đã làm |
| Tải thăm dò, phục hồi 120% trong 5 phút | PERF-006, 007, 012, 013 | `lib/recovery.js` | Đã làm |
| Tách phản hồi mong đợi, lỗi kỹ thuật, toàn vẹn | TEST_CASE_PERFORMANCE.md mục Cách đo | `lib/assertions.js`, `teardown()` | Đã làm |
| Bậc ≤ 173 giữ tiêu chí, bậc cao chỉ tìm giới hạn | PERF-008 | `tests/stress-login.js` | Đã làm |
| Lặp 3 lần với dữ liệu sạch | PERF-007 | Người chạy thực hiện | Chưa tự động, script chạy 1 lần mỗi lệnh |
| Theo dõi server, database, queue | CAU_TRUC_TEST_K6.md mục 7 | Chưa có quyền | Chưa làm được |
| Tổng thời gian flow | TEST_CASE_PERFORMANCE.md mục Cách đo | `flow_duration_ms` ở PERF-001 | Đã làm, nhưng tách 2 lượt login → check-in và login → check-out vì hai khung giờ không giao nhau |

## Điểm cần xác nhận

- 200 tài khoản (id 40–239, EMP202–EMP401) đã import, cùng Phòng Sản Xuất Phần Mềm. Ngày 02/11/2026 `seed/check-accounts.js` báo 200/200 chưa có ca và địa điểm. Chốt gán ca id 10 "Ca test hiệu năng" 08:00–17:30 bằng `POST /v1/shift-schedules/bulk-range` 2 lượt 100 người; địa điểm chưa gán.
- Khung giờ chấm công do server kiểm tra theo cấu hình ca trên web; ca để trống thì tự cộng ±60 phút (bridge ghi ±30 phút là đã cũ). Ngày 02/11/2026 ca 10 được nới tạm thành check-in 08:00–11:00, check-out 13:00–18:00 để test. Với khung này PERF-018 (18:00–18:30) nằm ngoài khung check-out, cần nới đến 18:30 hoặc trả về khung cũ 16:30–18:30 trước khi chạy.
- Mỗi tài khoản chỉ được gửi check-in tối đa 5 lần mỗi ngày, kể cả lần bị từ chối; lần thứ 6 trở đi trả 429 "Đã vượt quá số lần check-in cho phép trong ngày" (mã `UNKNOWN_ERROR`). Ngoài khung giờ trả 400 "Đã hết giờ check-in". PERF-003, PERF-007 pha check-in, PERF-009 gửi nhiều hơn 5 lần trên một tài khoản nên phần lớn là 429; từ 03/11/2026 các bài này coi 429 là phản hồi mong đợi và đặt threshold `checkin_not_limited`, `checkout_not_limited` ≤ 5 (số lần không bị 429) để kiểm tra rule.
- Check-out (xác nhận 02/11/2026) và check-in (xác nhận 03/11/2026) đều được ghi đè giờ, tối đa 5 lần/ngày. PERF-009, PERF-010, PERF-007 pha check-in nhận 1–5 lần thành công; PERF-003 nhận 201, 409 hoặc 429; PERF-004 nhận 200 hoặc 429. Hai bài đối soát thêm số bản ghi trong ngày qua `GET /v1/attendance/me` phải là 1.
- Server nhận check-out khi chưa check-in (ghi `missingType: MISSING_CHECKIN`, kiểm chứng ngày 02/11/2026 với EMP401). Bài check-out vì vậy chạy được từ trạng thái chưa check-in hoặc đã check-in.
- Case 200 tài khoản mỗi ngày chỉ chạy được một lần vì mỗi tài khoản chỉ chấm công thành công 1 lần; lặp 3 lần cần 3 ngày hoặc cách dọn dữ liệu.
- Chủ hệ thống đã đồng ý cho chạy tải trên `hrs-main-dev`. Cao điểm theo ca 08:30–18:00: check-in 08:30–08:45, check-out 18:00–18:30.
- PERF-008 là VU đóng, không có thời gian nghỉ trong bộ case, nên tải login thực tế rất cao ở bậc lớn.
- PERF-012: bộ case chưa có thời gian nghỉ của 20 VU, nên phải truyền `CHECKIN_THINK_SECONDS`.
- Server lưu ảnh lên S3 trước hay sau khi kiểm tra trùng; có thể phát sinh rác S3 ở PERF-003, PERF-007.
- Check-out dùng body theo Swagger gồm `photo`, `latitude`, `longitude`; check-in ngoài khung giờ được coi là chấp nhận. Cả hai cần kiểm chứng ở PERF-001.
- Tên field giờ trong `todayRecord` (`checkInAt`, `checkOutAt`) lấy từ bridge doc, chưa thấy trên dữ liệu thật vì tài khoản chưa check-in.
