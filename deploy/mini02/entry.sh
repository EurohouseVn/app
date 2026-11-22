#!/bin/sh
# Nạp Docker secrets (tệp trong /run/secrets) thành biến môi trường rồi chạy lệnh được truyền vào.
# Bí mật không nằm trong `docker inspect` hay compose.yml; chỉ có trong môi trường của tiến trình.
set -eu
load() { # load BIẾN tên-secret
  f="/run/secrets/$2"
  if [ -r "$f" ]; then
    v="$(cat "$f")"
    export "$1=$v"
  fi
}
load DATABASE_URL database_url
load JWT_SECRET   jwt_secret
load WEBSITE_PREVIEW_SECRET website_preview_secret
load RESEND_API_KEY resend_api_key
load MUSE_BRIDGE_TOKEN muse_bridge_token
exec "$@"
