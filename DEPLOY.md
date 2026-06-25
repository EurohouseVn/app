# HƯỚNG DẪN DEPLOY EUROHOUSE DEMO — RENDER + VERCEL

Tài liệu này viết cho người **không chuyên code**. Anh chỉ cần làm lần lượt từng bước.

## 0. Kết quả sau khi làm xong

Anh sẽ có 2 đường link:

1. **API Backend trên Render**
   - Ví dụ: `https://eurohouse-api.onrender.com/api/health`
2. **Web Admin trên Vercel**
   - Ví dụ: `https://eurohouse-admin.vercel.app`

Tài khoản demo để đăng nhập Web Admin:

- Email: `board@eurohouse.vn`
- Mật khẩu: `Eurohouse@2026`

## 1. Anh cần chuẩn bị gì?

Anh cần có 3 tài khoản:

1. GitHub — để lưu source code online.
2. Render — để chạy Backend API.
3. Vercel — để chạy Web Admin.

Nếu anh đã có Render và Vercel rồi thì tốt. Render free vẫn chạy được, nhưng nếu demo với lãnh đạo thì gói trả phí khoảng 7 USD/tháng sẽ ổn định hơn vì hạn chế bị ngủ/cold start.

## 2. Bước A — Đưa source code lên GitHub

Nếu source code chưa nằm trên GitHub, cần tạo repo trước.

### A1. Tạo repo GitHub

1. Vào https://github.com
2. Bấm dấu **+** góc phải trên.
3. Chọn **New repository**.
4. Repository name đặt ví dụ: `eurohouse-app`
5. Chọn **Private** nếu chưa muốn công khai.
6. Bấm **Create repository**.

### A2. Upload/push code

Nếu anh dùng VS Code/GitHub Desktop thì có thể dùng giao diện để push.

Nếu dùng terminal, chạy trong thư mục dự án:

```bash
git init
git add .
git commit -m "Initial Eurohouse demo"
git branch -M main
git remote add origin https://github.com/<ten-github>/<ten-repo>.git
git push -u origin main
```

Sau bước này, GitHub phải thấy đầy đủ thư mục:

- `apps/admin`
- `apps/api`
- `packages/ui`
- `packages/types`
- `render.yaml`
- `vercel.json`

## 3. Bước B — Deploy API lên Render

Làm API trước vì Vercel Admin cần URL API.

### B1. Tạo Web Service trên Render

1. Vào https://render.com
2. Đăng nhập.
3. Bấm **New +**.
4. Chọn **Web Service**.
5. Chọn **Build and deploy from a Git repository**.
6. Connect GitHub nếu Render yêu cầu.
7. Chọn repo `eurohouse-app`.
8. Bấm **Connect**.

### B2. Cấu hình service

Điền các thông tin sau:

- **Name**: `eurohouse-api`
- **Region**: Singapore nếu có, hoặc region gần Việt Nam nhất.
- **Branch**: `main`
- **Root Directory**: để trống hoặc nhập `.`
- **Runtime**: `Node`
- **Build Command**:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @eurohouse/api build
```

- **Start Command**:

```bash
pnpm --filter @eurohouse/api start
```

- **Instance Type**:
  - Free: test được nhưng có thể chậm lúc mở đầu.
  - Starter khoảng 7 USD/tháng: nên dùng nếu demo cho lãnh đạo.

### B3. Thêm Environment Variables trên Render

Trong phần **Environment**, thêm từng biến sau:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | tạm nhập `*` trước, sau có URL Vercel thì sửa lại |
| `JWT_ACCESS_SECRET` | nhập chuỗi bất kỳ dài, ví dụ `eurohouse-access-demo-2026-change-me` |
| `JWT_REFRESH_SECRET` | nhập chuỗi bất kỳ dài, ví dụ `eurohouse-refresh-demo-2026-change-me` |
| `DEMO_ADMIN_EMAIL` | `board@eurohouse.vn` |
| `DEMO_ADMIN_PASSWORD` | `Eurohouse@2026` |

Hiện tại demo chưa dùng database thật, nên có thể chưa cần nhập `DATABASE_URL` và `REDIS_URL`. Nếu Render bắt nhập thì dùng tạm:

```text
DATABASE_URL=postgresql://placeholder
REDIS_URL=redis://placeholder
```

### B4. Deploy API

1. Bấm **Create Web Service**.
2. Chờ Render build.
3. Khi thấy trạng thái **Live** là API đã chạy.

### B5. Kiểm tra API

Render sẽ cho anh một URL dạng:

```text
https://eurohouse-api-xxxx.onrender.com
```

Anh mở thử các link sau trên trình duyệt:

```text
https://eurohouse-api-xxxx.onrender.com/api/health
```

Nếu thấy nội dung kiểu:

```json
{"name":"Eurohouse API","status":"ok"}
```

là API chạy đúng.

Kiểm tra dashboard mock:

```text
https://eurohouse-api-xxxx.onrender.com/api/admin/dashboard
```

Nếu thấy nhiều dữ liệu JSON là đúng.

## 4. Bước C — Deploy Web Admin lên Vercel

### C1. Tạo project trên Vercel

1. Vào https://vercel.com
2. Đăng nhập.
3. Bấm **Add New...**.
4. Chọn **Project**.
5. Import repo `eurohouse-app` từ GitHub.

### C2. Cấu hình project

Quan trọng nhất là chọn đúng thư mục Admin.

- **Framework Preset**: `Next.js`
- **Root Directory**: `apps/admin`
- **Build Command**: để mặc định hoặc dùng:

```bash
pnpm build
```

- **Install Command**: để mặc định hoặc dùng:

```bash
pnpm install --frozen-lockfile
```

Nếu Vercel đọc [vercel.json](vercel.json) từ repo root thì cũng có thể deploy theo config có sẵn.

### C3. Thêm Environment Variable trên Vercel

Trong phần **Environment Variables**, thêm:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://eurohouse-api-xxxx.onrender.com/api` |

Trong đó `https://eurohouse-api-xxxx.onrender.com` là URL Render của anh.

Ví dụ:

```text
NEXT_PUBLIC_API_URL=https://eurohouse-api-9abc.onrender.com/api
```

### C4. Deploy Admin

1. Bấm **Deploy**.
2. Chờ Vercel build.
3. Sau khi xong, Vercel sẽ cho URL dạng:

```text
https://eurohouse-app.vercel.app
```

Mở URL đó, anh sẽ thấy màn đăng nhập demo.

## 5. Bước D — Quay lại Render sửa CORS cho chuẩn

Sau khi có URL Vercel thật, ví dụ:

```text
https://eurohouse-app.vercel.app
```

Anh quay lại Render:

1. Vào service `eurohouse-api`.
2. Vào **Environment**.
3. Sửa biến `CORS_ORIGIN` từ `*` thành URL Vercel thật:

```text
https://eurohouse-app.vercel.app
```

4. Bấm **Save Changes**.
5. Render sẽ redeploy lại API.

Nếu anh có nhiều URL muốn cho phép, nhập cách nhau bằng dấu phẩy:

```text
https://eurohouse-app.vercel.app,https://eurohouse-app-git-main.vercel.app
```

## 6. Bước E — Test bản demo

Mở URL Vercel:

```text
https://eurohouse-app.vercel.app
```

Đăng nhập:

- Email: `board@eurohouse.vn`
- Mật khẩu: `Eurohouse@2026`

Sau khi vào dashboard, kiểm tra các khu vực:

- KPI tổng quan
- Doanh số và đơn hàng 6 tháng
- Tải phòng ban
- Module vận hành
- Hoạt động gần đây
- Đơn hàng gần đây
- Báo giá mẫu từ API
- Trạng thái kỹ thuật

Nếu dashboard hiện đủ dữ liệu là demo đã thành công.

## 7. Khi nào nên mua gói Render 7 USD?

Anh nên cân nhắc mua nếu:

- Ban lãnh đạo sẽ mở demo nhiều lần.
- Không muốn API bị ngủ.
- Muốn lần mở đầu nhanh và ổn định hơn.
- Muốn demo cho khách/đối tác.

Nếu chỉ test nội bộ vài lần thì free vẫn được, nhưng có thể mở lần đầu hơi lâu.

## 8. Các lỗi thường gặp và cách xử lý

### Lỗi 1 — Vercel mở được nhưng báo API Offline

Nguyên nhân thường gặp:

- `NEXT_PUBLIC_API_URL` nhập sai.
- API Render chưa Live.
- Render free đang ngủ, cần chờ 30-60 giây.

Cách xử lý:

1. Mở trực tiếp link API health.
2. Nếu API health chạy, quay lại Vercel kiểm tra env `NEXT_PUBLIC_API_URL`.
3. Sau khi sửa env trên Vercel, bấm **Redeploy**.

### Lỗi 2 — Đăng nhập demo thất bại

Kiểm tra tài khoản:

```text
board@eurohouse.vn
Eurohouse@2026
```

Kiểm tra Render env:

- `DEMO_ADMIN_EMAIL=board@eurohouse.vn`
- `DEMO_ADMIN_PASSWORD=Eurohouse@2026`

Sau khi sửa env trên Render, cần redeploy API.

### Lỗi 3 — Render build fail vì pnpm

Trong Build Command đảm bảo dùng:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @eurohouse/api build
```

Start Command:

```bash
pnpm --filter @eurohouse/api start
```

### Lỗi 4 — CORS error

Sửa `CORS_ORIGIN` trên Render thành đúng URL Vercel.

Ví dụ đúng:

```text
https://eurohouse-app.vercel.app
```

Không thêm dấu `/` cuối URL.

### Lỗi 5 — Sửa env rồi mà vẫn không đổi

- Với Render: bấm **Manual Deploy** hoặc chờ service redeploy.
- Với Vercel: bấm **Redeploy** project.

## 9. Checklist gửi cho ban lãnh đạo

Gửi cho lãnh đạo 3 thông tin:

```text
Link demo: https://<vercel-url>
Email: board@eurohouse.vn
Mật khẩu: Eurohouse@2026
```

Nói rõ đây là bản demo dữ liệu mock, chưa phải dữ liệu thật.

## 10. Ghi chú bảo mật

Tài khoản demo này chỉ dùng cho bản thử nghiệm. Khi làm bản thật cần:

- Auth thật.
- Mật khẩu mã hóa.
- Phân quyền RBAC.
- Database PostgreSQL thật.
- Log/audit đầy đủ.
