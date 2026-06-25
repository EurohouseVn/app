# EUROHAUSE APP — BỘ CÂU LỆNH CHO CLAUDE CODE

> Tài liệu này chứa toàn bộ câu lệnh (prompt) để xây dựng app bằng **Claude Code**.
> Chạy lần lượt từng bước. Mỗi bước là một prompt độc lập, copy nguyên khối vào Claude Code.
> Bộ màu lấy từ logo Eurohause.

---

## BẢNG MÀU THƯƠNG HIỆU (Design Tokens)

| Token | Mã màu | Dùng cho |
|---|---|---|
| `--brand-orange` | `#FDA720` | Màu chính: nút, nhấn mạnh, khung cửa |
| `--brand-red` | `#FC0000` | Màu phụ/cảnh báo, điểm nhấn nóng |
| `--brand-black` | `#151110` | Chữ chính, icon, header tối |
| `--brand-grey` | `#A9A9A9` | Chữ phụ, đường viền, slogan |
| `--brand-white` | `#FFFFFF` | Nền |
| `--brand-orange-soft` | `#FFF3DF` | Nền nhạt cho card/section |
| `--success` | `#1E8E3E` | Trạng thái thành công |
| `--warning` | `#F4B400` | Cảnh báo (đơn chậm vàng) |
| `--danger` | `#FC0000` | Lỗi/đơn quá hạn đỏ |

Font gợi ý: **Be Vietnam Pro** (hỗ trợ tiếng Việt tốt, hiện đại) cho body; **Manrope** hoặc **Sora** cho tiêu đề.

---

## BƯỚC 0 — KHỞI TẠO DỰ ÁN & THIẾT LẬP CHUẨN

```
Tôi muốn xây dựng một hệ thống gồm 3 phần cho doanh nghiệp sản xuất nhôm cửa "Eurohause":
1. Mobile app (iOS + Android) cho thợ/đại lý/NPP — dùng React Native + Expo + TypeScript.
2. Web Admin cho nội bộ — dùng Next.js (App Router) + TypeScript + Tailwind CSS.
3. Backend API — dùng NestJS + TypeScript + PostgreSQL (Prisma ORM) + Redis.

Hãy khởi tạo monorepo dùng pnpm workspaces với cấu trúc:
- /apps/mobile  (Expo)
- /apps/admin   (Next.js)
- /apps/api     (NestJS)
- /packages/ui  (component & design tokens dùng chung)
- /packages/types (kiểu dữ liệu dùng chung giữa client & server)

Thiết lập:
- ESLint + Prettier + Husky pre-commit.
- Biến môi trường .env.example cho từng app.
- README.md mô tả cách chạy từng phần.
- Docker Compose cho PostgreSQL + Redis ở môi trường dev.

Tạo design tokens dùng chung trong /packages/ui/tokens.ts với bảng màu thương hiệu sau:
brandOrange #FDA720, brandRed #FC0000, brandBlack #151110, brandGrey #A9A9A9, white #FFFFFF, orangeSoft #FFF3DF, success #1E8E3E, warning #F4B400, danger #FC0000.
Font: Be Vietnam Pro (body), Sora (heading).
Áp dụng tokens này cho cả Tailwind config (admin) và theme React Native (mobile).

Hãy tạo toàn bộ scaffold, giải thích cấu trúc, rồi dừng lại để tôi review trước khi code nghiệp vụ.
```

---

## BƯỚC 1 — MÔ HÌNH DỮ LIỆU & DATABASE

```
Trong /apps/api, hãy thiết kế schema Prisma cho PostgreSQL với các thực thể sau cho hệ thống Eurohause. Mỗi bảng có id, createdAt, updatedAt, và soft-delete (deletedAt).

NGƯỜI DÙNG & PHÂN QUYỀN:
- User: tên đăng nhập, tên hiển thị, sđt, email, mật khẩu (hash), role (ADMIN, STAFF, NPP, DAILY/đại lý), trạng thái (active/locked), departmentId (cho nhân viên), điểm tích lũy, vị trí (lat, lng, địa chỉ text).
- Department: phòng ban (Kinh doanh, Kỹ thuật, CSKH, Kho).
- Permission & RolePermission: phân quyền theo nhóm chức năng.

HỆ NHÔM & BÁO GIÁ (lõi):
- AluSystem (hệ nhôm): tên, mô tả (vd Xingfa 55, PMA...).
- Profile (thanh nhôm): aluSystemId, mã thanh, tên, khối lượng kg/m, loại (khung/cánh/nẹp/đố).
- DoorType (loại cửa): tên (mặt tiền thủy lực, mở quay 2 cánh, mở quay 4 cánh, trượt, trượt quay, cửa sổ...), aluSystemId.
- CuttingRule (công thức cắt): doorTypeId, profileId, công thức tính chiều dài theo W (rộng) và H (cao), số lượng thanh, góc cắt, hệ số trừ hao. Lưu công thức dạng biểu thức (vd "W-50", "H/2-30").
- Accessory (phụ kiện): tên (kính, bản lề, khóa, ke góc, gioăng...), đơn vị, đơn giá mặc định.
- Project (công trình của user): userId, tên, khách hàng, địa chỉ, trạng thái, tổng tiền, tổng kg, lời/lỗ.
- Quote (báo giá): projectId, doorTypeId, kích thước W/H, số bộ, bảng cắt (JSON), tổng kg nhôm, đơn giá nhập, chi tiết phụ kiện (JSON), tổng tiền.

BẢO HÀNH & LOYALTY:
- Product: mã sản phẩm, hệ nhôm, mô tả.
- WarrantyCode: mã QR, productId, trạng thái (chưa kích hoạt/đã kích hoạt), userId kích hoạt, thông tin khách cuối, ngày kích hoạt.
- PointTransaction: userId, số điểm, loại (cộng từ bảo hành/sản lượng, trừ đổi quà), tham chiếu.
- Gift (quà): tên, ảnh, số điểm cần đổi, tồn kho, trạng thái.
- GiftRedemption: userId, giftId, trạng thái (yêu cầu/duyệt/đã gửi), địa chỉ nhận.

ĐƠN HÀNG & SẢN LƯỢNG:
- Order: từ đại lý, sản phẩm, số lượng, tổng kg, trạng thái (Mới/Tiếp nhận/Hoàn tất/Giao một phần/Hủy), nppId được gán, lịch sử trạng thái (JSON).
- SalesVolume: tổng hợp sản lượng đại lý cộng dồn cho NPP theo tháng.

NỘI DUNG & MARKETING:
- LibraryItem: loại (ảnh/kiến thức/sản phẩm), tiêu đề, nội dung, ảnh, do admin đăng.
- Campaign: chiến dịch khuyến mại, banner, ngày bắt đầu/kết thúc, đối tượng.
- PriceUpdate: cập nhật bảng giá, đẩy push khi tạo.
- Notification: push notification tới user/nhóm.
- Ticket & TicketMessage: hỗ trợ dạng thread, phân công nhân viên.

AUDIT:
- AuditLog: ghi vết mọi thao tác quan trọng (ai, làm gì, khi nào, dữ liệu cũ/mới).

Hãy viết schema.prisma đầy đủ, tạo migration đầu tiên, và seed dữ liệu mẫu: 1 admin, 4 phòng ban, 1 hệ nhôm Xingfa với vài profile và 1 loại cửa mở quay 2 cánh kèm công thức cắt mẫu. Giải thích quan hệ giữa các bảng.
```

---

## BƯỚC 2 — XÁC THỰC & PHÂN QUYỀN

```
Trong /apps/api, xây dựng module auth cho Eurohause:
- Đăng ký (chọn vai trò Đại lý hoặc NPP), đăng nhập bằng sđt/mật khẩu, JWT access + refresh token.
- Kích hoạt tài khoản qua OTP (email/SMS) — tạm thời mock OTP, để sẵn interface cho nhà cung cấp SMS sau.
- Quên mật khẩu qua OTP, giới hạn số lần (chống spam).
- 2FA tùy chọn cho tài khoản ADMIN.
- Guard phân quyền theo role + permission (RBAC), decorator @Roles và @RequirePermission.
- Rate limiting cho login/quên mật khẩu.
- Ghi AuditLog cho login/logout.

Bên admin (Next.js) và mobile (Expo): tạo màn hình đăng nhập/đăng ký dùng đúng bộ màu thương hiệu (nút màu brandOrange, nền trắng, chữ brandBlack). Lưu token an toàn (SecureStore trên mobile, httpOnly cookie trên web admin).
```

---

## BƯỚC 3 — LÕI: CÔNG CỤ TÍNH CẮT & BÁO GIÁ (QUAN TRỌNG NHẤT)

```
Đây là tính năng quan trọng nhất của Eurohause. Trong /apps/api tạo module "quoting":

1. Engine tính cắt:
   - Input: doorTypeId, kích thước phủ bì W (rộng, mm), H (cao, mm), số bộ.
   - Lấy tất cả CuttingRule của doorType đó. Mỗi rule có biểu thức công thức (vd "W-50", "H/2-30").
   - Dùng một bộ đánh giá biểu thức an toàn (KHÔNG dùng eval trực tiếp — dùng thư viện như mathjs hoặc expr-eval) để tính chiều dài cắt từ W, H.
   - Sinh "cutting list": danh sách [tên thanh, chiều dài (mm), số lượng, góc cắt].
   - Tính tổng kg nhôm = Σ (chiều dài_m × kg/m × số lượng × số bộ).

2. Tính báo giá:
   - Input thêm: đơn giá nhôm (đ/kg), danh sách phụ kiện (kính theo m², bản lề, khóa, ke góc... kèm đơn giá và số lượng).
   - Output: tiền nhôm, tiền từng phụ kiện, tổng cộng, giá thành/bộ.
   - Cho phép lưu thành Quote gắn vào Project.
   - Xuất báo giá ra PDF (dùng template có logo Eurohause, màu brandOrange).

3. API endpoints: POST /quotes/calculate (tính nhanh, không lưu), POST /quotes (lưu), GET /quotes/:id, GET /quotes/:id/pdf.

Viết unit test cho engine tính cắt với ít nhất 3 ca kiểm thử, đối chiếu kết quả thủ công.
QUAN TRỌNG: công thức cắt phải dễ cấu hình qua admin, vì đội kỹ thuật nhôm sẽ nhập/sửa công thức. Không hard-code công thức trong code.
```

```
Trong /apps/mobile, xây dựng giao diện "Tính & Báo giá":
- Bước 1: chọn Hệ nhôm → chọn Loại cửa (hiển thị icon từng loại: mặt tiền thủy lực, mở quay 2 cánh, 4 cánh, trượt, trượt quay).
- Bước 2: nhập kích thước W × H và số bộ (bàn phím số lớn, dễ thao tác).
- Bước 3: hiển thị bảng cắt tự động sinh ra (tên thanh, chiều dài, số lượng) + tổng kg nhôm nổi bật.
- Bước 4: nhập đơn giá nhôm và phụ kiện (kính, bản lề, khóa...) trong các ô rõ ràng.
- Bước 5: xem tổng báo giá, nút "Lưu vào công trình" và "Xuất PDF gửi khách".
Dùng bộ màu thương hiệu: nút chính brandOrange, tổng tiền/tổng kg dùng chữ brandBlack đậm trên nền orangeSoft. Thiết kế dạng wizard nhiều bước, có thanh tiến trình ở trên.
```

---

## BƯỚC 4 — BẢO HÀNH QR & TÍCH ĐIỂM

```
Xây dựng tính năng bảo hành QR cho Eurohause:

Backend (/apps/api):
- Admin sinh hàng loạt WarrantyCode (mã QR duy nhất) theo lô sản phẩm, xuất file để in.
- API kích hoạt: POST /warranty/activate { code, customerInfo } — kiểm tra mã tồn tại, chưa kích hoạt, gán userId người quét, lưu thông tin khách cuối, đổi trạng thái, cộng PointTransaction theo cấu hình.
- Chống kích hoạt trùng.

Mobile (/apps/mobile):
- Màn hình quét QR dùng camera (expo-camera / expo-barcode-scanner).
- Sau khi quét: form nhập thông tin khách hàng + công trình → xác nhận kích hoạt → hiển thị "Đã kích hoạt + nhận X điểm".
- Lịch sử bảo hành đã kích hoạt.
Giao diện dùng brandOrange cho nút quét, hiệu ứng thành công màu success.
```

---

## BƯỚC 5 — KHU LÀM VIỆC CÁ NHÂN & LOYALTY

```
Xây dựng "Khu làm việc cá nhân" trong mobile cho Eurohause:
- Dashboard cá nhân: thẻ tổng quan (số công trình, doanh số, lời/lỗ năm nay, điểm tích lũy) — dùng card nền orangeSoft, số liệu brandBlack.
- Danh sách công trình: lọc theo trạng thái, xem chi tiết (báo giá, ảnh, thu-chi).
- Sổ thu-chi đơn giản theo công trình; biểu đồ doanh số & lời/lỗ theo tháng/năm (dùng victory-native hoặc react-native-chart-kit, màu cột brandOrange).
- Ví điểm: số dư, lịch sử cộng/trừ điểm.
- Khuyến mại hàng tháng dành cho user.

Loyalty & đổi quà:
- Backend: cấu hình tỉ lệ điểm; danh mục Gift; user gửi GiftRedemption khi đủ điểm; admin duyệt và cập nhật trạng thái gửi quà; trừ điểm khi duyệt.
- Mobile: màn hình "Đổi quà" — lưới quà tặng kèm số điểm cần, nút "Đổi" (disable nếu chưa đủ điểm), theo dõi trạng thái đổi quà.
```

---

## BƯỚC 6 — THƯ VIỆN NỘI DUNG, CHÍNH SÁCH GIÁ & PUSH

```
Xây dựng cho Eurohause:

Thư viện nội dung (chỉ Admin đăng):
- Backend: CRUD LibraryItem (loại ảnh/kiến thức/sản phẩm), upload ảnh lưu trên server (multer, lưu thư mục uploads hoặc volume), trả URL.
- Mobile: 3 tab thư viện (Ảnh / Kiến thức / Sản phẩm), dạng lưới ảnh, xem chi tiết, nút tải ảnh về máy.

Chính sách giá & khuyến mại + Push:
- Backend: khi admin tạo PriceUpdate hoặc Campaign → tự động tạo Notification và gửi push qua FCM tới nhóm đối tượng.
- Mobile: nhận push (expo-notifications), màn hình "Thông báo", banner khuyến mại hiển thị ở trang chủ.
- Admin: trang quản lý bảng giá, chiến dịch (upload banner), gửi thông báo.
Dùng bộ màu thương hiệu nhất quán.
```

---

## BƯỚC 7 — ĐƠN HÀNG, VAI TRÒ NPP & SẢN LƯỢNG

```
Xây dựng module đơn hàng & sản lượng cho Eurohause:
- Đại lý đặt hàng → hệ thống tìm NPP gần nhất theo vị trí (trong bán kính cấu hình); nếu đơn > ngưỡng tấn hoặc đại lý vượt sản lượng/tháng thì gán cho công ty.
- Trạng thái đơn: Mới → Tiếp nhận → Hoàn tất / Giao một phần / Hủy, có lịch sử và quy tắc nhắc màu (xanh 3 ngày, vàng 7, đỏ 15 — cấu hình được).
- Sản lượng tiêu thụ của đại lý tự cộng dồn cho NPP phụ trách (SalesVolume theo tháng).
- Mobile: màn đặt hàng cho đại lý, màn quản lý đơn cho NPP (lọc theo trạng thái/thời gian, màu nhắc hạn).
- Admin: danh sách đơn toàn hệ thống, thống kê tổng đơn/khối lượng/doanh thu theo NPP.
```

---

## BƯỚC 8 — WEB ADMIN & KẾT NỐI PHÒNG BAN

```
Hoàn thiện Web Admin (/apps/admin) cho Eurohause với sidebar điều hướng, dùng bộ màu thương hiệu (sidebar nền brandBlack, mục active brandOrange):
- Dashboard tổng: số kho/đơn/user, biểu đồ tăng trưởng (line) và tương quan (pie), xuất Excel.
- Quản lý người dùng & phân quyền theo PHÒNG BAN (Kinh doanh, Kỹ thuật, CSKH, Kho) — mỗi phòng ban thấy & xử lý phần việc của mình; admin thấy tất cả.
- Quản lý hệ nhôm/profile/loại cửa/công thức cắt (giao diện cho đội kỹ thuật nhập công thức dễ dàng, có xem trước kết quả tính thử).
- Quản lý sản phẩm, mã bảo hành (sinh & xuất QR để in), quà tặng & duyệt đổi quà.
- Quản lý đơn hàng, chiến dịch, bảng giá, thư viện nội dung.
- Hệ thống ticket: phân công nhân viên theo phòng ban, trả lời dạng thread.
- Trang Audit log.
Kết nối phòng ban: mỗi ticket/đơn/yêu cầu có thể chuyển giữa các phòng ban, kèm thông báo cho phòng ban nhận.
```

---

## BƯỚC 9 — BẢO MẬT, KIỂM THỬ & TRIỂN KHAI

```
Hoàn thiện cho Eurohause:
Bảo mật: 2FA cho admin, rate limiting toàn cục, validation đầu vào (class-validator), bảo vệ chống SQL injection (Prisma đã an toàn), CORS đúng, helmet, mã hóa dữ liệu nhạy cảm.
Kiểm thử: unit test cho engine tính cắt và logic điểm; e2e test cho luồng đăng nhập, báo giá, kích hoạt bảo hành.
Triển khai (Phương án B — tách VPS App và VPS Database, dùng VPS Việt Nam):
- Viết Dockerfile cho api và admin.
- docker-compose.prod.yml: API + Admin trên VPS App; PostgreSQL + Redis trên VPS Database riêng.
- Hướng dẫn cấu hình Nginx reverse proxy + SSL (Let's Encrypt/certbot).
- Script backup PostgreSQL hàng ngày (pg_dump) + cron.
- Hướng dẫn build app mobile và publish lên App Store / Google Play (EAS Build của Expo).
- File DEPLOY.md mô tả toàn bộ quy trình.
```

---

## MẸO KHI DÙNG CLAUDE CODE

1. **Chạy tuần tự** từng bước; review xong mới sang bước sau.
2. Sau mỗi bước, yêu cầu: *"Chạy lint và test, sửa lỗi nếu có, rồi tóm tắt những gì đã tạo."*
3. Khi cần sửa: mô tả rõ file và hành vi mong muốn, đính kèm thông báo lỗi nếu có.
4. **Dữ liệu hệ nhôm & công thức cắt**: chuẩn bị sẵn bảng Excel (mã thanh, kg/m, công thức) trước khi tới Bước 3 — đây là yếu tố quyết định độ chính xác.
5. Giữ bộ màu thương hiệu nhất quán: luôn nhắc Claude Code dùng design tokens trong `/packages/ui/tokens.ts`.
