#!/bin/bash
# Khởi động lại API tạm (cổng 3011) để xoá bộ đếm throttle. Chỉ dùng cho môi trường quay video.
PID=$(netstat -ano | grep ":3011 " | grep LISTEN | awk '{print $5}' | head -1); [ -n "$PID" ] && taskkill //PID $PID //F >/dev/null
cd "E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/api"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55440/ehvideo" JWT_SECRET=video-demo-secret-local PORT=3011 NODE_ENV=development MUSE_BRIDGE_URL=http://127.0.0.1:3055 MUSE_BRIDGE_TOKEN=demo
nohup node .tmp-eh-video-dist/apps/api/src/main.js > "$TEMP/eh-api.log" 2>&1 &
for i in $(seq 1 30); do sleep 1; curl -s http://127.0.0.1:3011/api/health >/dev/null && break; done
