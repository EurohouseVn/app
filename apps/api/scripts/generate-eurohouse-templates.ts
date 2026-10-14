import * as exceljs from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

async function generateTemplate(
  name: string,
  fileName: string,
  inputs: { id: string; name: string; type: string }[],
  formulas: { desc: string; qty: string; formula: string; code: string }[],
) {
  const workbook = new exceljs.Workbook();
  const sheet = workbook.addWorksheet('Bảng tính');

  // Input mapping definition required by evaluateWorkbook
  sheet.getCell('A1').value = 'input_map';
  let row = 2;
  for (const input of inputs) {
    sheet.getCell(`A${row}`).value = input.id;
    sheet.getCell(`B${row}`).value = input.name;
    // We will place values in column E for calculations
    sheet.getCell(`C${row}`).value = `E${row}`;
    sheet.getCell(`D${row}`).value = input.type;

    // Set default value for E column
    sheet.getCell(`E${row}`).value = 1000;
    sheet.getCell(`D${row}`).font = { color: { argb: 'FF0000FF' } };

    row++;
  }

  // Define cut formulas required by evaluateWorkbook
  row += 2;
  sheet.getCell(`A${row}`).value = 'aluminum_cuts';
  row++;

  // Headers for aluminum cuts
  sheet.getCell(`A${row}`).value = 'STT';
  sheet.getCell(`B${row}`).value = 'Tên cấu kiện';
  sheet.getCell(`C${row}`).value = 'Mã Nhôm';
  sheet.getCell(`D${row}`).value = 'Số lượng';
  sheet.getCell(`E${row}`).value = 'Chiều dài cắt (mm)';
  sheet.getCell(`F${row}`).value = 'Góc cắt';

  // Style headers
  for (let c = 1; c <= 6; c++) {
    sheet.getCell(row, c).font = { bold: true };
    sheet.getCell(row, c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
  }

  row++;
  let stt = 1;
  for (const f of formulas) {
    sheet.getCell(`A${row}`).value = stt++;
    sheet.getCell(`B${row}`).value = f.desc;
    sheet.getCell(`C${row}`).value = f.code;
    // For quantity, we can make it a formula or static
    sheet.getCell(`D${row}`).value = { formula: f.qty, result: 0 };
    sheet.getCell(`E${row}`).value = { formula: f.formula, result: 0 };
    sheet.getCell(`F${row}`).value = '45-45';
    row++;
  }

  const outDir = path.join(process.cwd(), 'eurohouse-templates');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, fileName);
  await workbook.xlsx.writeFile(outPath);
  console.log(`Generated template: ${outPath}`);
}

async function main() {
  const commonInputs = [
    { id: 'width', name: 'Rộng (W)', type: 'number' },
    { id: 'height', name: 'Cao (H)', type: 'number' },
    { id: 'quantity', name: 'Số lượng bộ', type: 'number' },
  ];

  // 1. Hệ 55 Vát cạnh - Cửa đi 1 cánh mở quay
  await generateTemplate('Cửa đi 1 cánh', 'EH-55-VC_cua_di_1_canh.xlsx', commonInputs, [
    { desc: 'Khung bao đứng', code: 'C3328', qty: 'E3*2', formula: 'E2' },
    { desc: 'Khung bao ngang', code: 'C3328', qty: 'E3*1', formula: 'E1' },
    { desc: 'Cánh đứng', code: 'C3303', qty: 'E3*2', formula: 'E2 - 46' },
    { desc: 'Cánh ngang', code: 'C3303', qty: 'E3*2', formula: 'E1 - 84' },
    { desc: 'Nẹp kính đứng', code: 'C3304', qty: 'E3*2', formula: 'E2 - 180' },
    { desc: 'Nẹp kính ngang', code: 'C3304', qty: 'E3*2', formula: 'E1 - 210' },
    { desc: 'Ốp đáy', code: 'C3323', qty: 'E3*1', formula: 'E1 - 84' },
  ]);

  // 2. Hệ Ecento Plus - Cửa sổ lùa 2 cánh
  await generateTemplate(
    'Cửa sổ lùa 2 cánh',
    'EH-ECENTO-PLUS_cua_so_lua_2_canh.xlsx',
    commonInputs,
    [
      { desc: 'Khung bao đứng', code: 'EC-KBD', qty: 'E3*2', formula: 'E2' },
      { desc: 'Khung bao ngang', code: 'EC-KBN', qty: 'E3*2', formula: 'E1' },
      { desc: 'Cánh đứng móc', code: 'EC-CDM', qty: 'E3*2', formula: 'E2 - 62' },
      { desc: 'Cánh đứng trơn', code: 'EC-CDT', qty: 'E3*2', formula: 'E2 - 62' },
      { desc: 'Cánh ngang trên', code: 'EC-CNT', qty: 'E3*2', formula: '(E1 - 70) / 2' },
      { desc: 'Cánh ngang dưới', code: 'EC-CND', qty: 'E3*2', formula: '(E1 - 70) / 2' },
    ],
  );

  // 3. Hệ Trượt quay - Trượt quay 4 cánh
  await generateTemplate('Trượt quay 4 cánh', 'EH-TRUOT-QUAY_4_canh.xlsx', commonInputs, [
    { desc: 'Khung bao đứng', code: 'TQ-KBD', qty: 'E3*2', formula: 'E2' },
    { desc: 'Khung bao ngang trên', code: 'TQ-KBNT', qty: 'E3*1', formula: 'E1' },
    { desc: 'Khung bao ngang dưới', code: 'TQ-KBND', qty: 'E3*1', formula: 'E1' },
    { desc: 'Cánh đứng', code: 'TQ-CD', qty: 'E3*8', formula: 'E2 - 75' },
    { desc: 'Cánh ngang', code: 'TQ-CN', qty: 'E3*8', formula: '(E1 - 150) / 4' },
  ]);

  console.log('All templates generated successfully!');
}

main().catch(console.error);
