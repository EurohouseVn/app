# Sinh script-npp.json (bản đầy đủ) và script-npp-teaser.json cho video giới thiệu web Nhà Phân Phối. Số liệu lấy từ dữ liệu test trong CSDL tạm.
# Lời đọc luôn viết "Nhà Phân Phối" đầy đủ (không viết tắt NPP) để giọng đọc phát âm rõ.
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(root, 'npp-data.json'), encoding='utf8')) if os.path.exists(os.path.join(root, 'npp-data.json')) else {}
g = lambda k, d=None: D.get(k, d)
S = []
def pain(id, tag, lines, text): S.append(dict(id=id, kind='pain', tag=tag, lines=lines, text=text))
def feat(id, clip, tag, title, sub, text, **k): S.append(dict(id=id, kind='feat', clip=clip, clipdir='clips-npp', tag=tag, title=title, sub=sub, text=text, **k))

pain('q-p00-hook', 'CÂU HỎI CHO NHÀ PHÂN PHỐI', [['QUẢN LÝ THỢ', 'ink'], ['KHO, CÔNG NỢ', 'white'], ['BẰNG SỔ TAY?', 'ink']],
     'Chủ Nhà Phân Phối nhôm ơi! Quản lý thợ, quản lý kho, quản lý công nợ... anh chị vẫn đang làm bằng sổ tay và Zalo sao?')
pain('q-p01-order', 'NỖI ĐAU SỐ 1', [['THỢ NHẮN ĐƠN QUA ZALO', 'ink'], ['SAI MÃ, SAI MÀU', 'white'], ['GIAO NHẦM LÀ LỖ', 'ink']],
     'Thợ nhắn đơn qua Zalo, viết tay, ảnh chụp mờ. Sai mã, sai màu, sai số lượng. Giao nhầm một lô là mất tiền, mất luôn uy tín!')
pain('q-p02-stock', 'NỖI ĐAU SỐ 2', [['KHO ĐẾM BẰNG MẮT', 'ink'], ['SỔ GHI MỘT NẺO', 'white'], ['HÀNG THẬT MỘT NẺO', 'ink']],
     'Kho thì đếm bằng mắt, sổ ghi một nẻo, hàng thật một nẻo. Hết hàng mới biết, tồn kho lệch hàng chục cây mà không biết đi đâu!')
pain('q-p03-weigh', 'NỖI ĐAU SỐ 3', [['MỖI MÀU MỘT GIÁ', 'ink'], ['CÂN XONG QUÊN GHI', 'white'], ['TÍNH TIỀN SAI CẢ ĐƠN', 'ink']],
     'Mỗi màu nhôm một giá, bó nguyên một giá, nhôm trần một giá. Cân xong quên ghi số ký, tính tiền nhầm màu. Tới lúc đối chiếu thì cãi nhau cả buổi!')
pain('q-p04-debt', 'NỖI ĐAU SỐ 4', [['CÔNG NỢ THỢ', 'ink'], ['AI NỢ BAO NHIÊU?', 'white'], ['NỢ TỪ KHI NÀO?', 'ink']],
     'Còn công nợ? Mười mấy xưởng, hàng trăm đơn, ai nợ bao nhiêu, nợ từ khi nào, không ai nhớ nổi. Tiền nằm ngoài thị trường, dòng tiền nghẹt thở!')
S.append(dict(id='q-p05-turn', kind='turn', tag='GIẢI PHÁP', title='EUROHOUSE NPP', sub='Web quản lý dành cho Nhà Phân Phối nhôm',
              text='Dừng lại! Eurohouse Nhà Phân Phối: web quản lý dành riêng cho Nhà Phân Phối nhôm. Từ đơn của thợ, tồn kho, cân hàng theo từng màu, cho tới công nợ, gói gọn trên một màn hình. Và tất cả hoàn toàn miễn phí!'))
feat('q-f01-order', 'n01-tho-order', 'BƯỚC 1 · THỢ ĐẶT ĐƠN', 'Thợ đặt nhôm trên app', 'Chọn nhiều màu · Chọn mã thanh · App tự tính kg · Gửi thẳng Nhà Phân Phối',
     'Bước một. Thợ mở app Eurohouse, chọn ba màu: Metalic, Xám Ngọc Trai và Vân gỗ Cẩm Lai, rồi bấm số cây cho từng mã: mười cây E701A, tám cây E70D110, sáu cây E70D150. App tự tính bảy trăm chín mươi ki-lô-gam dự tính. Bấm gửi, đơn bay thẳng tới Nhà Phân Phối!',
     device='phone', stats=[['Số màu', '3 màu'], ['Số thanh', '72 cây'], ['Dự tính', '790,41 kg']])
feat('q-f02-receive', 'n02-orders', 'BƯỚC 2 · NHẬN ĐƠN', 'Đơn mới hiện ngay', 'Đủ tên xưởng, địa chỉ · Chi tiết từng thanh, từng màu · Tiếp nhận một chạm',
     'Bước hai. Bên Nhà Phân Phối, đơn mới hiện lên ngay: đủ tên xưởng, địa chỉ giao, từng mã thanh, từng màu. Một chạm là tiếp nhận, thợ thấy ngay đơn đã được nhận.',
     device='web', stats=[['Xưởng', 'Hùng Phát'], ['Trạng thái', 'Mới → Đã tiếp nhận']])
feat('q-f03-stock', 'n03-inventory', 'BƯỚC 3 · KIỂM TỒN KHO', 'Kiểm tra tồn kho theo màu', 'Lọc theo màu nhôm · Tồn từng mã thanh · Cảnh báo sắp hết',
     'Bước ba, kiểm tra tồn kho theo màu. Lọc ba màu của đơn, thấy ngay từng mã còn bao nhiêu cây. E70D110 còn bảy mươi tám cây, đơn cần hai mươi bốn. E70D150 còn một trăm ba mươi bảy, cần mười tám. E701A còn một trăm tám mươi bảy, cần ba mươi. Đủ hàng, giao được!',
     device='web', stats=[['E70D110', 'Còn 78 · cần 24'], ['E70D150', 'Còn 137 · cần 18'], ['E701A', 'Còn 187 · cần 30']])
feat('q-f04-weigh', 'n04-weigh', 'BƯỚC 4 · CÂN THEO TỪNG MÀU', 'Cân tách theo màu, tính tiền từng màu', 'Mỗi màu một khối nhập kg · Mỗi màu 2 dòng giá · Thành tiền tự tính · Phiếu giao PDF',
     'Bước bốn, cân hàng và lập phiếu giao. Đơn có ba màu nên web hiện ba khối, mỗi màu nhập số ký riêng, và trong mỗi màu tách hai dòng: bó nguyên và nhôm trần. Màu Metalic: hai trăm ký bó nguyên, sáu mươi tám phẩy năm ký nhôm trần. Màu Xám Ngọc Trai: hai trăm bảy mươi phẩy hai ký. Màu Cẩm Lai: một trăm ký bó nguyên và một trăm sáu mươi tám phẩy ba ký nhôm trần. Tổng tám trăm linh bảy ký, thành tiền một trăm hai mươi bảy triệu ba trăm linh hai nghìn tám trăm đồng, hệ thống tự tính, không sai một đồng. Ký thực của mỗi màu không được thấp hơn tỷ trọng.',
     device='web', stats=[['Metalic', '39.075.000 đ'], ['Xám Ngọc Trai', '41.070.400 đ'], ['Cẩm Lai', '47.157.400 đ'], ['Tổng 807 kg', '127.302.800 đ']])
feat('q-f05-debt', 'n05-debts', 'BƯỚC 5 · CÔNG NỢ TỰ SINH', 'Hoàn thành đơn, công nợ tự sinh', 'Kho tự trừ đúng số cây · Công nợ tự ghi · Không sót một đồng',
     'Xác nhận một lần, kho tự trừ đúng số cây theo từng màu. Bấm hoàn thành đơn, công nợ tự sinh: xưởng Hùng Phát nợ một trăm hai mươi bảy triệu ba trăm linh hai nghìn tám trăm đồng. Không ghi sổ tay, không sót một đồng!',
     device='web', stats=[['Xưởng nợ', '127.302.800 đ'], ['Kho nhôm', 'Tự trừ 72 cây']])
feat('q-f06-thoapp', 'n06-tho-debt', 'TRÊN APP CỦA THỢ', 'Thợ thấy nợ ngay trên app', 'Số tiền · Mã đơn · Còn phải trả · Báo thanh toán',
     'Ngay trên app của thợ, khoản nợ hiện rõ: số tiền, mã đơn, còn phải trả bao nhiêu. Thợ chuyển khoản hay đưa tiền mặt rồi báo thanh toán, Nhà Phân Phối xác nhận là trừ nợ. Minh bạch hai bên, hết cãi nhau!',
     device='phone')
feat('q-f07-dash', 'n10-dashboard', 'TỔNG QUAN', 'Cả cơ nghiệp trên một màn hình', 'Tổng đơn · Số xưởng · Công nợ còn mở · Doanh thu tháng',
     'Còn đây là trang tổng quan: tổng số đơn, số xưởng đang quản lý, công nợ còn mở và doanh thu tháng này, nhìn một lần là nắm.',
     device='web', stats=g('dash_stats'))
feat('q-f08-acc', 'n20-accessories', 'KHO PHỤ KIỆN', 'Nhập kho phụ kiện bằng một bức ảnh', 'Chụp phiếu bằng điện thoại · Tự đọc từng dòng · Chốt nhập kho · Giá bán tự động hoặc tay',
     'Kho phụ kiện cũng gọn lắm. Chụp một bức ảnh phiếu nhập hoặc hóa đơn nhà cung cấp bằng điện thoại, hệ thống đọc từng dòng, anh chị chỉnh lại rồi chốt, tồn kho tự cộng. Giá bán thì đặt tự động theo phần trăm lãi trên giá nhập, hoặc tự nhập giá riêng cho từng món.',
     device='web', stats=[['Ảnh phiếu', '5 dòng phụ kiện'], ['Giá bán tự động', 'Giá nhập + 25% lãi']])
feat('q-f09-glass', 'n11-glass', 'KHO KÍNH', 'Kho kính có mã vạch', 'Mã đầu theo loại kính · Tự sinh mã vạch · In nhãn · Tính hướng cắt',
     'Có cả kho kính. Mỗi loại kính một mã đầu, nhập kích thước là hệ thống tự sinh mã vạch để in nhãn dán lên tấm. Tính hướng cắt thông minh, ưu tiên dùng đầu thừa trước, tiết kiệm từng tấm.',
     device='web')
feat('q-f10-scan', 'n12-scan', 'QUÉT MÃ VÀ KIỂM KÊ', 'Điện thoại là máy quét mã', 'Quét là cộng, trừ kho · Mất mạng vẫn quét · Nhiều máy kiểm kê cùng lúc',
     'Điện thoại chính là máy quét mã vạch. Mỗi lần quét tự cộng hoặc trừ kho. Mất mạng vẫn quét tiếp, có mạng tự gửi lại. Kiểm kê thì nhiều điện thoại cùng quét, số đếm hiện ngay trên máy tính.',
     device='web')
feat('q-f11-recon', 'n16-recon', 'ĐỐI CHIẾU', 'Đối chiếu theo từng xưởng', 'Số đơn theo trạng thái · Tổng kg · Tổng giá trị · Theo tháng',
     'Cuối tháng đối chiếu cực nhanh: mỗi xưởng bao nhiêu đơn, bao nhiêu ký, tổng giá trị là bao nhiêu, lọc theo từng tháng, số liệu nằm sẵn đó.',
     device='web', stats=g('recon_stats'))
feat('q-f12-report', 'n21-reports', 'BÁO CÁO', 'Doanh thu và công nợ theo tháng', 'Doanh thu từng tháng · Công nợ phát sinh · Công nợ đã thu · Chọn 3, 6 hoặc 12 tháng',
     'Báo cáo tài chính cho thấy doanh thu, công nợ phát sinh và công nợ đã thu theo từng tháng. Chọn ba, sáu hay mười hai tháng gần nhất.',
     device='web', stats=g('report_stats'))
feat('q-f13-fact', 'n17-factories', 'CƠ SỞ SẢN XUẤT', 'Cấp quyền cho từng xưởng', 'Tìm theo số điện thoại hoặc email · Bật tắt công thức cắt · Bật tắt đặt hàng',
     'Quản lý xưởng, quản lý thợ: tìm theo số điện thoại hoặc email, rồi bật hoặc tắt quyền công thức cắt và quyền đặt hàng nhôm cho từng cơ sở.',
     device='web')
feat('q-f14-acct', 'n18-profile', 'TÀI KHOẢN', 'Bảo mật theo thiết bị', 'Tối đa 2 máy tính và 3 điện thoại · Đăng xuất từ xa · Thông tin trên PDF',
     'Bảo mật theo thiết bị: tối đa hai máy tính và ba điện thoại cùng đăng nhập, đăng xuất từ xa khi cần. Thông tin doanh nghiệp tự in lên phiếu giao và báo giá.',
     device='web')
S.append(dict(id='q-f20-outro', kind='outro', tag='Miễn phí cho Nhà Phân Phối của Eurohouse', sub='Đơn, kho, cân, công nợ: một màn hình!',
              text='Eurohouse Nhà Phân Phối! Từ đơn của thợ, tồn kho, cân hàng theo từng màu cho tới công nợ, tất cả trong một màn hình. Và tất cả hoàn toàn miễn phí khi anh chị là Nhà Phân Phối của Eurohouse! Liên hệ Eurohouse để mở tài khoản ngay hôm nay! Nhôm của sự thịnh vượng!'))
json.dump(S, open(os.path.join(root, 'script-npp.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# --- teaser
T = []
keep = ['q-p00-hook', 'q-p01-order', 'q-p05-turn', 'q-f01-order', 'q-f04-weigh', 'q-f05-debt', 'q-f06-thoapp', 'q-f20-outro']
by = {s['id']: s for s in S}
tx = {
 'q-p00-hook': 'Nhà Phân Phối nhôm! Quản lý thợ, kho và công nợ bằng sổ tay sao?',
 'q-p01-order': 'Đơn qua Zalo, sai mã, sai màu, tồn kho lệch, công nợ không ai nhớ. Mất tiền mà không biết!',
 'q-p05-turn': 'Eurohouse Nhà Phân Phối! Từ đơn của thợ đến công nợ, một màn hình, hoàn toàn miễn phí!',
 'q-f01-order': 'Thợ chọn ba màu, bấm số cây, gửi đơn ngay trên app!',
 'q-f04-weigh': 'Cân tách theo từng màu, thành tiền tự tính: một trăm hai mươi bảy triệu ba trăm nghìn đồng!',
 'q-f05-debt': 'Hoàn thành đơn, công nợ tự sinh. Không sót một đồng!',
 'q-f06-thoapp': 'Thợ thấy nợ ngay trên app. Minh bạch hai bên!',
 'q-f20-outro': 'Eurohouse Nhà Phân Phối, miễn phí cho Nhà Phân Phối của Eurohouse! Nhôm của sự thịnh vượng!',
}
for i in keep:
    s = dict(by[i]); s['id'] = 't' + i; s['text'] = tx[i]
    if s['kind'] == 'feat': s['short'] = True
    T.append(s)
json.dump(T, open(os.path.join(root, 'script-npp-teaser.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(S), len(T))
