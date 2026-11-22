/** Bài kiến thức ngành nhôm, kính và giải pháp cửa cho màn "Kiến thức" của app. Chỉ nêu kiến thức chung, chắc chắn; thông số cụ thể của từng hệ xem catalog Eurohouse. */
export type SeedArticle = {
  title: string;
  categoryId: 'PRODUCT_INFO' | 'CONSTRUCTION_GUIDE' | 'CUTTING_GUIDE' | 'CREATIVE_GUIDE';
  content: string;
};

export const KNOWLEDGE_ARTICLES: SeedArticle[] = [
  {
    title: 'Nhôm định hình 6063-T5: vì sao là vật liệu làm cửa',
    categoryId: 'PRODUCT_INFO',
    content: `Phần lớn thanh nhôm làm cửa là hợp kim 6063, thành phần chính là nhôm với magiê và silic. Hợp kim này dễ đùn ép thành tiết diện phức tạp, bề mặt mịn nên sơn hoặc anod rất đẹp, lại đủ bền để làm khung cửa.

Ký hiệu T5 nghĩa là thanh được làm nguội ngay sau khi đùn rồi hoá già nhân tạo để tăng độ cứng. T6 cứng hơn nhưng quy trình phức tạp hơn; với cửa thông thường T5 là lựa chọn phổ biến.

Điều cần nhớ:
• Độ dày thành thanh quyết định độ cứng và giá. Thanh quá mỏng dễ cong khi cánh lớn hoặc kính nặng.
• Mỗi mã thanh có khối lượng trên mét (kg/m) riêng, dùng để tính nhôm và giá.
• Cây tiêu chuẩn thường dài 6 mét; chiều dài và quy cách bó xem trong catalog.
• Thanh đạt chất lượng có bề mặt đều, không rỗ, không xước sâu, tiết diện đúng bản vẽ.

Khi nhận hàng, nên kiểm mã thanh, màu, số cây và tình trạng bề mặt trước khi ký nhận.`,
  },
  {
    title: 'Xử lý bề mặt nhôm: sơn tĩnh điện, anod hoá, vân gỗ',
    categoryId: 'PRODUCT_INFO',
    content: `Bề mặt quyết định màu sắc và độ bền của cửa ngoài trời. Có ba cách phổ biến.

Sơn tĩnh điện: phun bột sơn tích điện lên thanh rồi nung cho chảy thành lớp phủ. Nhiều màu, giá hợp lý, lớp sơn thường dày khoảng 60 đến 80 micron. Đây là lựa chọn phổ biến nhất cho cửa nhà ở.

Anod hoá: tạo lớp oxit ngay trên bề mặt nhôm bằng điện hoá. Giữ được ánh kim loại, bền màu, nhưng ít màu hơn và phụ thuộc kỹ thuật xử lý.

Vân gỗ: phủ lớp in vân gỗ lên bề mặt sơn, cho vẻ ngoài gần với gỗ mà không phải bảo dưỡng như gỗ thật.

Lưu ý khi chọn:
• Công trình gần biển hoặc khu công nghiệp nên chọn lớp phủ chất lượng tốt và bảo trì thường xuyên.
• Màu đậm hấp thụ nhiệt nhiều hơn màu sáng.
• Cắt, khoan sau khi sơn sẽ lộ nhôm trần ở vết cắt; nên xử lý đầu cắt và vệ sinh bavia.
• Cùng một mã màu nhưng khác lô sơn có thể lệch nhẹ, nên đặt đủ thanh cho một công trình trong cùng một lần.`,
  },
  {
    title: 'Cầu cách nhiệt trong cửa nhôm: khi nào cần',
    categoryId: 'PRODUCT_INFO',
    content: `Nhôm dẫn nhiệt rất tốt. Với cửa nhôm thường, nhiệt từ ngoài dễ truyền vào trong, mùa nóng thì nóng, mùa lạnh có thể đọng sương ở khung.

Cầu cách nhiệt là thanh nhựa kỹ thuật chèn giữa phần nhôm phía trong và phía ngoài của cùng một thanh, cắt đứt đường truyền nhiệt. Kết hợp với kính hộp, cửa cách nhiệt và cách âm tốt hơn rõ rệt.

Nên cân nhắc cầu cách nhiệt khi:
• Nhà dùng điều hoà nhiều, mặt tiền hướng nắng gắt.
• Khu vực yên tĩnh cần cách âm, hoặc ngược lại phố ồn.
• Muốn hạn chế đọng sương trên khung vào mùa lạnh.

Không phải công trình nào cũng cần: ban công thông gió, nhà kho hay vách ngăn nội bộ thường dùng hệ thường để tiết kiệm. Cầu cách nhiệt làm tăng giá nên chọn theo nhu cầu thực tế của khách.`,
  },
  {
    title: 'Chọn kính cho cửa nhôm: cường lực, dán an toàn, kính hộp, Low-E',
    categoryId: 'PRODUCT_INFO',
    content: `Kính chiếm phần lớn diện tích cửa nên ảnh hưởng nhiều đến an toàn, cách nhiệt và giá.

Kính cường lực: kính thường được tôi nhiệt, chịu lực và va đập tốt hơn khoảng bốn đến năm lần. Khi vỡ tạo hạt nhỏ ít sắc. Đây là lựa chọn mặc định cho cửa đi và ô kính lớn.

Kính dán an toàn: hai lớp kính liên kết bằng màng ở giữa. Khi vỡ mảnh vẫn dính vào màng, hạn chế rơi vỡ. Dùng cho lan can, mái kính, nơi cần an toàn cao và cách âm tốt hơn.

Kính hộp: hai lớp kính ngăn cách bằng khoảng không khí hoặc khí trơ. Giảm truyền nhiệt và tiếng ồn, giảm ngưng tụ hơi nước.

Kính Low-E: có lớp phủ phản xạ bức xạ nhiệt, giúp phòng mát hơn mà vẫn lấy sáng.

Khi chọn cần xét: kích thước ô kính, vị trí lắp (cao, sát đất, gần cầu thang), hướng nắng và ngân sách. Độ dày kính phải phù hợp với kích thước ô kính và khả năng chịu tải của khung; không tự ý tăng kích thước ô kính so với thiết kế của hệ.`,
  },
  {
    title: 'Phụ kiện kim khí và gioăng: phần quyết định độ bền của cửa',
    categoryId: 'PRODUCT_INFO',
    content: `Cửa nhôm tốt hay không phụ thuộc rất nhiều vào phụ kiện, thứ dễ bị bỏ qua khi so giá.

Bản lề, khoá và tay nắm: cửa mở quay dùng bản lề chịu tải theo trọng lượng cánh. Khoá đa điểm siết cánh vào khung tại nhiều vị trí, giúp kín khít và an toàn hơn khoá một điểm. Chọn phụ kiện đúng tải trọng của cánh, đúng rãnh của hệ nhôm.

Bánh xe và ray: cửa trượt chịu tải qua bánh xe. Bánh kém chất lượng gây chạy nặng, kêu và mòn ray nhanh.

Gioăng: thường làm bằng cao su EPDM, chịu nắng mưa tốt. Gioăng giữ kính, chống thấm và giảm ồn. Gioăng bị lão hoá, co ngót là nguyên nhân thấm nước thường gặp sau vài năm.

Lời khuyên cho xưởng:
• Dùng đúng bộ phụ kiện do nhà cung cấp hệ nhôm khuyến nghị.
• Kiểm tra gioăng liên tục không bị đứt hoặc hở tại góc.
• Hướng dẫn khách tra dầu bản lề, ray định kỳ để cửa luôn êm.`,
  },
  {
    title: 'Cửa mở quay, mở trượt, xếp trượt: chọn kiểu nào?',
    categoryId: 'CREATIVE_GUIDE',
    content: `Mỗi kiểu mở có ưu và nhược điểm riêng. Chọn đúng kiểu giúp cửa bền và khách hài lòng.

Mở quay: cánh quay quanh bản lề như cửa thông thường. Ưu điểm là kín khít, cách âm và chống thấm tốt. Nhược điểm là cần khoảng trống để mở cánh. Phù hợp cửa chính, cửa sổ cần kín.

Mở trượt (lùa): cánh trượt trên ray. Tiết kiệm không gian, hợp ban công, phòng nhỏ. Độ kín thường kém hơn mở quay và ray cần vệ sinh thường xuyên.

Xếp trượt: nhiều cánh gập lại khi mở, tạo khẩu độ rất rộng. Hợp phòng khách ra sân vườn, quán cà phê. Yêu cầu phụ kiện và thi công chính xác.

Mở hất: thông gió ngay cả khi trời mưa, thường dùng cho cửa sổ nhà vệ sinh, bếp.

Mẹo tư vấn: hỏi khách cần ưu tiên điều gì, kín và yên tĩnh, tiết kiệm không gian, hay mở rộng tầm nhìn, rồi mới đề xuất kiểu cửa và hệ nhôm.`,
  },
  {
    title: 'Giải pháp cửa theo không gian: mặt tiền, phòng ngủ, ban công, bếp, nhà xưởng',
    categoryId: 'CREATIVE_GUIDE',
    content: `Cùng một hệ nhôm nhưng mỗi không gian cần ưu tiên khác nhau.

Mặt tiền và cửa chính: cần chắc chắn, an toàn, đẹp. Nên chọn hệ khung dày, kính cường lực hoặc kính dán, khoá đa điểm; màu đồng bộ với kiến trúc.

Phòng ngủ: ưu tiên cách âm, cách nhiệt, riêng tư. Kính hộp, gioăng kín, cửa mở quay là hợp lý.

Ban công và lô gia: cần chống thấm, chịu gió, thông thoáng. Cửa trượt hoặc xếp trượt, kính cường lực, chú ý lan can và thoát nước chân cửa.

Bếp và nhà vệ sinh: chịu ẩm và dầu mỡ, dễ vệ sinh. Cửa sổ mở hất hoặc mở quay, bề mặt sơn bền, phụ kiện chống gỉ.

Phòng khách ra sân vườn: khẩu độ lớn, dùng xếp trượt hoặc trượt lớn, kính dày, sàn nhẹ nhàng.

Showroom, văn phòng, nhà xưởng: vách kính, mặt dựng, cửa lớn cần độ cứng cao và chịu gió; tính toán tải trọng và gia cường thay vì chỉ nhìn giá.

Một bản tư vấn tốt nêu rõ vì sao chọn hệ và kính đó cho đúng không gian của khách.`,
  },
  {
    title: 'Các hệ nhôm Eurohouse và cách chọn',
    categoryId: 'PRODUCT_INFO',
    content: `Eurohouse có 11 hệ nhôm, mỗi hệ dùng cho một nhóm sản phẩm. Tên và mã hệ trong hệ thống:

• Hệ 70 Ecento (EU-70) và Ecento Plus (EU-ECPLUS): dòng cửa mở quay cao cấp.
• Hệ 55 Vát Cạnh (EU-55) và Hệ Preco (EU-PRECO): dòng cửa phổ thông đến trung cấp.
• Hệ trượt Châu Âu (EU-TRUOT) và Hệ trượt quay (EU-TQ): cửa trượt và trượt quay.
• Hệ thủy lực (EU-TL): cửa đi dùng bản lề thuỷ lực.
• Hệ nội thất (EU-NOITHAT), Hệ chấn song (EU-CS), Hệ phào đại hội (EU-PDH): các hệ cho nội thất, lan can chấn song và chi tiết trang trí.
• Hệ mặt dựng (EU-MD): vách kính mặt dựng.

Cách chọn nhanh:
• Hỏi nhu cầu: cửa chính hay cửa sổ, cần kín và cách âm hay tiết kiệm không gian.
• Chọn kiểu mở, rồi chọn hệ phù hợp kiểu mở đó.
• Cân đối ngân sách giữa hệ cao cấp và hệ phổ thông.

Mã thanh, khối lượng kg/m, độ dày và quy cách bó của từng hệ có trong Catalog Eurohouse mới nhất và trong mục Công thức, Đặt nhôm của ứng dụng.`,
  },
  {
    title: 'Khảo sát và đo đạc trước khi làm cửa',
    categoryId: 'CONSTRUCTION_GUIDE',
    content: `Đo sai là nguyên nhân hàng đầu khiến cửa phải làm lại. Quy trình đo chuẩn:

1. Đo ở nhiều điểm: đo chiều rộng ở trên, giữa, dưới và chiều cao ở trái, giữa, phải. Lấy số nhỏ nhất làm số liệu để cửa không bị kẹt.
2. Kiểm tra độ vuông: đo hai đường chéo của ô chờ. Chênh lệch lớn nghĩa là ô chờ bị méo, cần xử lý hoặc chừa dung sai.
3. Xác định phần hoàn thiện: nếu sẽ ốp lát, trát hoặc sơn sau khi lắp, tính trước độ dày của lớp hoàn thiện.
4. Chừa khe lắp đặt: thường chừa khe giữa khung cửa và tường để xử lý chống thấm và bơm keo.
5. Ghi đủ thông tin: kiểu mở, hướng mở, hệ nhôm, màu, loại kính, phụ kiện, vị trí lắp.
6. Chụp ảnh hiện trạng và ghi chú vào hồ sơ công trình để tránh tranh cãi sau này.

Mẹo: đo bằng thước thép và ghi số liệu ngay tại chỗ, không nhớ trong đầu. Với công trình mới xây, hỏi chủ nhà lớp hoàn thiện cuối cùng của sàn và tường.`,
  },
  {
    title: 'Lắp đặt cửa nhôm: quy trình và các lỗi thường gặp',
    categoryId: 'CONSTRUCTION_GUIDE',
    content: `Cửa làm đẹp đến đâu mà lắp sai vẫn dễ hỏng. Quy trình lắp cơ bản:

1. Kiểm tra ô chờ: sạch, đủ kích thước, không lồi lõm.
2. Đặt khung vào vị trí, dùng nivô và dây dọi chỉnh thẳng đứng và ngang bằng, kê nêm tạm.
3. Cố định khung vào tường bằng vít nở hoặc ke theo khoảng cách hợp lý, thường vài chục centimet một điểm và gần các góc.
4. Lắp cánh, kính và phụ kiện; chỉnh bản lề, bánh xe để cánh êm, khít.
5. Xử lý khe giữa khung và tường bằng vật liệu phù hợp rồi hoàn thiện bằng keo silicone trung tính.
6. Vệ sinh và bàn giao: thử đóng mở nhiều lần, kiểm tra khoá.

Lỗi thường gặp:
• Khung bị vặn do siết vít quá chặt hoặc không đều.
• Cánh sệ, cọ khung vì chỉnh bản lề chưa đúng.
• Thấm nước ở khe do trám keo hời hợt hoặc chân cửa không thoát nước.
• Trầy xước bề mặt trong lúc thi công: nên dán băng bảo vệ đến lúc bàn giao.`,
  },
  {
    title: 'Chống thấm và thoát nước cho cửa nhôm',
    categoryId: 'CONSTRUCTION_GUIDE',
    content: `Thấm nước là phàn nàn phổ biến nhất của cửa nhôm kính. Hầu hết xuất phát từ ba chỗ.

1. Khe giữa khung và tường: phải được trám kín. Nên dùng keo và vật liệu trám phù hợp, tránh để hở nhất là phần đáy và góc.
2. Chân cửa và rãnh thoát nước: ray cửa trượt và đáy khung có lỗ thoát nước. Bít lỗ này bằng keo hoặc bụi vữa sẽ làm nước đọng và tràn vào nhà. Luôn kiểm tra thông thoáng.
3. Gioăng và keo kính: gioăng phải liên tục, góc nối đúng kỹ thuật. Keo silicone trung tính dùng cho kính phải đúng loại, bám sạch.

Nguyên tắc thiết kế: nước mưa phải có đường thoát rõ ràng ra ngoài; không để phần ngoài thấp hơn phần trong ở ngưỡng cửa; ban công cần độ dốc thoát nước ra ngoài.

Khi nhận phản ánh thấm, kiểm tra theo thứ tự: lỗ thoát nước, keo khe tường, gioăng, rồi mới tới kính và khung. Cách này tiết kiệm công đi lại.`,
  },
  {
    title: 'Bảo trì, vệ sinh và bảo hành cửa nhôm kính',
    categoryId: 'CONSTRUCTION_GUIDE',
    content: `Cửa bền lâu nhờ bảo trì đúng cách. Hướng dẫn khách:

Vệ sinh:
• Dùng nước sạch pha xà phòng loãng và khăn mềm, lau cả khung và kính.
• Không dùng axit, chất tẩy mạnh hay vật cứng cọ lên bề mặt sơn.
• Vệ sinh ray cửa trượt và lỗ thoát nước để nước không đọng.

Bôi trơn: tra dầu bản lề, ray và khoá định kỳ vài tháng một lần, nhất là khu vực gần biển.

Kiểm tra: gioăng bị nứt, keo bong, bản lề lỏng, cánh sệ cần xử lý sớm để tránh hỏng lan rộng.

Bảo hành: nên ghi rõ phạm vi (khung nhôm, bề mặt, phụ kiện, kính), thời hạn và những trường hợp không bảo hành như va đập, lắp đặt sai do bên thứ ba, hoá chất ăn mòn. Lập phiếu bảo hành điện tử trong ứng dụng để tra cứu nhanh và theo dõi phiếu sửa chữa.

Xưởng chu đáo là xưởng nhắc khách bảo trì và chủ động chăm sóc sau bán hàng.`,
  },
  {
    title: 'Tính khối lượng nhôm và cách báo giá cửa',
    categoryId: 'CUTTING_GUIDE',
    content: `Khối lượng của một thanh bằng khối lượng trên mét (kg/m) nhân chiều dài (mét). Ví dụ thanh 1,2 kg/m dài 6 mét nặng 7,2 kg. Tổng nhôm của một cửa là tổng khối lượng các đoạn cần cắt.

Cách báo giá phổ biến:
• Theo mét vuông cửa thành phẩm: đơn giá đã gồm nhôm, kính, phụ kiện, công. Nhanh, dễ hiểu với khách.
• Theo khối lượng nhôm: nhôm tính theo kg nhân đơn giá, cộng riêng kính, phụ kiện, nhân công. Minh bạch hơn cho công trình lớn.

Các yếu tố làm giá thay đổi: hệ nhôm và độ dày, màu bề mặt, loại kính, phụ kiện, kiểu mở, độ phức tạp, vận chuyển và lắp đặt.

Lời khuyên:
• Luôn cộng hao hụt khi cắt vào khối lượng nhôm.
• Ghi rõ phạm vi, kích thước và loại kính trong báo giá, tránh phát sinh.
• Giá chỉ mang tính tham khảo cho đến khi khảo sát và đo đạc thực tế xong.`,
  },
  {
    title: 'Cắt nhôm thông minh: giảm hao hụt và tận dụng đầu thừa',
    categoryId: 'CUTTING_GUIDE',
    content: `Một cây nhôm 6 mét được cắt thành nhiều đoạn theo bản vẽ. Phần còn lại sau khi cắt gọi là đầu thừa. Cách cắt quyết định bạn tốn bao nhiêu cây nhôm cho cùng một công trình.

Nguyên tắc giảm hao hụt:
• Gộp các đoạn cùng mã thanh và cùng màu của nhiều cửa để cắt chung trên một cây.
• Xếp đoạn dài trước, rồi lấp khoảng trống còn lại bằng các đoạn ngắn hơn.
• Tính cả độ dày lưỡi cưa và góc cắt 45 độ hoặc 90 độ; góc cắt 45 độ tốn chiều dài hơn.
• Nhờ công cụ tối ưu cắt trong ứng dụng tính sẵn phương án, tránh tính tay.

Đầu thừa:
• Đủ dài thì giữ lại, ghi chiều dài, mã thanh, màu vào kho đoạn dư để dùng cho lần cắt sau.
• Quá ngắn thì tách ra thành phế liệu và bán theo kg.
• Đừng để đầu thừa lẫn lộn trong kho: không biết còn gì sẽ bị mua mới trong khi vẫn có sẵn.

Làm tốt khâu này, xưởng có thể tiết kiệm đáng kể nhôm mỗi tháng.`,
  },
  {
    title: 'Quản lý tồn kho nhôm trong xưởng',
    categoryId: 'CUTTING_GUIDE',
    content: `Tồn kho nhôm lộn xộn dẫn tới hai thiệt hại: thiếu hàng giữa chừng làm trễ công trình, và mua trùng làm đọng vốn.

Nên quản lý ba nhóm:
1. Cây nguyên: theo mã thanh và màu, số lượng cây còn.
2. Đoạn dư tái sử dụng: ghi chiều dài, mã thanh, màu của từng đoạn đủ dài để dùng lại.
3. Phế liệu: đoạn quá ngắn hoặc hỏng, tính khối lượng để bán và đối chiếu hao hụt.

Thói quen tốt:
• Mọi lần nhập, xuất, điều chỉnh đều ghi lại kèm lý do và ngày.
• Đặt ngưỡng cảnh báo tồn thấp cho các mã thanh dùng nhiều để kịp đặt hàng.
• Cuối tháng kiểm đếm thực tế và đối chiếu với sổ, lệch phải tìm nguyên nhân.
• Đặt nhôm theo cây với nhà phân phối theo kế hoạch công trình, tránh đặt vội.

Dùng chức năng Kho nhôm và Đặt nhôm trong ứng dụng để mọi thứ được ghi nhận ngay, không phụ thuộc trí nhớ.`,
  },
];
