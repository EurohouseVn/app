import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import * as exceljs from 'exceljs';
import JSZip from 'jszip';
import { FormulaEvaluatorService } from './formula-evaluator.service';

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
