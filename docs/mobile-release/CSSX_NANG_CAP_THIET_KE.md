# Nâng cấp app Mobile cho CSSX: khảo sát và thiết kế (trước Bước 2)

Ngày lập: 17/11/2026. Nhánh: `release/mobile-play`.
Căn cứ: đọc mã nguồn, chạy app web với API local bằng tài khoản test `tho@eurohouse.vn`, chụp màn hình, tạo PDF mẫu bằng `pnpm pdf:samples`.

## 0. Hai việc chặn cần biết trước

1. **Phần API trên đĩa chưa có phiên bản rõ ràng.** Module workforce, schema và DTO đăng ký có thay đổi chưa commit, một số file còn bị lùi về bản cũ (đã thấy ở `register-workshop.dto.ts`). Ba mảng chấm công, thư viện và Thợ Pro đều phải sửa API, nên cần gỡ API giống cách đã làm với mobile: commit mốc nguyên trạng, gộp lại với HEAD, chạy test.
2. ~~`https://api.nhomeurohouse.com` không phản hồi~~ **Đính chính 17/11:** API production chạy bình thường qua HTTPS (đã kiểm bằng Node, mã 200). Lần kiểm đầu sai vì `curl` trong Git Bash trên máy này lỗi với HTTPS. API đặt trên máy MINI 02, truy cập từ Internet qua tên miền nhomeurohouse.com (đi qua Cloudflare).

## 1. Thời tiết

**Hiện trạng.** Màn `/weather` đã có dự báo 7 ngày từ Open-Meteo, ô tìm địa điểm và nút "Dùng vị trí hiện tại". Tuy vậy:
- Mặc định hiện TP. Hồ Chí Minh, kể cả khi xưởng ở tỉnh khác.
- App không hỏi vị trí ngay lần đầu.
- Trang chủ chỉ hiện nhiệt độ hôm nay.
- 7 ngày nằm trong một danh sách dài, phải cuộn mới xem hết.

**Rủi ro bản quyền.** API miễn phí của Open-Meteo chỉ cho dùng phi thương mại. App Eurohouse là app thương mại, nên cần gói trả phí (khoảng 29 EUR/tháng) hoặc đổi nhà cung cấp.

**Chọn nhà cung cấp (kiểm 17/11/2026, chủ dự án muốn dùng gói miễn phí):**
- **Google Maps Weather API:** miễn phí 10.000 lượt/tháng, nhưng bảng vùng phủ chính thức ghi Việt Nam *không có* thời tiết hiện tại, dự báo ngày hay dự báo giờ (chỉ có cảnh báo). Loại.
- **Nhà cung cấp tại Việt Nam:** không tìm thấy API công khai cho nhà phát triển. Trung tâm Dự báo KTTV Quốc gia không mở API.
- **Open-Meteo bản miễn phí:** điều khoản chỉ cho dùng phi thương mại.
- **MET Norway Locationforecast:** miễn phí, giấy phép CC BY 4.0, có dữ liệu cho Việt Nam. Yêu cầu: ghi nguồn "Dữ liệu thời tiết: MET Norway", gửi User-Agent có liên hệ, lưu đệm theo header `Expires`, toạ độ tối đa 4 chữ số thập phân, khuyến nghị gọi qua máy chủ trung gian. **→ Đề xuất dùng nhà cung cấp này, gọi qua API Eurohouse trên MINI 02.**
- Hiện tại app vẫn gọi Open-Meteo để chạy thử. Sẽ chuyển sang MET Norway khi làm phần API.
- **Đã làm 17/11 (commit 5632e4a):** tìm vị trí theo địa chỉ xưởng (có kiểm đúng tỉnh), hỏi vị trí lần đầu thay vì tự đoán TP.HCM, dải 7 ngày gọn trong một màn.

**Thiết kế.**
- **Gọi qua API Eurohouse:** thêm `GET /weather?lat&lon`. API lưu đệm kết quả theo ô lưới khoảng 10 km trong 30 phút. Như vậy không lộ khoá API ra app, và nghìn người dùng chỉ tốn vài chục lượt gọi tới nhà cung cấp.
- **Nhà cung cấp:** Open-Meteo gói thương mại (chọn mô hình "best match", gồm ECMWF, GFS, ICON). Việt Nam chưa có API công khai từ Trung tâm Dự báo Khí tượng Thuỷ văn Quốc gia.
- **Vị trí:**
  - Lần đầu mở app sau khi đăng nhập (hoặc khi vào chế độ khách), hiện một thẻ hỏi vị trí, có hai lựa chọn: "Dùng vị trí hiện tại" hoặc "Chọn tỉnh/huyện".
  - Mặc định lấy theo tỉnh trong địa chỉ xưởng.
  - Lưu theo tài khoản.
- **Giao diện:**
  - Một dải 7 ngày cuộn ngang, nằm gọn trong một màn.
  - Dự báo theo giờ cho hôm nay và ngày mai, có tô màu "giờ thuận lợi lắp đặt".
  - Trang chủ hiện 3 ngày tới, kèm cảnh báo mưa cho các ngày có lịch lắp đặt.

## 2. Đổi "Chấm công" thành "Quản lý xưởng"

**Hiện trạng.**
- Đã có: lương theo ngày, theo giờ, theo tháng; hệ số Chủ nhật và Lễ; trạng thái có mặt, vắng, nghỉ phép; tăng ca nhập tay.
- Chưa có:
  - Nửa ngày.
  - Lương cố định cộng khoán sản phẩm.
  - Bảo hiểm.
  - Thưởng, phụ cấp, tạm ứng.
  - Tăng ca tự sinh. Hiện giờ chính bị cắt ở mức 8 giờ, phần dư bị bỏ.
  - Phiếu lương PDF.

**Thiết kế.** Ba tab: **Hôm nay · Nhân sự · Lương**.

- **Thiết lập xưởng (làm một lần, có trình hướng dẫn):**
  - Giờ vào, giờ ra chuẩn, nghỉ trưa.
  - Ngày nghỉ trong tuần.
  - Ngưỡng tính tăng ca (ví dụ ra muộn từ 30 phút trở lên).
  - Hệ số tăng ca ngày thường, Chủ nhật, Lễ.
- **Hồ sơ nhân sự, chọn một trong 4 cách trả lương:**
  1. Theo ngày công.
  2. Theo giờ.
  3. Lương tháng cố định (chia theo số công chuẩn).
  4. Lương cố định cộng khoán sản phẩm (đơn giá theo bộ, theo m² hoặc theo việc).

  Thêm tuỳ chọn "Đóng bảo hiểm" với mức lương đóng bảo hiểm. Tỷ lệ mặc định theo quy định hiện hành: người lao động 10,5%, doanh nghiệp 21,5%. Tỷ lệ cho phép sửa.
- **Hôm nay:**
  - Mỗi người một dòng, bấm một lần để chấm vào hoặc ra.
  - Giữ lâu để chọn trạng thái: Đủ công, Nửa ngày sáng, Nửa ngày chiều, Nghỉ phép có lương, Nghỉ không lương, Vắng.
  - Ra sau giờ chuẩn thì **tự sinh giờ tăng ca**, người quản lý sửa được.
- **Khoán sản phẩm:** ghi "số lượng × đơn giá" theo ngày hoặc theo công trình.
- **Lương tháng:**
  - Mỗi người có các dòng: ngày công, số nửa ngày, giờ tăng ca, ngày nghỉ (có lương và không lương), lương chính, tiền tăng ca, tiền khoán, phụ cấp, thưởng, khấu trừ bảo hiểm, tạm ứng, **thực lĩnh**.
  - Có nút "Chốt lương tháng" để khoá số liệu.
  - Xuất **phiếu lương PDF cho từng người** và bảng lương tổng hợp (PDF, Excel).
- **Dễ dùng:**
  - Mọi số tiền đều có dòng giải thích ngắn, ví dụ "26 công × 350.000 đ".
  - Chưa thiết lập thì app dùng mặc định hợp lý: 8:00 đến 17:00, nghỉ Chủ nhật.

## 3. Thư viện, video, hình ảnh, tài liệu kỹ thuật

**Hiện trạng.**
- Thư viện có 1 mục, Học viện có 3 bài.
- `LibraryItem` chỉ có `mediaUrl`, `mediaType`, `category`.
- Lưu trữ dùng `STORAGE_PROVIDER=local` (đĩa của máy chạy API) hoặc S3/R2.

**Thiết kế.**
- **Mô hình dữ liệu:** `MediaAsset`, gồm loại (ảnh, video, tài liệu), ảnh đại diện, thời lượng, kích thước, thẻ, hệ nhôm liên quan, album. Thêm `MediaAlbum`.
- **Lưu trên máy chủ MINI 02 (500 GB):**
  - Video sau khi tải lên được chuyển sang MP4 H.264 720p, kèm ảnh đại diện (ffmpeg chạy trên máy chủ).
  - Phát video có hỗ trợ tua (HTTP Range).
  - Ảnh tự tạo bản nhỏ 480 px và bản lớn 1600 px.
- **App:** Thư viện có 3 tab Ảnh · Video · Tài liệu, có tìm kiếm và lọc theo hệ nhôm. Ảnh xem toàn màn, video phát ngay trong app.
- **Quản trị:** trang tải lên hàng loạt trong `apps/admin`.
- **Nội dung:** tôi soạn bản nháp bài kỹ thuật dựa trên catalog R19, bảng thông số cắt và tài liệu hỗ trợ kỹ thuật có trong repo. Chủ dự án duyệt trước khi đăng, vì sai thông số kỹ thuật thì hậu quả thật.

## 4. Màn tổng hợp công trình

**Hiện trạng** (đã chụp):
- **Danh sách:**
  - Thẻ doanh thu và nút tạo mới chiếm hơn nửa màn hình.
  - Mỗi công trình có một nút cam to "Bóc tách & đặt nhôm".
  - Mỗi lần chỉ thấy khoảng 2 công trình.
  - Không có tìm kiếm, không lọc theo trạng thái.
- **Chi tiết:** là form sửa luôn mở sẵn, kể cả khi công trình đã hoàn thành. Không có phần tóm tắt để đọc nhanh. Phần tài chính nằm tận dưới.

**Thiết kế:**
- **Danh sách:**
  - Đầu trang gọn, có một dòng 3 chỉ số: Đang thi công · Còn phải thu · Doanh thu năm.
  - Ô tìm kiếm và các nút lọc: Tất cả, Báo giá, Đang thi công, Chờ thu, Hoàn tất.
  - Mỗi công trình là một dòng gọn: mã, tên, khách hàng, trạng thái, số còn phải thu.
  - Nút "+" nổi để tạo công trình.
- **Chi tiết, dạng đọc trước:**
  - Thanh tiến trình trạng thái.
  - Thẻ tiền: Hợp đồng · Đã thu · Còn lại · Lợi nhuận.
  - Hàng thao tác nhanh: Báo giá, Đặt nhôm, Thu/Chi, Nghiệm thu, Xuất PDF.
  - Muốn sửa thì bấm "Sửa".
- Sẽ đưa 2 đến 3 phương án wireframe để chọn trước khi dựng.

## 5. Bộ biểu mẫu PDF cho CSSX

**Hiện trạng.** Có 7 loại: báo giá/quyết toán, dự toán, hợp đồng, phiếu cắt, đơn đặt hàng, biên bản nghiệm thu, tổng hợp thu chi. Lỗi thật:
- **Lớp chữ trong PDF bị hỏng:** copy hoặc tìm kiếm tiếng Việt ra ký tự rác.
- **Bảng thu chi trang 2 bị tràn chữ:** phần diễn giải hai dòng bị cắt.
- **Màu chưa theo bộ nhận diện:** đầu bảng dùng xanh navy, logo trên phiếu là logo Eurohouse thay vì logo của xưởng.

**Thiết kế:** một bộ khuôn dùng chung cho mọi biểu mẫu.
- Đầu trang có logo và thông tin của xưởng, kèm dấu nhỏ "Sử dụng nhôm Eurohouse".
- Màu theo nhận diện: cam #F47C20, đen #0A0A0A, đỏ nhấn.
- Bảng tự giãn dòng.
- Chân trang có mã QR tra cứu chứng từ hoặc bảo hành.
- Khung chữ ký thống nhất.
- Thêm biểu mẫu mới: Phiếu lương, Bảng lương tháng.
- Sửa lỗi nhúng phông để chữ copy được.

## 6. Đổi quà và Thợ Pro

**Hiện trạng.**
- Thẻ "THỢ PRO · GOLD" ở màn Tài khoản là **dữ liệu giả viết cứng**: hạng GOLD, thanh tiến độ 70% và "2/3 công trình QR" giống nhau với mọi người dùng.
- Kiểu `WorkerTier` (SILVER, GOLD, DIAMOND, MASTER) có khai báo nhưng chưa có logic.
- Điểm chỉ tích theo đơn NPP (5 điểm/100 kg), **không tích qua bảo hành** để chống gian lận.

**Thiết kế đề xuất. Các con số dưới đây là mặc định để chủ dự án duyệt.**
- **Tách hai loại điểm:**
  - **Điểm đổi quà:** tiêu được.
  - **Điểm hạng:** chỉ để xét hạng, tính theo 12 tháng gần nhất, không tiêu được.
  - Cả hai đều chỉ tích từ đơn nhôm Eurohouse đã giao qua NPP.
- **Hạng xét theo sản lượng nhôm trong 12 tháng:**

| Hạng | Điều kiện | Quyền lợi |
|---|---|---|
| Thành viên | Đăng ký | Đổi quà, Học viện |
| Bạc | ≥ 2 tấn | Điểm ×1,0, quà sinh nhật |
| Vàng | ≥ 10 tấn | Điểm ×1,1, ưu tiên giao hàng, hỗ trợ kỹ thuật qua điện thoại |
| Kim cương | ≥ 30 tấn | Điểm ×1,25, chiết khấu riêng qua NPP, kỹ thuật đến tận nơi, quà Tết |

- **Chứng nhận Thợ Pro** là danh hiệu riêng, không phải một hạng. Điều kiện:
  - Đạt từ hạng Vàng trở lên.
  - Hoàn thành khoá Học viện và bài kiểm tra.
  - Không có khiếu nại bảo hành bị xác nhận lỗi thi công trong 12 tháng.
- **Quyền lợi của Thợ Pro:**
  - Có huy hiệu.
  - Có giấy chứng nhận PDF.
  - **Được giới thiệu khách:** có tên trong danh bạ "Tìm thợ Pro" trên nhomeurohouse.com, nhận yêu cầu báo giá. Đây là lý do giữ chân thợ mạnh nhất.
- **Hiển thị:** màn "Hạng của tôi" có hạng hiện tại, tiến độ lên hạng (số kg còn thiếu), quyền lợi từng hạng và lịch sử.
- **Việc làm ngay:** gỡ thẻ dữ liệu giả, thay bằng số thật hoặc ẩn đi cho tới khi có logic.

## 7. Thứ tự đề xuất

1. Việc nhỏ làm ngay:
   - Gỡ thẻ Thợ Pro giả.
   - Thời tiết lấy theo tỉnh của xưởng, hỏi vị trí lần đầu, dải 7 ngày cuộn ngang.
   - Sửa tràn chữ và lớp chữ trong PDF.
2. Thiết kế lại màn Công trình (chỉ mobile, không đụng API).
3. Gỡ lệch phần API: commit mốc và gộp lại.
4. Module Quản lý xưởng (API, mobile, phiếu lương PDF).
5. Bộ biểu mẫu PDF theo nhận diện.
6. Thư viện media trên MINI 02 và nội dung kỹ thuật.
7. Hạng thành viên và chứng nhận Thợ Pro.
8. Quay lại Bước 2 của kế hoạch phát hành (xoá tài khoản, chính sách quyền riêng tư).
