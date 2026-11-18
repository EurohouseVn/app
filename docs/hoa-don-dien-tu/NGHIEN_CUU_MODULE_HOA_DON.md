# Nghiên cứu: module Hoá đơn & Doanh thu cho CSSX

Ngày lập: 18/11/2026. Người lập: Claude, theo yêu cầu của chủ dự án.

Mục tiêu: CSSX quản lý hoá đơn bán ra, xuất hoá đơn điện tử ký bằng chữ ký số của chính họ, theo dõi doanh thu cả năm để có số liệu làm việc với cơ quan thuế.

> **Lưu ý quan trọng.** Quy định thuế cho hộ kinh doanh đã đổi **ba lần trong năm 2026**: ngưỡng 100 triệu, rồi 500 triệu, rồi 1 tỷ. Phần quy định dưới đây tổng hợp từ báo chí và trang tư vấn. Có những chỗ các nguồn mâu thuẫn, đã ghi rõ. **Trước khi đưa vào sản phẩm phải có kế toán thuế xác nhận**, nhất là tỷ lệ thuế theo ngành của nghề nhôm kính.

---

## 1. Tóm tắt

- **Ngưỡng 1 tỷ đồng/năm là mốc quyết định** (Nghị định 141/2026/NĐ-CP, áp dụng từ 01/01/2026):
  - **Dưới hoặc bằng 1 tỷ:** không nộp thuế GTGT, không nộp thuế TNCN. Ghi sổ doanh thu và thông báo doanh thu năm cho cơ quan thuế. Hoá đơn điện tử là **tự nguyện**.
  - **Trên 1 tỷ:** **bắt buộc** hoá đơn điện tử có mã của cơ quan thuế, hoặc hoá đơn khởi tạo từ máy tính tiền. Khai thuế theo quý.
- Phần lớn CSSX nhỏ nằm dưới hoặc quanh 1 tỷ. Vì vậy giá trị lớn nhất của module là **sổ doanh thu tự động và cảnh báo sắp vượt ngưỡng**; xuất hoá đơn là bước thứ hai.
- **App không nên tự giữ chữ ký số.** Nên tích hợp một nhà cung cấp hoá đơn điện tử có API (MISA meInvoice, Viettel S-Invoice…). Việc ký diễn ra ở phía nhà cung cấp, bằng HSM hoặc chữ ký số từ xa của chính hộ kinh doanh.
- **Đề xuất làm 2 giai đoạn:**
  - **GĐ1, không phụ thuộc bên ngoài:** hồ sơ thuế của xưởng, sổ doanh thu (mẫu S1a-HKD) lấy từ phiếu thu và công trình, quản lý hoá đơn (ghi số hoá đơn đã xuất), báo cáo tháng/quý/năm, cảnh báo ngưỡng 1 tỷ, xuất Excel/PDF.
  - **GĐ2:** nối API một nhà cung cấp để lập và ký hoá đơn ngay trong app.

## 2. Quy định hiện hành liên quan (bản 11/2026)

### 2.1 Mốc ngưỡng doanh thu của hộ kinh doanh

| Thời điểm | Ngưỡng không nộp GTGT/TNCN | Căn cứ |
|---|---|---|
| Trước 05/3/2026 | 100 triệu/năm | Quy định cũ |
| Từ 05/3/2026 | 500 triệu/năm | Nghị định 68/2026/NĐ-CP |
| **Từ 01/01/2026** (ban hành 29/4/2026, áp dụng hồi tố) | **1 tỷ/năm** | **Nghị định 141/2026/NĐ-CP**, sửa Nghị định 68/2026 |

- Thuế đã nộp theo ngưỡng cũ được bù trừ hoặc hoàn lại (Điều 3, Nghị định 141/2026).
- Thuế khoán đã **bãi bỏ từ 01/01/2026** (Nghị quyết 198/2025/QH15). Hộ kinh doanh tự kê khai, tự nộp theo doanh thu thực tế.
- Doanh nghiệp có doanh thu năm từ 1 tỷ trở xuống được miễn thuế TNDN (Nghị định 141/2026 bổ sung vào Nghị định 320/2025).

### 2.2 Hộ có doanh thu từ 1 tỷ trở xuống

- Ghi **Sổ doanh thu bán hàng hoá, dịch vụ, mẫu S1a-HKD** (theo từng nghiệp vụ hoặc theo kỳ).
- **Thông báo doanh thu thực tế của năm** cho cơ quan thuế **chậm nhất 31/01 năm sau**.
- Khi bán hàng **vẫn lập hoá đơn cho người mua**. Hoá đơn điện tử không bắt buộc, nhưng được đăng ký nếu có nhu cầu.
- Nên giữ hoá đơn đầu vào (nhôm, kính, phụ kiện) để chứng minh nguồn gốc hàng và chi phí.

### 2.3 Hộ có doanh thu trên 1 tỷ

- **Hoá đơn điện tử bắt buộc:** có mã của cơ quan thuế, hoặc khởi tạo từ máy tính tiền có kết nối dữ liệu với cơ quan thuế.
  - Nhiều địa điểm kinh doanh dùng chung mã số thuế thì phải ghi mã địa điểm trên hoá đơn.
- **Vượt ngưỡng giữa năm:** phải đăng ký hoá đơn điện tử **trong 30 ngày kể từ ngày cuối của kỳ tính thuế** có doanh thu luỹ kế trên 1 tỷ. App cần cảnh báo đúng mốc này.
- **Cách tính thuế** (theo các bài tổng hợp Nghị định 68/2026, cần đối chiếu văn bản gốc):
  - **GTGT:** tỷ lệ % × doanh thu (phương pháp trực tiếp).
  - **TNCN, doanh thu trên 1 tỷ đến 3 tỷ:** chọn một trong hai cách:
    - (doanh thu − 1 tỷ) × tỷ lệ % theo ngành;
    - (doanh thu − chi phí) × 15%.
  - **TNCN, doanh thu trên 3 tỷ:** bắt buộc tính theo thu nhập: (doanh thu − chi phí) × 17% (3–50 tỷ) hoặc 20% (trên 50 tỷ). Đã chọn cách thì giữ 2 năm liền.
  - **Kỳ khai:** theo quý, hạn là ngày cuối tháng đầu của quý sau. Trên 50 tỷ thì khai theo tháng. Quyết toán TNCN theo thu nhập: các nguồn ghi 31/3 hoặc 31/01 năm sau, **chưa thống nhất**.
- **Tỷ lệ % theo ngành cho nhôm kính** (sản xuất, gia công; xây lắp có bao thầu vật tư): các nguồn tìm được **chưa xác nhận** con số cho năm 2026. Mức quen thuộc trước đây là GTGT 3%, TNCN 1,5%. **Bắt buộc hỏi kế toán.**

### 2.4 Công cụ của cơ quan thuế

- **eTax Mobile** (miễn phí, của Cục Thuế): đăng ký thuế, khai thuế, đăng ký hoá đơn điện tử, nộp thuế, khai báo tài khoản ngân hàng và ví dùng cho kinh doanh.
- **Chưa tìm thấy** nguồn xác nhận eTax Mobile cho hộ kinh doanh **lập** hoá đơn miễn phí. Muốn xuất hoá đơn vẫn phải qua một nhà cung cấp.

## 3. Nhà cung cấp hoá đơn điện tử và chữ ký số

### 3.1 Hoá đơn điện tử có API

| Nhà cung cấp | API | Ghi chú tích hợp |
|---|---|---|
| **MISA meInvoice** | Open API REST/JSON. Tài liệu doc.meinvoice.vn/itg, cổng developer.misa.vn | Header `ClientID` (MISA cấp) + `Bearer token`. Luồng phát hành: tạo → ký → phát hành. Tham số `SignType`: 1 USB/tệp, 2 HSM, 3 HSM bất đồng bộ, 4 không ký (vé), 5 máy tính tiền không ký. Có điều chỉnh/thay thế, gửi email. Tài liệu cập nhật 15/09/2025. |
| **Viettel S-Invoice** | Webservice, tài liệu v2.46 (01/10/2025), code mẫu C#/Java | Phát hành **bất đồng bộ**: hoá đơn vào hệ thống khoảng 1 giây sau, tra cứu bằng `transactionUuid` do app tự sinh. Có gói máy tính tiền cho hộ kinh doanh. |
| VNPT Invoice | Chưa tìm được tài liệu API công khai | Cần liên hệ trực tiếp |

Giá gói **hoá đơn máy tính tiền cho hộ kinh doanh** (Viettel, đại lý niêm yết, đã gồm VAT): 300 hoá đơn 165.000 đ, 1.000 hoá đơn 404.800 đ, 5.000 hoá đơn 1.144.000 đ.

### 3.2 Chữ ký số từ xa (không cần USB token)

| Dịch vụ | Giá tham khảo (đã gồm VAT, nguồn đại lý) |
|---|---|
| **Viettel MySign**, gói hộ kinh doanh | 893.000 đ/12 tháng · 1.325.000 đ/24 tháng · 1.570.000 đ/36 tháng (viettelca.vn) |
| **VNPT SmartCA** cá nhân | 380.000 đ/12 tháng (đại lý). Gói hộ kinh doanh khuyến mại từ khoảng 100.000 đ/năm, **chưa có bảng giá chính thức** |

- Chữ ký số từ xa ký trên điện thoại (duyệt trong app của nhà cung cấp), dùng được cho cả eTax Mobile và BHXH.
- Với hoá đơn điện tử, cách phổ biến là **nhà cung cấp hoá đơn ký bằng HSM** đã đăng ký cho người bán. App chỉ gọi API phát hành, **không bao giờ chạm vào khoá ký**.

### 3.3 Nguyên tắc an toàn cho app

- **Không lưu** mật khẩu, PIN, file chữ ký số hay khoá riêng trong app hay máy chủ Eurohouse.
- Thông tin kết nối nhà cung cấp (ClientID, token) lưu theo từng xưởng, **mã hoá khi lưu**. Chỉ chủ xưởng thêm hoặc xoá được.
- Mỗi xưởng tự ký hợp đồng với nhà cung cấp, đứng tên mã số thuế của mình. Eurohouse không đứng tên hộ.
- Mọi lần phát hành hoá đơn đều ghi nhật ký: ai, lúc nào, số hoá đơn, mã tra cứu.

## 4. Dữ liệu app đang có và còn thiếu

**Đã có:**
- `CashTransaction` loại RECEIPT: phiếu thu theo công trình, tức **doanh thu thực thu**.
- `Project`: giá trị hợp đồng, quyết toán, khách hàng.
- `Quotation`: hạng mục, đơn giá, VAT. Dùng làm dòng hàng cho hoá đơn.
- `WorkshopCustomer.taxCode`: mã số thuế của khách là doanh nghiệp.
- `Order.invoiceNo`: số hoá đơn trên đơn NPP. Đây là chiều mua vào của xưởng.

**Còn thiếu:**
- Hồ sơ thuế của xưởng: mã số thuế, loại hình (hộ kinh doanh / doanh nghiệp), tên và địa chỉ đăng ký, ngành nghề (để chọn tỷ lệ %), mã địa điểm kinh doanh.
- Bảng hoá đơn bán ra.
- Quy tắc ghi nhận doanh thu cho sổ S1a-HKD: theo **hoá đơn đã lập** hay theo **tiền đã thu**. **Cần kế toán chốt.** App có thể hiện cả hai cột.

## 5. Thiết kế đề xuất

### GĐ1: Sổ doanh thu & quản lý hoá đơn (khoảng 1–1,5 tuần)

**Dữ liệu:**
- `TaxProfile` (1–1 với Organization): mã số thuế, loại hình, ngành, phương pháp tính thuế, năm áp dụng.
- `SalesInvoice`:
  - khách hàng, công trình, ngày, ký hiệu và số hoá đơn;
  - trạng thái NHÁP / ĐÃ PHÁT HÀNH / ĐIỀU CHỈNH / THAY THẾ / HUỶ;
  - tiền trước thuế, thuế, tổng;
  - nguồn: ghi tay, hoặc từ nhà cung cấp ở GĐ2.
- `SalesInvoiceLine`: lấy từ báo giá hoặc công trình.

**Màn hình** (theo mẫu giao diện Công trình / Quản lý xưởng):
1. **Doanh thu:**
   - Năm hiện tại: luỹ kế, thanh tiến độ tới 1 tỷ;
   - Số theo quý và theo tháng;
   - Cảnh báo khi đạt 80% ngưỡng, và **khi vượt ngưỡng: đếm ngược 30 ngày đăng ký hoá đơn điện tử**.
2. **Hoá đơn:** danh sách, lọc theo tháng và trạng thái, tạo hoá đơn từ công trình hoặc báo giá, nhập số hoá đơn đã xuất ở hệ thống ngoài.
3. **Báo cáo thuế:**
   - Sổ S1a-HKD;
   - Số liệu thông báo doanh thu năm (hạn 31/01);
   - Số tạm tính theo quý cho hộ trên 1 tỷ;
   - Xuất Excel/PDF gửi kế toán.

**Logic có test** (TDD như phần lương):
- luỹ kế theo kỳ và mốc vượt ngưỡng;
- hạn đăng ký 30 ngày;
- thuế tạm tính theo cả hai phương pháp. Tỷ lệ % là cấu hình, không viết cứng.

### GĐ2: Xuất hoá đơn trong app (khoảng 1–2 tuần, sau khi chọn nhà cung cấp)

- Lớp kết nối chung (`InvoiceProvider`) với 1 bản cài đặt đầu tiên. Đề xuất **MISA meInvoice**: tài liệu REST rõ, có HSM. Phương án dự phòng là Viettel S-Invoice.
- Luồng xuất:
  1. Lập hoá đơn nháp từ công trình.
  2. Kiểm tra số liệu.
  3. Gọi API phát hành, nhà cung cấp ký bằng HSM.
  4. Lưu số hoá đơn và mã tra cứu.
  5. Gửi PDF hoặc link tra cứu cho khách qua Zalo/email.
- Hỗ trợ điều chỉnh, thay thế, huỷ theo API của nhà cung cấp. Không tự sửa hoá đơn đã phát hành.
- Thử trên môi trường test của nhà cung cấp (`testapi.meinvoice.vn`) trước khi bật thật.

## 6. Câu hỏi cần chủ dự án chốt

1. Phần lớn CSSX của Eurohouse là **hộ kinh doanh** hay **doanh nghiệp**? (Quyết định sổ sách và cách tính thuế.)
2. Muốn GĐ1 trước (sổ doanh thu và quản lý hoá đơn), hay cần **xuất hoá đơn thật trong app** ngay?
3. Eurohouse hoặc các xưởng đã dùng **nhà cung cấp hoá đơn nào**? Có muốn đàm phán gói chung cho mạng lưới CSSX không?
4. Phạm vi: chỉ CSSX, hay cả NPP và Công ty dùng module này?
5. Có kế toán thuế nào để **xác nhận tỷ lệ % ngành nhôm kính** và quy tắc ghi nhận doanh thu không?

## 7. Rủi ro

- **Quy định đổi liên tục.** Ngưỡng và tỷ lệ phải là **cấu hình theo năm** trong Web Admin, không viết cứng trong code.
- **Trách nhiệm.** App hỗ trợ tính toán và lưu trữ. Số liệu khai thuế do hộ kinh doanh chịu trách nhiệm. Cần ghi rõ trong app.
- **Phụ thuộc nhà cung cấp.** Khi API thay đổi hoặc ngừng dịch vụ: thiết kế lớp kết nối tách riêng, đổi được nhà cung cấp.

## Nguồn

- Nghị định 141/2026/NĐ-CP, toàn văn: https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-so-141-2026-nd-cp-nang-nguong-doanh-thu-khong-phai-chiu-thue-len-1-ty-dong-119260504154326455.htm
- LuatVietnam, nâng ngưỡng 1 tỷ: https://luatvietnam.vn/tin-van-ban-moi/chinh-thuc-nang-nguong-doanh-thu-len-1-ty-dong-doi-voi-ho-kinh-doanh-tu-2026-186-108719-article.html
- VnEconomy: https://vneconomy.vn/ho-kinh-doanh-co-doanh-thu-duoi-1-ty-dong-chua-bat-buoc-dung-hoa-don-dien-tu.htm
- SeaBank, nghĩa vụ hộ dưới 1 tỷ: https://www.seabank.com.vn/tin-tuc/tu-van-dich-vu/tu-van--meo/5-dieu-ho-kinh-doanh-co-doanh-thu-duoi-1-ty-dong-can-luu-y-theo-quy-dinh-moi
- Nghị định 68/2026, tổng hợp: https://einvoice.vn/tin-tuc/nghi-dinh68-quan-ly-thue-vs-hkd · https://ketoanthuevision.com/nghi-dinh-so-68-2026-nd-cp-ve-chinh-sach-thue-doi-voi-ho-kinh-doanh-ca-nhan-kinh-doanh/
- Luật Thuế TNCN sửa đổi (ngưỡng 500 triệu, trước khi nâng): https://xaydungchinhsach.chinhphu.vn/thong-nhat-ho-kinh-doanh-co-doanh-thu-den-500-trieu-dong-nam-khong-phai-nop-thue-119251210100204058.htm
- Nghị định 70/2025 (hoá đơn máy tính tiền): https://tuoitre.vn/plo/go-roi-thue-khoan-va-hoa-don-dien-tu-cho-ho-kinh-doanh-109854902.htm
- eTax Mobile: https://baochinhphu.vn/huong-dan-cach-ke-khai-thue-tren-app-etax-mobile-cho-ho-kinh-doanh-102251214115009015.htm
- MISA meInvoice Open API: https://www.misa.vn/154127/tong-quan-open-api-hoa-don-dien-tu-misa-meinvoice/ · https://doc.meinvoice.vn/itg/Doc/PublishInvoice.html
- Viettel S-Invoice, tài liệu tích hợp: https://www.sinvoice.vn/p/tai-ve.html
- Viettel MySign, bảng giá: https://viettelca.vn/chu-ky-so-tu-xa-mysign-viettel · VNPT SmartCA (đại lý): https://vinaphonetphcm.com/bao-gia-chi-tiet-dich-vu-chu-ky-so-vnpt-cap-nhat-gia-moi-2025-bid1269.html
