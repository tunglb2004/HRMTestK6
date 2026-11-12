# Báo cáo ngắn: Test hiệu năng HRM (login, check-in, check-out)

- **Thời gian test:** 02/11/2026 11:14 – 03/11/2026 11:00
- **Môi trường:** Dev (`https://hrs-main-dev.sonthanh.net.vn`), k6 v2.3.0
- **Người thực hiện:** Lưu Bách Tùng
- **Tài khoản:** case 1 người dùng `bachtungluu@gmail.com`; case nhiều người dùng 200 tài khoản EMP202–EMP401
- **Tiêu chí đạt (PO đã chấp nhận):** p95 < 1s, p99 < 2,5s, lỗi kỹ thuật < 1%, không sai dữ liệu chấm công. Mức 1 (đạt có điều kiện): p95 < 2s, p99 < 6s.

## 1. Các case đã test

| Case | Nội dung | Số lần | p95 | p99 | Lỗi | Kết quả |
|---|---|---|---|---|---|---|
| PERF-001 | Smoke: 1 người login → check-in | 1 | 925ms | 925ms | 0% | **Đạt** (lượt check-out chưa chạy) |
| PERF-002 | Login tải ổn định 5 phút và 15 phút (02/11) | 2 | 550–574ms | 1025–1103ms | 0–0,02% | **Đạt** |
| PERF-002 | Login tải ổn định 5 phút, chạy lại 08:19 sáng 03/11 | 1 | 2,19s | 3,74s | 0% | **Không đạt**: cùng tải nhưng chậm gấp khoảng 4 lần ngày 02/11, trượt cả mức 1 |
| PERF-004 | 1 người check-out lặp 1 lần/giây trong 5 phút | 1 | 100ms | 111ms | 0% | **Đạt**, chỉ đo nhánh bị từ chối (429) |
| PERF-005 | Login rải đều 173 lượt / 15 phút | 1 | 281ms | 538ms | 0% | **Đạt** |
| PERF-006 | Login dồn 173 lượt / 30 giây | 1 | 244ms | 276ms | 0% | **Đạt** |
| PERF-007 | Login 173 người cùng lúc trong 5 giây | 3 | 6,2–7,4s | 10,7–11,1s | 0% | **Không đạt**: p95 gấp 6–7 lần ngưỡng, p99 gấp khoảng 4,4 lần; trượt cả mức 1 |
| PERF-010 | 1 người bấm check-out 10 lần cùng lúc | 1 | 1,01s | 1,07s | 0% | **Đạt có điều kiện**: dữ liệu đúng (1 bản ghi), thời gian mức 1 |
| PERF-014 | Login 200 tài khoản cùng lúc trong 5 giây | 3 | 7,2–11,2s | 11,5–12,9s | 0% | **Không đạt**: p95 gấp 7–11 lần ngưỡng, p99 gấp 4,6–5,2 lần; trượt cả mức 1 |
| PERF-015 | 200 người cùng check-in trong 5 giây | 1 | 11,2s | 11,4s | 0% | **Không đạt**: 200/200 thành công, dữ liệu đúng, nhưng quá chậm |
| PERF-016 | 200 người cùng check-out trong 5 giây | 1 | 10,5s | 10,6s | 0% | **Không đạt**: 199/200 thành công (1 tài khoản đã hết 5 lượt), dữ liệu 200/200 đúng, nhưng quá chậm |
| PERF-017 | 200 người login → check-in rải đều 15 phút | 1 | 950ms | 1,27s | 0% | **Đạt** (bắt đầu 08:48 thay vì 08:30, là lượt check-in thứ hai của tài khoản) |
| PERF-018 | 200 người login → check-out rải đều 30 phút | 1 | 1,13s | 1,48s | 0% | **Đạt có điều kiện**: 200/200 thành công, p95 chỉ đạt mức 1 |
| PERF-009 | 1 người bấm check-in 10 lần cùng lúc | 2 | – | – | 0% | **Không hợp lệ**: cả 2 lần (02/11) chạy ngoài khung giờ hoặc đã hết 5 lượt, không có lần check-in thành công nào; cần chạy lại |
| PERF-003 | 1 người check-in lặp | 1 | 98ms | 587ms | 0% | **Không hợp lệ**: chạy sau hạn check-in 09:30 của ca HN; chỉ xác nhận được rule 5 lần/ngày. Không chạy lại (theo yêu cầu) |

Số p95, p99 của PERF-007, PERF-014 là riêng các lượt dồn trong 5 giây.

## 2. Các case chưa test

| Case | Nội dung | Lý do |
|---|---|---|
| PERF-008 | Stress login đến 1000 VU | Tải rất nặng lên dev, cần dev theo dõi server khi chạy |
| PERF-012 | S3 chậm khi check-in | Cần đội vận hành gây lỗi S3 |
**Bỏ** theo yêu cầu ngày 03/11 |

## 3. Phát hiện chính

1. **Login chậm khi nhiều người đăng nhập trong vài giây.** Dồn 173–200 lượt trong 5 giây thì p95 6–11 giây. Rải cùng số lượt trong 30 giây thì vẫn nhanh (p95 244ms).
2. **Check-in, check-out hàng loạt cũng chậm.** 200 người gửi trong 5 giây thì p95 10,5–11,2 giây, trung vị trên 9 giây. Rải đều thì chỉ khoảng 1 giây. Dữ liệu luôn đúng: đủ 200/200 bản ghi, không trùng.
3. **Hệ thống chậm chứ không sập.** Không có lỗi 5xx hay timeout, và luôn về bình thường ngay phút sau đợt dồn.
4. **Sáng 03/11 login chậm hơn hẳn ngày 02/11** ở cùng mức tải (p95 2,19s so với 574ms). Có thể do tải nền buổi sáng trên dev, cần chạy lại để xác nhận.
5. **Rule nghiệp vụ:** mỗi người chỉ được gửi check-in, check-out tối đa 5 lần/ngày, tính cả lần bị từ chối (lần thứ 6 trả 429, mã lỗi chưa chuẩn `UNKNOWN_ERROR`). Check-in và check-out lần 2 được ghi đè giờ, vẫn 1 bản ghi.

## 4. Kết luận tổng quan

**Không đạt.** Khi người dùng gửi rải đều (đúng nhịp thực tế bình thường), login, check-in, check-out đều đạt hoặc gần đạt tiêu chí. Nhưng khi nhiều người **cùng thao tác trong vài giây**, tình huống dễ xảy ra đầu ca và cuối ca, cả 3 API đều chậm 6–11 giây, vượt xa ngưỡng 1 giây. Dữ liệu chấm công luôn đúng, hệ thống không sập.

**Việc cần làm tiếp:**
1. Dev đo CPU, DB server và thời gian upload ảnh trong lúc dồn tải, tìm và xử lý điểm nghẽn, rồi chạy lại PERF-007, PERF-014, PERF-015, PERF-016.
2. Chạy PERF-001 lượt check-out, chạy lại PERF-009 hợp lệ, và chạy lại PERF-002 ngoài giờ cao điểm.
3. Chạy PERF-008, PERF-012, PERF-013 khi có dev và đội vận hành phối hợp.
