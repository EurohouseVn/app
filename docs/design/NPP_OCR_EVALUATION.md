# Đánh giá OCR đọc phiếu nhà cung cấp cho web NPP

Ngày: 2026-11-25. Mục đích: chọn cách đọc ảnh phiếu/đơn hàng nhà cung cấp (tiếng Việt, ảnh chụp bằng điện thoại) để tạo phiếu nhập nháp ở giai đoạn 4 của `NPP_GLASS_BARCODE_STOCK_DESIGN.md`.

**Mức bằng chứng:** đây là khảo sát tài liệu và trang chính thức, **chưa chạy thử trên phiếu thật của anh**. Chưa có số đo độ chính xác tiếng Việt cho từng công cụ trên phiếu giao hàng; kết luận cuối phải dựa trên bài thử ở mục 5.

## 1. Các lựa chọn mã nguồn mở

| Công cụ | Giấy phép | Tiếng Việt | Chạy trên CPU | Nhận xét |
|---|---|---|---|---|
| **Tesseract** (`vie`) | Apache 2.0 | Có gói `vie`, đủ dấu | Nhanh (khoảng 0,4 giây/trang trong một thử nghiệm hóa đơn) | Tốt với ảnh scan thẳng, sạch. Kém với ảnh chụp nghiêng, tối, nhàu, bảng nhiều cột. Không hiểu cấu trúc bảng |
| **PaddleOCR** (PP-OCRv5) | Apache 2.0 | **Có `vi` nhưng dấu yếu**: bộ ký tự chính thức của các mô hình Latin thiếu phần lớn chữ có dấu (nhiều nguồn đếm chỉ khoảng 35–46 trong 134 chữ có dấu tiếng Việt). Một đo đạc cho CER khoảng 16–20% trên bài thi tiếng Việt | Được (khoảng 10 giây/trang trên 1 nhân CPU trong một thử nghiệm) | Phát hiện vùng chữ và đọc số rất ổn định trên ảnh xấu. Có bản tinh chỉnh cộng đồng (`Vphuc/PP-OCRv5-mobile-rec-vi`) nhưng còn dang dở |
| **VietOCR** | Apache 2.0 | Chuyên tiếng Việt, đủ dấu; tác giả nêu độ chính xác khoảng 88% (chuỗi đúng hoàn toàn) trên bộ dữ liệu riêng | Được | **Chỉ nhận dạng, không tự tìm vùng chữ**; thường ghép với bộ phát hiện của PaddleOCR. Một bài báo về hóa đơn Việt cho VietOCR đọc sạch tốt nhất, PaddleOCR bền nhất khi ảnh xấu. Chưa rõ lần cập nhật gần nhất |
| **PaddleOCR-VL** (0,9B) | Apache 2.0 | Nêu "109 ngôn ngữ", **trang mô hình không liệt kê tiếng Việt** | Có chạy được nhưng chậm, không có số liệu chính thức | Hiểu cả bảng và bố cục, đầu ra có cấu trúc. Phải thử mới biết dấu |
| **Qwen3-VL** (2B/4B/8B) | Apache 2.0 | Tài liệu chính thức nêu OCR 32 ngôn ngữ, **không liệt kê cụ thể**; tuyên bố chịu được ảnh mờ, thiếu sáng, nghiêng | 4B/8B trên CPU rất chậm; hợp với GPU | Có thể đọc thẳng ảnh ra JSON (mã, kích thước, số lượng). Là hướng có khả năng cao nhất nếu có GPU |

## 2. Ba điều rút ra

1. **Không công cụ nào đủ bằng chứng để tin ngay là đọc tiếng Việt tốt trên phiếu chụp điện thoại.** PaddleOCR bản chuẩn có điểm yếu rõ về dấu. Phải thử trên phiếu thật.
2. **Phiếu nhập kho chủ yếu cần SỐ và MÃ, không cần dấu.** Kích thước, số lượng, đơn giá, mã hàng đều là chữ số và chữ Latin không dấu. Tên hàng ("kính cường lực 8 ly") chỉ dùng để khớp với mã đầu đã cài, mà việc khớp có thể bỏ dấu cả hai bên ("kinh cuong luc 8"). Nên lỗi dấu của PaddleOCR ít ảnh hưởng hơn vẻ ngoài.
3. **Phần cứng quyết định lựa chọn.** R620 dùng chip E5-2640 v1 (không có tập lệnh AVX2) nên chạy mô hình ngôn ngữ-thị giác trên CPU rất chậm. Máy Lenovo (Gold 6138) mạnh hơn trên CPU, và nếu có card đồ họa thì chạy được Qwen3-VL. **Chưa biết Lenovo có card đồ họa không.**

## 3. Đề xuất kiến trúc (không phụ thuộc kết quả thử)

Dựng một dịch vụ OCR chạy nền riêng (container), API chính chỉ gọi nội bộ. Trình tự mỗi ảnh:

1. Làm thẳng, tăng tương phản, cắt viền.
2. Đọc chữ bằng PaddleOCR (phát hiện vùng + đọc), kèm VietOCR đọc lại các ô nghi ngờ.
3. Bỏ dấu, chuẩn hóa chữ số, ghép dòng bảng theo cột bằng vị trí.
4. Khớp với danh mục của NPP (mã đầu, tên phụ kiện). Mỗi dòng có điểm tin cậy.
5. Ra **phiếu nhập nháp**; người dùng xem và xác nhận (không tự ghi vào kho).

Phương án thay thế nếu Lenovo có GPU: một mô hình ngôn ngữ-thị giác (Qwen3-VL 8B hoặc PaddleOCR-VL) đọc thẳng ảnh ra JSON, rồi cùng bước khớp danh mục ở trên.

## 4. API trả phí để so sánh (đơn vị: USD cho 1 triệu token)

Giá lấy từ trang chính thức của Google (aistudio.google.com/docs/pricing) và bảng giá của Anthropic đã cache trong công cụ, đọc ngày 2026-11-25. Giá có thể đổi.

| Dịch vụ | Mô hình | Vào | Ra | Ghi chú |
|---|---|---|---|---|
| Anthropic | Haiku 5.5 | 0,10 (tới 100K token) | 0,50 | Rẻ nhất trong nhóm; giảm 50% nếu chạy theo lô |
| Anthropic | Sonnet 5.5 | 2,00 | 10,00 | Đọc bảng khó tốt hơn |
| Google | Gemini 3.5 Flash-Lite | 0,30 | 2,50 | Lô: 0,15 / 1,25 |
| Google | Gemini 3.1 Flash-Lite | 0,25 | 1,50 | Lô: 0,125 / 0,75 |
| Google | Gemini 3.8 Flash | 0,75 đến 31/12/2026, sau đó 1,50 | 3,75, sau đó 7,50 | Lô giảm 50% |

- Google có bậc **miễn phí**, nhưng dữ liệu ở bậc miễn phí **được dùng để cải thiện sản phẩm** của Google. Không nên dùng cho phiếu mua bán của khách. Phải dùng bậc trả phí.
- **Ước lượng một ảnh phiếu** (ảnh khoảng 1.500 token, lời nhắc khoảng 500 token, kết quả JSON khoảng 800 token; số token ảnh là ước lượng của tôi, chưa kiểm với tài khoản thật):
  - Haiku 5.5: khoảng 0,0006 USD/phiếu, cỡ 15 đồng.
  - Sonnet 5.5: khoảng 0,012 USD/phiếu, cỡ 300 đồng.
  - 100 phiếu/tháng: Haiku khoảng 0,06 USD, Sonnet khoảng 1,2 USD, tức dưới 35.000 đồng.
- Chi phí API là không đáng kể so với công sức tự xây. Lý do để tự chạy là **dữ liệu không rời máy chủ nhà** và không phụ thuộc nhà cung cấp, không phải tiết kiệm tiền.

## 5. Bài thử cần làm trước khi chốt (giai đoạn 4)

1. Anh gửi 10–20 ảnh phiếu thật (che thông tin nhạy cảm nếu muốn): đủ loại phiếu giao hàng kính, phiếu phụ kiện, chụp bằng điện thoại ở nhiều điều kiện.
2. Tôi tự chép tay đáp án đúng cho từng ảnh (kích thước, số lượng, đơn giá, mã hàng).
3. Chạy Tesseract, PaddleOCR (bản chuẩn và bản tinh chỉnh tiếng Việt), VietOCR ghép PaddleOCR, và nếu máy có GPU thì Qwen3-VL/PaddleOCR-VL.
4. Đo: tỉ lệ dòng đúng hoàn toàn, tỉ lệ ô số đúng (quan trọng nhất), thời gian mỗi ảnh trên R620 và trên Lenovo.
5. Ngưỡng chọn: nếu **ô số đúng ≥ 95% và mỗi ảnh dưới 60 giây** thì dùng OCR tự chạy với bước xác nhận. Dưới ngưỡng thì dùng API (Haiku 5.5 hoặc Gemini Flash-Lite trả phí) cho riêng bước đọc, vẫn giữ bước xác nhận.

## 6. Ảnh mẫu thật chủ dự án đã gửi (2026-11-25)

Bốn ảnh, đều là **giấy viết tay trên vở kẻ ngang**, chụp bằng điện thoại, không phải phiếu in của nhà cung cấp. Nội dung là danh sách hàng viết tắt theo nhóm màu (Xám Ngọc Trai, Cẩm Lai, Cafe Metalic...) và hệ nhôm (ECS, E70, Plus): tên thanh, số lượng kèm đơn vị "bó" hoặc "cây", có chỗ ghi mã (ECS01, ECS03, E70KT), có chỗ viết tắt (KB, T, C19, Kbao 55).

Hệ quả:

1. **Tesseract và PaddleOCR bản chuẩn gần như chắc chắn đọc hỏng chữ viết tay** (chúng thiết kế cho chữ in). VietOCR có huấn luyện cả chữ viết tay nhưng chưa có số đo cho kiểu chữ này. Hướng khả thi duy nhất cho loại giấy này là **mô hình ngôn ngữ-thị giác** (Qwen3-VL, PaddleOCR-VL) hoặc API đọc ảnh. Chưa chạy thử mô hình nào trên máy chủ nhà, nên chưa có số đo.
2. **Chữ khó đọc ngay cả với người.** Khi xem ảnh bằng mô hình thị giác của Claude, các dòng số lượng và mã đọc khá rõ (4 bó, 2 bó, ECS01, ECS03), còn vài chữ không chắc chắn: nhãn bên trái ảnh 1 ("Giờ thác"?), "Nối tường", "Chân sống Φ28", "Chữa/Chìa" ở ảnh 3, "ES0150" ở ảnh 2, "C18 53" ở ảnh 4. Vì vậy **phải có bước xác nhận của người dùng**, không tự ghi thẳng vào kho.
3. **Từ viết tắt là phần khó nhất.** KB, T, C19, "Kbao 55", "Sập", "Đế sập" chỉ có nghĩa trong ngữ cảnh xưởng. Ảnh 4 còn có chú thích đỏ "kb200 TL" do người khác thêm để giải nghĩa. Cần một **bảng từ viết tắt** do NPP tự thiết lập (KB = khung bao, T = thanh T...) cộng với danh mục thanh nhôm của Eurohouse (mã và tên chính thức) để khớp mờ. Khớp theo danh mục sẽ sửa được nhiều lỗi đọc chữ, vì chỉ có khoảng vài chục tên thanh hợp lệ.
4. **Đơn vị phải hiểu.** "bó" và "cây" khác nhau (một bó gồm nhiều cây, xem `barsPerBundle` trong bảng `Profile`). Hệ thống phải quy đổi sang số cây khi vào kho.
5. **Cần biết giấy này dùng để làm gì**: đơn đặt hàng của xưởng thợ gửi NPP, phiếu kiểm kho, hay phiếu nhập từ nhà cung cấp. Mỗi loại đi vào một luồng khác nhau (đơn → tạo đơn bán; kiểm kho → đợt kiểm kê; nhập → phiếu nhập).

### Card đồ họa Tesla P4 (8 GB)

- Là card suy luận cũ (kiến trúc Pascal, 75 W, **làm mát thụ động, không có quạt**), chỉ chạy tốt khi thùng máy có luồng gió mạnh như máy chủ rack. Cần xác nhận kiểu thùng máy của Lenovo.
- 8 GB chạy được Qwen3-VL cỡ 4B thoải mái và cỡ 8B nếu nén 4-bit (vừa sát). Dùng **llama.cpp hoặc Ollama**; các bộ chạy khác (vLLM) cần card đời mới hơn.
- Pascal chỉ được trình điều khiển CUDA 12.x hỗ trợ; CUDA 13 bỏ hỗ trợ. Phải ghim phiên bản CUDA 12 khi cài.
- Không thể tinh chỉnh (huấn luyện thêm) mô hình thị giác 8B trên card này. Muốn tinh chỉnh thì thuê GPU theo giờ, hoặc chỉ tinh chỉnh mô hình đọc chữ nhỏ.
- Card này không dùng cho dựng video; nó chỉ làm OCR. Không xung đột với việc dựng video của máy.

### Câu hỏi: tích hợp mô hình mã nguồn mở rồi "viết lại theo hướng của mình"

Được, nhưng cần hiểu đúng "viết lại": các mô hình trên đều dùng giấy phép Apache 2.0, cho phép dùng, sửa, tinh chỉnh và dùng thương mại. Không nên viết lại mô hình từ đầu (tốn nhiều tháng và cần dữ liệu lớn). Phần thuộc về Eurohouse và đáng tự xây là:

1. **Lớp cổng chuẩn** (như `AiProviderPort`): API chính chỉ gọi một giao diện "đọc ảnh → danh sách dòng". Bên dưới đổi mô hình tự chạy hoặc API trả phí mà không sửa nghiệp vụ.
2. **Lớp hiểu nghiệp vụ**: lời nhắc và khuôn JSON bắt buộc, bảng từ viết tắt của từng NPP, khớp mờ với danh mục thanh nhôm/phụ kiện, quy đổi bó ↔ cây, chấm điểm tin cậy từng dòng.
3. **Vòng học từ sửa lỗi**: mỗi lần người dùng sửa dòng đọc sai rồi xác nhận, lưu cặp (ảnh cắt dòng, chữ đúng). Khi đủ vài trăm đến vài nghìn mẫu thì tinh chỉnh mô hình đọc chữ nhỏ (VietOCR hoặc bộ đọc của PaddleOCR) trên chữ viết tay của chính các xưởng. Đây mới là phần "của mình" và ngày càng chính xác theo thời gian.

### Hai loại giấy, hai đường đọc khác nhau (xác nhận 2026-11-25)

| Loại | Nguồn | Đường đọc | Độ khó |
|---|---|---|---|
| **Đơn của thợ** | Giấy viết tay | Mô hình ngôn ngữ-thị giác (Qwen3-VL trên Tesla P4, hoặc API) + bảng viết tắt + khớp danh mục → **đơn nháp** | Khó, chắc chắn cần người xác nhận |
| **Phiếu nhập kho** | Hóa đơn in của nhà cung cấp | OCR chữ in (PaddleOCR phát hiện vùng + đọc, Tesseract `vie` dự phòng) + tách bảng → **phiếu nhập nháp** | Dễ hơn nhiều: chữ in, bố cục cố định theo từng nhà cung cấp |

- Hóa đơn in của nhà cung cấp là loại **OCR cổ điển làm tốt**, nên phần lớn không cần mô hình thị giác. Ảnh chụp nghiêng, thiếu sáng vẫn nên qua bước làm thẳng và tăng tương phản.
- **Nếu nhà cung cấp xuất hóa đơn điện tử** (có tệp XML hoặc PDF có lớp chữ), nên **nhập thẳng từ tệp XML/PDF**, không qua OCR: dữ liệu chính xác 100%, không phải đoán. Đề xuất hỗ trợ cả hai đường (chụp ảnh hóa đơn giấy, tải tệp hóa đơn điện tử). Cần anh cho biết các nhà cung cấp có gửi tệp hóa đơn điện tử không.
- Với mỗi nhà cung cấp, lưu **mẫu cột** (cột nào là tên hàng, kích thước, số lượng, đơn giá) sau lần xác nhận đầu tiên để các lần sau đọc đúng cột ngay.

## 7. Việc cần chủ dự án

- Cho biết các tờ giấy viết tay dùng để làm gì (đơn đặt hàng của thợ, kiểm kho hay nhập hàng) và ai viết (cùng một vài người hay nhiều xưởng khác nhau).
- Xác nhận kiểu thùng máy của Lenovo (rack hay tower) có luồng gió làm mát cho Tesla P4.
- Gửi thêm ảnh mẫu nếu có (đặc biệt phiếu in từ nhà cung cấp, nếu có loại đó).

## 8. Hợp đồng dịch vụ đọc ảnh (đã cài sẵn phía API)

API chỉ biết "ảnh vào, các nhóm dòng ra"; mô hình đọc chữ nằm sau một dịch vụ HTTP riêng, bật bằng biến môi trường `OCR_SERVICE_URL` (và `OCR_SERVICE_TOKEN` nếu có). Để trống thì phiếu vẫn lập bản nháp nhập tay.

```
POST {OCR_SERVICE_URL}/v1/extract        Authorization: Bearer <token>
{ "imageBase64": "...", "mime": "image/jpeg", "kind": "ORDER" | "RECEIPT" }
-> { "engine": "tên-mô-hình", "groups": [ { "heading": "Cẩm lai", "lines": [ { "text": "CS03", "quantity": 2, "unit": "c" } ] } ] }
```

- `heading`: tiêu đề nhóm đọc được (màu nhôm, hệ nhôm); `unit`: chữ như đọc được ("bó", "cây", "b", "c").
- Dịch vụ không cần biết danh mục: ghép mã, từ điển học theo từng NPP và xác nhận của người dùng nằm ở API.
- Hết 180 giây hoặc lỗi thì API báo "đọc chậm/lỗi", người dùng vẫn nhập tay được.
