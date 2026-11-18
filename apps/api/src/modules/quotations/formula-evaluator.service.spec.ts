import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import * as exceljs from 'exceljs';
import JSZip from 'jszip';
import { FormulaEvaluatorService } from './formula-evaluator.service';
import { MANAGED_TQ_FORMULAS } from '../../../prisma/managed-tq-formulas.data';
import { MANAGED_TRUOT_FORMULAS } from '../../../prisma/managed-truot-formulas.data';

function service() {
  return new FormulaEvaluatorService({} as never);
}

function workbookWithInputs() {
  const workbook = new exceljs.Workbook();
  const sheet = workbook.addWorksheet('Formula');
  sheet.getCell('B5').value = 'Rộng Cửa (B) (mm)';
  sheet.getCell('C5').value = 1200;
  sheet.getCell('B6').value = 'Cao Cửa (H) (mm)';
  sheet.getCell('C6').value = 2200;
  sheet.getCell('B7').value = 'B1 (mm)';
  sheet.getCell('C7').value = 600;
  sheet.getCell('B8').value = 'B2 (mm)';
  sheet.getCell('C8').value = 600;
  sheet.getCell('B9').value = 'H1 (mm)';
  sheet.getCell('C9').value = 1100;
  sheet.getCell('B10').value = 'H2 (mm)';
  sheet.getCell('C10').value = 1100;
  sheet.getCell('B11').value = 'Hở chân cánh (mm)';
  sheet.getCell('C11').value = 10;
  sheet.getCell('B12').value = 'Số bộ';
  sheet.getCell('C12').value = 1;
  return workbook;
}

test('formula inputs expose stable B1/B2/H1/H2 and bottom gap keys', () => {
  const workbook = workbookWithInputs();
  const sheet = workbook.worksheets[0];
  const result = (service() as any).extractInputsFromSheet(sheet);
  assert.deepEqual(
    result.inputs.map((item: { id: string }) => item.id),
    ['width', 'height', 'b1', 'b2', 'h1', 'h2', 'bottom_gap', 'quantity'],
  );
  assert.equal(result.inputs[0].name, 'Rộng Cửa (B)');
  assert.equal(result.inputs[0].defaultValue, 1200);
  assert.equal(result.inputs[0].required, true);
});

test('calculated helper cells are not exposed as user inputs', () => {
  const workbook = workbookWithInputs();
  const sheet = workbook.worksheets[0];
  sheet.getCell('C7').value = { formula: 'C5/2', result: 600 };
  const result = (service() as any).extractInputsFromSheet(sheet);
  assert.equal(result.inputs.some((item: { id: string }) => item.id === 'b1'), false);
});

test('negative aluminum dimensions are rejected instead of returned', () => {
  const workbook = workbookWithInputs();
  const sheet = workbook.worksheets[0];
  sheet.getCell('B22').value = 'KICH THUOC CAT NHOM';
  sheet.getCell('B24').value = 'Khung';
  sheet.getCell('D24').value = 'TEST';
  sheet.getCell('F24').value = 1;
  sheet.getCell('G24').value = -100;
  assert.throws(() => (service() as any).evaluateWorkbook(workbook, {}), BadRequestException);
});

test('component dimensions cannot exceed the overall door dimensions', () => {
  const workbook = workbookWithInputs();
  assert.throws(
    () => (service() as any).evaluateWorkbook(workbook, { width: 500, b1: 600 }),
    (error: unknown) => error instanceof BadRequestException && error.message.includes('B1 (600 mm)'),
  );
});

test('profile codes and cutting angles remain text in formula results', () => {
  const workbook = workbookWithInputs();
  const sheet = workbook.worksheets[0];
  sheet.getCell('B22').value = 'KICH THUOC CAT NHOM';
  sheet.getCell('B24').value = 'Khung';
  sheet.getCell('C24').value = 'Ngang';
  sheet.getCell('D24').value = 22900;
  sheet.getCell('E24').value = '45-45';
  sheet.getCell('F24').value = 1;
  sheet.getCell('G24').value = 1200;

  const result = (service() as any).evaluateWorkbook(workbook, {});
  assert.equal(result.aluminum[0].code, '22900');
  assert.equal(result.aluminum[0].angle, '45-45');
});

test('unsupported or broken Excel expressions are rejected', () => {
  const formulaService = service() as any;
  assert.throws(
    () => formulaService.evalFormula('=#REF!*$H$5', () => 1, () => []),
    BadRequestException,
  );
});

test('managed cutting expressions use declared dimensions without executing arbitrary code', () => {
  const formulaService = service() as any;
  assert.equal(formulaService.evaluateManagedExpression('2 * (H - 50)', { H: 2200 }), 4300);
  assert.equal(formulaService.evaluateManagedExpression('ROUND(W / 3, 1)', { W: 1000 }), 333.3);
  assert.throws(() => formulaService.evaluateManagedExpression('process.exit()', { H: 2200 }), BadRequestException);
});

test('published managed formula generates shared profile cut rows', async () => {
  const prisma = {
    systemFormula: {
      findFirst: async () => ({
        id: 'formula-1',
        status: 'PUBLISHED',
        revision: 3,
        inputSchema: [
          { key: 'W', label: 'Chiều rộng', unit: 'mm', required: true },
          { key: 'H', label: 'Chiều cao', unit: 'mm', required: true },
          { key: 'Q', label: 'Số bộ', unit: 'bộ', required: true, defaultValue: 1 },
        ],
        cutRules: [
          { profileCode: 'DAK55', profileName: 'Khung đứng', lengthFormula: 'H-50', quantityFormula: '2*Q', cutAngle: '45-45' },
        ],
        doorModel: { name: 'Cửa đi 1 cánh' },
        aluSystem: { code: 'EU-55' },
      }),
    },
  };
  const result = await new FormulaEvaluatorService(prisma as never).evaluateManagedFormula('formula-1', { W: 1200, H: 2200, Q: 2 });
  assert.deepEqual(result.aluminum[0], {
    systemCode: 'EU-55',
    code: 'DAK55',
    name: 'Khung đứng',
    length_mm: 2150,
    quantity: 4,
    cutAngle: '45-45',
    note: '',
  });
});

test('EU-TQ managed engine matches the four source workbook golden cases', async () => {
  const cases = [
    {
      stableKey: 'EU-TQ-INWARD-2-LEAF-DAMPER-V1', inputs: { W: 2363, H: 2500, Q: 1 },
      expected: { first: 1071, second: 1187, top: 1199, vertical: 2412, quantity: 14, glass: [[1017, 2242, 2]] },
    },
    {
      stableKey: 'EU-TQ-INWARD-4-LEAF-DAMPER-V1', inputs: { W: 2800, H: 2388, Q: 1 },
      expected: { first: 1208, second: 727, top: 739, vertical: 2300, quantity: 23, glass: [[557, 2130, 4]] },
    },
    {
      stableKey: 'EU-TQ-OUTWARD-2-LEAF-DAMPER-V1', inputs: { W: 1190, H: 2780, Q: 1 },
      expected: { first: 440.5, second: 644.5, top: 568.5, vertical: 2695, quantity: 14, glass: [[386.5, 2525, 1], [474.5, 2525, 1]] },
    },
    {
      stableKey: 'EU-TQ-OUTWARD-4-LEAF-DAMPER-V1', inputs: { W: 2985, H: 2770, Q: 1 },
      expected: { first: 1212.5, second: 817.25, top: 741.25, vertical: 2682, quantity: 23, glass: [[559.25, 2512, 2], [647.25, 2512, 2]] },
    },
  ];

  for (const golden of cases) {
    const definition = MANAGED_TQ_FORMULAS.find((item) => item.stableKey === golden.stableKey)!;
    const prisma = {
      systemFormula: {
        findFirst: async () => ({
          id: definition.stableKey,
          status: 'PUBLISHED',
          revision: 1,
          inputSchema: definition.inputFields,
          cutRules: definition.cutRules,
          glassRules: definition.glassRules,
          sourceRef: definition.sourceRef,
          verificationStatus: definition.verificationStatus,
          doorModel: { name: definition.name },
          aluSystem: { code: 'EU-TQ' },
        }),
      },
    };
    const result = await new FormulaEvaluatorService(prisma as never).evaluateManagedFormula(definition.stableKey, golden.inputs);
    assert.equal(result.aluminum[0].length_mm, golden.expected.first, `${golden.stableKey}: ray khung`);
    assert.equal(result.aluminum[1].length_mm, golden.expected.second, `${golden.stableKey}: ray cánh`);
    assert.equal(result.aluminum.find((row) => row.code === 'KH-TQ04')?.length_mm, golden.expected.top, `${golden.stableKey}: cánh trên`);
    assert.equal(result.aluminum.find((row) => row.code === 'KH-TQ05')?.length_mm, golden.expected.vertical, `${golden.stableKey}: cánh đứng`);
    assert.equal(result.aluminum.reduce((sum, row) => sum + row.quantity, 0), golden.expected.quantity, `${golden.stableKey}: tổng số đoạn nhôm`);
    assert.deepEqual(
      result.glass.map((row) => [row.width_mm, row.height_mm, row.quantity]),
      golden.expected.glass,
      `${golden.stableKey}: kính`,
    );
  }
});

test('EU-TQ optional top fix splits active door height and emits EU-55 frame cuts', async () => {
  const definition = MANAGED_TQ_FORMULAS.find((item) => item.stableKey === 'EU-TQ-OUTWARD-2-LEAF-DAMPER-V1')!;
  const prisma = {
    systemFormula: {
      findFirst: async () => ({
        id: definition.stableKey,
        status: 'PUBLISHED',
        revision: 3,
        inputSchema: definition.inputFields,
        cutRules: definition.cutRules,
        glassRules: definition.glassRules,
        sourceRef: definition.sourceRef,
        verificationStatus: definition.verificationStatus,
        doorModel: { name: definition.name },
        aluSystem: { code: 'EU-TQ' },
      }),
    },
  };

  const result = await new FormulaEvaluatorService(prisma as never).evaluateManagedFormula(definition.stableKey, {
    W: 2900,
    H: 3300,
    HAS_TOP_FIX: 1,
    FIX_H: 800,
    Q: 1,
  });

  assert.equal(result.aluminum.find((row) => row.code === 'KH-TQ03' && row.quantity === 2)?.length_mm, 2500);
  assert.deepEqual(
    result.aluminum.filter((row) => row.systemCode === 'EU-55').map((row) => [row.code, row.length_mm, row.quantity]),
    [
      ['LH5110', 2900, 2],
      ['LH5110', 800, 2],
      ['DAT55', 752, 2],
      ['DAS14', 690, 6],
      ['C3300', 2900, 1],
      ['DAS14', 917.333, 6],
    ],
  );
  assert.deepEqual(result.glass.at(-1), {
    name: 'Kính ô fix - 3 khoang đều',
    width_mm: 908.333,
    height_mm: 719,
    quantity: 3,
    area_m2: 1.959,
    note: 'Ba tấm kính bằng nhau; phương án bộ 2 cánh cần nghiệm thu thực tế',
  });
});

test('EU-TQ four-leaf top fix preserves the workbook L1 - L2 - L1 layout', async () => {
  const definition = MANAGED_TQ_FORMULAS.find((item) => item.stableKey === 'EU-TQ-OUTWARD-4-LEAF-DAMPER-V1')!;
  const prisma = {
    systemFormula: {
      findFirst: async () => ({
        id: definition.stableKey,
        status: 'PUBLISHED',
        revision: definition.revision,
        inputSchema: definition.inputFields,
        cutRules: definition.cutRules,
        glassRules: definition.glassRules,
        sourceRef: definition.sourceRef,
        verificationStatus: definition.verificationStatus,
        doorModel: { name: definition.name },
        aluSystem: { code: 'EU-TQ' },
      }),
    },
  };

  const result = await new FormulaEvaluatorService(prisma as never).evaluateManagedFormula(definition.stableKey, {
    W: 2985,
    H: 3300,
    HAS_TOP_FIX: 1,
    FIX_H: 800,
    Q: 1,
  });

  assert.deepEqual(
    result.aluminum.filter((row) => row.code === 'DAS14' && row.name.includes('ngang')).map((row) => [row.length_mm, row.quantity]),
    [[676.25, 4], [1484.5, 2]],
  );
  assert.deepEqual(
    result.glass.slice(-2).map((row) => [row.width_mm, row.height_mm, row.quantity]),
    [[667.25, 719, 2], [1475.5, 719, 1]],
  );
});

test('Ecento Châu Âu managed engine matches the five normalized workbook layouts', async () => {
  const cases = [
    { stableKey: 'EU-TRUOT-ECENTO-2-LEAF-2-RAIL-V1', horizontal: 1513, glass: [1359, 2198.7, 2], quantity: 26 },
    { stableKey: 'EU-TRUOT-ECENTO-4-LEAF-2-RAIL-V1', horizontal: 777.2, glass: [623.2, 2197.7, 4], quantity: 45 },
    { stableKey: 'EU-TRUOT-ECENTO-4-LEAF-4-RAIL-V1', horizontal: 800.15, glass: [646.15, 2198.7, 4], quantity: 56 },
    { stableKey: 'EU-TRUOT-ECENTO-3-LEAF-3-RAIL-V1', horizontal: 1038.133, glass: [884.133, 2198.7, 3], quantity: 41 },
    { stableKey: 'EU-TRUOT-ECENTO-6-LEAF-3-RAIL-V1', horizontal: 547.933, glass: [393.933, 2198.7, 6], quantity: 66 },
  ];

  for (const golden of cases) {
    const definition = MANAGED_TRUOT_FORMULAS.find((item) => item.stableKey === golden.stableKey)!;
    const prisma = {
      systemFormula: {
        findFirst: async () => ({
          id: definition.stableKey,
          status: 'PUBLISHED',
          revision: definition.revision,
          inputSchema: definition.inputFields,
          cutRules: definition.cutRules,
          glassRules: definition.glassRules,
          sourceRef: definition.sourceRef,
          verificationStatus: definition.verificationStatus,
          doorModel: { name: definition.name },
          aluSystem: { code: 'EU-TRUOT' },
        }),
      },
    };
    const result = await new FormulaEvaluatorService(prisma as never).evaluateManagedFormula(definition.stableKey, { W: 3000, H: 2400, Q: 1 });
    assert.equal(result.aluminum[1].length_mm, golden.horizontal, `${golden.stableKey}: cánh ngang`);
    assert.equal(result.aluminum.reduce((sum, row) => sum + row.quantity, 0), golden.quantity, `${golden.stableKey}: tổng số đoạn nhôm`);
    assert.deepEqual(
      [result.glass[0].width_mm, result.glass[0].height_mm, result.glass[0].quantity],
      golden.glass,
      `${golden.stableKey}: kính`,
    );
  }
});

test('malformed ampersands in legacy XLSX metadata are repaired in memory', async () => {
  const workbook = workbookWithInputs();
  const original = Buffer.from(await workbook.xlsx.writeBuffer());
  const zip = await JSZip.loadAsync(original);
  const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
  zip.file(
    'xl/workbook.xml',
    workbookXml.replace(
      '</sheets>',
      '</sheets><definedNames><definedName name="Legacy">A1&"x"</definedName></definedNames>',
    ),
  );

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eurohouse-xlsx-'));
  const filePath = path.join(directory, 'legacy.xlsx');
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));

  try {
    const recovered = await (service() as any).loadWorkbookFile(filePath);
    const result = (service() as any).extractInputsFromSheet(recovered.worksheets[0]);
    assert.equal(result.inputs.some((item: { id: string }) => item.id === 'width'), true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
