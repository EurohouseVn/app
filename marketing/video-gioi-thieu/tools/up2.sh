#!/bin/bash
# Dựng môi trường quay RIÊNG: Postgres 55461, API 3061, cầu nối AI giả 3065, web Expo 8095. Dữ liệu giả.
set -u
R="E:/LELOIGLOBAL_CODEX/APP EUROHOUSE"; PGBIN="E:/LELOIGLOBAL_CODEX/pg/pgsql/bin"; D="$TEMP/eh-video2-pg"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55461/ehvideo2"
if [ ! -d "$D" ]; then
  "$PGBIN/initdb.exe" -D "$D" -U postgres --auth=trust -E UTF8 >/dev/null 2>&1
  "$PGBIN/pg_ctl.exe" -D "$D" -o "-p 55461" -l "$TEMP/eh-pg2.log" start >/dev/null 2>&1 </dev/null
  for i in $(seq 1 30); do "$PGBIN/pg_isready.exe" -h 127.0.0.1 -p 55461 >/dev/null && break; sleep 1; done
  "$PGBIN/createdb.exe" -h 127.0.0.1 -p 55461 -U postgres ehvideo2
  cd "$R/apps/api"; npx prisma migrate deploy 2>&1 | tail -1; npx ts-node prisma/seed.ts 2>&1 | tail -1
  "$PGBIN/psql.exe" -h 127.0.0.1 -p 55461 -U postgres -d ehvideo2 -c "update \"User\" set \"verifiedAt\"=now() where email='tho@eurohouse.vn'" >/dev/null
fi
cd "$R/apps/api"
[ -f .tmp-eh-video2-dist/apps/api/src/main.js ] || npx tsc -p tsconfig.json --outDir .tmp-eh-video2-dist 2>&1 | tail -2
nohup node "$R/marketing/video-gioi-thieu/tools/mock-bridge.mjs" > /dev/null 2>&1 &
PID=$(netstat -ano | grep ":3061 " | grep LISTEN | awk '{print $5}' | head -1); [ -n "$PID" ] && taskkill //PID $PID //F >/dev/null
JWT_SECRET=video-demo-secret-local PORT=3061 NODE_ENV=development MUSE_BRIDGE_URL=http://127.0.0.1:3065 MUSE_BRIDGE_TOKEN=demo nohup node .tmp-eh-video2-dist/apps/api/src/main.js > "$TEMP/eh-api2.log" 2>&1 &
for i in $(seq 1 40); do sleep 1; curl -s http://127.0.0.1:3061/api/health >/dev/null && break; done
curl -s http://127.0.0.1:3061/api/health | head -c 50; echo
