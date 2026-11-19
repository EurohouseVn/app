# Triển khai nhánh `release/mobile-play` lên MINI 02

Ngày lập: 18/11/2026.

**Vì sao chạy tay.** Máy LELOIGROUP không vào được MINI 02:
- MINI 02 không có trong Tailscale;
- host `leloi-mini` từ chối khoá SSH.

Các lệnh dưới đây chạy **trên MINI 02**, trong thư mục chứa repo `EurohouseVn/app`.

**Hiện trạng** (kiểm lúc 18/11/2026 23:22):
- `https://api.nhomeurohouse.com/api/health` trả bản build `npp-color-schema-guard-v2`, tức commit `00bdc67` trên `main`.
- Nhánh `release/mobile-play` đi trước `main` 68 commit, gồm các module: lương xưởng, hoá đơn và thuế, quyền Eurohouse, nội dung website.

## 0. Sao lưu CSDL (bắt buộc)

```bash
pg_dump "$DATABASE_URL" -Fc -f ~/backup-eurohouse-$(date +%Y%m%d-%H%M).dump
```

## 1. Lấy code

```bash
git fetch origin
git checkout release/mobile-play
git pull --ff-only origin release/mobile-play
```

## 2. Cài gói, chạy migration, build

```bash
pnpm install --frozen-lockfile
pnpm --filter @eurohouse/api prisma:deploy
pnpm --filter @eurohouse/api build
```

- `prisma:deploy` chỉ chạy những migration còn thiếu.
- Có tới 14 migration mới so với `main`. Hai cái cuối là:
  - `20261118120000_workshop_payroll_management`
  - `20261118180000_workshop_tax_invoices`

## 3. Biến môi trường cần có

| Biến | Dùng cho |
|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Gửi mã xác minh email khi xưởng đăng ký |

## 4. Khởi động lại API

Dùng đúng cách MINI 02 đang chạy API: pm2, dịch vụ Windows hay Docker. Ví dụ với pm2:

```bash
pm2 restart eurohouse-api
```

Kiểm tra lại. Trường `build` phải khác `npp-color-schema-guard-v2`.

```bash
node -e "fetch('https://api.nhomeurohouse.com/api/health').then(r=>r.json()).then(console.log)"
```

## 5. Tạo tài khoản kiểm duyệt

Anh tự đặt mật khẩu:
- ít nhất 10 ký tự, có cả chữ và số;
- không gửi qua chat.

```bash
REVIEW_EMAIL=kiemduyet@eurohouse.vn REVIEW_PASSWORD='...' pnpm --filter @eurohouse/api review-account:create
```

Nếu production có từ hai NPP trở lên, thêm `REVIEW_NPP_CODE=<mã NPP>`.

## Quay lại bản cũ nếu lỗi

```bash
git checkout main
pnpm install --frozen-lockfile
pnpm --filter @eurohouse/api build
pm2 restart eurohouse-api
```

Migration đã chạy thì không tự gỡ được. Phải khôi phục từ bản sao lưu ở bước 0:

```bash
pg_restore --clean -d "$DATABASE_URL" <file.dump>
```
