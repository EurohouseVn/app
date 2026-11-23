# Sinh script.json (bản đầy đủ) và script-teaser.json (bản ngắn) cho video v2: mở bằng nỗi đau của chủ xưởng.
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = []
def pain(id, tag, lines, text, bg='orange'):
    S.append(dict(id=id, kind='pain', tag=tag, lines=lines, text=text, bg=bg))
def feat(id, clip, tag, title, sub, text, **k):
    S.append(dict(id=id, kind='feat', clip=clip, tag=tag, title=title, sub=sub, text=text, **k))

pain('p00-hook', 'CÂU HỎI CHO CHỦ XƯỞNG', [['KHÓ KHĂN', 'ink'], ['NHẤT', 'white'], ['CỦA XƯỞNG?', 'ink']],
     'Chủ xưởng nhôm kính ơi! Khó khăn nhất của xưởng mình là gì? Và bạn đang quản lý nó ra sao?')
pain('p01-quote', 'NỖI ĐAU SỐ 1', [['BÁO GIÁ SAI', 'ink'], ['MỘT CON SỐ', 'white'], ['LỖ CẢ CÔNG TRÌNH', 'ink']],
     'Báo giá sai chỉ một con số, lỗ cả công trình!')
pain('p02-waste', 'NỖI ĐAU SỐ 2', [['NHÔM HAO HỤT', 'ink'], ['ĐẦU THỪA VỨT ĐI', 'white'], ['KHO CÒN BAO NHIÊU?', 'ink']],
     'Nhôm hao hụt. Đầu thừa cắt xong vứt bỏ. Còn kho thì còn bao nhiêu thanh? Không ai biết!')
pain('p03-money', 'NỖI ĐAU SỐ 3', [['CHẤM CÔNG BẰNG SỔ', 'ink'], ['CÔNG NỢ QUÊN ĐÒI', 'white'], ['THU CHI LẪN LỘN', 'ink']],
     'Cuối tháng ngồi cộng công, tính lương bằng tay. Công nợ khách quên đòi. Thu chi lẫn lộn, lời hay lỗ cũng chẳng rõ!')
pain('p04-late', 'NỖI ĐAU SỐ 4', [['CÔNG TRÌNH TRỄ HẸN', 'ink'], ['KHÔNG AI NẮM', 'white'], ['KẸT Ở KHÂU NÀO?', 'ink']],
     'Công trình trễ hẹn, mà chẳng ai biết đang kẹt ở khâu nào. Sổ tay, bảng tính, nhóm chat, đến bao giờ?')
S.append(dict(id='p05-turn', kind='turn', tag='GIẢI PHÁP', title='EUROHOUSE WORKSHOP OS', sub='Đã có trên App Store và CH Play',
              text='Dừng lại! Có một cách gọn hơn nhiều. Eurohouse Workshop OS: cả xưởng nhôm kính, gói gọn trong một chiếc điện thoại!'))
feat('f01-register', 'c02-register', 'BẮT ĐẦU', 'Đăng ký trong một phút', 'Email · mã 6 số · vào dùng ngay',
     'Đăng ký bằng email, nhập mã sáu số, và vào dùng ngay! Một phút là xong.')
feat('f02-home', 'c01-home', 'TRANG CHỦ', 'Mở app là thấy hết', 'Chấm công · việc gấp · công trình còn thu tiền',
     'Mở app lên là thấy hết: ai đi làm, việc nào gấp, công trình nào còn phải thu tiền!')
feat('f03-quote', 'c03-quote', 'BÁO GIÁ', 'Báo giá chuẩn, gửi ngay', 'Nhiều hạng mục cửa · xuất PDF gửi khách',
     'Báo giá chuẩn từng hạng mục, xuất PDF gửi khách trong vài phút. Hết cảnh báo giá theo cảm tính!')
feat('f04-orders', 'c04-orders', 'ĐẶT NHÔM', 'Đặt nhôm Eurohouse', 'Chọn màu · hệ nhôm · thanh · số lượng',
     'Đặt nhôm Eurohouse thật nhanh: chọn màu, chọn hệ, chọn thanh, chốt số lượng. Đơn đi là công nợ tự ghi!')
feat('f05-cut', 'c21-cutplan', 'CÔNG THỨC CẮT', 'Cắt đúng, ít hao', 'Công thức theo hệ · tận dụng đầu cắt thừa',
     'Nhập kích thước cửa, app tính ngay công thức cắt: cây nào cắt gì, dài bao nhiêu. Và phần ăn tiền nhất: ưu tiên tận dụng đầu cắt thừa trong kho! Ví dụ này, hai mươi bảy cây mới, ba mươi mốt đoạn tận dụng. Tiết kiệm từng cân nhôm!')
feat('f06-stock', 'c20-inventory', 'TỒN KHO', 'Kho nhôm nhìn là biết', 'Cây nguyên · đoạn đề-xê · phế liệu',
     'Tồn kho cây nguyên, đoạn đề-xê và phế liệu, nhìn là biết! Nhận kho, xuất kho chỉ một chạm. Đầu cắt từ một mét được lưu lại để dùng lần sau, đoạn quá ngắn mới tính phế liệu. Hết cảnh mua thừa, hết cảnh vứt tiền!')
feat('f07-projects', 'c06-projects', 'CÔNG TRÌNH', 'Mỗi công trình một sổ thu chi', 'Phiếu thu · phiếu chi · PDF tổng hợp',
     'Mỗi công trình một bảng thu chi riêng. Phiếu thu, phiếu chi rõ ràng, xuất PDF tổng hợp. Lời bao nhiêu, lỗ ở đâu, biết ngay!')
feat('f08-workforce', 'c07-workforce', 'QUẢN LÝ XƯỞNG', 'Chấm công, lương, bảo hiểm', 'Chấm công · việc khoán · lương · bảo hiểm',
     'Chấm công một chạm. Việc khoán chia đều cho thợ. Lương, phiếu lương PDF, bảo hiểm, app tự tính hết. Cuối tháng hết đau đầu!')
feat('f09-debts', 'c08-debts', 'CÔNG NỢ', 'Công nợ rõ từng đồng', 'Tự ghi từ đơn nhà phân phối',
     'Công nợ với nhà phân phối tự ghi từ đơn hàng. Còn nợ bao nhiêu, hạn nào, nhìn là rõ!')
feat('f10-invoices', 'c09-invoices', 'HOÁ ĐƠN · THUẾ', 'Hoá đơn điện tử và thuế', 'Doanh thu · hoá đơn · báo cáo theo quý',
     'Hoá đơn điện tử và thuế: theo dõi doanh thu, hoá đơn và báo cáo theo quý, không lo chạm ngưỡng mà không biết!')
feat('f11-remind', 'c10-reminders', 'NHẮC VIỆC', 'Không bỏ sót việc nào', 'Giao hàng · gọi khách · mua vật tư',
     'Nhắc việc giao hàng, gọi khách, mua vật tư. Không bỏ sót việc nào!')
feat('f12-shop', 'c11-shopfloor', 'VIỆC XƯỞNG', 'Thợ biết làm gì, quản lý biết ở đâu', 'Bắt đầu · tạm dừng · hoàn tất',
     'Giao việc cho từng thợ, theo dõi từ lúc bắt đầu đến khi hoàn tất. Công trình hết cảnh trễ hẹn!')
feat('f13-qc', 'c12-qc', 'KIỂM TRA CHẤT LƯỢNG', 'Kiểm từng bước trước khi giao', 'Danh mục kiểm rõ ràng',
     'Kiểm tra chất lượng theo danh mục rõ ràng, trước khi giao cửa cho khách!')
feat('f14-install', 'c13-install', 'LẮP ĐẶT', 'Lịch lắp đặt cho từng đội', 'Vật tư · dụng cụ · ảnh nghiệm thu',
     'Lịch lắp đặt cho từng đội, đủ vật tư, đủ dụng cụ, có ảnh nghiệm thu!')
feat('f15-warranty', 'c14-warranty', 'BẢO HÀNH', 'Bảo hành quét mã QR', 'Yêu cầu xử lý ngay · hồ sơ đầy đủ',
     'Bảo hành chỉ cần quét mã QR. Khách yêu cầu là xử lý ngay, hồ sơ lưu đầy đủ!')
feat('f16-weather', 'c15-weather', 'THỜI TIẾT', 'Chọn ngày lắp đặt đẹp trời', 'Dự báo 7 ngày theo khu vực',
     'Xem thời tiết bảy ngày theo khu vực, chọn đúng ngày lắp đặt đẹp trời!')
feat('f17-catalog', 'c16-catalog', 'CATALOG', 'Catalog trong túi', 'Hệ nhôm · mã thanh · mặt cắt',
     'Catalog và thư viện Eurohouse luôn trong túi: hệ nhôm, mã thanh, mặt cắt rõ nét, tra cứu ngay tại xưởng!')
feat('f18-ai', 'c18-assistant', 'TRỢ LÝ AI', 'Bé Eu · trợ lý AI của xưởng bạn', 'Trò chuyện · soạn lời chào · quy tắc riêng',
     'Và đây là Bé Eu, trợ lý AI riêng của từng xưởng! Hỏi gì đáp nấy, soạn lời chào gửi khách, và nhớ quy tắc riêng của xưởng bạn!', mascot=True)
S.append(dict(id='f19-pwa', kind='pwa', title='Tải ngay hôm nay', sub='App Store · CH Play · app.nhomeurohouse.com', tag='ĐÃ CÓ TRÊN APP STORE VÀ CH PLAY',
              text='Eurohouse Workshop OS đã có trên App Store và CH Play! Tải ngay, hoặc cài thẳng từ trang web, a, p, p, chấm nhom euro house chấm com!'))
S.append(dict(id='f20-outro', kind='outro', title='EUROHOUSE', sub='Nhôm của sự thịnh vượng', tag='app.nhomeurohouse.com',
              text='Eurohouse Workshop OS, đã có trên App Store và CH Play! Quản lý xưởng gọn trong tay. Nhôm của sự thịnh vượng!'))
json.dump(S, open(os.path.join(root, 'script.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

T = []
def tp(id, tag, lines, text):
    T.append(dict(id=id, kind='pain', tag=tag, lines=lines, text=text, bg='orange'))
tp('t00-hook', 'CHỦ XƯỞNG NHÔM KÍNH', [['KHÓ KHĂN', 'ink'], ['NHẤT', 'white'], ['CỦA XƯỞNG?', 'ink']], 'Chủ xưởng nhôm kính! Khó khăn nhất của xưởng là gì?')
tp('t01-pain', 'NỖI ĐAU', [['BÁO GIÁ SAI', 'ink'], ['ĐẦU THỪA VỨT ĐI', 'white'], ['KHO KHÔNG BIẾT', 'ink']], 'Báo giá sai, lỗ cả công trình. Đầu thừa vứt đi, kho còn bao nhiêu không ai biết!')
tp('t02-pain', 'NỖI ĐAU', [['CHẤM CÔNG BẰNG SỔ', 'ink'], ['CÔNG NỢ QUÊN ĐÒI', 'white'], ['TRỄ HẸN', 'ink']], 'Chấm công bằng sổ, công nợ quên đòi, công trình trễ hẹn!')
T.append(dict(id='t03-turn', kind='turn', tag='GIẢI PHÁP', title='EUROHOUSE WORKSHOP OS', sub='Đã có trên App Store và CH Play',
              text='Dừng lại! Eurohouse Workshop OS, cả xưởng trong một chiếc điện thoại!'))
for id, clip, tag, title, sub, text, m in [
    ('t04-cut', 'c21-cutplan', 'CẮT NHÔM', 'Tận dụng đầu cắt thừa', 'Công thức cắt · tối ưu hao hụt', 'Tính công thức cắt, tận dụng đầu cắt thừa, tiết kiệm từng cân nhôm!', False),
    ('t05-stock', 'c20-inventory', 'TỒN KHO', 'Kho nhôm nhìn là biết', 'Cây nguyên · đoạn đề-xê · phế liệu', 'Tồn kho rõ ràng, hết cảnh mua thừa, hết cảnh vứt tiền!', False),
    ('t07-work', 'c07-workforce', 'QUẢN LÝ XƯỞNG', 'Chấm công · lương · bảo hiểm', 'Tự tính hết · hết đau đầu', 'Chấm công, lương, bảo hiểm, app tự tính hết!', False),
    ('t08-ai', 'c18-assistant', 'TRỢ LÝ AI', 'Bé Eu · trợ lý AI', 'Trò chuyện · quy tắc riêng của xưởng', 'Thêm Bé Eu, trợ lý AI riêng cho xưởng bạn!', True)]:
    d = dict(id=id, kind='feat', clip=clip, tag=tag, title=title, sub=sub, text=text, short=True)
    if m: d['mascot'] = True
    T.append(d)
T.append(dict(id='t09-outro', kind='outro', title='EUROHOUSE', sub='Nhôm của sự thịnh vượng', tag='app.nhomeurohouse.com', text='Đã có trên App Store và CH Play! Nhôm của sự thịnh vượng!'))
json.dump(T, open(os.path.join(root, 'script-teaser.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(S), len(T))
