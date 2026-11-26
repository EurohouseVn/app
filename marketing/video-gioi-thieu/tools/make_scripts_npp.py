# Sinh script-npp.json (bản đầy đủ) và script-npp-teaser.json cho video giới thiệu web NPP. Số liệu lấy từ dữ liệu test thật trong CSDL tạm.
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(root, 'npp-data.json'), encoding='utf8')) if os.path.exists(os.path.join(root, 'npp-data.json')) else {}
g = lambda k, d='': D.get(k, d)
S = []
def pain(id, tag, lines, text): S.append(dict(id=id, kind='pain', tag=tag, lines=lines, text=text))
def feat(id, clip, tag, title, sub, text, **k): S.append(dict(id=id, kind='feat', clip=clip, clipdir='clips-npp', tag=tag, title=title, sub=sub, text=text, **k))

pain('q-p00-hook', 'CÂU HỎI CHO NHÀ PHÂN PHỐI', [['QUẢN LÝ THỢ', 'ink'], ['KHO, CÔNG NỢ', 'white'], ['BẰNG SỔ TAY?', 'ink']],
     'Chủ nhà phân phối nhôm ơi! Quản lý thợ, quản lý kho, quản lý công nợ... anh chị vẫn đang làm bằng sổ tay và Zalo sao?')
pain('q-p01-order', 'NỖI ĐAU SỐ 1', [['THỢ NHẮN ĐƠN QUA ZALO', 'ink'], ['SAI MÃ, SAI MÀU', 'white'], ['GIAO NHẦM LÀ LỖ', 'ink']],
     'Thợ nhắn đơn qua Zalo, viết tay, ảnh chụp mờ. Sai mã, sai màu, sai số lượng. Giao nhầm một lô là mất tiền, mất luôn uy tín!')
pain('q-p02-stock', 'NỖI ĐAU SỐ 2', [['KHO ĐẾM BẰNG MẮT', 'ink'], ['SỔ GHI MỘT NẺO', 'white'], ['HÀNG THẬT MỘT NẺO', 'ink']],
     'Kho thì đếm bằng mắt, sổ ghi một nẻo, hàng thật một nẻo. Hết hàng mới biết, tồn kho lệch hàng chục cây mà không biết đi đâu!')
pain('q-p03-weigh', 'NỖI ĐAU SỐ 3', [['CÂN XONG', 'ink'], ['QUÊN GHI SỐ KÝ', 'white'], ['GIÁ MỖI NGƯỜI MỘT KIỂU', 'ink']],
     'Cân hàng xong quên ghi số ký. Đơn giá mỗi người nhớ một kiểu. Tới lúc đối chiếu thì cãi nhau cả buổi!')
pain('q-p04-debt', 'NỖI ĐAU SỐ 4', [['CÔNG NỢ THỢ', 'ink'], ['AI NỢ BAO NHIÊU?', 'white'], ['NỢ TỪ KHI NÀO?', 'ink']],
     'Còn công nợ? Mười mấy xưởng, hàng trăm đơn, ai nợ bao nhiêu, nợ từ khi nào, không ai nhớ nổi. Tiền nằm ngoài thị trường, dòng tiền nghẹt thở!')
S.append(dict(id='q-p05-turn', kind='turn', tag='GIẢI PHÁP', title='EUROHOUSE NPP', sub='Web quản lý dành cho nhà phân phối nhôm',
              text='Dừng lại! Eurohouse en pê pê: web quản lý dành riêng cho nhà phân phối nhôm. Từ đơn của thợ, tồn kho, cân hàng, cho tới công nợ, gói gọn trên một màn hình!'))
feat('q-f01-order', 'n01-tho-order', 'BƯỚC 1 · THỢ ĐẶT ĐƠN', 'Thợ đặt nhôm trên app', 'Chọn màu · Chọn mã thanh · App tự tính kg · Gửi thẳng NPP',
     'Bước một. Thợ mở app Eurohouse, chọn màu Café Metalic, chọn mã thanh rồi bấm số cây: hai mươi cây E70D110, mười bốn cây E70D150, ba mươi cây E701A. App tự tính sáu trăm tám mươi lăm phẩy tám bảy ki-lô-gam dự tính. Bấm gửi, đơn bay thẳng tới nhà phân phối!',
     device='phone', stats=[['Số thanh', '64 cây'], ['Dự tính', '685,87 kg']])
feat('q-f02-receive', 'n02-orders', 'BƯỚC 2 · NPP NHẬN ĐƠN', 'Đơn mới hiện ngay', 'Đủ tên xưởng, địa chỉ · Chi tiết từng thanh · Tiếp nhận một chạm',
     'Bước hai. Bên nhà phân phối, đơn mới hiện lên ngay: đủ tên xưởng, địa chỉ giao, từng mã thanh, từng màu. Một chạm là tiếp nhận, thợ thấy ngay đơn đã được nhận.',
     device='web', stats=[['Xưởng', 'Hùng Phát'], ['Trạng thái', 'Mới → Đã tiếp nhận']])
feat('q-f03-stock', 'n03-inventory', 'BƯỚC 3 · KIỂM TỒN KHO', 'Kiểm tra tồn kho theo màu', 'Lọc theo màu nhôm · Tồn từng mã thanh · Cảnh báo sắp hết',
     'Bước ba, kiểm tra tồn kho. Lọc theo màu Café Metalic, thấy ngay từng mã còn bao nhiêu cây. E70D110 còn bốn mươi cây, đơn cần hai mươi. E70D150 còn bảy mươi, cần mười bốn. E701A còn chín mươi sáu, cần ba mươi. Đủ hàng, giao được!',
     device='web', stats=[['E70D110', 'Còn 40 · cần 20'], ['E70D150', 'Còn 70 · cần 14'], ['E701A', 'Còn 96 · cần 30']])
feat('q-f04-weigh', 'n04-weigh', 'BƯỚC 4 · CÂN VÀ LẬP PHIẾU GIAO', 'Cân xong, nhập số ký thực', 'Kg thực cân · Đơn giá · Thành tiền tự tính · Phiếu giao PDF',
     'Bước bốn, cân hàng và lập phiếu giao. Hệ thống tính sẵn sáu trăm tám mươi lăm phẩy tám bảy ki-lô-gam theo tỷ trọng. Cân thực tế sáu trăm chín mươi chín phẩy sáu ki-lô-gam, nhập đơn giá tám mươi bảy nghìn năm trăm đồng một ký. Thành tiền sáu mươi mốt triệu hai trăm mười lăm nghìn đồng, tự tính, không sai một đồng! Ký thực không được thấp hơn tỷ trọng, chặn gian lận ngay từ cửa.',
     device='web', stats=[['Kg thực cân', '699,6 kg'], ['Đơn giá', '87.500 đ/kg'], ['Thành tiền', '61.215.000 đ']])
feat('q-f05-debt', 'n05-debts', 'BƯỚC 5 · CÔNG NỢ TỰ SINH', 'Hoàn thành đơn, công nợ tự sinh', 'Kho tự trừ đúng số cây · Công nợ tự ghi · Không sót một đồng',
     'Xác nhận một lần, kho tự trừ đúng số cây. Bấm hoàn thành đơn, công nợ tự sinh: xưởng Hùng Phát nợ sáu mươi mốt triệu hai trăm mười lăm nghìn đồng. Không ghi sổ tay, không sót một đồng!',
     device='web', stats=[['Xưởng nợ', '61.215.000 đ'], ['Kho nhôm', 'Tự trừ 64 cây']])
feat('q-f06-thoapp', 'n06-tho-debt', 'TRÊN APP CỦA THỢ', 'Thợ thấy nợ ngay trên app', 'Số tiền · Mã đơn · Còn phải trả · Báo thanh toán',
     'Ngay trên app của thợ, khoản nợ hiện rõ: số tiền, mã đơn, còn phải trả bao nhiêu. Thợ chuyển khoản hay đưa tiền mặt rồi báo thanh toán, nhà phân phối xác nhận là trừ nợ. Minh bạch hai bên, hết cãi nhau!',
     device='phone')
feat('q-f07-dash', 'n10-dashboard', 'TỔNG QUAN', 'Cả cơ nghiệp trên một màn hình', 'Tổng đơn · Số xưởng · Công nợ còn mở · Doanh thu tháng',
     'Còn đây là trang tổng quan: tổng số đơn, số xưởng đang quản lý, công nợ còn mở và doanh thu tháng này, nhìn một lần là nắm.',
     device='web', stats=g('dash_stats', None))
feat('q-f08-glass', 'n11-glass', 'KHO KÍNH', 'Kho kính có mã vạch', 'Mã đầu theo loại kính · Tự sinh mã vạch · In nhãn · Tính hướng cắt',
     'Có cả kho kính. Mỗi loại kính một mã đầu, nhập kích thước là hệ thống tự sinh mã vạch để in nhãn dán lên tấm. Tính hướng cắt thông minh, ưu tiên dùng đầu thừa trước, tiết kiệm từng tấm.',
     device='web')
feat('q-f09-scan', 'n12-scan', 'QUÉT MÃ VÀ KIỂM KÊ', 'Điện thoại là máy quét mã', 'Quét là cộng, trừ kho · Mất mạng vẫn quét · Nhiều máy kiểm kê cùng lúc',
     'Điện thoại chính là máy quét mã vạch. Mỗi lần quét tự cộng hoặc trừ kho. Mất mạng vẫn quét tiếp, có mạng tự gửi lại. Kiểm kê thì nhiều điện thoại cùng quét, số đếm hiện ngay trên máy tính.',
     device='web')
feat('q-f10-recon', 'n16-recon', 'ĐỐI CHIẾU', 'Đối chiếu theo từng xưởng', 'Số đơn theo trạng thái · Tổng kg · Tổng giá trị · Theo tháng',
     'Cuối tháng đối chiếu cực nhanh: mỗi xưởng bao nhiêu đơn, bao nhiêu ký, tổng giá trị là bao nhiêu, lọc theo từng tháng, số liệu nằm sẵn đó.',
     device='web', stats=g('recon_stats', None))
feat('q-f11-acct', 'n18-profile', 'TÀI KHOẢN', 'Bảo mật theo thiết bị', 'Tối đa 2 máy tính và 3 điện thoại · Đăng xuất từ xa · Thông tin trên PDF',
     'Bảo mật theo thiết bị: tối đa hai máy tính và ba điện thoại cùng đăng nhập, đăng xuất từ xa khi cần. Thông tin doanh nghiệp tự in lên phiếu giao và báo giá.',
     device='web')
S.append(dict(id='q-f20-outro', kind='outro', tag='Liên hệ Eurohouse để mở tài khoản NPP', sub='Đơn, kho, cân, công nợ: một màn hình!',
              text='Eurohouse en pê pê! Từ đơn của thợ, tồn kho, cân hàng cho tới công nợ, tất cả trong một màn hình. Liên hệ Eurohouse để mở tài khoản nhà phân phối ngay hôm nay! Nhôm của sự thịnh vượng!'))
json.dump(S, open(os.path.join(root, 'script-npp.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# --- teaser
T = []
keep = ['q-p00-hook', 'q-p01-order', 'q-p05-turn', 'q-f01-order', 'q-f03-stock', 'q-f04-weigh', 'q-f05-debt', 'q-f06-thoapp', 'q-f20-outro']
by = {s['id']: s for s in S}
tx = {
 'q-p00-hook': 'Nhà phân phối nhôm! Quản lý thợ, kho và công nợ bằng sổ tay sao?',
 'q-p01-order': 'Đơn qua Zalo, sai mã, sai màu, tồn kho lệch, công nợ không ai nhớ. Mất tiền mà không biết!',
 'q-p05-turn': 'Eurohouse en pê pê! Từ đơn của thợ đến công nợ, một màn hình!',
 'q-f01-order': 'Thợ đặt nhôm ngay trên app. Chọn màu, chọn thanh, bấm gửi!',
 'q-f03-stock': 'Nhà phân phối kiểm tồn kho theo màu, đủ hàng là giao!',
 'q-f04-weigh': 'Cân xong nhập số ký thực, thành tiền tự tính: sáu mươi mốt triệu hai trăm mười lăm nghìn!',
 'q-f05-debt': 'Hoàn thành đơn, công nợ tự sinh. Không sót một đồng!',
 'q-f06-thoapp': 'Thợ thấy nợ ngay trên app. Minh bạch hai bên!',
 'q-f20-outro': 'Eurohouse en pê pê! Nhôm của sự thịnh vượng!',
}
for i in keep:
    s = dict(by[i]); s['id'] = 't' + i; s['text'] = tx[i]
    if s['kind'] == 'feat': s['short'] = True
    if s['kind'] == 'pain': s['lines'] = by[i]['lines']
    T.append(s)
json.dump(T, open(os.path.join(root, 'script-npp-teaser.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(S), len(T))
