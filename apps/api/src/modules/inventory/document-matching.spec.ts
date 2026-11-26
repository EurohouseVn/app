import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertToBars,
  learnTermFromLine,
  matchColor,
  matchLine,
  normalizeText,
  parseQuantityUnit,
  type CatalogProfile,
  type GlossaryEntry,
} from './document-matching';

/** Trích từ danh mục thật của Eurohouse (mã, tên, quy cách bó) cho các thanh xuất hiện trên 4 tờ viết tay mẫu của chủ dự án. */
const p = (id: string, code: string, name: string, systemCode: string, barsPerBundle: number): CatalogProfile => ({ id, code, name, systemCode, systemName: systemCode, barsPerBundle });
const CATALOG: CatalogProfile[] = [
  p('p-ecs01', 'ECS01', 'Khung chấn song hệ 55', 'EU-CS', 2),
  p('p-ecs03', 'ECS03', 'Nối khung', 'EU-CS', 2),
  p('p-ecs05', 'ECS05', 'Chấn song D28', 'EU-CS', 5),
  p('p-ecs07', 'ECS07', 'Thanh đố ngang', 'EU-CS', 5),
  p('p-ecs10', 'ECS10', 'Phào dài', 'EU-CS', 10),
  p('p-ecs11', 'ECS11', 'Nối khung 3cm', 'EU-CS', 10),
  p('p-ecs13', 'ECS13', 'Thanh đố ngang 75mm', 'EU-CS', 4),
  p('p-ecs22', 'ECS22-P75', 'Phào ôm tường 75mm', 'EU-CS', 5),
  p('p-e70kt', 'E70KT', 'Khung thấp', 'EU-70', 5),
  p('p-e70d150', 'E70D150', 'Cánh cửa đi Ecento 150', 'EU-70', 1),
  p('p-e70d190', 'E70D190', 'Cánh cửa đi Ecento 190', 'EU-70', 1),
  p('p-e70sh', 'E70SH', 'Sập kính thường', 'EU-70', 10),
  p('p-ktl05', 'KTL-05', 'Khung bao 200', 'EU-TL', 1),
  p('p-tl03', 'TL03', 'Khung Bao 120', 'EU-TL', 2),
  p('p-c3225-70', 'C3225', 'Nẹp vách kính hộp', 'EU-70', 16),
  p('p-c3225-plus', 'C3225', 'Sập khung kính hộp', 'EU-ECPLUS', 10),
  p('p-nobundle', 'ECS18', 'Phào cân', 'EU-CS', 0),
];
const NO_GLOSSARY: GlossaryEntry[] = [];

test('normalizing removes Vietnamese marks and punctuation', () => {
  assert.equal(normalizeText('  Khung bao ôm TƯỜNG, 2 mặt phải: '), 'khung bao om tuong 2 mat phai');
  assert.equal(normalizeText('Đố động Φ28'), 'do dong phi28');
  assert.equal(normalizeText('Cánh Đi 91'), 'canh di 91');
});

test('quantity and unit are read from handwritten shorthand', () => {
  assert.deepEqual(parseQuantityUnit('4 bó'), { quantity: 4, unit: 'BUNDLE' });
  assert.deepEqual(parseQuantityUnit('= 2 bó'), { quantity: 2, unit: 'BUNDLE' });
  assert.deepEqual(parseQuantityUnit('8b.'), { quantity: 8, unit: 'BUNDLE' });
  assert.deepEqual(parseQuantityUnit('9b'), { quantity: 9, unit: 'BUNDLE' });
  assert.deepEqual(parseQuantityUnit('3 cây'), { quantity: 3, unit: 'BAR' });
  assert.deepEqual(parseQuantityUnit('4C.'), { quantity: 4, unit: 'BAR' });
  assert.deepEqual(parseQuantityUnit('2c'), { quantity: 2, unit: 'BAR' });
  assert.deepEqual(parseQuantityUnit('1 bộ'), { quantity: 1, unit: 'SET' });
  assert.deepEqual(parseQuantityUnit('6'), { quantity: 6, unit: null });
  assert.deepEqual(parseQuantityUnit('không có số'), { quantity: null, unit: null });
});

test('bundles convert to bars with the catalog bundle size', () => {
  assert.equal(convertToBars(4, 'BUNDLE', 2), 8);
  assert.equal(convertToBars(3, 'BAR', 5), 3);
  assert.equal(convertToBars(2, 'BUNDLE', 0), null);
  assert.equal(convertToBars(2, null, 5), null);
  assert.equal(convertToBars(2, 'SET', 5), null);
  assert.equal(convertToBars(0, 'BAR', 5), null);
});

test('aluminium colours are recognised from handwritten headings, with small spelling slips', () => {
  assert.equal(matchColor('Xám Ngọc Trai')?.colorCode, 'XAM_NGOC_TRAI');
  assert.equal(matchColor('Xán Ngọc Trai')?.colorCode, 'XAM_NGOC_TRAI');
  assert.equal(matchColor('Cẩm lai')?.colorCode, 'VAN_GO_CAM_LAI');
  assert.equal(matchColor('Cafe Metalic')?.colorCode, 'CAFE_METALIC');
  assert.equal(matchColor('Cafe Metalíc')?.colorCode, 'CAFE_METALIC');
  assert.equal(matchColor('Cà phê thường')?.colorCode, 'CAFE_THUONG');
  assert.equal(matchColor('cafe')?.colorCode, 'CAFE_THUONG');
  assert.equal(matchColor('Vân gỗ Olak')?.colorCode, 'VAN_GO_OLAK');
  assert.equal(matchColor('Xám Rita')?.colorCode, 'XAM_RITA');
  assert.equal(matchColor('Hàng bổ xung'), null);
  assert.equal(matchColor(''), null);
});

test('an explicit catalog code in the text wins over a mismatching description', () => {
  const line = matchLine({ text: 'Khung bao ôm tường 2 mặt phải: mã ECS01', quantity: 4, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.profileId, 'p-ecs01');
  assert.equal(line.confidence, 'HIGH');
  assert.equal(line.bars, 8);
  assert.equal(line.candidates[0].reason, 'CODE');
});

test('"Nối tường 10 cm mã ECS03" resolves by code, 2 bundles of 2 = 4 bars', () => {
  const line = matchLine({ text: 'Nối tường 10 cm mã ECS03', quantity: 2, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.profileId, 'p-ecs03');
  assert.equal(line.bars, 4);
});

test('an exact code beats a near-miss code in the same line ("lại cho ES0150 (E70KT)")', () => {
  const line = matchLine({ text: 'Kbao Mỏng (nhỏ) lại cho ES0150 (E70KT)', quantity: 1, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.profileId, 'p-e70kt');
  assert.equal(line.confidence, 'HIGH');
  const near = line.candidates.find((c) => c.profileId === 'p-e70d150');
  assert.ok(!near || near.score < line.candidates[0].score);
});

test('a partial code from handwriting ("Phào CS22 - PJ5") still finds the long catalog code', () => {
  const line = matchLine({ text: 'Phào CS22 - PJ5', quantity: 9, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.profileId, 'p-ecs22');
  assert.equal(line.bars, 9);
});

test('without a code, the name and the number find the right profile ("Nối tường 3 cm")', () => {
  const line = matchLine({ text: 'Nối tường 3 cm', quantity: 1, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.candidates[0].profileId, 'p-ecs11');
  assert.notEqual(line.confidence, 'NONE');
});

test('"Khung bao thủy lực 200" matches "Khung bao 200" and not "Khung Bao 120"', () => {
  const line = matchLine({ text: 'Khung bao thủy lực 200', quantity: 2, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.candidates[0].profileId, 'p-ktl05');
  assert.ok(line.candidates.findIndex((c) => c.profileId === 'p-tl03') > 0 || !line.candidates.some((c) => c.profileId === 'p-tl03'));
});

test('"Chân sống Φ28" finds the D28 bar through the number', () => {
  const line = matchLine({ text: 'Chân sống Φ28', quantity: 2, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.candidates[0].profileId, 'p-ecs05');
  assert.equal(line.bars, 10);
});

test('the number separates "Thanh đố ngang" from "Thanh đố ngang 75mm"', () => {
  const plain = matchLine({ text: 'Thanh ngang 25x50', quantity: 1, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(plain.candidates[0].profileId, 'p-ecs07');
  const sized = matchLine({ text: 'Thanh đố ngang 75', quantity: 1, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.equal(sized.candidates[0].profileId, 'p-ecs13');
});

test('lines nothing in the catalog resembles are left unmatched for a human', () => {
  for (const text of ['C19', 'C18 53', 'Sập trốn cánh']) {
    const line = matchLine({ text, quantity: 3, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
    assert.equal(line.profileId, null, text);
  }
  const none = matchLine({ text: 'xyz qwerty', quantity: 1, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.equal(none.confidence, 'NONE');
  assert.deepEqual(none.candidates, []);
});

test('the same code in two systems needs the system heading to decide', () => {
  const ambiguous = matchLine({ text: 'C3225', quantity: 1, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(ambiguous.profileId, null);
  assert.equal(ambiguous.candidates.filter((c) => c.code === 'C3225').length, 2);
  const hinted = matchLine({ text: 'C3225', quantity: 1, unit: 'BUNDLE', systemHint: 'Hệ Plus EU-ECPLUS' }, CATALOG, NO_GLOSSARY);
  assert.equal(hinted.profileId, 'p-c3225-plus');
});

test('learned glossary terms map shorthand to a profile', () => {
  const glossary: GlossaryEntry[] = [{ term: 'kb 200 tl', profileId: 'p-ktl05' }];
  const line = matchLine({ text: 'KB 200 TL', quantity: 6, unit: 'BAR' }, CATALOG, glossary);
  assert.equal(line.profileId, 'p-ktl05');
  assert.equal(line.candidates[0].reason, 'GLOSSARY');
  const other = matchLine({ text: 'KB 200 TL', quantity: 6, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.notEqual(other.candidates[0]?.reason, 'GLOSSARY');
});

test('built-in abbreviations help: "K bao thấp" reaches "Khung thấp"', () => {
  const line = matchLine({ text: 'K bao thấp', quantity: 2, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.equal(line.candidates[0].profileId, 'p-e70kt');
});

test('warnings explain what cannot be computed', () => {
  const noBundle = matchLine({ text: 'Phào cân ECS18', quantity: 2, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.equal(noBundle.profileId, 'p-nobundle');
  assert.equal(noBundle.bars, null);
  assert.ok(noBundle.warnings.some((w) => /quy cách bó/i.test(w)));
  const noUnit = matchLine({ text: 'Khung thấp E70KT', quantity: 4, unit: null }, CATALOG, NO_GLOSSARY);
  assert.equal(noUnit.bars, null);
  assert.ok(noUnit.warnings.some((w) => /đơn vị/i.test(w)));
  const noQty = matchLine({ text: 'Khung thấp E70KT', quantity: null, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.ok(noQty.warnings.some((w) => /số lượng/i.test(w)));
});

test('the colour heading is applied to the line and a colour in the line itself wins', () => {
  const inherited = matchLine({ text: 'Khung thấp E70KT', quantity: 1, unit: 'BAR', colorHint: 'Xám Ngọc Trai' }, CATALOG, NO_GLOSSARY);
  assert.equal(inherited.colorCode, 'XAM_NGOC_TRAI');
  const own = matchLine({ text: 'Khung thấp E70KT cẩm lai', quantity: 1, unit: 'BAR', colorHint: 'Xám Ngọc Trai' }, CATALOG, NO_GLOSSARY);
  assert.equal(own.colorCode, 'VAN_GO_CAM_LAI');
  const none = matchLine({ text: 'Khung thấp E70KT', quantity: 1, unit: 'BAR' }, CATALOG, NO_GLOSSARY);
  assert.equal(none.colorCode, null);
});

test('learning a glossary term drops numbers, units and filler words', () => {
  assert.equal(learnTermFromLine('Khung bao thủy lực 200 = 2 cây'), 'khung bao thuy luc 200');
  assert.equal(learnTermFromLine('  KB 200 TL  '), 'kb 200 tl');
  assert.equal(learnTermFromLine('4'), null);
  assert.equal(learnTermFromLine('c'), null);
});

test('matching is deterministic and never mutates the catalog', () => {
  const copy = JSON.stringify(CATALOG);
  const a = matchLine({ text: 'Nối tường 3 cm', quantity: 1, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  const b = matchLine({ text: 'Nối tường 3 cm', quantity: 1, unit: 'BUNDLE' }, CATALOG, NO_GLOSSARY);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(CATALOG), copy);
});

test('two catalog rows with the same code are told apart by the description', () => {
  const catalog = [...CATALOG, p('p-ecs01-55', 'ECS01', 'Khung ôm tường', 'EU-55', 0)];
  const wall = matchLine({ text: 'Khung bao ôm tường 2 mặt phải mã ECS01', quantity: 4, unit: 'BUNDLE' }, catalog, NO_GLOSSARY);
  assert.equal(wall.profileId, 'p-ecs01-55');
  assert.equal(wall.confidence, 'HIGH');
  assert.equal(wall.bars, null);
  assert.ok(wall.warnings.some((w) => /quy cách bó/i.test(w)));
  const grille = matchLine({ text: 'Khung chấn song hệ 55 mã ECS01', quantity: 2, unit: 'BUNDLE' }, catalog, NO_GLOSSARY);
  assert.equal(grille.profileId, 'p-ecs01');
  const bare = matchLine({ text: 'ECS01', quantity: 1, unit: 'BAR' }, catalog, NO_GLOSSARY);
  assert.equal(bare.profileId, null, 'with nothing to tell them apart, a human must choose');
  assert.equal(bare.candidates.filter((c) => c.code === 'ECS01').length, 2);
});

test('a match by description alone is at most "worth a look"; only a code or a learned term is "sure"', () => {
  const catalog = [...CATALOG, p('p-prd91', 'PRD91', 'Cánh đi mỏng 91', 'EU-PRECO', 4)];
  const byName = matchLine({ text: 'Cánh Đi 91', quantity: 1, unit: 'BUNDLE' }, catalog, NO_GLOSSARY);
  assert.equal(byName.profileId, 'p-prd91');
  assert.equal(byName.confidence, 'MEDIUM');
  const byCode = matchLine({ text: 'mã PRD91', quantity: 1, unit: 'BUNDLE' }, catalog, NO_GLOSSARY);
  assert.equal(byCode.confidence, 'HIGH');
  const learned = matchLine({ text: 'Cánh Đi 91', quantity: 1, unit: 'BUNDLE' }, catalog, [{ term: 'canh di 91', profileId: 'p-prd91' }]);
  assert.equal(learned.confidence, 'HIGH');
});

test('a one-letter slip in a short word never picks a different word ("cánh lưới" is not "Cánh dưới")', () => {
  const catalog = [...CATALOG, p('p-kt07', 'KH-TQ07', 'Cánh dưới', 'EU-TQ', 2)];
  const line = matchLine({ text: 'cánh lưới', quantity: 3, unit: 'BUNDLE' }, catalog, NO_GLOSSARY);
  assert.equal(line.profileId, null);
});

test('a one-letter slip in a long word is only a suggestion, never an automatic pick', () => {
  const catalog = [p('p-tn', 'TN01', 'Thanh ngang trung', 'EU-CS', 5)];
  const line = matchLine({ text: 'Thanh ngang trunk', quantity: 1, unit: 'BAR' }, catalog, NO_GLOSSARY);
  assert.equal(line.profileId, null);
  assert.equal(line.candidates[0]?.profileId, 'p-tn');
});

test('"hệ 55" written in the line points at the 55 system', () => {
  const catalog = [...CATALOG, p('p-dak55', 'DAK55', 'Khung bao', 'EU-55', 4), p('p-kht', 'KH-T9802', 'Khung', 'EU-TRUOT', 2)];
  const line = matchLine({ text: 'Khung bao thường hệ 55 vát cạnh', quantity: 1, unit: 'BUNDLE' }, catalog, NO_GLOSSARY);
  assert.equal(line.profileId, 'p-dak55');
  assert.equal(line.bars, 4);
  const without = matchLine({ text: 'Khung bao thường vát cạnh', quantity: 1, unit: 'BUNDLE' }, catalog, NO_GLOSSARY);
  assert.equal(without.profileId, null, 'without the system hint the plain "Khung bao" match is not decisive');
});

test('a system named in the heading ("E70", "Plus") favours that system', () => {
  const catalog = [p('p-a', 'AA11', 'Đố động', 'EU-70', 4), p('p-b', 'BB22', 'Đố động', 'EU-ECPLUS', 4)];
  assert.equal(matchLine({ text: 'Đồ động', quantity: 2, unit: 'BAR', systemHint: 'TL E xám E70' }, catalog, NO_GLOSSARY).profileId, 'p-a');
  assert.equal(matchLine({ text: 'Đồ động', quantity: 2, unit: 'BAR', systemHint: 'Hệ Plus' }, catalog, NO_GLOSSARY).profileId, 'p-b');
});
