import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const systems = [
  { code: 'EH-55-VC', name: 'Hệ 55 Vát Cạnh', sortOrder: 1 },
  { code: 'EH-ECENTO-PLUS', name: 'Hệ Ecento Plus', sortOrder: 2 },
  { code: 'EH-ECENTO-70', name: 'Hệ Ecento70', sortOrder: 3 },
  { code: 'EH-TRUOT-CHAU-AU', name: 'Hệ Trượt Châu Âu', sortOrder: 4 },
  { code: 'EH-TRUOT-QUAY', name: 'Hệ Trượt quay', sortOrder: 5 },
  { code: 'EH-NOI-THAT', name: 'Hệ Nội thất', sortOrder: 6 },
  { code: 'EH-THUY-LUC', name: 'Hệ Thuỷ lực', sortOrder: 7 },
];

const doorDesigns = [
  // Cửa đi
  { name: 'Cửa đi 1 cánh', type: 'DOOR_OPEN', imageUrl: '/images/doors/6145c1ba79934a297880f089__Cửa đi mở ngoài__EUROHOUSE.png' },
  { name: 'Cửa đi 2 cánh', type: 'DOOR_OPEN', imageUrl: '/images/doors/6145c22479934a297880f08e__Cửa đi mở trong__EUROHOUSE.png' },
  { name: 'Cửa đi 3 cánh', type: 'DOOR_OPEN', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  { name: 'Cửa đi 4 cánh', type: 'DOOR_OPEN', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  { name: 'Cửa đi 6 cánh', type: 'DOOR_OPEN', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  // Cửa sổ mở quay / hất
  { name: 'Cửa sổ mở quay 1 cánh', type: 'WINDOW_OPEN', imageUrl: '/images/doors/60eb0d3eb4359a08249d1868__Cửa sổ mở quay__E.H.O.png' },
  { name: 'Cửa sổ mở quay 2 cánh', type: 'WINDOW_OPEN', imageUrl: '/images/doors/60eb0d3eb4359a08249d1868__Cửa sổ mở quay__E.H.O.png' },
  { name: 'Cửa sổ mở hất 1 cánh', type: 'WINDOW_OPEN', imageUrl: '/images/doors/60eb0d3eb4359a08249d1868__Cửa sổ mở quay__E.H.O.png' },
  { name: 'Cửa sổ mở hất 2 cánh', type: 'WINDOW_OPEN', imageUrl: '/images/doors/60eb0d3eb4359a08249d1868__Cửa sổ mở quay__E.H.O.png' },
  // Cửa sổ trượt
  { name: 'Cửa sổ lùa 2 cánh', type: 'WINDOW_SLIDING', imageUrl: '/images/doors/60eb1435b4359a08249d1943__Cửa sổ mở trượt__E.H.O.png' },
  { name: 'Cửa sổ lùa 3 cánh', type: 'WINDOW_SLIDING', imageUrl: '/images/doors/60eb1435b4359a08249d1943__Cửa sổ mở trượt__E.H.O.png' },
  { name: 'Cửa sổ lùa 4 cánh', type: 'WINDOW_SLIDING', imageUrl: '/images/doors/60eb1435b4359a08249d1943__Cửa sổ mở trượt__E.H.O.png' },
  // Cửa đi trượt
  { name: 'Cửa đi trượt 2 cánh', type: 'DOOR_SLIDING', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  { name: 'Cửa đi trượt 3 cánh', type: 'DOOR_SLIDING', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  { name: 'Cửa đi trượt 4 cánh', type: 'DOOR_SLIDING', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  // Trượt quay
  { name: 'Trượt quay 2 cánh', type: 'SLIDE_TURN', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  { name: 'Trượt quay 4 cánh', type: 'SLIDE_TURN', imageUrl: '/images/doors/5c93a6245253030aa7abed6f__Cửa đi mở trượt__EUROVN.png' },
  // Khác
  { name: 'Vách kính', type: 'FIXED', imageUrl: '/images/doors/60eb1279b4359a08249d190b__Vách + Cửa sổ quay__E.H.O.png' },
  { name: 'Chấn song đơn', type: 'BARS', imageUrl: '/images/doors/60eb159cb4359a08249d196d__Bổ sung__E.H.O.png' },
  { name: 'Chấn song ôm tường', type: 'BARS', imageUrl: '/images/doors/60eb159cb4359a08249d196d__Bổ sung__E.H.O.png' },
  { name: 'Vách kính + Cửa sổ mở hất', type: 'COMBINED', imageUrl: '/images/doors/60eb1279b4359a08249d190b__Vách + Cửa sổ quay__E.H.O.png' },
];

async function main() {
  console.log('Seeding Eurohouse systems...');
  for (const sys of systems) {
    await prisma.aluSystem.upsert({
      where: { code: sys.code },
      update: { name: sys.name, sortOrder: sys.sortOrder },
      create: { code: sys.code, name: sys.name, sortOrder: sys.sortOrder },
    });
  }
  console.log('Done systems.');

  console.log('Seeding Door Designs...');
  for (const design of doorDesigns) {
    const existing = await prisma.doorModel.findFirst({
      where: { name: design.name, type: design.type }
    });
    if (!existing) {
      await prisma.doorModel.create({
        data: {
          name: design.name,
          type: design.type,
          imageUrl: design.imageUrl,
        }
      });
    } else {
      await prisma.doorModel.update({
        where: { id: existing.id },
        data: { imageUrl: design.imageUrl }
      });
    }
  }
  console.log('Done door designs.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
