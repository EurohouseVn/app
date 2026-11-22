export type GalleryCategory = 'cua-di' | 'cua-so' | 'mau-profile' | 'nha-may';

export type GalleryPhoto = {
  id: string;
  src: string;
  title: string;
  category: GalleryCategory;
  /** Bề mặt nhìn thấy trên ảnh; chuỗi rỗng khi không áp dụng (ảnh nhà máy). */
  finish: string;
  width: number;
  height: number;
};

export const galleryCategories: readonly { id: GalleryCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'cua-di', label: 'Cửa đi' },
  { id: 'cua-so', label: 'Cửa sổ và vách' },
  { id: 'mau-profile', label: 'Mẫu và cánh cửa' },
  { id: 'nha-may', label: 'Nhà máy' },
];

/** Ảnh thật từ kho tư liệu marketing EUROHOUSE. Không ghi tên chủ nhà hay địa điểm. */
export const galleryPhotos: readonly GalleryPhoto[] = [
  { id: 'cua-di-go-kinh-hoa-van', src: '/images/gallery/cong-trinh/cua-di-go-kinh-hoa-van.webp', title: 'Cửa đi hai cánh vân gỗ, kính ốp nan đồng', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-di-go-phong-khach', src: '/images/gallery/cong-trinh/cua-di-go-phong-khach.webp', title: 'Cửa đi hai cánh vân gỗ cho phòng khách', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-di-go-khung-trang-tri', src: '/images/gallery/cong-trinh/cua-di-go-khung-trang-tri.webp', title: 'Cửa đi vân gỗ có khung trang trí và kính hoa văn', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-di-xam-bon-canh', src: '/images/gallery/cong-trinh/cua-di-xam-bon-canh.webp', title: 'Cửa đi bốn cánh màu xám than, tay nắm đồng', category: 'cua-di', finish: 'Xám', width: 1300, height: 975 },
  { id: 'cua-di-xam-san-da', src: '/images/gallery/cong-trinh/cua-di-xam-san-da.webp', title: 'Cửa đi xám than ở sảnh lát đá hoa văn', category: 'cua-di', finish: 'Xám', width: 975, height: 1300 },
  { id: 'cua-kinh-lon-noi-that', src: '/images/gallery/cong-trinh/cua-kinh-lon-noi-that.webp', title: 'Cửa kính lớn nhiều ô kính, nhìn từ bên trong', category: 'cua-di', finish: 'Nâu đậm', width: 975, height: 1300 },
  { id: 'cua-di-xam-co-dien', src: '/images/gallery/cong-trinh/cua-di-xam-co-dien.webp', title: 'Cửa đi xám phong cách cổ điển, kính hoa văn', category: 'cua-di', finish: 'Xám', width: 1300, height: 975 },
  { id: 'cua-di-go-bon-canh', src: '/images/gallery/cong-trinh/cua-di-go-bon-canh.webp', title: 'Cửa đi bốn cánh vân gỗ, kính trong', category: 'cua-di', finish: 'Vân gỗ', width: 960, height: 1280 },
  { id: 'cua-di-xam-hai-canh-kinh', src: '/images/gallery/cong-trinh/cua-di-xam-hai-canh-kinh.webp', title: 'Cửa đi hai cánh kính lớn màu xám', category: 'cua-di', finish: 'Xám', width: 960, height: 1280 },
  { id: 'cua-di-go-kinh-lon', src: '/images/gallery/cong-trinh/cua-di-go-kinh-lon.webp', title: 'Cửa đi vân gỗ, vách kính nan đồng', category: 'cua-di', finish: 'Vân gỗ', width: 1300, height: 975 },
  { id: 'cua-di-go-mot-canh', src: '/images/gallery/cong-trinh/cua-di-go-mot-canh.webp', title: 'Cửa đi một cánh vân gỗ', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-phong-go-mot-canh', src: '/images/gallery/cong-trinh/cua-phong-go-mot-canh.webp', title: 'Cửa phòng vân gỗ đỏ', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-phong-go-sau', src: '/images/gallery/cong-trinh/cua-phong-go-sau.webp', title: 'Cửa phòng vân gỗ nâu sẫm', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-di-xam-bon-canh-kinh', src: '/images/gallery/cong-trinh/cua-di-xam-bon-canh-kinh.webp', title: 'Cửa đi bốn cánh màu xám ghi, kính khung đứng', category: 'cua-di', finish: 'Xám', width: 960, height: 1280 },
  { id: 'cua-phong-den', src: '/images/gallery/cong-trinh/cua-phong-den.webp', title: 'Cửa phòng và cửa thông tầng màu đen', category: 'cua-di', finish: 'Đen', width: 979, height: 1300 },
  { id: 'cua-phong-xam-xanh', src: '/images/gallery/cong-trinh/cua-phong-xam-xanh.webp', title: 'Cửa một cánh màu xám xanh', category: 'cua-di', finish: 'Xám', width: 960, height: 1280 },
  { id: 'cua-phong-xam-nhat', src: '/images/gallery/cong-trinh/cua-phong-xam-nhat.webp', title: 'Cửa một cánh màu xám nhạt, gờ nổi', category: 'cua-di', finish: 'Xám', width: 979, height: 1300 },
  { id: 'cua-di-nau-kinh', src: '/images/gallery/cong-trinh/cua-di-nau-kinh.webp', title: 'Cửa đi nâu có ô kính', category: 'cua-di', finish: 'Nâu', width: 979, height: 1300 },
  { id: 'cua-di-go-kinh-cong', src: '/images/gallery/cong-trinh/cua-di-go-kinh-cong.webp', title: 'Cửa đi hai cánh vân gỗ, kính hoa văn', category: 'cua-di', finish: 'Vân gỗ', width: 960, height: 1280 },
  { id: 'cua-di-go-do-kinh', src: '/images/gallery/cong-trinh/cua-di-go-do-kinh.webp', title: 'Cửa đi hai cánh gỗ đỏ, kính trong', category: 'cua-di', finish: 'Vân gỗ', width: 979, height: 1300 },
  { id: 'cua-di-nau-dam', src: '/images/gallery/cong-trinh/cua-di-nau-dam.webp', title: 'Cửa đi hai cánh nâu đậm, khe kính đứng', category: 'cua-di', finish: 'Nâu đậm', width: 960, height: 1280 },
  { id: 'cua-di-go-vien-xanh', src: '/images/gallery/cong-trinh/cua-di-go-vien-xanh.webp', title: 'Cửa đi hai cánh vân gỗ, kính lớn', category: 'cua-di', finish: 'Vân gỗ', width: 1280, height: 960 },
  { id: 'cua-di-nau-kinh-vach', src: '/images/gallery/cong-trinh/cua-di-nau-kinh-vach.webp', title: 'Cửa đi nâu đậm, khe kính đứng, hoa văn đồng', category: 'cua-di', finish: 'Nâu đậm', width: 960, height: 1280 },
  { id: 'cua-di-go-bon-canh-cao', src: '/images/gallery/cong-trinh/cua-di-go-bon-canh-cao.webp', title: 'Cửa đi bốn cánh vân gỗ', category: 'cua-di', finish: 'Vân gỗ', width: 732, height: 1300 },
  { id: 'cua-di-xam-hai-canh-pano', src: '/images/gallery/cong-trinh/cua-di-xam-hai-canh-pano.webp', title: 'Cửa đi hai cánh xám, pano nổi', category: 'cua-di', finish: 'Xám', width: 960, height: 1280 },
  { id: 'cua-di-go-kinh-hoa-van-2', src: '/images/gallery/cong-trinh/cua-di-go-kinh-hoa-van-2.webp', title: 'Cửa đi vân gỗ có ô kính hoa văn', category: 'cua-di', finish: 'Vân gỗ', width: 919, height: 1300 },
  { id: 'cua-phong-go-pano', src: '/images/gallery/cong-trinh/cua-phong-go-pano.webp', title: 'Cửa phòng vân gỗ có pano nổi', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-di-xam-co-dien-2', src: '/images/gallery/cong-trinh/cua-di-xam-co-dien-2.webp', title: 'Cửa đi xám, khung ốp phào cổ điển', category: 'cua-di', finish: 'Xám', width: 720, height: 960 },
  { id: 'cua-di-go-hai-canh-pano', src: '/images/gallery/cong-trinh/cua-di-go-hai-canh-pano.webp', title: 'Cửa đi hai cánh vân gỗ pano nổi', category: 'cua-di', finish: 'Vân gỗ', width: 960, height: 1280 },
  { id: 'cua-di-go-kinh-van-go', src: '/images/gallery/cong-trinh/cua-di-go-kinh-van-go.webp', title: 'Cửa đi và vách kính vân gỗ', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-di-go-kinh-mot-canh', src: '/images/gallery/cong-trinh/cua-di-go-kinh-mot-canh.webp', title: 'Cửa kính một cánh vân gỗ', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-di-kinh-hai-canh', src: '/images/gallery/cong-trinh/cua-di-kinh-hai-canh.webp', title: 'Cửa đi hai cánh kính lớn, cửa sổ cố định', category: 'cua-di', finish: 'Nâu', width: 975, height: 1300 },
  { id: 'cua-di-go-kinh-ngoai-troi', src: '/images/gallery/cong-trinh/cua-di-go-kinh-ngoai-troi.webp', title: 'Cửa đi hai cánh vân gỗ, kính hoa văn', category: 'cua-di', finish: 'Vân gỗ', width: 752, height: 1020 },
  { id: 'cua-di-xam-nhin-nghieng', src: '/images/gallery/cong-trinh/cua-di-xam-nhin-nghieng.webp', title: 'Cửa đi xám than nhìn nghiêng ở sảnh', category: 'cua-di', finish: 'Xám', width: 975, height: 1300 },
  { id: 'cua-di-go-khung-lon', src: '/images/gallery/cong-trinh/cua-di-go-khung-lon.webp', title: 'Cửa đi và vách vân gỗ có khung lớn', category: 'cua-di', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-so-nau-dam', src: '/images/gallery/cong-trinh/cua-so-nau-dam.webp', title: 'Cửa sổ nhiều ô kính, hoa văn đồng', category: 'cua-so', finish: 'Nâu đậm', width: 720, height: 1280 },
  { id: 'cua-so-den-mo-quay', src: '/images/gallery/cong-trinh/cua-so-den-mo-quay.webp', title: 'Cửa sổ mở quay màu đen', category: 'cua-so', finish: 'Đen', width: 960, height: 1280 },
  { id: 'cua-so-xam-vach-kinh', src: '/images/gallery/cong-trinh/cua-so-xam-vach-kinh.webp', title: 'Cửa sổ và vách kính nhiều ô màu xám', category: 'cua-so', finish: 'Xám', width: 975, height: 1300 },
  { id: 'cua-so-go-song-sat', src: '/images/gallery/cong-trinh/cua-so-go-song-sat.webp', title: 'Cửa sổ vân gỗ có chấn song bảo vệ', category: 'cua-so', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'cua-so-nau-hai-canh', src: '/images/gallery/cong-trinh/cua-so-nau-hai-canh.webp', title: 'Cửa sổ hai cánh nâu', category: 'cua-so', finish: 'Nâu', width: 975, height: 1300 },
  { id: 'cua-so-xam-mo-hat', src: '/images/gallery/cong-trinh/cua-so-xam-mo-hat.webp', title: 'Cửa sổ mở hất màu xám', category: 'cua-so', finish: 'Xám', width: 975, height: 1300 },
  { id: 'cua-truot-xam-kinh', src: '/images/gallery/cong-trinh/cua-truot-xam-kinh.webp', title: 'Cửa trượt xám có khung kính trên', category: 'cua-so', finish: 'Xám', width: 964, height: 1280 },
  { id: 'profile-van-go-cuon', src: '/images/gallery/cong-trinh/profile-van-go-cuon.webp', title: 'Thanh profile vân gỗ trong màng bảo vệ', category: 'mau-profile', finish: 'Vân gỗ', width: 598, height: 1280 },
  { id: 'cua-go-pano-trong-san-xuat', src: '/images/gallery/cong-trinh/cua-go-pano-trong-san-xuat.webp', title: 'Cánh cửa vân gỗ pano đang trong xưởng', category: 'mau-profile', finish: 'Vân gỗ', width: 975, height: 1300 },
  { id: 'canh-cua-xam-san-xuat', src: '/images/gallery/cong-trinh/canh-cua-xam-san-xuat.webp', title: 'Ba cánh cửa xám trong màng bảo vệ', category: 'mau-profile', finish: 'Xám', width: 1300, height: 979 },
  { id: 'canh-cua-pano-xam', src: '/images/gallery/cong-trinh/canh-cua-pano-xam.webp', title: 'Cánh cửa xám pano nổi, mặt cắt viền', category: 'mau-profile', finish: 'Xám', width: 975, height: 1300 },
  { id: 'cua-chop-van-go', src: '/images/gallery/cong-trinh/cua-chop-van-go.webp', title: 'Cánh chớp lá sách vân gỗ', category: 'mau-profile', finish: 'Vân gỗ', width: 979, height: 1300 },
  { id: 'cua-so-song-sat-khung-go', src: '/images/gallery/cong-trinh/cua-so-song-sat-khung-go.webp', title: 'Khung cửa sổ vân gỗ có chấn song', category: 'mau-profile', finish: 'Vân gỗ', width: 736, height: 1000 },
  { id: 'khung-cua-song-sat-vat-canh', src: '/images/gallery/cong-trinh/khung-cua-song-sat-vat-canh.webp', title: 'Khung cửa có chấn song bảo vệ, mặt cắt', category: 'mau-profile', finish: 'Vân gỗ', width: 736, height: 1000 },
  { id: 'day-chuyen-son', src: '/images/gallery/cong-trinh/day-chuyen-son.webp', title: 'Dây chuyền sơn tĩnh điện', category: 'nha-may', finish: '', width: 1300, height: 732 },
  { id: 'san-nha-may', src: '/images/gallery/cong-trinh/san-nha-may.webp', title: 'Sân và nhà xưởng EUROHOUSE', category: 'nha-may', finish: '', width: 1300, height: 732 },
  { id: 'phoi-nhom', src: '/images/gallery/cong-trinh/phoi-nhom.webp', title: 'Phôi nhôm tròn chờ đùn ép', category: 'nha-may', finish: '', width: 732, height: 1300 },
  { id: 'kho-profile', src: '/images/gallery/cong-trinh/kho-profile.webp', title: 'Kho profile và mẫu trưng bày', category: 'nha-may', finish: '', width: 1300, height: 975 },
  { id: 'uon-cong-profile', src: '/images/gallery/cong-trinh/uon-cong-profile.webp', title: 'Profile uốn cong trong xưởng gia công', category: 'nha-may', finish: '', width: 1080, height: 810 },
];
