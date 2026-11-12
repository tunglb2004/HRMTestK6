# Báo cáo ngắn: Test hiệu năng HRM (login, check-in, check-out)

- **Ngày test:** 02/11/2026, 11:14 – 17:23
- **Môi trường:** Dev (`https://hrs-main-dev.sonthanh.net.vn`), k6 v2.3.0
- **Người thực hiện:** Lưu Bách Tùng
- **Tiêu chí đạt (PO đã chấp nhận):** p95 < 1s, p99 < 2,5s, lỗi kỹ thuật < 1%, không sai dữ liệu chấm công

## 1. Các case đã test (9 case)

| Case | Nội dung | Số lần | p95 | p99 | Lỗi | Kết quả |
|---|---|---|---|---|---|---|
| PERF-002 | Login tải ổn định 5 phút và 15 phút | 2 | 550–574ms | 1025–1103ms | 0–0,02% | **Đạt** |
| PERF-005 | Login rải đều trong khung check-in (173 lượt / 15 phút) | 1 | 281ms | 538ms | 0% | **Đạt** |
| PERF-006 | Login dồn đầu ca (173 lượt / 30 giây) | 1 | 244ms | 276ms | 0% | **Đạt** |
| PERF-007 | Login 173 người cùng lúc trong 5 giây | 3 | 6,2–7,4s | 10,7–11,1s | 0% | **Không đạt**: p95 gấp 6–7 lần ngưỡng 1s, p99 gấp khoảng 4,4 lần ngưỡng 2,5s; trượt cả mức 1 (p95 < 2s, p99 < 6s) ở cả 3 lần |
| PERF-014 | Login 200 tài khoản cùng lúc trong 5 giây | 3 | 7,2–11,2s | 11,5–12,9s | 0% | **Không đạt**: p95 gấp 7–11 lần ngưỡng 1s, p99 gấp 4,6–5,2 lần ngưỡng 2,5s; trượt cả mức 1 ở cả 3 lần |
| PERF-010 | Bấm check-out 10 lần cùng lúc | 1 | 1,01s | 1,07s | 0% | **Đạt có điều kiện**: dữ liệu đúng (1 bản ghi), thời gian chỉ đạt mức 1 |
| PERF-004 | Check-out lặp 1 lần/giây trong 5 phút | 1 | 100ms | 111ms | 0% | **Đạt**, nhưng chỉ đo nhánh bị từ chối (429) |
| PERF-016 | 200 tài khoản cùng check-out trong 5 giây (đã đăng nhập trước) | 1 | 10,5s | 10,6s | 0% | **Không đạt**: 199/200 thành công (EMP202 bị 429 vì đã dùng hết 5 lượt trong ngày), đối soát 200/200 đã check-out, nhưng thời gian vượt xa ngưỡng |
| PERF-009 | Bấm check-in 10 lần cùng lúc | 2 | – | – | 0% | **Không hợp lệ**: chạy ngoài khung giờ check-in và vượt giới hạn 5 lần/ngày, cần chạy lại |

Số p95, p99 của PERF-007 và PERF-014 là riêng các lượt dồn trong 5 giây.

**Nguyên nhân không đạt của PERF-007 và PERF-014**

- **Lý do không đạt:** chỉ do **thời gian phản hồi quá chậm**. Cả 6 lần chạy không có request lỗi, không bị 429, không timeout, tất cả đều đăng nhập thành công. Riêng lượt dồn, trung vị đã 2,9–4,1s ở PERF-007 và 4,1–6,7s ở PERF-014, tức là đa số người dùng đều phải chờ lâu, không phải vài request lẻ.
- **Điểm nghẽn nằm ở server, không ở máy test:** CPU máy chạy test chỉ 14–31%. Cùng 173 lượt login nhưng rải trong 30 giây (khoảng 6 lượt/s, PERF-006) thì p95 chỉ 244ms; dồn trong 5 giây (khoảng 35–40 lượt/s) thì vượt ngưỡng. Kiểm tra rate limit trước đó cũng cho kết quả tương tự: 12 lượt/s p95 391ms, 35 lượt/s p95 6,4s.
- **Server xếp hàng chứ không sập:** trong phút dồn, cả các lượt login nhẹ chạy song song cũng chậm theo (PERF-014: p95 5,8–7,7s); phút ngay sau đó đã về mức nền (khoảng 230–280ms).
- **Nguyên nhân gốc chưa xác định** vì chưa có số liệu CPU, DB của server. Giả thuyết: login tốn nhiều CPU cho mỗi request (thường do băm mật khẩu bcrypt) hoặc thiếu worker, connection pool, nên khi vượt khoảng vài chục lượt/s thì request phải chờ nhau. Cần dev đo server trong phút dồn để xác nhận. PERF-016 chạy lúc 17:14–17:23, CPU máy chạy test tối đa 24,3%.

## 2. Các case chưa test

| Case | Nội dung | Lý do |
|---|---|---|
| PERF-001 | Smoke: login → check-in, login → check-out | Khung check-in (08:00–11:00) đã đóng |
| PERF-003 | Check-in lặp | Cần khung check-in; script chưa nhận 429 (giới hạn 5 lần/ngày) |
| PERF-007 pha check-in | 173 request check-in cùng lúc | Cần khung check-in và tài khoản chưa check-in |
| PERF-008 | Stress login đến 1000 VU | Tải rất nặng lên dev, cần dev theo dõi server khi chạy |
| PERF-011 | Check-in và check-out gửi cùng lúc | Cần khung check-in |
| PERF-012 | S3 chậm khi check-in | Cần đội vận hành gây lỗi S3 |
| PERF-013 | Restart app khi đang login | Cần người có quyền restart app |
| PERF-015 | 200 tài khoản cùng check-in | Khung check-in (08:00–11:00) đã đóng |
| PERF-017, 018 | Check-in 08:30–08:45 / check-out 18:00–18:30 với 200 tài khoản | Phải chạy đúng giờ; khung check-out hiện đóng lúc 18:00 |

## 3. Phát hiện chính

1. **Login chậm khi nhiều người đăng nhập trong vài giây.** Dồn 173–200 lượt trong 5 giây thì p95 lên 6–11 giây, gấp 6–11 lần ngưỡng. Server không báo lỗi và phục hồi ngay phút sau. Rải cùng số lượt trong 30 giây thì vẫn nhanh (p95 244ms).
2. **Check-out hàng loạt cũng chậm.** 200 người check-out cùng lúc thì p95 10,5 giây, trung vị 9,3 giây; dữ liệu vẫn đúng (200/200 tài khoản có bản ghi check-out). Hệ thống phục hồi ngay phút sau.
3. **Mỗi tài khoản chỉ được gửi check-in, check-out tối đa 5 lần/ngày**, tính cả lần bị từ chối; lần thứ 6 trả 429 với mã lỗi chưa chuẩn (`UNKNOWN_ERROR`).

## 4. Kết luận tổng quan

**Không đạt.** Login chịu tốt tải đều và tải dồn trong 30 giây, nhưng **không đáp ứng** khi nhiều người cùng đăng nhập trong vài giây đầu ca. **Check-out hàng loạt (200 người cùng lúc) cũng không đáp ứng** về thời gian (p95 10,5 giây), dù dữ liệu ghi đúng. Check-in chưa có kết quả hợp lệ.

**Việc cần làm tiếp:**
1. Dev kiểm tra CPU, DB server và thời gian upload ảnh khi dồn tải, sửa rồi chạy lại PERF-007, PERF-014, PERF-016.
2. Chạy PERF-015, PERF-017, PERF-018 (200 tài khoản đã đủ ca và địa điểm).
3. Chạy các case check-in trong khung 08:00–11:00 bằng tài khoản chưa dùng trong ngày.
