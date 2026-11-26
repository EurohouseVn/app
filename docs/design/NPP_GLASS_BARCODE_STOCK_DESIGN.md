# Thiết kế: Kính, mã vạch và kiểm kê bằng điện thoại cho web NPP

Ngày: 2026-11-25. Trạng thái: **đã duyệt**. Tiến độ: giai đoạn 1 (mã đầu, kho kính theo mã vạch, in nhãn) xong, commit 033554f và 2629b5c; giai đoạn 2 (tính hướng cắt, chốt cắt, tấm dư, sổ kính) xong; giai đoạn 3 (thiết bị 2 máy tính + 3 điện thoại, PWA, quét camera, kiểm kê nhiều máy, trạm in) xong, chưa thử camera trên điện thoại thật; giai đoạn 4 (đọc đơn viết tay, hóa đơn in) xong phần ghép danh mục, bản nháp, xác nhận bắt buộc, học từ điển, tạo đơn và nhập kho; **chưa chạy mô hình đọc ảnh thật** (cổng `OCR_SERVICE_URL` để trống thì chỉ nhập tay có gợi ý) và chưa có dòng kính/phụ kiện trong phiếu nhập.
Phạm vi: `apps/npp` và các route `npp/*` trong `apps/api/src/modules/inventory`. NPP là khu độc lập (xem ghi nhớ NPP boundary): mọi bảng mới gắn `nppOrgId`, không dùng chung bảng Workshop OS, chỉ mượn mẫu thiết kế.

## 1. Quyết định của chủ dự án (đã chốt)

1. Mã vạch: nhà phân phối tự đặt **mã đầu**; **phần số sau tự sinh từ kích thước**, nhìn mã là biết kích thước.
2. Quét bằng **camera điện thoại**, không cần máy quét riêng. Web NPP cài được như ứng dụng, đăng nhập **song song 1 máy tính + tối đa 3 điện thoại**. Điện thoại quét thì tự lưu vào kho.
3. Chụp phiếu/đơn hàng của nhà cung cấp, hệ thống tự đọc số liệu và nhập vào tồn kho đã thiết lập sẵn.
4. In nhãn **từ trình duyệt** hoặc **bấm in từ điện thoại**.

## 2. Hiện trạng cần thay (đã đọc mã)

- `apps/npp/app/glass/page.tsx` + `inventory.service.ts::planNppGlassCut`: chỉ tính xếp hàng ngang trên **một** tấm, không lề cắt, không trừ tồn, không lưu phương án, không sinh tấm dư.
- Bảng `NppGlassSheet`: mã tự do, không có độ dày, không có vị trí, không có sổ nhập xuất.
- `NppAccessory`: sửa số lượng bằng ghi đè (PATCH `quantity`), không có lịch sử.
- Không có mã vạch/QR ở phía NPP. Phía API có `NestingEngine` (xếp hàng ngang đơn giản) nhưng chưa dùng cho kính NPP.
- Đăng nhập là JWT 7 ngày không trạng thái (`auth.module.ts`): chưa đếm hay thu hồi được thiết bị.
- Nhà cung cấp AI hiện tại (`ai-provider.ts`, cầu nối muse.ai) **chỉ nhận chữ, không nhận ảnh** → chưa đọc được ảnh phiếu. Xem mục 7.

## 3. Quy tắc mã vạch

Dạng: `{MÃ ĐẦU}-{RỘNG}-{CAO}`, kích thước tính bằng mm, 4 chữ số, đệm số 0.

| Ví dụ | Nghĩa |
|---|---|
| `CL8-2440-3660` | mã đầu CL8 (ví dụ: cường lực 8 mm), tấm 2440 × 3660 mm |
| `CL8-0600-0900` | cùng loại, tấm 600 × 900 mm |

- **Mã đầu** do NPP tự đặt trong Cài đặt: 2–6 ký tự A–Z, 0–9, không trùng trong cùng NPP, kèm nhãn mô tả (loại kính, độ dày, màu). Một mã đầu = một loại kính. Có thể tắt, không xóa nếu đã có tồn.
- **Số sinh tự động**: không ai gõ tay. Nhập kích thước là ra mã. Cạnh ngắn ghi trước (`0600-0900`, không có `0900-0600`) để một kích thước chỉ có một mã.
- Giới hạn mỗi cạnh 1–9999 mm. Kích thước lẻ làm tròn lên mm gần nhất khi tạo mã.
- Ký hiệu in: **Code 128** (đọc tốt bằng camera, có chữ và dấu gạch). Dưới mã vạch in chữ lớn kích thước dễ đọc bằng mắt (`2440 x 3660 mm`).
- Mã là mã **loại hàng** (mã đầu + kích thước), không phải số sê-ri từng tấm. Quét thêm một tấm cùng mã = cộng 1. Nhãn cho tấm cắt riêng cho một đơn in thêm dòng chữ mã đơn, không đổi mã vạch. (Chủ dự án xác nhận ở mục 8.)
- Hàm sinh/đọc mã là logic thuần, viết test trước (TDD): sinh, đọc ngược, chuẩn hóa cạnh ngắn, từ chối vượt giới hạn.

## 4. Mô hình dữ liệu (thêm mới, migration trong `apps/api/prisma/migrations`)

| Bảng | Vai trò |
|---|---|
| `NppBarcodeScheme` | `nppOrgId`, `prefix`, `label`, `glassType`, `thicknessMm`, `active`; duy nhất `(nppOrgId, prefix)` |
| `NppGlassStock` | thay cho `NppGlassSheet`: `(nppOrgId, schemeId, widthMm, heightMm, kind SHEET/REMNANT/CUT_PIECE, location)` → `quantity`, `unitCost`; có cột `barcode` suy ra được. Dữ liệu cũ chuyển sang mã đầu `OLD` |
| `NppGlassMovement` | sổ nhập xuất bất biến: `type` (RECEIVE, ISSUE, CUT, REMNANT_IN, ADJUST, SCRAP), số lượng, nguồn (phiếu nhập, phương án cắt, đợt kiểm kê), `deviceSessionId`, `idempotencyKey` duy nhất → quét lặp, mất mạng gửi lại không bị cộng đôi |
| `NppCutPlan` | phương án cắt: trạng thái `DRAFT/CONFIRMED/CANCELLED`, đơn/công trình liên quan, kết quả xếp (JSON), hao hụt |
| `NppStocktake` + `NppStocktakeScan` | đợt kiểm kê (nhiều điện thoại cùng quét) và từng lần quét |
| `NppDeviceSession` | `userId`, `deviceKind` (DESKTOP/PHONE), tên máy, `jti`, `lastSeenAt`, `revokedAt` |
| `NppReceiptDraft` | ảnh phiếu (qua `StorageObject`), kết quả đọc (JSON), `DRAFT/CONFIRMED/REJECTED` |

Phụ kiện và nhôm giữ bảng hiện tại ở giai đoạn này (gộp vào kho thống nhất ở giai đoạn sau).

## 5. Tính phương án cắt kính (thay `planNppGlassCut`)

- Xếp hình chữ nhật 2D kiểu **guillotine** (cắt suốt từ mép này sang mép kia, đúng cách cắt kính thật), **nhiều tấm**, có tham số **lề cắt** (hao mạch) và **mép bỏ** mỗi cạnh do NPP cài. Cho xoay 90 độ trừ khi kính có vân/hoa.
- **Dùng tấm dư trước**: duyệt các tấm `REMNANT` cùng mã đầu từ nhỏ đến lớn, đủ chỗ thì dùng, rồi mới mở tấm nguyên.
- Chỉ lưu `DRAFT` khi tính. Bấm **Chốt cắt** mới ghi sổ trong một giao dịch: trừ tấm đã dùng, cộng **tấm dư** đủ lớn (ngưỡng tối thiểu cài được, mặc định 300 × 300 mm) với mã đúng quy tắc mục 3, đánh dấu tấm dư vào nhãn in. Chốt hai lần không cộng trừ hai lần.
- Logic xếp là hàm thuần có test: hết khổ, quá lớn, xoay, lề cắt, ưu tiên tấm dư, hao hụt tối thiểu so với phương án cũ.

## 6. Quét bằng điện thoại, cài đặt, đăng nhập song song

- **PWA**: thêm manifest + service worker cho `apps/npp` để "Thêm vào màn hình chính". Trang dành cho điện thoại: Quét, Kiểm kê, Chụp phiếu, In nhãn.
- **Camera**: dùng `BarcodeDetector` khi có (Chrome Android), nếu không có thì dùng bộ đọc ZXing chạy bằng WebAssembly (Safari iPhone). Camera chỉ chạy khi mở trang HTTPS, chỉ tải bộ đọc khi vào màn Quét. Quét xong rung nhẹ và phát tiếng bíp.
- **Hạn mức thiết bị**: mỗi lần đăng nhập tạo `NppDeviceSession` và nhúng `jti` vào JWT; guard của route `npp/*` kiểm tra phiên còn hiệu lực. Mỗi NPP tối đa **1 máy tính + 3 điện thoại** cùng lúc. Điện thoại thứ 4 đăng nhập thì hiện danh sách máy đang dùng để chọn gỡ một máy (có nút "Đăng xuất máy này" ở Cài đặt). Thu hồi được ngay, không đợi 7 ngày.
- **Kiểm kê nhiều máy**: máy tính mở một đợt kiểm kê, các điện thoại tham gia, mỗi lần quét gửi một bản ghi có `idempotencyKey` (mã máy + số thứ tự). Màn hình máy tính cập nhật số đếm gần thời gian thực (hỏi lại 3 giây/lần). Cuối đợt hiện bảng so sánh số quét với số trong hệ thống; chỉ khi người dùng bấm **Áp dụng** mới ghi các dòng điều chỉnh vào sổ.
- **Mất mạng**: điện thoại lưu hàng đợi quét trong thiết bị và gửi lại khi có mạng (theo mẫu `syncOperationsQueue` bên app).
- Nhập/xuất nhanh: chọn "Nhập" hoặc "Xuất" rồi quét từng tấm, cuối cùng bấm Xong ra một phiếu.

## 7. Chụp đơn viết tay của thợ (và phiếu nhà cung cấp), tự đọc thành đơn nháp

**Cập nhật 2026-11-25:** ảnh mẫu chủ dự án gửi là **đơn viết tay của thợ** (xưởng) gửi NPP, không phải phiếu nhà cung cấp. Vì vậy luồng chính của giai đoạn 4 là **ảnh đơn viết tay → đơn nháp "tạo đơn cho thợ"** (cùng đường với `createManualFactoryOrder` và `orders/new` hiện có), chứ không phải phiếu nhập kho. Phiếu in của nhà cung cấp (nếu có) vẫn đi luồng phiếu nhập như mô tả dưới đây. Đặc điểm của đơn viết tay:

- Tiêu đề nhóm ghi **màu nhôm** (Xám Ngọc Trai, Cẩm Lai, Cafe Metalic...) → khớp `ALUMINUM_COLORS` / `colorCode`; tiêu đề nhóm có thể ghi **hệ nhôm** (ECS, E70, Plus) → khớp hệ trong catalog.
- Mỗi dòng: tên thanh viết tắt + số lượng kèm đơn vị **bó** hoặc **cây**; đôi khi có mã (ECS01, E70KT). Quy đổi bó → cây theo `barsPerBundle` của thanh.
- Cụm như "Hàng cần gấp" → ghi chú ưu tiên của đơn.
- Viết tắt (KB, T, C19, "Kbao 55", "Sập"...) tra bảng từ viết tắt do NPP tự thiết lập (Cài đặt) và khớp mờ với danh mục thanh nhôm; dòng không khớp được thì để người dùng chọn.
- **Phiếu nhập kho** là **hóa đơn in** của nhà cung cấp (chủ dự án xác nhận 2026-11-25): đọc bằng OCR chữ in, dễ hơn đơn viết tay. Nếu nhà cung cấp có hóa đơn điện tử thì nhập thẳng từ tệp XML/PDF, không qua OCR. Mỗi nhà cung cấp lưu một mẫu cột sau lần xác nhận đầu.
- Kết quả đơn viết tay là **đơn nháp có kiểm tồn**: mỗi dòng hiện tồn hiện có của NPP và báo thiếu trước khi xác nhận; người dùng sửa rồi mới bấm tạo đơn.

Luồng: chụp (hoặc tải ảnh) → máy chủ gửi ảnh cho dịch vụ đọc → ra **phiếu nhập nháp** (từng dòng: mô tả, kích thước, số lượng, đơn giá, mã đầu đoán được, mức tin cậy) → người dùng xem và sửa → bấm **Xác nhận nhập kho** thì mới ghi sổ.

- **Không tự ghi thẳng vào kho.** Đọc ảnh có thể sai chữ số, mà sai số trong kho kéo theo công nợ và báo cáo. Dòng tin cậy cao được tích sẵn, một chạm là xong; dòng tin cậy thấp tô đỏ.
- Ghép dòng với danh mục đã cài: khớp mã đầu theo từ khóa ("cường lực 8" → `CL8`), khớp kích thước, khớp tên phụ kiện. Dòng chưa khớp được cho chọn mã hoặc tạo mới.
- **Vướng thực tế:** bộ AI hiện có (muse.ai qua cầu nối) không nhận ảnh. Cần một dịch vụ đọc ảnh, có hai hướng: (a) API có khả năng đọc ảnh (trả phí theo lượt, rẻ, đọc bảng và tiếng Việt có dấu tốt); (b) tự chạy OCR trên máy chủ nhà (miễn phí nhưng đọc bảng và dấu tiếng Việt kém hơn, tốn công chỉnh). Đề xuất (a), cần khóa API do chủ dự án tự nhập vào cấu hình trên MINI 02.
- Ảnh phiếu là dữ liệu kinh doanh gửi ra dịch vụ bên ngoài: phải cập nhật chính sách quyền riêng tư và có công tắc bật/tắt cho từng NPP.
- Ảnh lưu qua `StorageObject` để đối chiếu về sau; có hạn giữ.

## 8. In nhãn

- **Từ trình duyệt**: trang in dùng CSS `@page` đúng khổ tem (cài khổ trong Cài đặt: mặc định 50 × 30 mm, hoặc theo máy in của NPP), mã vạch vẽ bằng SVG (Code 128) nên nét và không phụ thuộc phông. In một nhãn hoặc nhiều nhãn (nhập số lượng).
- **Từ điện thoại**: nút In dùng chức năng in của hệ điều hành. Máy in tem có nhiều loại không in được trực tiếp từ điện thoại, nên có thêm **Trạm in**: điện thoại bấm In thì lệnh vào hàng đợi trên máy chủ, máy tính đang mở trang Trạm in tự in ra máy in nối với nó (cần mở Chrome với tùy chọn in thẳng, không hiện hộp thoại). Cách này chạy với mọi máy in có driver Windows.
- Cần xác nhận khổ tem và hãng máy in trước khi làm chi tiết, vì ảnh hưởng cỡ chữ và độ rộng vạch.

## 9. Chia giai đoạn (mỗi giai đoạn đưa lên dùng được độc lập)

1. **Mã đầu + quy tắc mã + kho kính mới + in nhãn bằng trình duyệt.** (Hàm sinh mã, bảng mới, màn hình Cài đặt mã đầu, nhập tấm kính, in nhãn.)
2. **Tính phương án cắt mới + chốt cắt + tấm dư + sổ nhập xuất kính.**
3. **PWA + phiên thiết bị (1 máy tính + 3 điện thoại) + quét bằng camera + kiểm kê nhiều máy + Trạm in.**
4. **Chụp phiếu nhà cung cấp → phiếu nhập nháp → xác nhận.**

Kiểm thử: logic thuần (sinh/đọc mã, xếp cắt, hạn mức thiết bị, quét lặp) viết test trước; màn hình kiểm bằng trình duyệt thật, camera kiểm trên điện thoại thật; chạy `pnpm test` và `tsc` của `apps/api` và `apps/npp` trước khi báo xong.

Triển khai: migration chạy khi chủ dự án deploy lên MINI 02 (không có Render, push GitHub không deploy). Hiện chưa có người dùng NPP thật nên rủi ro di chuyển dữ liệu thấp, vẫn phải sao lưu DB trước khi chạy migration.

## 10. Quyết định đã xác nhận (2026-11-25)

1. Mã = loại hàng + kích thước, không có số sê-ri từng tấm. **Đã đồng ý.**
2. Mã đầu gắn với loại kính + độ dày (một mã đầu một loại). **Đã đồng ý.**
3. Hạn mức thiết bị: tối đa **2 máy tính + 3 điện thoại** đăng nhập cùng lúc.
4. Máy in tem: **chưa chọn**, trao đổi sau. Giai đoạn 1 làm khổ tem cài được, không phụ thuộc hãng.
5. Đọc phiếu: **ưu tiên tự chạy OCR mã nguồn mở trên máy chủ nhà**; chỉ dùng API trả phí nếu OCR tự chạy quá yếu với tiếng Việt. Kết quả khảo sát: xem `NPP_OCR_EVALUATION.md`.
