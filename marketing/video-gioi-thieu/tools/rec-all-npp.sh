#!/bin/bash
# Quay lại toàn bộ clip web NPP theo đúng thứ tự (đơn → nhận → kho → cân → nợ → app thợ, rồi các tiện ích). Chỉ môi trường tạm.
cd "E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/marketing/video-gioi-thieu/tools"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55471/ehvideo2"
PG="E:/LELOIGLOBAL_CODEX/pg/pgsql/bin/psql.exe"
$PG -h 127.0.0.1 -p 55471 -U postgres -d ehvideo2 -c 'delete from "NppAccessory"' -c 'delete from "NppAccessorySetting"' -c 'delete from "NppDeviceSession"' >/dev/null
node ../../../scratch/video4-accessories-reset.mjs
node mk-state.mjs hungphat@eurohouse.vn "$TEMP/eh-state-hungphat.json" | tail -1
$PG -h 127.0.0.1 -p 55471 -U postgres -d ehvideo2 -c 'delete from "NppDeviceSession"' >/dev/null; node mk-npp-state.mjs
node clips-npp.mjs n01-tho-order n02-orders n03-inventory n04-weigh n05-debts n06-tho-debt
$PG -h 127.0.0.1 -p 55471 -U postgres -d ehvideo2 -c 'delete from "NppDeviceSession"' >/dev/null; node mk-npp-state.mjs
node clips-npp.mjs n20-accessories n21-reports n10-dashboard n11-glass n12-scan n16-recon n17-factories n18-profile
echo RECALLDONE
