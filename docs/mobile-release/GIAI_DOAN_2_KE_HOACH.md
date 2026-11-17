# Eurohouse Mobile: Kế hoạch đưa lên Google Play (Giai đoạn 2)

Ngày lập: 17/11/2026. Phạm vi: `apps/mobile` (Expo SDK 54, RN 0.81, expo-router), cùng phần API và web cần cho chính sách Google Play.
Căn cứ: báo cáo khảo sát Giai đoạn 1, manifest thật lấy bằng `expo config --type introspect`, `tsc --noEmit` đã qua.

## 1. Bảng vấn đề và giải pháp

### Ưu tiên Cao (chặn phát hành hoặc bị Play từ chối)

| # | Vấn đề | Giải pháp | Chỗ sửa |
|---|---|---|---|
| C1 | Mã chưa commit (36 file, sửa 10/11) lệch so với HEAD `1abe084` (9/11). Bản đang sửa đã gỡ chế độ khách khỏi `_layout`. HEAD khai báo route `contract` nhưng không có file | Chốt một bản gốc duy nhất. Cất bản đang sửa vào một nhánh riêng có commit, rồi quyết định giữ hay bỏ chế độ khách. Mọi việc dưới đây làm trên bản đã chốt | git |
| C2 | Không có chức năng xoá tài khoản. API auth chỉ có `login`, `register-*`, `verification/*`, `me`. Play bắt buộc với app cho tạo tài khoản | API: thêm `POST /auth/me/delete`, xác nhận lại bằng mật khẩu, ẩn danh hoá thông tin cá nhân, khoá đăng nhập; đơn và công nợ giữ lại cho kế toán. Mobile: nút "Xoá tài khoản" trong Tài khoản, xác nhận hai bước. Web: trang hướng dẫn xoá tài khoản để khai trong Play Console | `apps/api/src/auth`, `apps/mobile/app/profile.tsx`, `apps/web` |
| C3 | Chưa có Chính sách quyền riêng tư cho app. Play Console bắt buộc có URL | Trang `/chinh-sach-bao-mat-ung-dung` trên nhomeurohouse.com: dữ liệu thu thập (tài khoản, SĐT, ảnh, vị trí gần đúng, camera để quét QR), mục đích, thời gian lưu, cách xoá. Đơn vị phát hành: LELOI EXIM GLOBAL | `apps/web` |
| C4 | Adaptive icon: `logo-mark.png` 512px, nền cam đặc khác `backgroundColor`, hình tràn khỏi vùng an toàn 66%, dấu ® sẽ bị cắt. `icon-512.png` nhỏ hơn mức 1024px khuyến nghị | Dựng `icon-1024.png`, `adaptive-foreground-1024.png` (nền trong suốt, logo nằm gọn trong 66% giữa) và `adaptive-monochrome-1024.png` (icon theo chủ đề Android 13+). Đặt `backgroundColor` trùng màu nền logo | `apps/mobile/assets`, `app.config` |
| C5 | Quyền thừa trong manifest cuối: RECORD_AUDIO (expo-camera tự thêm), SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE, ACCESS_FINE_LOCATION (xem thời tiết chỉ cần vị trí gần đúng) | `expo-camera` đặt `recordAudioAndroid: false`. Thêm `android.blockedPermissions` cho các quyền trên. Chỉ giữ CAMERA và ACCESS_COARSE_LOCATION. Kiểm lại bằng introspect | `app.config` |
| C6 | Base URL rơi về `127.0.0.1` khi thiếu biến env, nên bản release vẫn build được nhưng app không gọi được API | Chuyển `app.json` thành `app.config.ts`, ép phải có `EXPO_PUBLIC_API_URL` dạng https khi build preview/production (thiếu thì build dừng). `api.ts` chỉ giữ fallback khi `__DEV__` | `app.config.ts`, `src/lib/api.ts` |
| C7 | Không có ErrorBoundary. Một lỗi render là màn trắng toàn app | Export `ErrorBoundary` ở `app/_layout.tsx` (expo-router hỗ trợ sẵn): màn báo lỗi có nút "Thử lại" và "Về trang chủ" | `app/_layout.tsx`, component mới |
| C8 | Chưa có keystore và cấu hình phát hành. Profile production đang build cho cả iOS | Ký app bằng thông tin quản lý trên EAS, bật Play App Signing. Profile production chỉ Android, `buildType: app-bundle`. Thêm `submit.production.android` (track `internal`) | `eas.json` |

### Ưu tiên Trung bình (chất lượng bản phát hành)

| # | Vấn đề | Giải pháp | Chỗ sửa |
|---|---|---|---|
| T1 | Không tách môi trường. Preview và production cùng API, cùng package nên không cài song song được | Biến `APP_VARIANT` = development/preview/production trong `app.config.ts`. Bản preview đổi package thành `com.nhomeurohouse.workshop.preview` và tên thành "Eurohouse (Test)"; nếu có máy chủ staging thì trỏ vào staging | `app.config.ts`, `eas.json` |
| T2 | JWT hạn 7 ngày, không có refresh. Người dùng bị đá ra khi token hết hạn | Gia hạn trượt: thêm `POST /auth/refresh` (token còn hạn thì cấp token mới 7 ngày). Mobile gọi khi mở app hoặc khi token còn dưới 2 ngày. Gặp 401 thì thử refresh một lần rồi mới đăng xuất. Viết test trước | `apps/api/src/auth`, `src/lib/api.ts`, `src/lib/auth.tsx` |
| T3 | Không phát hiện mất mạng. GET không có retry. 16 chỗ `catch {}` nuốt lỗi. Câu báo lỗi mỗi màn một kiểu | Thêm `@react-native-community/netinfo` và banner "Đang ngoại tuyến" toàn app. Đồng bộ hàng đợi ngay khi có mạng lại. GET thử lại 2 lần (backoff 0,5s và 1,5s, chỉ cho lỗi mạng và 5xx). Một hàm `toUserMessage(error)` dùng chung. Rà các `catch {}` ở chỗ người dùng nhìn thấy | `src/lib/api.ts`, `src/lib/network.ts`, `_layout` |
| T4 | Chưa cấu hình splash. `StatusBar style="light"` nằm trên nền trắng | Thêm plugin `expo-splash-screen` (logo trên nền trắng, có biến thể tối), giữ splash cho đến khi `auth.ready`. Đặt StatusBar `dark` | `app.config.ts`, `_layout` |
| T5 | Token khai báo Inter và Sora nhưng không nạp font nào | Nạp `@expo-google-fonts/inter` và `@expo-google-fonts/sora` (có glyph tiếng Việt), thêm component `Text` mặc định dùng Inter, tiêu đề dùng Sora. Kiểm dấu tiếng Việt bằng ảnh chụp | `_layout`, `src/components/ui` |
| T6 | `allowBackup` đang là `true`, khôi phục sao lưu có thể làm SecureStore không đọc được | `android.allowBackup: false` | `app.config.ts` |
| T7 | Chưa bật R8 và shrink resources | Thêm `expo-build-properties`: `enableProguardInReleaseBuilds` và `enableShrinkResourcesInReleaseBuilds`. Chạy thử bản release trên máy thật để bắt lỗi do R8 | `app.config.ts` |
| T8 | Danh sách dài render bằng `.map` trong ScrollView (130 chỗ, chỉ 1 chỗ dùng FlatList) | Chuyển sang FlatList cho các danh sách dài: đơn hàng, công trình, báo giá, công nợ, kho, thư viện | các màn tương ứng |
| T9 | Không có bộ component chung. Loading chỉ là spinner, trạng thái trống và lỗi không thống nhất, bấm nút không có phản hồi | Tạo `src/components/ui`: `Screen`, `Button` (hiệu ứng khi bấm, haptics nhẹ, trạng thái loading), `Card`, `EmptyState`, `ErrorState` (có nút Thử lại), `Skeleton`. Áp trước cho 5 tab chính và màn chi tiết đơn | `src/components/ui`, các màn |
| T10 | ~~Tên app chưa thống nhất~~ **Đã chốt 17/11/2026:** tên dưới icon "Eurohouse" (dễ tìm trên Play), trang chủ trong app vẫn ghi "EUROHOUSE WORKSHOP OS"; tên trên cửa hàng đề xuất "Eurohouse - Nhôm kính & Xưởng"; package `com.nhomeurohouse.workshop` (chờ chốt lại vì định hướng nền tảng đa vai trò) | — | `app.json` |

### Ưu tiên Thấp (làm dần sau bản đầu)

| # | Vấn đề | Giải pháp |
|---|---|---|
| L1 | 706 mã hex viết cứng | Chuyển dần sang `colors` của `@eurohouse/ui`, màn nào được động tới thì chuyển màn đó |
| L2 | Màn quá lớn: `quote.tsx` 1235 dòng, `project/[id].tsx` 895, `orders.tsx` 809 | Tách thành component con khi sửa tới |
| L3 | Dependency lạ: khai `metro-runtime ^0.87.2` thẳng, dùng hai bộ icon (lucide và vector-icons) | Chạy `npx expo-doctor`, bỏ gói thừa |
| L4 | Màn hình lớn và tablet chưa xử lý | Giới hạn bề rộng nội dung khoảng 640px, căn giữa |
| L5 | Không có chuyển động | Thêm `LayoutAnimation` nhẹ khi mở/đóng khối, chuyển màn mặc định của router |

## 2. Lộ trình

Mỗi bước kết thúc bằng một commit và lệnh kiểm. Không push lên `main` khi chưa hỏi.

**Bước 0. Chốt bản gốc (C1).** Chủ dự án quyết định trước khi sửa mã.
- Tạo nhánh `release/mobile-play`. Commit nguyên trạng bản đang sửa thành một mốc riêng để không mất gì.
- Theo quyết định của chủ dự án: giữ chế độ khách như HEAD (khôi phục 3 chỗ trong `_layout`) hoặc bỏ hẳn.
- Kiểm: `tsc`, chạy bộ test `src/lib`, mở app trên web và chụp 5 tab.

**Bước 1. Cấu hình phát hành (C4, C5, C6, C8, T1, T4, T6, T7, T10).** Không đụng logic nghiệp vụ.
- `app.json` chuyển thành `app.config.ts` có biến thể. Icon và splash mới. Chặn quyền thừa. Thêm build-properties. Sửa `eas.json`.
- Kiểm: `expo config --type introspect` chỉ còn INTERNET, CAMERA, ACCESS_COARSE_LOCATION, VIBRATE và các quyền hệ thống của thư viện. `expo-doctor` sạch.

**Bước 2. Đáp ứng chính sách (C2, C3).**
- API xoá tài khoản (viết test trước), nút xoá trong app, hai trang web.
- Kiểm: test API, thử xoá một tài khoản test trên máy local, mở hai trang web bằng trình duyệt.

**Bước 3. Tầng API và ổn định (C7, T2, T3).**
- Viết test trước cho retry, cho `toUserMessage` và cho refresh khi gặp 401, sau đó mới sửa `api.ts` và `auth.tsx`. Thêm ErrorBoundary và banner ngoại tuyến.
- Kiểm: test pass; tắt mạng thì thấy banner, bật lại thì hàng đợi tự đồng bộ.

**Bước 4. UI/UX (T5, T8, T9, rồi L4).**
- Nạp font, dựng bộ component chung, áp cho 5 tab và màn chi tiết đơn, chuyển danh sách dài sang FlatList.
- Kiểm: chụp màn hình trước và sau ở cỡ 360×800 và 412×915, soi dấu tiếng Việt.

**Bước 5. Build thử và kênh internal.**
- `eas build --profile preview` (APK) để cài thử trên máy thật: đăng nhập, tạo đơn, offline, quét QR, xuất PDF, xoá tài khoản.
- `eas build --profile production` (AAB) rồi `eas submit` lên track Internal testing.
- Kiểm: báo cáo trước khi ra mắt (pre-launch report) của Play không có crash, cảnh báo quyền đã xử lý.

Phần còn lại của Giai đoạn 4 (hướng dẫn keystore, Data Safety, ảnh chụp cửa hàng) viết sau Bước 5, theo cấu hình thật.

## 3. Việc chủ dự án cần quyết định hoặc chuẩn bị

1. **Bản gốc (C1):** giữ chế độ khách (bản HEAD) hay bỏ (bản đang sửa)?
2. **Tên app và package:** "EUROHOUSE Workshop" hay "Eurohouse CSSX"? Giữ package `com.nhomeurohouse.workshop`?
3. **Staging:** có máy chủ API staging không? Nếu không có, bản preview dùng API thật với tài khoản test.
4. **Xoá tài khoản:** đồng ý cách ẩn danh hoá thông tin cá nhân và giữ đơn hàng, công nợ cho kế toán?
5. **Tài khoản:** đã có tài khoản Expo (EAS) và Google Play Console (tổ chức, phí 25 USD) chưa? Với tài khoản cá nhân mới, Play bắt buộc kiểm thử kín 12 người trong 14 ngày trước khi phát hành công khai.
