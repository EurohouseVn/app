# Thiết kế GĐ1: Hoá đơn & thuế cho CSSX

Ngày: 18/11/2026. Căn cứ: `NGHIEN_CUU_MODULE_HOA_DON.md` và các lựa chọn của chủ dự án ngày 18/11/2026.

## Chủ dự án đã chốt

- Làm **GĐ1 cộng khung kết nối nhà cung cấp**. Khung có một bản **giả lập (Bản thử)** để chạy thử luồng phát hành. MISA hay Viettel sẽ nối khi xưởng có tài khoản API.
- Đối tượng chính là **hộ kinh doanh**. Hồ sơ thuế vẫn có lựa chọn Doanh nghiệp.
- Sổ doanh thu có **hai cột**: theo hoá đơn đã lập và theo tiền đã thu. Ngưỡng 1 tỷ tính theo cột hoá đơn. Cột tiền thu dùng để đối chiếu.
- Module đặt trong **app mobile cho CSSX**. Chưa có trang Web Admin.

## Phạm vi

**Có trong GĐ1:**

1. **Hồ sơ thuế của xưởng:**
   - mã số thuế, tên và địa chỉ đăng ký, mã địa điểm kinh doanh;
   - loại hình: hộ kinh doanh hoặc doanh nghiệp;
   - ngành: sản xuất và gia công, hoặc xây lắp có bao thầu vật tư;
   - cách tính thuế TNCN;
   - ký hiệu hoá đơn;
   - nhà cung cấp hoá đơn: Chưa dùng / Bản thử / MISA (sắp có);
   - ngày đã đăng ký hoá đơn điện tử, nếu có.
2. **Hoá đơn bán ra:**
   - **Lập:** lập nháp từ công trình (lấy khách và giá trị) hoặc lập trống. Mỗi hoá đơn có các dòng hàng.
   - **Phát hành:** nếu chọn nhà cung cấp, phát hành qua nhà cung cấp đó (GĐ1 chỉ có Bản thử). Nếu không, **ghi nhận hoá đơn đã xuất ở hệ thống ngoài** bằng ký hiệu, số và ngày.
   - **Sau phát hành:** huỷ (có lý do) và lập hoá đơn thay thế. Không sửa hoá đơn đã phát hành.
   - **Nhật ký:** ghi ai làm gì, lúc nào.
3. **Sổ doanh thu năm:**
   - 12 tháng và 4 quý, mỗi kỳ có hai cột;
   - luỹ kế tới ngưỡng 1 tỷ;
   - cảnh báo khi đạt 80% ngưỡng;
   - khi vượt ngưỡng thì báo **hạn đăng ký hoá đơn điện tử**: 30 ngày kể từ ngày cuối quý có doanh thu luỹ kế vượt.
4. **Báo cáo:**
   - **Sổ S1a-HKD** (Excel) theo năm.
   - **Số liệu thông báo doanh thu năm.** Hạn nộp 31/01 năm sau.
   - **Thuế tạm tính theo quý** khi vượt ngưỡng:
     - GTGT = tỷ lệ × doanh thu;
     - TNCN = (doanh thu − 1 tỷ) × tỷ lệ, hoặc (doanh thu − chi phí) × 15% nếu đã chọn cách tính theo thu nhập.
   - Câu nhắc đi kèm: "Số tham khảo, kế toán xác nhận trước khi khai".

**Chưa làm trong GĐ1:**
- Nối API MISA/Viettel thật.
- Gửi email hoá đơn cho khách.
- Hoá đơn đầu vào.
- Trang Web Admin cấu hình năm thuế.

## Quy tắc thuế theo năm là cấu hình

File `apps/api/src/modules/tax-invoice/tax-rules.ts` giữ bảng theo năm:
- ngưỡng (2026: 1.000.000.000 đ);
- tỷ lệ GTGT và TNCN theo ngành;
- các mức % thuế suất theo thu nhập (15 / 17 / 20%).

Mức GTGT/TNCN mặc định của nghề nhôm kính để **3% / 1,5%**, đánh dấu **"chưa xác nhận"**. Xưởng sửa được trong hồ sơ thuế. Năm sau chỉ cần thêm một dòng vào bảng. Logic tính thuế không có con số viết cứng.

## Dữ liệu (Prisma)

**`WorkshopTaxProfile`**, quan hệ 1–1 với `Organization`. Các trường:
- `taxCode`, `legalName`, `legalAddress`, `locationCode`;
- `entityType`: `HKD` hoặc `DN`;
- `businessLine`: `MANUFACTURING` hoặc `CONSTRUCTION_WITH_MATERIALS`;
- `vatRatePct?` và `pitRatePct?`: để trống thì lấy theo bảng năm;
- `pitMethod`: `REVENUE_RATE` hoặc `INCOME`;
- `invoiceSeries` (ví dụ `1C26TAP`);
- `provider`: `NONE`, `SANDBOX` hoặc `MISA`;
- `einvoiceRegisteredAt?`;
- `updatedById`.

**`WorkshopSalesInvoice`**:
- **Liên kết:** `organizationId`, `projectId?`, `customerId?`.
- **Người mua:** `buyerName`, `buyerTaxCode`, `buyerAddress`, `buyerEmail`, `buyerPhone`.
- **Ngày và số:** `issueDate`, `series`, `number?`.
- **`status`:** `DRAFT`, `ISSUED`, `CANCELLED` hoặc `REPLACED`.
- **`source`:** `PROVIDER` hoặc `EXTERNAL`.
- **Nhà cung cấp:** `provider?`, `providerRef?`, `lookupCode?`.
- **Tiền:** `subtotal`, `vatRatePct` (hộ kinh doanh = 0, tức hoá đơn bán hàng không tách thuế), `vatAmount`, `total`.
- **Huỷ và thay thế:** `replacesId?`, `cancelReason?`.
- **Khác:** `note`, `createdById`, `issuedAt?`, `cancelledAt?`.

**`WorkshopSalesInvoiceLine`**: `invoiceId`, `position`, `name`, `unit`, `quantity`, `unitPrice`, `amount`.

**`WorkshopSalesInvoiceEvent`**: `invoiceId`, `action`, `actorId`, `detail`, `createdAt`.

**Quy tắc khoá chống trùng:** `@@unique([organizationId, series, number])` khi đã có số.

**Không lưu** khoá ký, PIN hay mật khẩu chữ ký số. Khi nối MISA, thông tin ClientID/token sẽ được mã hoá lúc lưu; việc này thuộc GĐ2.

## Doanh thu ghi nhận

- **Cột hoá đơn:** `total` của các hoá đơn `ISSUED`, tính theo `issueDate`. Hoá đơn đã huỷ hay đã bị thay thế không tính; hoá đơn thay thế thì tính.
- **Cột tiền thu:** `CashTransaction` loại `RECEIPT` của các công trình thuộc xưởng, tính theo `transDate`.

## Logic có test (TDD)

File `tax-ledger.ts`, hàm thuần, không gọi CSDL:
- **`buildYearLedger`**, đầu vào: `{ year, invoices, receipts, rule, profile, today }`. Trả về:
  - doanh thu theo tháng, quý, luỹ kế;
  - % so với ngưỡng;
  - quý vượt ngưỡng;
  - hạn đăng ký và số ngày còn lại;
  - mức cảnh báo: `NONE`, `NEAR` (từ 80%), `CROSSED`, `OVERDUE`, `REGISTERED`;
  - hạn thông báo doanh thu năm.
- **`estimateTax`**, đầu vào: doanh thu luỹ kế, chi phí (nếu có), `rule`, `profile`. Trả về:
  - GTGT và TNCN tạm tính;
  - chi tiết công thức để hiện lên màn hình.
- **Kiểm tra trước khi phát hành:**
  - có mã số thuế và ký hiệu;
  - người mua có tên;
  - tổng các dòng khớp;
  - không trùng số.

## API (`/workshop/tax`, quyền FACTORY và DAILY như Quản lý xưởng)

| Việc | Đường dẫn |
|---|---|
| Hồ sơ thuế | `GET` / `PUT` `profile` |
| Sổ doanh thu năm | `GET ledger?year=2026` |
| Hoá đơn: xem, lập | `GET invoices?year=&month=&status=`, `POST invoices` |
| Hoá đơn: chi tiết, sửa nháp, xoá nháp | `GET` / `PATCH` / `DELETE` `invoices/:id` |
| Lập từ công trình | `POST invoices/from-project/:projectId` |
| Phát hành | `POST invoices/:id/issue` (qua nhà cung cấp), `POST invoices/:id/record-external` (ghi số đã xuất ngoài) |
| Huỷ, thay thế | `POST invoices/:id/cancel`, `POST invoices/:id/replace` |
| PDF | `GET invoices/:id/pdf`: bản Bản thử có dấu "KHÔNG CÓ GIÁ TRỊ PHÁP LÝ"; bản ghi ngoài là phiếu tóm tắt |
| Báo cáo | `GET reports/s1a.xlsx?year=`, `GET reports/annual-notice?year=` |

Lớp kết nối `InvoiceProvider` có hai hàm `issue(draft, profile)` và `cancel(invoice, reason)`:
- `SandboxInvoiceProvider` cấp số tăng dần theo ký hiệu và mã tra cứu `TEST-…`;
- `MisaInvoiceProvider` báo "chưa cấu hình" cho tới GĐ2.

## Màn hình mobile

- Ô mới ở trang chủ: **Hoá đơn & thuế**.
- Màn `/invoices`: bố cục theo wireframe anh chọn.
- `/invoice/[id]`: chi tiết hoá đơn.
- Form lập hoá đơn.
- `/tax-profile`: hồ sơ thuế.
- Dùng bộ `ws.tsx`.

## Câu chữ bắt buộc

Màn Báo cáo và PDF ghi: "Số liệu do app tổng hợp để tham khảo. Hộ kinh doanh chịu trách nhiệm số khai thuế; nên nhờ kế toán xác nhận tỷ lệ % theo ngành."
