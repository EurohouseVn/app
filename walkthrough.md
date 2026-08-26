# EUROHOUSE - Trang thai trien khai va audit

Cap nhat: 26/08/2026

## 1. Kien truc va pham vi van hanh

- WebAdmin quan ly toan he thong, tai khoan NPP va du lieu danh muc dung chung.
- Moi NPP la mot `Organization` rieng, co tai khoan vai tro `NPP` va chi thay du lieu cua minh.
- Moi CSSX la mot `Organization` rieng, duoc kich hoat bang ma CSSX do NPP cap va chi thay du lieu cua tai khoan CSSX.
- Don hang, bao gia, cong no va ton kho da duoc gioi han theo tenant o API; client khong the mo rong pham vi bang query gia mao.

## 2. Module da hoan tat trong dot khac phuc nay

### WebAdmin

- Tao tai khoan NPP va organization NPP trong mot giao dich.
- Tu sinh ma NPP dang `NPP-TEN...` va mat khau ngau nhien manh neu khong nhap mat khau.
- Dashboard lay so lieu dong: 11 he Eurohouse, khuyen mai, thu vien va trang thai don.
- Quan ly kho va tao phieu giao NPP co mau nhom, kg theo ty trong va mot dong kg thuc can toan phieu.
- Phan quyen cac API quan tri, upload anh an toan va migration runtime production.

### Web NPP

- Nhan danh sach va chi tiet don cua CSSX theo dung NPP.
- Co nut tao don chu dong cho CSSX.
- Vong doi don: moi -> NPP tiep nhan -> tao don giao -> hoan tat.
- Tao don giao tru ton kho dung ma thanh + mau; thao tac lap lai khong tru kho hoac tao cong no trung.
- Hoan tat don tao cong no dung mot lan.
- Kg thuc te chi nhap o cap toan phieu giao; thanh tien duoc tinh theo kg thuc te.
- Xuat PDF va Excel phieu giao hang co thong tin NPP, CSSX, ma don, khoi luong, gia tri va ba khu ky nhan.
- Kho NPP co 11 he, 6 mau, loc nhieu mau, tong cay va quy doi tan; ton kho khong lo ra App CSSX.
- Dang nhap co hien/xoa mat khau va nho email qua trinh duyet.

### App Mobile CSSX

- Dang ky/kich hoat theo ma CSSX, dang nhap mot tai khoan cho mot CSSX.
- Tao, luu nhap, sua va chi gui don sang NPP khi bam `Gui NPP`.
- Don hang lay thong tin CSSX mac dinh, khong yeu cau nhap lai thong tin khach hang.
- Dat kinh bang danh sach mau/loai, kich thuoc rong-dai-so luong theo mm.
- Banner khuyen mai dung chung voi WebAdmin/Web NPP, co trinh chieu va xem anh lon.
- 11 he nhom Eurohouse hien thi trong Cong thuc cat; khong con so dem 544 mau toan cuc.
- Menu day da duoc kiem tra o viewport 406 x 866, khong de len nut luu/xac nhan.
- Expo Web xuat HTML tinh cho 24 route, tranh loi 404 khi mo truc tiep cac man hinh chinh tren Render.
- App CSSX khong nhan hoac hien so ton kho cua NPP.

### Cong thuc cat va boc tach

- Da giu lai 41 mau tham chieu da chon, thay vi tai toan bo 544 mau.
- 16 XLSX cu co XML loi da co co che phuc hoi trong bo nho; khong sua file goc.
- 41/41 mau doc duoc truong nhap va tinh thanh cong voi du lieu mac dinh.
- Ket qua kiem dinh sinh 431 dong nhom va 108 dong kinh; khong co kich thuoc am/0.
- Ma thanh va goc cat nhu `45-45` duoc giu la chuoi, khong bi chuyen sai thanh so.
- Chan B1/B2 lon hon rong cua va H1/H2 lon hon cao cua.
- Bo toi uu cat tinh hao hut luoi, chan doan dai hon cay nguyen va khong sinh suc chua am.
- Bao gia luu snapshot cong thuc de don cu khong bi thay doi khi mau cong thuc duoc cap nhat sau nay.
- Boc tach chi map ma trong dung he Eurohouse; ma chua xac nhan se bi chan, khong tu chon mot ma gan giong.

### Catalog R18

- Da co va kiem tra 38/38 anh mat cat cho Ecento Plus (21), phao dai hoi (12), mat dung (5).
- Tat ca URL anh tra HTTP 200, dung kieu anh va kich thuoc file hop le.

## 3. Kiem thu da dat

- API unit/regression: 24/24.
- TypeScript typecheck: API, WebAdmin, Web NPP, Mobile deu dat.
- Production build: Nest API, WebAdmin, Web NPP va Expo iOS bundle deu dat.
- Cong thuc thuc te: 41/41 doc input va tinh thanh cong.
- Luong giao hang thuc te: tru kho -> tao phieu -> hoan tat -> cong no; goi lap lai khong tao trung.
- PDF da render thanh anh va kiem tra bo cuc/Unicode; Excel da doc lai bang `openpyxl` de doi chieu so lieu.
- Health local: API 3001, NPP 3002, Admin 3005, Mobile 8081 deu HTTP 200.
- Production: API/Admin/NPP/Mobile deu HTTP 200; NPP doc duoc 6 don hien co va lich su tieng Viet da duoc sua sach.
- Production Mobile: dang nhap CSSX thanh cong, Cong thuc hien dung 11 he va menu day dat o viewport 406 x 866.
- `git diff --check`: khong co loi whitespace.

## 4. Gioi han con lai can du lieu nghiep vu

### Cong thuc Eurohouse chinh thuc

41 mau hien tai la mau hinh dang tham chieu. Chung sinh 184 ma nhom nguon, nhung chi 4 ma trung danh muc Eurohouse va 2 ma bi trung giua nhieu he. Vi vay he thong dang chu dong chan tao BOM neu ma chua duoc anh xa.

Can bo cong thuc/mapping duoc Eurohouse phe duyet cho tung he. Khong nen tu dong doi ten theo do gan giong vi se dat sai ma cay va sai ton kho.

Ba he `Noi that`, `Chan song`, `Phao dai hoi` hien chua co mau cong thuc tham chieu phu hop. Danh muc va anh mat cat van day du; phan tinh cat cho ba he cho bo cong thuc chinh thuc.

### OCR va tu dong doc hoa don

Nhap phu kien/kinh thu cong va database noi bo da co nen tang. OCR anh don hang va tich hop Gmail/Gemini chua duoc coi la hoan tat production; can thiet ke quyen truy cap, han muc API va buoc nguoi dung xac nhan du lieu OCR.

### Dong goi app native

Expo iOS bundle build thanh cong. Mobile Web da co manifest, icon 192/512, che do standalone va service worker de cai PWA truc tiep len Android/iPhone trong dot pilot. Service worker chi cache icon/manifest, luon lay HTML/JS moi tu mang va tu xoa cache cu; khoi phuc phien co timeout/finally de khong treo man hinh khoi dong khi API cham. Viec phat hanh TestFlight/Google Play hoac APK noi bo van can tai khoan Apple Developer/Google Play Console va cau hinh EAS signing rieng.

## 5. No ky thuat khong chan van hanh

- Typecheck va build sach, nhung lint toan monorepo con nhieu vi pham cu, chu yeu `no-explicit-any` va import thua trong cac module legacy.
- Can mot dot rieng chuan hoa ESLint de tranh tron refactor kieu du lieu lon vao dot sua luong don hang/cong thuc.
