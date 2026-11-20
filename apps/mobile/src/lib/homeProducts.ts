// Bốn dòng nhôm chủ lực hiển thị ở trang chủ, cùng ảnh với website nhomeurohouse.com.
// Ảnh được nén trong assets/brand; nội dung tĩnh, không gọi API.

export interface HomeProduct {
  key: string;
  name: string;
  detail: string;
  image: 'ecento70' | 'ecentoPlus' | 'he55' | 'preco';
}

export const HOME_PRODUCTS: HomeProduct[] = [
  { key: 'ecento-70', name: 'Ecento 70', detail: 'Hệ cửa mở quay', image: 'ecento70' },
  { key: 'ecento-plus', name: 'Ecento Plus', detail: 'Hệ cửa ECP', image: 'ecentoPlus' },
  { key: 'he-55', name: '55 Vát cạnh', detail: 'Cửa đi & cửa sổ hệ 55', image: 'he55' },
  { key: 'preco', name: 'Preco', detail: 'Hệ cửa dòng Preco', image: 'preco' },
];
