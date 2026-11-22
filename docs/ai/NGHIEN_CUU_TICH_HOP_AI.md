# Nghiên cứu: AI hỗ trợ trả lời và tạo ảnh theo từng xưởng

Ngày lập: 22/11/2026. Trạng thái: **nghiên cứu và thiết kế, chưa viết mã.**

## 1. Cần chốt trước: "tài khoản MUSE 31B" là gì

Tôi không tìm thấy mô hình nào tên "MUSE 31B" trên API chính thức của Meta. Các điều đã kiểm:

| Thông tin | Kết quả |
|---|---|
| Họ mô hình Muse trên Meta Model API | Muse Spark (`muse-spark-1.3`, `-1.2`, `-1.1`), Muse Wonder (`muse-wonder-1.0`, bản xem trước), Muse Ember (`muse-ember-1.0`, rẻ, khối lượng lớn), Muse Image (`muse-image-1.0`), Muse Voice Transcribe |
| Mô hình 30B | Muse Glimmer (30 tỉ tham số, tải trọng số về) **không có trên API**, phải tự chạy hoặc thuê máy chủ |
| "31B" | Trang giới thiệu của một dịch vụ giới thiệu nói mức tối đa **31 tỉ token** là hạn mức cho **ứng dụng Muse dành cho người dùng cuối**, không phải token API |

**Câu hỏi cho chủ dự án:** tài khoản anh/chị đang có thuộc loại nào?
1. **Khoá API chính thức** tạo tại `dev.meta.ai` (mục API keys), dùng được qua `https://api.meta.ai/v1`, trả tiền theo mức dùng. **Đây là loại duy nhất nên đưa vào sản phẩm.**
2. **Gói thuê bao / token của ứng dụng Muse** (muse.ai). Tài liệu chính thức không nói gói này dùng được cho API. Chỉ có dịch vụ bên thứ ba không chính thức (useapi.net) bọc lại. Không nên dựa vào cách này cho sản phẩm: dễ vi phạm điều khoản, có thể bị khoá bất cứ lúc nào.

Nếu là loại 2 thì cần tạo khoá API chính thức trước khi làm tiếp. Nếu "31B" có nghĩa khác, anh/chị cho biết tên nhà cung cấp.

## 2. API chính thức cho phép những gì (đã đọc tài liệu)

- Địa chỉ gốc `https://api.meta.ai/v1`, xác thực bằng Bearer `MODEL_API_KEY`.
- **Tương thích OpenAI SDK và Anthropic SDK**: đổi địa chỉ gốc và khoá là dùng được, không phải viết lại.
- Trò chuyện: `POST /v1/responses`, cũng có Chat Completions và Messages.
- Tạo ảnh: `POST /v1/images/generations`; sửa ảnh: `/v1/images/edits`. Kết quả là base64 hoặc đường dẫn có chữ ký (**đường dẫn hết hạn**, nên phải tải về lưu).
- Cửa sổ ngữ cảnh 1.048.576 token (Spark, Wonder, Ember).
- Tính tiền theo mức dùng: theo token (văn bản), theo ảnh (tạo ảnh). Chưa đọc được chi tiết giới hạn tốc độ và bảng giá (trang riêng "Pricing and rate limits").
- Có thể xem hình ảnh, video, âm thanh làm đầu vào (ví dụ gửi ảnh bản vẽ ô cửa để hỏi).

## 3. Yêu cầu của chủ dự án và cách đáp ứng

| Yêu cầu | Thiết kế |
|---|---|
| Mỗi xưởng là khu vực làm việc độc lập | Mọi bảng AI có `organizationId`; mọi truy vấn lọc theo xưởng của người đăng nhập, không nhận `organizationId` từ máy khách. Xưởng A không bao giờ đọc được hội thoại, ảnh, hạn mức của xưởng B. |
| Câu lệnh giới hạn mỗi phiên là nội dung riêng của từng xưởng | Mỗi xưởng có **hồ sơ AI** (`AiWorkspaceProfile`): tên xưởng, sản phẩm, giọng điệu, quy tắc được và không được trả lời, thông tin liên hệ. Máy chủ ghép **câu lệnh hệ thống** = phần chung của Eurohouse + hồ sơ của xưởng đó, mỗi lần mở phiên. Máy khách không gửi và không sửa được câu lệnh này. |
| Dữ liệu sinh ra lưu vào CSDL của mình | Lưu toàn bộ tin nhắn, ảnh (tệp lưu vào kho tệp hiện có, `/static/uploads/…`), số token, mô hình dùng, tài khoản dùng. Không phụ thuộc bộ nhớ phía nhà cung cấp. |
| Tài khoản lỗi thì vẫn còn dữ liệu; thêm tài khoản mới thì tiếp tục ngữ cảnh | Xem mục 5. |

## 4. Mô hình dữ liệu đề xuất

- `AiProviderAccount`: nhà cung cấp, nhãn, **khoá mã hoá**, trạng thái (`ACTIVE`, `EXHAUSTED`, `INVALID`, `DISABLED`), thứ tự ưu tiên, `lastErrorAt`, `lastErrorCode`. Cấp nền tảng (một bộ khoá chung của công ty) hoặc cấp xưởng (xưởng tự có khoá, nếu sau này bán gói riêng).
- `AiWorkspaceProfile` (1–1 với `Organization`): `systemInstructions`, `allowedTopics`, `blockedTopics`, `language`, `dailyMessageLimit`, `dailyImageLimit`, `enabled`.
- `AiConversation`: `organizationId`, `userId`, tiêu đề, `summary` (tóm tắt cuốn chiếu), `summaryUpToMessageId`.
- `AiMessage`: `conversationId`, `organizationId`, vai trò, nội dung, `inputTokens`, `outputTokens`, `providerAccountId`, `model`, `status` (`DONE`, `FAILED`, `PENDING`).
- `AiImageJob`: `organizationId`, `userId`, câu lệnh, thông số, trạng thái (`QUEUED`, `RUNNING`, `DONE`, `FAILED`), `storedFileUrl`, `providerAccountId`, lỗi.
- `AiUsageDaily`: `organizationId`, ngày, số tin nhắn, token, số ảnh. Dùng để chặn vượt hạn mức và để tính chi phí từng xưởng.

## 5. Chịu lỗi tài khoản và nạp lại ngữ cảnh

Nguyên tắc: **CSDL của mình là nguồn sự thật, nhà cung cấp chỉ là bộ máy tính toán không lưu trạng thái.**

1. Mỗi lượt hỏi: lưu tin nhắn người dùng (`PENDING`) → dựng ngữ cảnh từ CSDL → gọi nhà cung cấp → lưu câu trả lời.
2. Ngữ cảnh gồm: câu lệnh hệ thống của xưởng + `summary` + N tin nhắn gần nhất. Khi hội thoại dài, tóm tắt các tin cũ rồi lưu vào `summary`, tránh phình token.
3. Không dùng "bộ nhớ phía nhà cung cấp" (như `previous_response_id`) làm nguồn chính, để đổi tài khoản không mất gì.
4. Gặp lỗi do tài khoản (hết hạn mức, khoá sai, 401/402/429 kéo dài): đánh dấu tài khoản `EXHAUSTED`/`INVALID`, **thử tài khoản kế tiếp** theo thứ tự ưu tiên. Hết tài khoản thì tin nhắn giữ `PENDING`, người dùng thấy thông báo "AI đang tạm nghỉ, câu hỏi của bạn đã được lưu".
5. Khi quản trị **thêm tài khoản mới**: hệ thống tự xử lý lại các tin `PENDING` và job ảnh `QUEUED` theo thứ tự, dựng lại ngữ cảnh từ CSDL. Hội thoại tiếp tục như chưa từng gián đoạn.
6. Ảnh phải **tải về và lưu ngay** khi nhận đường dẫn có chữ ký, vì đường dẫn hết hạn.

## 6. Bảo mật và tuân thủ

- Khoá nhà cung cấp mã hoá khi lưu (AES-256-GCM), khoá chủ lấy từ Docker secret trên MINI 02, **không bao giờ gửi xuống app**. Đồng bộ với cách đang quản lý `jwt_secret`.
- Chỉ người dùng đã xác minh email, thuộc đúng xưởng, mới dùng AI. Hạn mức theo ngày cho từng xưởng và từng người, chặn chi phí vượt kiểm soát.
- **Chống chèn lệnh (prompt injection):** nội dung người dùng và dữ liệu xưởng đưa vào luôn là dữ liệu, không bao giờ được gộp vào câu lệnh hệ thống. AI chỉ có quyền đọc (nếu sau này cho đọc dữ liệu công trình), không có công cụ ghi.
- Lọc nội dung ảnh và chữ theo quy tắc nền tảng, ghi nhật ký yêu cầu bị từ chối.
- Gửi nội dung tới bên thứ ba (Meta): cần cập nhật **chính sách quyền riêng tư** và mục "an toàn dữ liệu" khi đưa lên Google Play; nên ghi rõ nội dung do AI tạo; người dùng không nên nhập thông tin nhạy cảm của khách hàng (số điện thoại, địa chỉ) vào câu hỏi, hoặc hệ thống che trước khi gửi.
- Điều khoản dịch vụ của Meta về dùng khoá cho sản phẩm nhiều khách hàng: tài liệu đã đọc không nói rõ. **Cần đọc điều khoản đầy đủ trước khi mở cho khách ngoài công ty.**

## 7. Kiến trúc triển khai trên MINI 02

- Module `ai` trong API (NestJS), cùng ảnh Docker hiện tại, thêm hai biến: khoá chủ mã hoá (Docker secret) và danh sách mô hình mặc định.
- Gọi nhà cung cấp qua một lớp trừu tượng (`AiProviderPort`), có thể thay Meta bằng nhà cung cấp khác mà không đổi phần còn lại. Có thể dùng chính OpenAI SDK với địa chỉ gốc của Meta.
- Job tạo ảnh chạy bằng bộ xử lý nền có sẵn (mẫu `WorkshopEventWorker`), trạng thái trả về app theo kiểu hỏi lại (polling) hoặc cập nhật khi mở màn hình.
- App: màn **Trợ lý Eurohouse** (hội thoại), màn **Tạo ảnh** (gợi ý câu lệnh, danh sách ảnh đã tạo của xưởng). Trên web dùng chung mã.

## 8. Lộ trình đề xuất

1. **Giai đoạn 1 (khoảng 3–4 ngày):** lớp nhà cung cấp, bảng dữ liệu, trả lời chữ theo hồ sơ riêng từng xưởng, lưu CSDL, chuyển tài khoản dự phòng, hạn mức ngày. Chưa có ảnh.
2. **Giai đoạn 2 (khoảng 2–3 ngày):** tạo ảnh, hàng đợi, lưu ảnh vào kho tệp, màn thư viện ảnh theo xưởng.
3. **Giai đoạn 3:** cho AI đọc dữ liệu của chính xưởng (công trình, báo giá, công nợ) ở chế độ chỉ đọc để trả lời câu hỏi như "công trình nào còn nợ nhiều nhất". Cần thiết kế quyền riêng.
4. Trang quản trị: màn nhập và theo dõi tài khoản nhà cung cấp, xem mức dùng và chi phí theo xưởng.

## 9. Việc cần chủ dự án quyết

1. Loại tài khoản Muse đang có (mục 1) và tạo khoá API chính thức nếu chưa có.
2. Ngân sách tối đa mỗi tháng và hạn mức mỗi xưởng (số tin nhắn và số ảnh mỗi ngày).
3. Gói nào được dùng AI: mọi xưởng đăng ký, hay chỉ xưởng được bật (khuyên bật theo từng xưởng như cờ `survey`).
4. Quy tắc nội dung chung (ví dụ chỉ trả lời về nhôm kính, cơ khí, báo giá, công trình; không tư vấn pháp lý/tài chính).
5. Có cho phép AI nhìn ảnh khách hàng và bản vẽ hay không (ảnh hưởng chính sách quyền riêng tư).
