# Triển khai Eurohouse lên MINI 02 (Docker compose)

Cập nhật 22/11/2026. Thay cho bản runbook 18/11 (dựa trên `git pull` + pm2, không còn đúng).

## Máy chủ chạy thế nào
- MINI 02 (`leloi02@192.168.1.141`), Ubuntu, Docker compose, dự án `euroapp` tại `/srv/eurohouse-app/app`.
- **Một ảnh `eurohouse/app:<tag>`** chứa api, admin, npp, web và bản web (PWA) của app di động. Tag đang chạy ghi trong `/srv/eurohouse-app/app/.env` (`APP_TAG`).
- Postgres nằm ở dự án riêng `eurodb` (container `eurodb-pg`).
- Bí mật là Docker secrets, tệp ở `/srv/eurohouse-app/secrets` (chỉ root đọc).
- Ra Internet qua Cloudflare Tunnel. **Push lên GitHub không deploy gì.**

## Cần chuẩn bị một lần: Resend
1. Resend: xác minh domain `mail.nhomeurohouse.com` (Domains → Add Domain, nối Cloudflare), tạo API key quyền *Sending access*.
2. Trên MINI 02 (có `sudo`), tạo secret, **không gõ khoá qua chat hay lưu vào lịch sử shell**:
   ```bash
   read -rs -p "RESEND_API_KEY: " K && echo
   printf %s "$K" | sudo tee /srv/eurohouse-app/secrets/resend_api_key >/dev/null
   sudo chmod 640 /srv/eurohouse-app/secrets/resend_api_key
   unset K
   ```
   Quyền/chủ sở hữu của tệp phải giống các secret cũ (xem `sudo ls -l /srv/eurohouse-app/secrets`; container chạy bằng uid 2000).
3. Thêm vào `/srv/eurohouse-app/app/.env`:
   ```
   RESEND_FROM_EMAIL=Eurohouse <no-reply@mail.nhomeurohouse.com>
   ```

## Mỗi lần cập nhật
1. **Sao lưu CSDL** (bắt buộc, có migration):
   ```bash
   docker exec eurodb-pg pg_dump -U euro_owner -Fc eurohouse > ~/backup-eurohouse-$(date +%Y%m%d-%H%M).dump
   ```
   (đổi tên người dùng/CSDL nếu khác; kiểm tra tệp dump không rỗng).
2. **Dựng ảnh mới.** Trong repo trên máy dev: `git archive --format=tar.gz -o src.tar.gz HEAD`, `scp` sang MINI 02, giải nén vào thư mục riêng rồi:
   ```bash
   nice -n 15 docker build -f deploy/mini02/Dockerfile -t eurohouse/app:<tag> .
   ```
   Địa chỉ API nhúng vào web/app mặc định `https://api.nhomeurohouse.com/api` (đổi bằng `--build-arg PUBLIC_API_URL=...`). Tag nên có ngày và mã commit, ví dụ `2026-11-22-1a5c95d`.
3. **Cập nhật tệp cấu hình** (từ repo `deploy/mini02/`):
   ```bash
   sudo cp deploy/mini02/compose.yml deploy/mini02/entry.sh /srv/eurohouse-app/app/
   sudo sed -i 's/^APP_TAG=.*/APP_TAG=<tag>/' /srv/eurohouse-app/app/.env
   ```
4. **Chạy bản mới** (migrate chạy trước tự động, rồi api, admin, npp, web, mobile-dist, edge):
   ```bash
   cd /srv/eurohouse-app/app && sudo docker compose up -d
   sudo docker compose ps
   ```
5. **Kiểm**: `https://api.nhomeurohouse.com/api/health` (trường `build` đổi), mở `https://app.nhomeurohouse.com`, thử đăng ký bằng một email thật và nhận mã.

## Tài khoản kiểm duyệt Google Play
```bash
sudo docker compose run --rm --entrypoint "" migrate sh /entry.sh sh -c \
  "REVIEW_EMAIL=kiemduyet@eurohouse.vn REVIEW_PASSWORD='...' pnpm --filter @eurohouse/api review-account:create"
```
Mật khẩu tự đặt (≥ 10 ký tự, có chữ và số), không gửi qua chat.

## Quay lại bản cũ
Đổi `APP_TAG` về tag trước (ảnh cũ vẫn còn trên máy) rồi `sudo docker compose up -d`. Migration đã chạy thì không tự gỡ: khôi phục từ tệp sao lưu bước 1 bằng `pg_restore --clean`.

## Cần xác nhận trước lần chạy đầu
Các lệnh ở bước 3 và 4 dựa trên `compose.yml` đang chạy; chưa kiểm được `scripts/update-app.sh` (tài khoản `leloi02` không đọc được). Nếu script đó làm thêm việc (nạp dữ liệu, seed công thức), chạy nó thay cho bước 3–4.
