# Cấu trúc project test k6 — HR System

_Tạo lúc 2026-11-02 12:00 từ bộ case `TEST_CASE_PERFORMANCE.md`, báo cáo API `BAO_CAO_API.md`, tài liệu nghiệp vụ `bridges/bridges/*.md` (thay cho SRS). 18 case, 33 file._

## 1. Tóm tắt

- Đây là bản thiết kế, chưa có script và chưa đo tải.
- Project đặt tại `G:\TestK6\performance-tests`, chia theo lớp: dữ liệu (`seed/`, `data/`), hàm API (`lib/`), luồng đại diện (`flows/`), bài chạy (`tests/`).
- 13 file test phủ 18/18 case. Case cùng tải và khác nhánh được gộp: PERF-003, 004 dùng 1 file; PERF-009, 010, 011 dùng 1 file.
- Chỉ có 2 luồng đại diện, vì phạm vi chỉ gồm login, check-in, check-out.
- Mọi lệnh chạy qua `run.ps1` để đọc tài khoản từ `G:\TestK6\.env`, không ghi mật khẩu vào script.
- Chủ hệ thống đã đồng ý cho chạy tải trên `hrs-main-dev`. Check-in, check-out tạo dữ liệu chấm công thật.
- Project đã được viết tại `performance-tests/`. Cao điểm check-in 08:30–08:45, check-out 18:00–18:30.

## 2. Cấu trúc thư mục

```text
performance-tests/
├─ README.md                      hướng dẫn chạy
├─ .env.example                   mẫu biến môi trường
├─ run.ps1                        đọc .env rồi chạy k6
├─ config/
│  ├─ env.js                      biến môi trường
│  └─ thresholds.js               thang A, B và xếp loại
├─ lib/
│  ├─ auth.js                     login
│  ├─ accounts.js                 đọc danh sách tài khoản
│  ├─ attendance.js               check-in, check-out
│  ├─ assertions.js               kiểm tra và metric
│  ├─ sync.js                     đồng bộ thời điểm gửi
│  ├─ recovery.js                 tính phục hồi
│  └─ summary.js                  ghi kết quả
├─ flows/
│  ├─ login-flow.js               luồng đăng nhập
│  ├─ attendance-flow.js          luồng chấm công
│  └─ multi-account-flow.js       luồng nhiều tài khoản
├─ data/
│  ├─ selfie-500kb.jpg            ảnh mẫu
│  └─ accounts.example.csv        mẫu danh sách tài khoản
├─ seed/
│  ├─ check-accounts.js           kiểm tra 200 tài khoản
│  ├─ check-rate-limit.js         kiểm tra rate limit login, chạy đầu tiên
│  └─ preflight.js                kiểm tra trạng thái đầu
├─ tests/
│  ├─ smoke-attendance.js          001
│  ├─ load-login.js                002
│  ├─ load-repeat-attendance.js    003, 004
│  ├─ peak-login.js                005
│  ├─ spike-login.js               006
│  ├─ burst-173vu.js               007
│  ├─ stress-login.js              008
│  ├─ race-attendance.js           009, 010, 011
│  ├─ resilience-s3.js             012
│  ├─ recovery-login.js            013
│  ├─ burst-login-200.js           014
│  ├─ burst-attendance-200.js      015, 016
│  └─ peak-attendance-200.js       017, 018
└─ results/                       sinh khi chạy, không commit
```

## 3. Mô tả từng file

| File | Loại | Dùng để làm gì | Case quản lý | API chính | Phụ thuộc |
| --- | --- | --- | --- | --- | --- |
| README.md | doc | Hướng dẫn cài k6, cấu hình `.env`, thứ tự lệnh, cách đọc kết quả | Tất cả | - | - |
| .env.example | config | Mẫu biến môi trường, không chứa mật khẩu thật | Tất cả | - | - |
| run.ps1 | config | Đọc `..\.env`, truyền vào k6 bằng `-e`, rồi chạy file test được chỉ định. k6 không tự đọc `.env` | Tất cả | - | `.env` ở `G:\TestK6` |
| config/env.js | config | Đọc `HRM_BASE_URL`, `HRM_EMAIL`, `HRM_PASSWORD`, `CASE`; báo lỗi sớm khi thiếu | Tất cả | - | run.ps1 |
| config/thresholds.js | config | Khai báo thang A, B, tiêu chí nghiệm thu đề xuất và hàm xếp loại Đạt, Đạt có điều kiện, Không đạt | Tất cả | - | - |
| lib/auth.js | lib | Hàm `login()`, tag `api:login`, trả token; không in mật khẩu và token | Tất cả | `POST /v1/auth/login` | config/env.js |
| lib/attendance.js | lib | Hàm `checkIn()`, `checkOut()` gửi multipart gồm `photo`, `latitude`, `longitude`; gắn tag `api` | PERF-015, PERF-016, PERF-017, PERF-018, PERF-001, PERF-003, PERF-004, PERF-007, PERF-009, PERF-010, PERF-011, PERF-012 | `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | config/env.js, data/selfie-500kb.jpg |
| lib/assertions.js | lib | Kiểm tra `{ success, data }`, phân loại phản hồi mong đợi, lỗi kỹ thuật, 429; khai báo metric `tech_errors`, `rate_limited`, `expected_response_rate` | Tất cả | - | - |
| lib/sync.js | lib | Tính mốc T0 chung rồi cho từng VU chờ đến thời điểm gửi, vì VU không chia sẻ bộ nhớ | PERF-007, PERF-009, PERF-010, PERF-011 | - | - |
| lib/recovery.js | lib | Tính p95 tải thăm dò theo cửa sổ 1 phút từ file kết quả, so với 120% mức nền | PERF-006, PERF-007, PERF-012, PERF-013 | - | config/thresholds.js |
| lib/summary.js | lib | Hàm `handleSummary()` ghi kết quả vào `results/`, kèm số mẫu và mức đạt của thang A, B | Tất cả | - | config/thresholds.js |
| lib/accounts.js | lib | Đọc CSV email, password từ `ACCOUNTS_FILE` vào `SharedArray`; file thật nằm ngoài project | PERF-012, PERF-014, PERF-015, PERF-016, PERF-017, PERF-018 | - | config/env.js |
| flows/multi-account-flow.js | flow | Chuẩn bị token và địa điểm cho từng tài khoản, chạy flow login → đọc thông tin → chấm công | PERF-015, PERF-016, PERF-017, PERF-018 | `POST /v1/auth/login`, `GET /v1/attendance/today-info`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | lib/auth.js, lib/attendance.js, flows/attendance-flow.js |
| flows/login-flow.js | flow | Luồng đăng nhập đại diện: gọi login và kiểm tra token | PERF-002, PERF-005, PERF-006, PERF-007, PERF-008, PERF-012, PERF-013 | `POST /v1/auth/login` | lib/auth.js, lib/assertions.js |
| flows/attendance-flow.js | flow | Luồng chấm công đại diện: login → check-in → check-out, đo thêm tổng thời gian flow; từng bước gọi riêng được | PERF-015, PERF-016, PERF-017, PERF-018, PERF-001, PERF-003, PERF-004, PERF-007, PERF-009, PERF-010, PERF-011, PERF-012 | `POST /v1/auth/login`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | lib/auth.js, lib/attendance.js, lib/assertions.js |
| data/selfie-500kb.jpg | data | Ảnh mẫu khoảng 500KB cho check-in, check-out; không dùng ảnh người thật | PERF-015, PERF-016, PERF-017, PERF-018, PERF-001, PERF-003, PERF-004, PERF-007, PERF-009, PERF-010, PERF-011, PERF-012 | - | - |
| data/accounts.example.csv | data | Mẫu cột danh sách tài khoản cho PERF-012 khi có 20 tài khoản; không chứa mật khẩu thật | PERF-012 | - | - |
| seed/check-rate-limit.js | seed | Đã viết. Bắt buộc chạy trước mọi bài tải login: tăng bậc 1, 5, 12, 35 lần/giây, dừng ngay khi gặp 429, lỗi server hoặc đăng nhập thất bại; cần `-e CONFIRM_ALLOWED=yes` | PERF-002, PERF-005, PERF-006, PERF-007, PERF-008, PERF-013 | `POST /v1/auth/login` | - |
| seed/check-accounts.js | seed | Chỉ đọc: kiểm tra 200 tài khoản login được, có ca, có địa điểm, đúng trạng thái; dùng trước bài và để đối soát sau bài | PERF-014, PERF-015, PERF-016, PERF-017, PERF-018 | `POST /v1/auth/login`, `GET /v1/attendance/today-info` | lib/accounts.js, lib/auth.js, lib/attendance.js |
| seed/preflight.js | seed | Chạy 1 VU trước mỗi bài chấm công: đọc ca, địa điểm, trạng thái hôm nay; ghi `results/preflight.json`; không tạo dữ liệu | PERF-015, PERF-016, PERF-017, PERF-018, PERF-001, PERF-003, PERF-004, PERF-007, PERF-009, PERF-010, PERF-011, PERF-012 | `GET /v1/attendance/today-info`, `GET /v1/check-in-locations/me` | lib/auth.js |
| tests/smoke-attendance.js | test | Chạy 1 lượt login, check-in, check-out để xác nhận ảnh, GPS, ca và dữ liệu ghi đúng | PERF-001 | `POST /v1/auth/login`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js |
| tests/load-login.js | test | Duy trì 173 VU đăng nhập, chạy 2 lần với thời gian giữ tải 5 phút và 15 phút | PERF-002 | `POST /v1/auth/login` | flows/login-flow.js, lib/auth.js, lib/assertions.js |
| tests/load-repeat-attendance.js | test | Case phụ: gửi lặp để đo nhánh từ chối của check-in hoặc check-out | PERF-003, PERF-004 | `POST /v1/auth/login`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js |
| tests/peak-login.js | test | Rải 173 lượt đăng nhập trong khung 15 phút | PERF-005 | `POST /v1/auth/login` | flows/login-flow.js, lib/auth.js, lib/assertions.js |
| tests/spike-login.js | test | Dồn 173 VU login trong 30 giây, có tải thăm dò để đo phục hồi | PERF-006 | `POST /v1/auth/login` | flows/login-flow.js, lib/auth.js, lib/assertions.js, lib/recovery.js |
| tests/burst-173vu.js | test | Đồng bộ 173 VU trong cửa sổ 5 giây: pha login và pha check-in dùng chung token | PERF-007 | `POST /v1/auth/login`, `POST /v1/attendance/check-in` | flows/login-flow.js, flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/sync.js, lib/recovery.js |
| tests/stress-login.js | test | Giữ tiêu chí nghiệm thu đến bậc 173, sau đó tăng để tìm giới hạn đăng nhập | PERF-008 | `POST /v1/auth/login` | flows/login-flow.js, lib/auth.js, lib/assertions.js |
| tests/race-attendance.js | test | Gửi đồng thời cùng tài khoản để kiểm tra chống ghi trùng và tính nhất quán | PERF-009, PERF-010, PERF-011 | `POST /v1/auth/login`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/sync.js |
| tests/resilience-s3.js | test | Giữ login độc lập trong lúc S3 lỗi, đo ảnh hưởng và phục hồi | PERF-012 | `POST /v1/auth/login`, `POST /v1/attendance/check-in` | flows/login-flow.js, flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/recovery.js |
| tests/recovery-login.js | test | Đo khả năng phục hồi của đăng nhập khi restart app | PERF-013 | `POST /v1/auth/login` | flows/login-flow.js, lib/auth.js, lib/assertions.js, lib/recovery.js |
| tests/burst-login-200.js | test | 200 tài khoản riêng cùng đăng nhập trong cửa sổ 5 giây | PERF-014 | `POST /v1/auth/login` | flows/login-flow.js, lib/accounts.js, lib/auth.js, lib/sync.js, lib/recovery.js |
| tests/burst-attendance-200.js | test | 200 tài khoản đã login cùng gửi check-in hoặc check-out trong 5 giây | PERF-015, PERF-016 | `POST /v1/auth/login`, `GET /v1/attendance/today-info`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | flows/multi-account-flow.js, flows/login-flow.js, lib/accounts.js, lib/attendance.js, lib/sync.js, lib/recovery.js |
| tests/peak-attendance-200.js | test | 200 người chấm công rải đều trong khung cao điểm, đo cả flow | PERF-017, PERF-018 | `POST /v1/auth/login`, `GET /v1/attendance/today-info`, `POST /v1/attendance/check-in`, `POST /v1/attendance/check-out` | flows/multi-account-flow.js, lib/accounts.js, lib/auth.js, lib/attendance.js |

## 4. Ma trận case và file

| Case | Nhóm test | Flow | File chạy | Flow và lib dùng | Scenario hoặc tag | Lệnh chạy |
| --- | --- | --- | --- | --- | --- | --- |
| PERF-001 | Smoke | Đăng nhập, check-in, check-out | tests/smoke-attendance.js | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js | `case:PERF-001` | `.\run.ps1 tests/smoke-attendance.js` |
| PERF-002 | Load | Đăng nhập tải ổn định | tests/load-login.js | flows/login-flow.js, lib/auth.js, lib/assertions.js | `case:PERF-002`, tag `hold` | `.\run.ps1 tests/load-login.js -e HOLD=5m, sau đó -e HOLD=15m` |
| PERF-003 | Load | Check-in lặp, nhánh đã check-in | tests/load-repeat-attendance.js | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js | `case:PERF-003`, `ACTION=checkin` | `.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkin` |
| PERF-004 | Load | Check-out lặp, nhánh đã check-out | tests/load-repeat-attendance.js | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js | `case:PERF-004`, `ACTION=checkout` | `.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkout` |
| PERF-005 | Peak | Đăng nhập trong khung check-in | tests/peak-login.js | flows/login-flow.js, lib/auth.js, lib/assertions.js | `case:PERF-005` | `.\run.ps1 tests/peak-login.js` |
| PERF-006 | Spike | Đăng nhập dồn đầu ca | tests/spike-login.js | flows/login-flow.js, lib/auth.js, lib/assertions.js, lib/recovery.js | `probe`, `spike` | `.\run.ps1 tests/spike-login.js` |
| PERF-007 | Spike | Burst đồng thời 173 VU | tests/burst-173vu.js | flows/login-flow.js, flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/sync.js, lib/recovery.js | `probe`, `burst`, `PHASE` | `.\run.ps1 tests/burst-173vu.js -e PHASE=login, sau đó -e PHASE=checkin` |
| PERF-008 | Stress | Đăng nhập tăng bậc đến 1000 VU | tests/stress-login.js | flows/login-flow.js, lib/auth.js, lib/assertions.js | `case:PERF-008`, tag `stage` | `.\run.ps1 tests/stress-login.js` |
| PERF-009 | Concurrency | Bấm check-in nhiều lần | tests/race-attendance.js | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/sync.js | `ACTION=checkin` | `.\run.ps1 tests/race-attendance.js -e ACTION=checkin` |
| PERF-010 | Concurrency | Bấm check-out nhiều lần | tests/race-attendance.js | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/sync.js | `ACTION=checkout` | `.\run.ps1 tests/race-attendance.js -e ACTION=checkout` |
| PERF-011 | Concurrency | Check-in và check-out gửi cùng lúc | tests/race-attendance.js | flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/sync.js | `ACTION=both` | `.\run.ps1 tests/race-attendance.js -e ACTION=both` |
| PERF-012 | Resilience | S3 chậm khi check-in | tests/resilience-s3.js | flows/login-flow.js, flows/attendance-flow.js, lib/auth.js, lib/attendance.js, lib/assertions.js, lib/recovery.js | `login_probe`, `checkin_load` | `.\run.ps1 tests/resilience-s3.js` |
| PERF-013 | Recovery | Restart app khi đang đăng nhập | tests/recovery-login.js | flows/login-flow.js, lib/auth.js, lib/assertions.js, lib/recovery.js | `case:PERF-013` | `.\run.ps1 tests/recovery-login.js` |
| PERF-014 | Spike | Burst đăng nhập 200 tài khoản | tests/burst-login-200.js | flows/login-flow.js, lib/accounts.js, lib/auth.js, lib/sync.js, lib/recovery.js | `probe`, `burst` | `.\run.ps1 tests/burst-login-200.js` |
| PERF-015 | Spike | Burst check-in 200 tài khoản | tests/burst-attendance-200.js | flows/multi-account-flow.js, flows/login-flow.js, lib/accounts.js, lib/attendance.js, lib/sync.js, lib/recovery.js | `ACTION=checkin` | `.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkin` |
| PERF-016 | Spike | Burst check-out 200 tài khoản | tests/burst-attendance-200.js | flows/multi-account-flow.js, flows/login-flow.js, lib/accounts.js, lib/attendance.js, lib/sync.js, lib/recovery.js | `ACTION=checkout` | `.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkout` |
| PERF-017 | Peak | Check-in cao điểm 200 tài khoản | tests/peak-attendance-200.js | flows/multi-account-flow.js, lib/accounts.js, lib/auth.js, lib/attendance.js | `ACTION=checkin` | `.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkin` |
| PERF-018 | Peak | Check-out cao điểm 200 tài khoản | tests/peak-attendance-200.js | flows/multi-account-flow.js, lib/accounts.js, lib/auth.js, lib/attendance.js | `ACTION=checkout` | `.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkout` |

## 5. Chi tiết file test

### tests/smoke-attendance.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Chạy 1 lượt login, check-in, check-out để xác nhận ảnh, GPS, ca và dữ liệu ghi đúng |
| Case quản lý | PERF-001 |
| Executor và tải | `shared-iterations`: 1 VU, 1 lượt, `maxDuration` 1 phút. Theo bộ case: PERF-001: 1 người, 1 lượt; Tối đa 1 phút. |
| Threshold | Cấu hình k6: Mọi check bắt buộc đạt; chỉ tham khảo, không dùng để nghiệm thu. Theo bộ case: PERF-001: Login 200, check-in 201, check-out 200, `checkInAt`, `checkOutAt`, ảnh được lưu đúng, lỗi 0%. |
| Kiểm tra nghiệp vụ | Login 200; check-in 201; check-out 200; `checkInAt`, `checkOutAt`, ảnh có trong response; bước sau chỉ chạy khi bước trước hợp lệ |
| Dữ liệu cần có | Tài khoản EMPLOYEE trong `.env`, ảnh 500KB, toạ độ từ `seed/preflight.js`; trạng thái đầu chưa check-in |
| Đối soát sau khi chạy | Đọc lại bản ghi hôm nay bằng `seed/preflight.js`: đúng 1 bản ghi, có giờ vào và ra |
| Lệnh chạy | `.\run.ps1 tests/smoke-attendance.js` |

### tests/load-login.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Duy trì 173 VU đăng nhập, chạy 2 lần với thời gian giữ tải 5 phút và 15 phút |
| Case quản lý | PERF-002 |
| Executor và tải | `ramping-vus`: ramp 2 phút lên 173 VU, giữ theo `-e HOLD=5m` hoặc `15m`, `sleep(15)` sau mỗi lượt. Theo bộ case: PERF-002: 173 VU, mỗi VU login rồi nghỉ 15 giây, khoảng 11,5 req/s, ramp 2 phút. Chạy 2 lần: giữ tải 5 phút, sau đó giữ tải 15 phút; 5 phút, rồi 15 phút. |
| Threshold | Cấu hình k6: `http_req_duration{api:login}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`. Theo bộ case: PERF-002: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), tốc độ đạt ≥ 90% của 11,5 req/s; báo cáo số VU, req/s đạt được, số mẫu. |
| Kiểm tra nghiệp vụ | Login 200, có `data.accessToken`; 429 tính riêng ở `rate_limited` |
| Dữ liệu cần có | Tài khoản trong `.env`, chỉ dùng mật khẩu đúng |
| Đối soát sau khi chạy | So req/s đạt được với mức ≥ 90% của 11,5 req/s; xác nhận tài khoản không bị khoá |
| Lệnh chạy | `.\run.ps1 tests/load-login.js -e HOLD=5m, sau đó -e HOLD=15m` |

### tests/load-repeat-attendance.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Case phụ: gửi lặp để đo nhánh từ chối của check-in hoặc check-out |
| Case quản lý | PERF-003, PERF-004 |
| Executor và tải | `constant-arrival-rate`: 1 req/s trong 5 phút, login 1 lần trong `setup()`; chọn nhánh bằng `-e ACTION=checkin` hoặc `checkout`. Theo bộ case: PERF-003: 1 req/s tải mở sau khi đã check-in thật; 5 phút. PERF-004: 1 req/s tải mở sau khi đã check-out thật; 5 phút. |
| Threshold | Cấu hình k6: `http_req_duration{api:checkin}`: `p(95)<1000`, `p(99)<2500` hoặc `http_req_duration{api:checkout}`: `p(95)<1000`, `p(99)<2500`; `expected_response_rate`: `rate>=0.99`; `tech_errors`: `rate<0.01`. Theo bộ case: PERF-003: Phản hồi mong đợi 409 ≥ 99%; lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); toàn vẹn: vẫn đúng 1 bản ghi; p95 < 1s, p99 < 2,5s (mức 2 thang B). PERF-004: Phản hồi mong đợi 400 ≥ 99%; lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); toàn vẹn: `checkOutAt` không đổi; p95 < 1s, p99 < 2,5s (mức 2 thang B). |
| Kiểm tra nghiệp vụ | PERF-003 mong đợi 409 `ATTENDANCE_ALREADY_CHECKED_IN`; PERF-004 mong đợi 400 `Đã check-out rồi` |
| Dữ liệu cần có | Đã có lượt thật trong ngày; ảnh 500KB; toạ độ hợp lệ |
| Đối soát sau khi chạy | Vẫn đúng 1 bản ghi; `checkOutAt` không đổi so với trước khi chạy |
| Lệnh chạy | `.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkin`; `.\run.ps1 tests/load-repeat-attendance.js -e ACTION=checkout` |

### tests/peak-login.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Rải 173 lượt đăng nhập trong khung 15 phút |
| Case quản lý | PERF-005 |
| Executor và tải | `constant-arrival-rate`: `rate` 173, `timeUnit` 15m, `duration` 15m. Theo bộ case: PERF-005: 173 lượt rải đều trong 15 phút, 0,192 req/s tải mở; 15 phút. |
| Threshold | Cấu hình k6: `http_req_duration{api:login}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`. Theo bộ case: PERF-005: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), không khoá tài khoản, báo cáo số mẫu. |
| Kiểm tra nghiệp vụ | Login 200, có `data.accessToken` |
| Dữ liệu cần có | Tài khoản trong `.env`; mọi lượt dùng chung email |
| Đối soát sau khi chạy | Đúng 173 lượt, báo cáo số mẫu; xác nhận không khoá tài khoản |
| Lệnh chạy | `.\run.ps1 tests/peak-login.js` |

### tests/spike-login.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Dồn 173 VU login trong 30 giây, có tải thăm dò để đo phục hồi |
| Case quản lý | PERF-006 |
| Executor và tải | Scenario `probe`: `constant-arrival-rate` 1 req/s suốt bài. Scenario `spike`: `constant-arrival-rate` 173 lượt trong 30 giây, `startTime` 2 phút. Theo bộ case: PERF-006: Tải thăm dò login 1 req/s chạy suốt: 2 phút nền, 173 VU login trong 30 giây, 5 phút sau spike; Khoảng 8 phút. |
| Threshold | Cấu hình k6: `tech_errors`: `rate<0.01`; không có 5xx. Theo bộ case: PERF-006: Không 5xx, lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối), phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện. |
| Kiểm tra nghiệp vụ | Login 200; tách số liệu bằng tag `phase` là `baseline`, `spike`, `after` |
| Dữ liệu cần có | Tài khoản trong `.env` |
| Đối soát sau khi chạy | Tính p95 theo cửa sổ 1 phút của `probe`, so với 120% mức nền bằng `lib/recovery.js` |
| Lệnh chạy | `.\run.ps1 tests/spike-login.js` |

### tests/burst-173vu.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Đồng bộ 173 VU trong cửa sổ 5 giây: pha login và pha check-in dùng chung token |
| Case quản lý | PERF-007 |
| Executor và tải | Scenario `probe`: 1 req/s. Scenario `burst`: `per-vu-iterations` 173 VU, 1 lượt, `lib/sync.js` chờ mốc T0 rồi trải đều trong 5 giây. Chọn pha bằng `-e PHASE=login` hoặc `checkin`. Theo bộ case: PERF-007: Pha 1: 173 VU login trong 5 giây, trung bình 34,6 lượt/s. Pha 2: 173 VU gửi check-in trong 5 giây, ảnh khoảng 500KB. Tải thăm dò login 1 req/s trước, trong và 5 phút sau; Cửa sổ gửi 5 giây, quan sát khoảng 8 phút mỗi pha. |
| Threshold | Cấu hình k6: Pha login: `http_req_duration{api:login}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`. Pha check-in: `checkin_success_count`: `count==1`; không có 5xx. Theo bộ case: PERF-007: Pha 1: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối). Pha 2: đúng 1 thành công, còn lại 409, không 5xx, đúng 1 bản ghi. phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần. |
| Kiểm tra nghiệp vụ | Pha check-in: đúng 1 response 201, 172 response 409 |
| Dữ liệu cần có | Trạng thái đầu pha check-in: chưa check-in; ảnh 500KB; token còn hạn |
| Đối soát sau khi chạy | Đúng 1 bản ghi; tính phục hồi của `probe`; lặp 3 lần |
| Lệnh chạy | `.\run.ps1 tests/burst-173vu.js -e PHASE=login, sau đó -e PHASE=checkin` |

### tests/stress-login.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Giữ tiêu chí nghiệm thu đến bậc 173, sau đó tăng để tìm giới hạn đăng nhập |
| Case quản lý | PERF-008 |
| Executor và tải | `ramping-vus`: các bậc 50, 100, 173, 300, 500, 1000, mỗi bậc giữ 5 phút; tag `stage` theo bậc. Theo bộ case: PERF-008: VU đóng, bậc 50, 100, 173 rồi 300, 500, 1000; dừng khi vi phạm giới hạn an toàn; 5 phút mỗi bậc. |
| Threshold | Cấu hình k6: Bậc ≤ 173: `http_req_duration{api:login}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`. Bậc > 173: chỉ ghi nhận, `abortOnFail` khi lỗi ≥ 5% hoặc p95 ≥ 1s. Theo bộ case: PERF-008: Bậc ≤ 173: p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1%. Bậc > 173 chỉ tìm giới hạn: ghi bậc đầu tiên có lỗi ≥ 5% hoặc p95 ≥ 1s và mã lỗi; không tự sập. |
| Kiểm tra nghiệp vụ | Login 200; 429 tính riêng ở `rate_limited` |
| Dữ liệu cần có | Tài khoản trong `.env`; có xác nhận của chủ hệ thống |
| Đối soát sau khi chạy | Ghi bậc đầu tiên vi phạm và mã lỗi; xác nhận server còn sống bằng `GET /v1/health` |
| Lệnh chạy | `.\run.ps1 tests/stress-login.js` |

### tests/race-attendance.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Gửi đồng thời cùng tài khoản để kiểm tra chống ghi trùng và tính nhất quán |
| Case quản lý | PERF-009, PERF-010, PERF-011 |
| Executor và tải | `per-vu-iterations`, 1 lượt, `lib/sync.js` đồng bộ: PERF-009 và PERF-010 dùng 10 VU trong 1 giây; PERF-011 dùng 2 VU trong 100ms. Chọn bằng `-e ACTION=`. Theo bộ case: PERF-009: 10 VU gửi trong 1 giây; 1 lượt. PERF-010: 10 VU gửi trong 1 giây; 1 lượt. PERF-011: 2 VU gửi trong cùng 100ms; 1 lượt. |
| Threshold | Cấu hình k6: Tiêu chí nghiệp vụ tuyệt đối, không có ngưỡng thời gian. Theo bộ case: PERF-009: Đúng 1 thành công, còn lại 409 `ATTENDANCE_ALREADY_CHECKED_IN`, đúng 1 bản ghi, không 5xx. PERF-010: Đúng 1 thành công, còn lại 400 `Đã check-out rồi`, `checkOutAt` ổn định, không 5xx. PERF-011: Không 5xx; check-out chạy trước phải trả 400 `Chưa check-in`; không có `checkOutAt` mà thiếu `checkInAt`. |
| Kiểm tra nghiệp vụ | PERF-009: đúng 1 thành công, còn lại 409. PERF-010: đúng 1 thành công, còn lại 400. PERF-011: mọi thứ tự đều nhất quán |
| Dữ liệu cần có | Trạng thái đầu kiểm bằng `seed/preflight.js` |
| Đối soát sau khi chạy | Đọc lại bản ghi: đúng 1 bản ghi; `checkOutAt` ổn định; không có `checkOutAt` mà thiếu `checkInAt` |
| Lệnh chạy | `.\run.ps1 tests/race-attendance.js -e ACTION=checkin`; `.\run.ps1 tests/race-attendance.js -e ACTION=checkout`; `.\run.ps1 tests/race-attendance.js -e ACTION=both` |

### tests/resilience-s3.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Giữ login độc lập trong lúc S3 lỗi, đo ảnh hưởng và phục hồi |
| Case quản lý | PERF-012 |
| Executor và tải | Scenario `login_probe`: `constant-arrival-rate` 1 req/s trong 15 phút. Scenario `checkin_load`: `constant-vus` 20. Gây lỗi S3 từ phút 3 đến phút 10 bằng công cụ hạ tầng bên ngoài k6. Theo bộ case: PERF-012: Nhóm 1: login độc lập 1 req/s chạy suốt. Nhóm 2: 20 VU check-in. 3 phút nền, 7 phút S3 trễ 5 giây rồi trả lỗi, 5 phút phục hồi; 15 phút. |
| Threshold | Cấu hình k6: Nhóm login: `http_req_duration{api:login}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`; check-in: `http_req_duration{api:checkin}`: `max<30000`. Theo bộ case: PERF-012: Nhóm login giữ p95 < 1s, p99 < 2,5s (mức 2 thang B), lỗi kỹ thuật < 1%; check-in báo lỗi rõ ràng, không treo quá 30 giây, không có bản ghi thiếu ảnh; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện. |
| Kiểm tra nghiệp vụ | Check-in báo lỗi rõ ràng; login không bị kéo chậm |
| Dữ liệu cần có | Cần 20 tài khoản trong `data/accounts.example.csv`, quyền giả lập lỗi hạ tầng |
| Đối soát sau khi chạy | Không có bản ghi thiếu ảnh; tính phục hồi của `login_probe` |
| Lệnh chạy | `.\run.ps1 tests/resilience-s3.js` |

### tests/recovery-login.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | Đo khả năng phục hồi của đăng nhập khi restart app |
| Case quản lý | PERF-013 |
| Executor và tải | `constant-arrival-rate`: 1 req/s trong 15 phút; người vận hành restart app ở phút 5. Theo bộ case: PERF-013: Tải thăm dò 1 req/s tải mở: 4 phút nền, restart app ở phút 5, quan sát đến phút 15; 15 phút. |
| Threshold | Cấu hình k6: Lỗi chỉ nằm trong khoảng restart; p95 cửa sổ 1 phút ≤ 120% mức nền trong 5 phút. Theo bộ case: PERF-013: Lỗi chỉ xuất hiện trong lúc restart; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện. |
| Kiểm tra nghiệp vụ | Login 200 ngoài khoảng restart |
| Dữ liệu cần có | Tài khoản trong `.env`, quyền restart trên môi trường riêng |
| Đối soát sau khi chạy | Ghi thời điểm restart; tính phục hồi bằng `lib/recovery.js` |
| Lệnh chạy | `.\run.ps1 tests/recovery-login.js` |

### tests/burst-login-200.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | 200 tài khoản riêng cùng đăng nhập trong cửa sổ 5 giây |
| Case quản lý | PERF-014 |
| Executor và tải | Scenario `probe`: 1 req/s. Scenario `burst`: `per-vu-iterations` 200 VU, 1 lượt, `lib/sync.js` trải đều trong 5 giây. Theo bộ case: PERF-014: 200 tài khoản riêng gửi login trong 5 giây, trung bình 40 lượt/s; tải thăm dò login 1 req/s trước, trong và 5 phút sau; Cửa sổ gửi 5 giây, quan sát khoảng 8 phút. |
| Threshold | Cấu hình k6: `http_req_duration{api:login}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`. Theo bộ case: PERF-014: Login p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần. |
| Kiểm tra nghiệp vụ | Login 200 cho từng tài khoản; 429 tính riêng |
| Dữ liệu cần có | File `accounts-200.csv` |
| Đối soát sau khi chạy | Tính phục hồi của `probe`; lặp 3 lần |
| Lệnh chạy | `.\run.ps1 tests/burst-login-200.js` |

### tests/burst-attendance-200.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | 200 tài khoản đã login cùng gửi check-in hoặc check-out trong 5 giây |
| Case quản lý | PERF-015, PERF-016 |
| Executor và tải | Setup login và đọc thông tin cho 200 tài khoản. Scenario `probe`: 1 req/s. Scenario `burst`: `per-vu-iterations` 200 VU, 1 lượt. Chọn bằng `-e ACTION=`. Theo bộ case: PERF-015: Login và đọc thông tin trước trong setup; 200 tài khoản gửi check-in trong 5 giây, trung bình 40 lượt/s, ảnh khoảng 500KB; tải thăm dò login 1 req/s; Cửa sổ gửi 5 giây, quan sát khoảng 8 phút. PERF-016: Login và đọc thông tin trước trong setup; 200 tài khoản gửi check-out trong 5 giây, trung bình 40 lượt/s, ảnh khoảng 500KB; tải thăm dò login 1 req/s; Cửa sổ gửi 5 giây, quan sát khoảng 8 phút. |
| Threshold | Cấu hình k6: `http_req_duration{api:checkin}`: `p(95)<1000`, `p(99)<2500` hoặc `http_req_duration{api:checkout}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`; `attendance_success_count`: `count==200`. Theo bộ case: PERF-015: Check-in p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đúng 200 bản ghi; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần bằng dữ liệu sạch. PERF-016: Check-out p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; phục hồi: p95 của tải thăm dò trong cửa sổ 1 phút ≤ 120% mức nền, trong vòng 5 phút sau sự kiện; báo cáo số mẫu; lặp 3 lần bằng dữ liệu sạch. |
| Kiểm tra nghiệp vụ | Mỗi tài khoản nhận đúng mã thành công; sai trạng thái đầu thì dừng ở setup |
| Dữ liệu cần có | 200 tài khoản có ca, địa điểm, đúng trạng thái đầu; ảnh 500KB |
| Đối soát sau khi chạy | Chạy `seed/check-accounts.js` với trạng thái sau; tính phục hồi của `probe` |
| Lệnh chạy | `.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkin`; `.\run.ps1 tests/burst-attendance-200.js -e ACTION=checkout` |

### tests/peak-attendance-200.js

| Trường | Nội dung |
| --- | --- |
| Mục đích | 200 người chấm công rải đều trong khung cao điểm, đo cả flow |
| Case quản lý | PERF-017, PERF-018 |
| Executor và tải | `shared-iterations`: 40 VU, 200 lượt, mỗi người một mốc thời gian rải đều 15 phút với check-in, 30 phút với check-out. Chọn bằng `-e ACTION=`. Theo bộ case: PERF-017: 200 tài khoản, mỗi người 1 lượt thành công, rải đều 08:30–08:45, 0,222 lượt/s, ảnh khoảng 500KB; 15 phút. PERF-018: 200 tài khoản, mỗi người 1 lượt thành công, rải đều 18:00–18:30, 0,111 lượt/s, ảnh khoảng 500KB; 30 phút. |
| Threshold | Cấu hình k6: `http_req_duration{api:login}`: `p(95)<1000`, `p(99)<2500`; `http_req_duration{api:checkin}`: `p(95)<1000`, `p(99)<2500` hoặc `http_req_duration{api:checkout}`: `p(95)<1000`, `p(99)<2500`; `tech_errors`: `rate<0.01`; `attendance_success_count`: `count==200`. Theo bộ case: PERF-017: Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đúng 200 bản ghi; báo cáo tổng thời gian flow và số mẫu. PERF-018: Mỗi API riêng p95 < 1s, p99 < 2,5s (mức 2 thang B); lỗi kỹ thuật < 1% (5xx, timeout, mất kết nối); thành công 200/200; đủ 200 `checkOutAt`; báo cáo tổng thời gian flow và số mẫu. |
| Kiểm tra nghiệp vụ | Mỗi người: login, đọc thông tin, chấm công thành công; đo `flow_login_to_attendance_ms` |
| Dữ liệu cần có | 200 tài khoản có ca, địa điểm, đúng trạng thái đầu; ảnh 500KB |
| Đối soát sau khi chạy | Chạy `seed/check-accounts.js` với trạng thái sau |
| Lệnh chạy | `.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkin`; `.\run.ps1 tests/peak-attendance-200.js -e ACTION=checkout` |

## 6. Dữ liệu và môi trường

- **Môi trường:** API `https://hrs-main-dev.sonthanh.net.vn`, tài liệu `https://hrs-main-dev.sonthanh.net.vn/api/docs`. Web `https://nhan-su-dev.netlify.app/` không nằm trong tải vì k6 gọi thẳng API.
- **200 tài khoản thật:** danh sách ở `G:\TestK6\accounts-200.csv`, ngoài project, đường dẫn đặt trong `.env` qua `ACCOUNTS_FILE`.
- **Tài khoản:** 1 tài khoản EMPLOYEE, lưu ở `G:\TestK6\.env` với `HRM_BASE_URL`, `HRM_EMAIL`, `HRM_PASSWORD`. Script chỉ nhận qua `run.ps1`.
- **Login:** gửi `identifier`, `password` theo Swagger. Không dùng mật khẩu sai vì sai 5 lần khoá 30 phút.
- **Token:** chạy trên 15 phút hoặc dùng token từ `setup()` phải đăng nhập lại trước khi hết hạn.
- **Ảnh và GPS:** được phép dùng ảnh mẫu và GPS trên tài khoản thật. Mỗi request chấm công đều gửi ảnh. `data/selfie-500kb.jpg` khoảng 500KB. `open()` nạp ảnh theo từng VU nên 173 VU tốn khoảng 87MB RAM phía máy chạy.
- **Toạ độ:** lấy từ `GET /v1/check-in-locations/me`, không ghi cứng trong script.
- **Trạng thái đầu:** mỗi bài chấm công chạy `seed/preflight.js` trước; sai trạng thái thì dừng.
- **testRunId:** không dùng được cho bản ghi chấm công vì API không nhận trường ghi chú; nhận diện dữ liệu test qua tài khoản và thời gian chạy.
- **Dọn dữ liệu:** chưa có cách tự dọn. Không tự sửa bản ghi vì `PATCH /v1/attendance/{id}` cần HR, ADMIN.
- **Dịch vụ ngoài:** check-in, check-out ghi ảnh lên S3 và có thể gửi thông báo.

## 7. Theo dõi khi chạy

| Lớp | Chỉ số | Công cụ, file phụ trách |
| --- | --- | --- |
| Client | p95, p99, req/s, lỗi, số mẫu theo `api` | `lib/summary.js`, thư mục `results/` |
| Máy chạy k6 | CPU, RAM, mạng; quá tải máy chạy sẽ làm sai số đo | Task Manager hoặc công cụ theo dõi trên Windows |
| Server API | CPU, RAM, connection pool | Cần DevOps cấp quyền, hiện chưa có |
| Database | Query chậm, số kết nối | Cần DevOps cấp quyền, hiện chưa có |
| Queue | Tồn đọng hàng đợi BullMQ `fcm` | Cần DevOps cấp quyền, hiện chưa có |
| Sức khoẻ | `GET /v1/health` | Tải thăm dò hoặc kiểm tra tay |

## 8. Thứ tự triển khai

| Giai đoạn | File cần viết | Case chạy được | Đầu ra |
| --- | --- | --- | --- |
| 0. Kiểm tra trước | seed/check-rate-limit.js (đã viết) | Đã chạy trên dev, bắt buộc trước PERF-002, 005, 006, 007, 008, 013 | Biết login có giới hạn không và giới hạn ở bậc nào |
| 1. Nền | README.md, .env.example, run.ps1, config/env.js, config/thresholds.js, lib/auth.js, lib/assertions.js, lib/summary.js, flows/login-flow.js | Chưa có | Login 1 VU, ghi được file kết quả |
| 2. Chấm công | lib/attendance.js, flows/attendance-flow.js, seed/preflight.js, data/selfie-500kb.jpg, tests/smoke-attendance.js | PERF-001 | Một lượt smoke, xác nhận body check-out và khung giờ |
| 3. Tải login | tests/load-login.js, tests/peak-login.js | PERF-002, PERF-005 | Số đo login ở 173 VU |
| 4. Tranh chấp | lib/sync.js, tests/race-attendance.js, tests/load-repeat-attendance.js | PERF-003, PERF-004, PERF-009, PERF-010, PERF-011 | Kết quả chống ghi trùng |
| 5. Đợt dồn | lib/recovery.js, tests/spike-login.js, tests/burst-173vu.js | PERF-006, PERF-007 | Số đo burst 5 giây và phục hồi |
| 6. Giới hạn | tests/stress-login.js | PERF-008 | Điểm gãy của login |
| 6b. 200 tài khoản | lib/accounts.js, flows/multi-account-flow.js, seed/check-accounts.js, tests/burst-login-200.js, tests/burst-attendance-200.js, tests/peak-attendance-200.js | PERF-014, PERF-015, PERF-016, PERF-017, PERF-018 | Số đo chấm công thành công hàng loạt |
| 7. Hạ tầng | data/accounts.example.csv, tests/resilience-s3.js, tests/recovery-login.js | PERF-012, PERF-013 | Cần quyền hạ tầng trước khi viết |

## 9. Điểm cần xác nhận

| Nội dung | Giả định hiện tại | Hỏi ai |
| --- | --- | --- |
| Server lưu ảnh lên S3 trước hay sau khi kiểm tra trùng | Mỗi request đều gửi ảnh; nếu lưu trước, pha check-in của PERF-007 có thể tạo khoảng 86MB rác S3 mỗi lần | Backend |
| Body check-out | Theo Swagger gửi `photo`, `latitude`, `longitude`; bridge chỉ ghi `photo`; kiểm chứng ở PERF-001 | Backend |
| Check-in ngoài khung giờ | Theo trả lời là được chấp nhận; bridge ghi `OUTSIDE_WINDOW`; kiểm chứng ở PERF-001 | Backend |
| Độ trễ login ở tải cao | Không gặp 429 tới 35 lần/giây, nhưng p95 lên 6,41s ở 35 lần/giây | Backend, DevOps |
| Dọn dữ liệu chấm công sau test | Chưa có cách, dữ liệu test nằm lại trên tài khoản | HR, Backend |
| Quyền và 20 tài khoản cho PERF-012, quyền restart cho PERF-013 | Chưa có | DevOps, Quản trị hệ thống |
