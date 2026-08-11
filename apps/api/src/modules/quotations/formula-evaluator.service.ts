import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import * as exceljs from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../prisma/prisma.service';

function normalizeText(val: any): string {
  if (!val) return '';
  return String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Ã„â€˜Ã„Â]/g, 'd')
    .toLowerCase();
}

function columnIndex(colName: string): number {
  let total = 0;
  for (let i = 0; i < colName.length; i++) {
    total = total * 26 + (colName.charCodeAt(i) - 64);
  }
  return total;
}

function columnName(index: number): string {
  let name = '';
  while (index > 0) {
    let remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

const SOURCE_WINDOW_TYPES = {
  doorOpen: ['Cửa đi mở ngoài'],
  doorSlide: ['Cửa đi mở trượt'],
  windowOpen: ['Cửa sổ mở quay'],
  windowSlide: ['Cửa sổ mở trượt'],
  facade: ['Vách + Cửa sổ quay'],
  supplement: ['Bổ sung'],
} as const;

const SELECTED_TEMPLATE_BACKUP = 'formula-templates-before-prune-2026-08-10T08-33-10-712Z.json';

const EUROHOUSE_SYSTEM_NAMES: Record<string, string> = {
  'EU-55': 'Hệ 55 Euroqueen',
  'EU-TRUOT': 'Hệ trượt Châu Âu',
};

function resolveApiPublicPath(...segments: string[]) {
  const candidates = [
    path.join(process.cwd(), 'apps', 'api', 'public', ...segments),
    path.join(process.cwd(), 'public', ...segments),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function resolveApiBackupPath(fileName: string) {
  const candidates = [
    path.join(process.cwd(), 'apps', 'api', 'backups', fileName),
    path.join(process.cwd(), 'backups', fileName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function loadSelectedTemplateIds() {
  const backupPath = resolveApiBackupPath(SELECTED_TEMPLATE_BACKUP);
  if (!backupPath) return [];
  try {
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    if (!Array.isArray(data?.templates)) return [];
    return data.templates
      .map((template: any) => template?.templateId)
      .filter((templateId: any): templateId is string => typeof templateId === 'string' && templateId.length > 0);
  } catch {
    return [];
  }
}

const SELECTED_TEMPLATE_IDS = loadSelectedTemplateIds();

function selectedTemplateWhere() {
  return SELECTED_TEMPLATE_IDS.length > 0 ? { templateId: { in: SELECTED_TEMPLATE_IDS } } : {};
}

function displaySystemName(code: string, fallback: string) {
  return EUROHOUSE_SYSTEM_NAMES[code.toUpperCase()] ?? fallback;
}

type QuoteDoorType = {
  name: string;
  sourceWindowTypes: string[];
};

const DOOR_OPEN_55: QuoteDoorType[] = [
  'Cửa 1 cánh 91',
  'Cửa 2 cánh 91',
  'Cửa 4 cánh 91',
  'Cửa 1 cánh VIP 118',
  'Cửa 2 cánh VIP 118',
  'Cửa 4 cánh VIP 118',
  'Cửa 1 cánh liền phào 125',
  'Cửa 2 cánh liền phào 125',
  'Cửa 4 cánh liền phào 125',
].map((name) => ({ name, sourceWindowTypes: [...SOURCE_WINDOW_TYPES.doorOpen] }));

const DOOR_OPEN_55_PRECO: QuoteDoorType[] = [
  'Cửa 1 cánh 91',
  'Cửa 2 cánh 91',
  'Cửa 4 cánh 91',
].map((name) => ({ name, sourceWindowTypes: [...SOURCE_WINDOW_TYPES.doorOpen] }));

const DOOR_OPEN_70: QuoteDoorType[] = [
  'Cửa 1 cánh 110',
  'Cửa 2 cánh 110',
  'Cửa 4 cánh 110',
  'Cửa 1 cánh 150',
  'Cửa 2 cánh 150',
  'Cửa 4 cánh 150',
  'Cửa 1 cánh 190',
  'Cửa 2 cánh 190',
  'Cửa 4 cánh 190',
].map((name) => ({ name, sourceWindowTypes: [...SOURCE_WINDOW_TYPES.doorOpen] }));

const DOOR_OPEN_ECENTO_PLUS: QuoteDoorType[] = [
  'Cửa 1 cánh 98',
  'Cửa 2 cánh 98',
  'Cửa 4 cánh 98',
  'Cửa 1 cánh 138',
  'Cửa 2 cánh 138',
  'Cửa 4 cánh 138',
  'Cửa 1 cánh liền phào 138',
  'Cửa 2 cánh liền phào 138',
  'Cửa 4 cánh liền phào 138',
].map((name) => ({ name, sourceWindowTypes: [...SOURCE_WINDOW_TYPES.doorOpen] }));

const DOOR_HYDRAULIC: QuoteDoorType[] = [
  'Cửa TL 1 cánh 140',
  'Cửa TL 1 cánh 180',
  'Cửa TL 2 cánh 140',
  'Cửa TL 2 cánh 180',
].map((name) => ({ name, sourceWindowTypes: [...SOURCE_WINDOW_TYPES.doorOpen] }));

const DOOR_TURN_SLIDE: QuoteDoorType[] = [
  'Trượt quay 2 cánh',
  'Trượt quay 4 cánh',
].map((name) => ({ name, sourceWindowTypes: [...SOURCE_WINDOW_TYPES.doorSlide] }));

const DOOR_EURO_SLIDE: QuoteDoorType[] = [
  'Cửa trượt ray đơn 1 cánh',
  'Cửa trượt ray đôi 2 cánh',
  'Cửa trượt ray đôi 4 cánh',
  'Cửa trượt 3 ray – 3 cánh',
  'Cửa trượt 3 ray – 6 cánh',
].map((name) => ({ name, sourceWindowTypes: [...SOURCE_WINDOW_TYPES.doorSlide] }));

const WINDOW_55: QuoteDoorType[] = [
  { name: 'Cửa lùa 2 cánh', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowSlide] },
  { name: 'Cửa lùa 4 cánh', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowSlide] },
  { name: 'Cửa mở hất 1 cánh', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowOpen] },
  { name: 'Cửa mở hất 2 cánh + Vách', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowOpen, ...SOURCE_WINDOW_TYPES.facade] },
  { name: 'Cửa mở hất 3 cánh', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowOpen] },
  { name: 'Cửa 2 cánh quay-2 cánh hất', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowOpen] },
  { name: 'Cửa 1 cánh quay', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowOpen] },
  { name: 'Cửa 2 cánh quay + Vách', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowOpen, ...SOURCE_WINDOW_TYPES.facade] },
  { name: 'Cửa 2 cánh quay – 1 cánh hất', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.windowOpen] },
];

const FACADE_55: QuoteDoorType[] = [
  { name: 'Vách kính độc lập', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.facade] },
  { name: 'Vách kính kèm cửa sổ', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.facade, ...SOURCE_WINDOW_TYPES.windowOpen] },
];

const CURTAIN_WALL: QuoteDoorType[] = [
  { name: 'Mặt dựng hệ 65', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.facade] },
  { name: 'Mặt dựng hệ 65 (Gồm cửa)', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.facade, ...SOURCE_WINDOW_TYPES.doorOpen] },
  { name: 'Mặt dựng hệ 120', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.facade] },
  { name: 'Mặt dựng hệ 120 (Gồm cửa)', sourceWindowTypes: [...SOURCE_WINDOW_TYPES.facade, ...SOURCE_WINDOW_TYPES.doorOpen] },
];

@Injectable()
export class FormulaEvaluatorService {
  private readonly logger = new Logger(FormulaEvaluatorService.name);
  private templatesDir = resolveApiPublicPath('templates');
  private doorImagesDir = resolveApiPublicPath('images', 'doors');

  constructor(private readonly prisma: PrismaService) {}

  public async getTemplates(keyword?: string, systemName?: string, windowTypeName?: string, onlyPopular?: boolean) {
    const where: any = { ...selectedTemplateWhere() };
    if (keyword) {
      where.templateName = { contains: keyword, mode: 'insensitive' };
    }
    if (systemName) {
      where.systemName = systemName;
    }
    if (windowTypeName) {
      where.windowTypeName = windowTypeName;
    }
    if (onlyPopular !== undefined) {
      where.isPopular = onlyPopular;
    }

    const templates = await this.prisma.formulaTemplate.findMany({
      where,
      take: 200,
      orderBy: [{ isPopular: 'desc' }, { createdAt: 'desc' }],
    });

    return templates.map((template) => this.toTemplateDto(template));
  }

  public async getTemplateSystems() {
    const [systems, groups] = await Promise.all([
      this.prisma.aluSystem.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { profiles: true } } },
      }),
      this.prisma.formulaTemplate.groupBy({
        by: ['windowTypeName'],
        where: selectedTemplateWhere(),
        _count: { _all: true },
      }),
    ]);
    const countsBySourceType = new Map(groups.map((group) => [group.windowTypeName, group._count._all]));

    return systems.filter((system) => system.code.toUpperCase().startsWith('EU-')).map((system) => {
      const quoteTypes = this.getQuoteDoorTypesForSystem(system.code);
      const sourceTypes = [...new Set(quoteTypes.flatMap((type) => type.sourceWindowTypes))];
      const templateCount = sourceTypes.reduce((sum, sourceType) => sum + (countsBySourceType.get(sourceType) ?? 0), 0);
      return {
        id: system.id,
        name: displaySystemName(system.code, system.name),
        code: system.code,
        description: system.description,
        profileCount: system._count.profiles,
        templateCount,
        referenceSource: 'phanmemcua',
      };
    }).filter((system) => system.templateCount > 0);
  }

  public async getTemplateWindowTypes(eurohouseSystemId?: string) {
    const groups = await this.prisma.formulaTemplate.groupBy({
      by: ['windowTypeName'],
      where: selectedTemplateWhere(),
      _count: { _all: true },
      orderBy: { windowTypeName: 'asc' },
    });

    const popularGroups = await this.prisma.formulaTemplate.groupBy({
      by: ['windowTypeName'],
      where: { ...selectedTemplateWhere(), isPopular: true },
      _count: { _all: true },
    });
    const popularByType = new Map(popularGroups.map((group) => [group.windowTypeName, group._count._all]));

    const countsBySourceType = new Map(groups.map((group) => [group.windowTypeName, group._count._all]));
    const system = eurohouseSystemId ? await this.prisma.aluSystem.findUnique({ where: { id: eurohouseSystemId } }) : null;
    const quoteTypes = this.getQuoteDoorTypesForSystem(system?.code);

    if (quoteTypes.length === 0) {
      return groups.map((group) => ({
        id: group.windowTypeName,
        name: group.windowTypeName,
        templateCount: group._count._all,
        popularCount: popularByType.get(group.windowTypeName) ?? 0,
        sourceWindowTypes: [group.windowTypeName],
      }));
    }

    return quoteTypes.map((type) => ({
      id: type.name,
      name: type.name,
      templateCount: type.sourceWindowTypes.reduce((sum, sourceType) => sum + (countsBySourceType.get(sourceType) ?? 0), 0),
      popularCount: type.sourceWindowTypes.reduce((sum, sourceType) => sum + (popularByType.get(sourceType) ?? 0), 0),
      sourceWindowTypes: type.sourceWindowTypes,
    }));
  }

  public async getTemplatesForSystem(windowTypeName: string, options: { eurohouseSystemId?: string; sourceSystemName?: string; onlyPopular?: boolean; preferPopular?: boolean } = {}) {
    const baseWhere: any = { ...selectedTemplateWhere() };
    if (options.sourceSystemName) baseWhere.systemName = options.sourceSystemName;
    if (windowTypeName) {
      const system = options.eurohouseSystemId ? await this.prisma.aluSystem.findUnique({ where: { id: options.eurohouseSystemId } }) : null;
      const sourceWindowTypes = this.getSourceWindowTypesForQuoteDoorType(windowTypeName, system?.code);
      if (sourceWindowTypes.length > 1) {
        baseWhere.windowTypeName = { in: sourceWindowTypes };
      } else {
        baseWhere.windowTypeName = sourceWindowTypes[0] ?? windowTypeName;
      }
    }

    const where = { ...baseWhere };
    if (options.onlyPopular !== undefined) {
      where.isPopular = options.onlyPopular;
    } else if (options.preferPopular) {
      where.isPopular = true;
    }

    let templates = await this.prisma.formulaTemplate.findMany({
      where,
      orderBy: [{ isPopular: 'desc' }, { templateName: 'asc' }],
      take: 200,
    });

    if (options.preferPopular && templates.length === 0) {
      templates = await this.prisma.formulaTemplate.findMany({
        where: baseWhere,
        orderBy: [{ isPopular: 'desc' }, { templateName: 'asc' }],
        take: 200,
      });
    }

    return templates.map((template) => this.toTemplateDto(template));
  }

  private getQuoteDoorTypesForSystem(systemCode?: string): QuoteDoorType[] {
    switch ((systemCode || '').toUpperCase()) {
      case 'EU-TL':
        return DOOR_HYDRAULIC;
      case 'EU-70':
        return [...DOOR_OPEN_70, ...WINDOW_55, ...FACADE_55];
      case 'EU-ECPLUS':
        return [...DOOR_OPEN_ECENTO_PLUS, ...WINDOW_55, ...FACADE_55];
      case 'EU-TQ':
        return DOOR_TURN_SLIDE;
      case 'EU-TRUOT':
        return DOOR_EURO_SLIDE;
      case 'EU-PRECO':
        return [...DOOR_OPEN_55_PRECO, ...WINDOW_55, ...FACADE_55];
      case 'EU-55':
        return [...DOOR_OPEN_55, ...WINDOW_55, ...FACADE_55];
      case 'EU-MD':
        return CURTAIN_WALL;
      default:
        return [];
    }
  }

  private getSourceWindowTypesForQuoteDoorType(quoteDoorType: string, systemCode?: string) {
    const found = this.getQuoteDoorTypesForSystem(systemCode).find((type) => type.name === quoteDoorType);
    if (found) return found.sourceWindowTypes;
    const legacySources = Object.values(SOURCE_WINDOW_TYPES).flat();
    return legacySources.includes(quoteDoorType as any) ? [quoteDoorType] : [quoteDoorType];
  }

  public async togglePopular(templateId: string, isPopular: boolean) {
    const template = await this.prisma.formulaTemplate.update({
      where: { templateId },
      data: { isPopular },
    });
    return template;
  }

  public async getTemplateDetails(templateId: string) {
    const template = await this.prisma.formulaTemplate.findUnique({
      where: { templateId },
    });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    const leaf = path.basename(template.filePath || '');
    const numericId = String(template.numericId || '');

    let files: string[] = [];
    try {
      files = fs.readdirSync(this.templatesDir);
    } catch (e) {
      this.logger.warn(`Could not read templates dir ${this.templatesDir}`);
    }
    let localName = files.find(f => f === leaf);
    if (!localName) {
      localName = files.find(f => f.includes(`__${numericId}__${leaf}`));
    }
    
    let inputs: any[] = [];
    if (localName) {
      try {
        const filePath = path.join(this.templatesDir, localName);
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets.find(w => w.name.toUpperCase() !== 'TSS1') || workbook.worksheets[0];
        
        inputs = this.extractInputsFromSheet(sheet).inputs;
      } catch (e: any) {
        this.logger.error(`Error reading template details for ${templateId}: ${e.message}`);
      }
    }

    return {
      ...template,
      imageUrl: this.findTemplateImageUrl(template),
      requiredInputs: inputs,
    };
  }

  public async getSystemFormulaDetails(systemFormulaId: string) {
    const formula = await this.prisma.systemFormula.findUnique({
      where: { id: systemFormulaId },
      include: { doorModel: true, aluSystem: true },
    });
    if (!formula) throw new NotFoundException(`System formula ${systemFormulaId} not found`);

    let inputs: any[] = [];
    if (formula.excelFilePath && fs.existsSync(formula.excelFilePath)) {
      try {
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(formula.excelFilePath);
        const sheet = workbook.worksheets.find(w => w.name.toUpperCase() !== 'TSS1') || workbook.worksheets[0];
        
        inputs = this.extractInputsFromSheet(sheet).inputs;
      } catch (e: any) {
        this.logger.error(`Error reading system formula details for ${systemFormulaId}: ${e.message}`);
      }
    }

    return {
      ...formula,
      requiredInputs: inputs,
    };
  }

  public async evaluateTemplate(templateId: string, inputs: Record<string, any>) {
    const template = await this.prisma.formulaTemplate.findUnique({
      where: { templateId },
    });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    // DÃ¡Â»Â±a vÃƒÂ o file_path trong database cÃ…Â©, tÃƒÂ¬m file xlsx cÃƒÂ³ Ã„â€˜Ã¡Â»â€¹nh dÃ¡ÂºÂ¡ng *__{numeric_id}__{leaf}
    const leaf = path.basename(template.filePath || '');
    const numericId = String(template.numericId || '');
    
    // VÃƒÂ¬ ta Ã„â€˜ÃƒÂ£ copy file vÃ¡Â»â€ºi tÃƒÂªn gÃ¡Â»â€˜c tÃ¡Â»Â« extractor
    let files: string[] = [];
    try {
      files = fs.readdirSync(this.templatesDir);
    } catch (e) {
      this.logger.warn(`Could not read templates dir ${this.templatesDir}`);
    }
    let localName = files.find(f => f === leaf);
    if (!localName) {
      localName = files.find(f => f.includes(`__${numericId}__${leaf}`));
    }
    
    if (!localName) {
      throw new NotFoundException(`XLSX file for template ${templateId} not found`);
    }

    const filePath = path.join(this.templatesDir, localName);
    return this.evaluateWorkbookFile(filePath, inputs);
  }

  public async evaluateSystemFormula(systemFormulaId: string, inputs: Record<string, any>) {
    const formula = await this.prisma.systemFormula.findUnique({
      where: { id: systemFormulaId },
    });
    if (!formula) throw new NotFoundException(`System formula ${systemFormulaId} not found`);
    
    if (!formula.excelFilePath || !fs.existsSync(formula.excelFilePath)) {
      throw new NotFoundException(`XLSX file for formula ${systemFormulaId} not found`);
    }

    return this.evaluateWorkbookFile(formula.excelFilePath, inputs);
  }

  private async evaluateWorkbookFile(filePath: string, inputs: Record<string, any>) {
    try {
      const workbook = new exceljs.Workbook();
      await workbook.xlsx.readFile(filePath);
      return this.evaluateWorkbook(workbook, inputs);
    } catch (e: any) {
      this.logger.error(`Error reading or evaluating workbook at ${filePath}: ${e.message}`);
      throw new InternalServerErrorException(`XLSX parse error: ${e.message}`);
    }
  }

  private evaluateWorkbook(workbook: exceljs.Workbook, inputs: Record<string, any>) {
    const sheet = workbook.worksheets.find(w => w.name.toUpperCase() !== 'TSS1') || workbook.worksheets[0];
    const { inputMap } = this.extractInputsFromSheet(sheet);

    const normalizedInputs: Record<string, any> = {};

    for (const [key, cellRef] of Object.entries(inputMap)) {
      const cell = sheet.getCell(cellRef as string);
      if (inputs[key] !== undefined && inputs[key] !== null && inputs[key] !== '') {
        const val = this.toNumber(inputs[key]);
        cell.value = val;
        normalizedInputs[key] = val;
      } else {
        normalizedInputs[key] = this.getCellValue(cell);
      }
    }

    const cache: Record<string, any> = {};
    const stack = new Set<string>();

    const getVal = (coord: string) => {
      coord = coord.replace(/\$/g, '').toUpperCase();
      if (cache[coord] !== undefined) return cache[coord];
      if (stack.has(coord)) return 0;
      
      stack.add(coord);
      const cell = sheet.getCell(coord);
      let val = this.getCellValue(cell);
      
      if (this.isFormula(val)) {
        val = this.evalFormula(val, getVal, getRangeVals);
      }
      
      val = this.toNumber(val);
      cache[coord] = val;
      stack.delete(coord);
      return val;
    };

    const getRangeVals = (startCol: string, startRow: string, endCol: string, endRow: string) => {
      const values = [];
      const sRow = parseInt(startRow, 10);
      const eRow = parseInt(endRow, 10);
      const sCol = columnIndex(startCol);
      const eCol = columnIndex(endCol);

      for (let r = sRow; r <= eRow; r++) {
        for (let c = sCol; c <= eCol; c++) {
          values.push(getVal(`${columnName(c)}${r}`));
        }
      }
      return values;
    };

    const extractSection = (title: string, cols: Array<[string, number]>, stopTitles: string[]) => {
      const startRow = this.findRow(sheet, title);
      if (!startRow) return [];
      
      const rows = [];
      const maxRow = Math.min(sheet.rowCount, startRow + 80);
      
      for (let r = startRow + 2; r <= maxRow; r++) {
        const firstValues = [];
        for (let c = 1; c <= 7; c++) {
          firstValues.push(String(this.getCellValue(sheet.getCell(r, c)) || ''));
        }
        
        const shouldStop = firstValues.some(val => 
          stopTitles.some(stop => normalizeText(val).includes(normalizeText(stop)))
        );
        if (shouldStop) break;
        
        const record: any = {};
        for (const [name, colIdx] of cols) {
          let cellVal = this.getCellValue(sheet.getCell(r, colIdx));
          if (this.isFormula(cellVal)) {
            cellVal = this.evalFormula(cellVal, getVal, getRangeVals);
          }
          record[name] = this.toNumber(cellVal);
        }
        
        if (record[cols[0][0]] || record[cols[1][0]] || record[cols[2][0]]) {
           rows.push(record);
        }
      }
      return rows;
    };

    const aluminum = extractSection(
      'KICH THUOC CAT NHOM',
      [['name', 2], ['position', 3], ['code', 4], ['angle', 5], ['quantity', 6], ['length_mm', 7], ['kg_per_m', 8], ['total_kg', 9]],
      ['KICH THUOC CAT KINH', 'PHU KIEN', 'BANG TINH']
    );

    const glass = extractSection(
      'KICH THUOC CAT KINH',
      [['name', 2], ['width_mm', 3], ['height_mm', 4], ['quantity', 5], ['area_m2', 6], ['position', 7]],
      ['PHU KIEN', 'BANG TINH']
    );

    const accessories = extractSection(
      'PHU KIEN',
      [['name', 2], ['code', 3], ['unit', 4], ['quantity', 5]],
      ['BANG TINH', 'TÃ¡Â»â€NG', 'TONG']
    );

    return {
      sheet: sheet.name,
      inputs: normalizedInputs,
      aluminum,
      glass,
      accessories,
    };
  }

  private findRow(sheet: exceljs.Worksheet, label: string): number | null {
    const needle = normalizeText(label);
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= row.cellCount; c++) {
        const val = this.getCellValue(row.getCell(c));
        if (typeof val === 'string' && normalizeText(val).includes(needle)) {
          return r;
        }
      }
    }
    return null;
  }

  private getCellValue(cell: exceljs.Cell): any {
    if (cell.type === exceljs.ValueType.Formula) {
      // exceljs stores the raw string formula
      return `=${cell.formula}`;
    }
    return cell.value?.valueOf() ?? cell.value;
  }

  private isFormula(val: any): boolean {
    return typeof val === 'string' && val.startsWith('=');
  }

  private toNumber(val: any): any {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const asNum = parseFloat(String(val).replace(/,/g, ''));
    if (!isNaN(asNum)) return asNum;
    return val;
  }

  private evalFormula(
    formula: string,
    getCell: (coord: string) => any,
    getRange: (c1: string, r1: string, c2: string, r2: string) => any[]
  ): any {
    let expr = formula.replace(/^=/, '').replace(/\^/g, '**');

    // Replace Range (e.g. A1:B2)
    expr = expr.replace(/(?<![A-Za-z0-9_])\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)/g, (m, c1, r1, c2, r2) => {
      return `RANGE('${c1}', '${r1}', '${c2}', '${r2}')`;
    });

    // Replace Cell Ref (e.g. A1)
    expr = expr.replace(/(?<![A-Za-z0-9_])(?:'[^']+'!)?\$?([A-Z]{1,3})\$?(\d+)/g, (m, c, r) => {
      return `CELL('${c}${r}')`;
    });

    // Convert excel functions to JS functions
    expr = expr.replace(/\bSUM\s*\(/gi, 'SUM(');
    expr = expr.replace(/\bSQRT\s*\(/gi, 'SQRT(');
    expr = expr.replace(/\bIF\s*\(/gi, 'IF(');
    expr = expr.replace(/\bROUND\s*\(/gi, 'ROUND(');
    expr = expr.replace(/\bMIN\s*\(/gi, 'MIN(');
    expr = expr.replace(/\bMAX\s*\(/gi, 'MAX(');
    expr = expr.replace(/\bABS\s*\(/gi, 'ABS(');
    // Excel argument separator
    expr = expr.replace(/;/g, ',');

    const EXCEL_SUM = (...args: any[]) => {
      let sum = 0;
      for (const arg of args) {
        if (Array.isArray(arg)) sum += EXCEL_SUM(...arg);
        else if (typeof arg === 'number') sum += arg;
        else {
          const parsed = parseFloat(arg);
          if (!isNaN(parsed)) sum += parsed;
        }
      }
      return sum;
    };

    const EXCEL_IF = (cond: any, yes: any, no: any = 0) => (cond ? yes : no);
    
    try {
      return this.evaluateSafeExpression(expr, {
        CELL: getCell,
        RANGE: getRange,
        SUM: EXCEL_SUM,
        SQRT: (val: any) => Math.sqrt(parseFloat(val) || 0),
        IF: EXCEL_IF,
        ROUND: Math.round,
        MIN: Math.min,
        MAX: Math.max,
        ABS: Math.abs,
      });
    } catch (e) {
      return 0;
    }
  }

  private evaluateSafeExpression(expr: string, functions: Record<string, (...args: any[]) => any>): any {
    type Token =
      | { type: 'number'; value: number }
      | { type: 'string'; value: string }
      | { type: 'identifier'; value: string }
      | { type: 'operator'; value: string }
      | { type: 'punct'; value: '(' | ')' | ',' }
      | { type: 'eof'; value: '' };

    const tokens: Token[] = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      if (ch === '\'' || ch === '"') {
        const quote = ch;
        i += 1;
        let value = '';
        while (i < expr.length && expr[i] !== quote) {
          value += expr[i];
          i += 1;
        }
        if (expr[i] === quote) i += 1;
        tokens.push({ type: 'string', value });
        continue;
      }
      if (/\d|\./.test(ch)) {
        let raw = '';
        while (i < expr.length && /[\d.]/.test(expr[i])) {
          raw += expr[i];
          i += 1;
        }
        tokens.push({ type: 'number', value: parseFloat(raw) || 0 });
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let raw = '';
        while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
          raw += expr[i];
          i += 1;
        }
        tokens.push({ type: 'identifier', value: raw.toUpperCase() });
        continue;
      }
      const two = expr.slice(i, i + 2);
      if (['>=', '<=', '<>', '!=', '==', '**'].includes(two)) {
        tokens.push({ type: 'operator', value: two });
        i += 2;
        continue;
      }
      if (['+', '-', '*', '/', '>', '<', '='].includes(ch)) {
        tokens.push({ type: 'operator', value: ch });
        i += 1;
        continue;
      }
      if (ch === '(' || ch === ')' || ch === ',') {
        tokens.push({ type: 'punct', value: ch });
        i += 1;
        continue;
      }
      throw new Error(`Unsupported formula token: ${ch}`);
    }
    tokens.push({ type: 'eof', value: '' });

    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];
    const match = (type: Token['type'], value?: string) => {
      const token = peek();
      if (token.type !== type) return false;
      if (value !== undefined && token.value !== value) return false;
      pos += 1;
      return true;
    };

    const asNumber = (value: any) => {
      if (typeof value === 'number') return value;
      if (Array.isArray(value)) return value.reduce((sum, item) => sum + asNumber(item), 0);
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const parseExpression = (): any => parseComparison();

    const parseComparison = (): any => {
      let left = parseAdditive();
      while (peek().type === 'operator' && ['>', '<', '>=', '<=', '=', '==', '<>', '!='].includes(String(peek().value))) {
        const op = take().value;
        const right = parseAdditive();
        const l = asNumber(left);
        const r = asNumber(right);
        if (op === '>') left = l > r;
        else if (op === '<') left = l < r;
        else if (op === '>=') left = l >= r;
        else if (op === '<=') left = l <= r;
        else if (op === '<>' || op === '!=') left = l !== r;
        else left = l === r;
      }
      return left;
    };

    const parseAdditive = (): any => {
      let left = parseMultiplicative();
      while (peek().type === 'operator' && ['+', '-'].includes(String(peek().value))) {
        const op = take().value;
        const right = parseMultiplicative();
        left = op === '+' ? asNumber(left) + asNumber(right) : asNumber(left) - asNumber(right);
      }
      return left;
    };

    const parseMultiplicative = (): any => {
      let left = parsePower();
      while (peek().type === 'operator' && ['*', '/'].includes(String(peek().value))) {
        const op = take().value;
        const right = parsePower();
        left = op === '*' ? asNumber(left) * asNumber(right) : asNumber(left) / asNumber(right);
      }
      return left;
    };

    const parsePower = (): any => {
      const left = parseUnary();
      if (match('operator', '**')) {
        return Math.pow(asNumber(left), asNumber(parsePower()));
      }
      return left;
    };

    const parseUnary = (): any => {
      if (match('operator', '+')) return asNumber(parseUnary());
      if (match('operator', '-')) return -asNumber(parseUnary());
      return parsePrimary();
    };

    const parsePrimary = (): any => {
      const token = take();
      if (token.type === 'number' || token.type === 'string') return token.value;
      if (token.type === 'identifier') {
        if (token.value === 'TRUE') return true;
        if (token.value === 'FALSE') return false;
        if (match('punct', '(')) {
          const args: any[] = [];
          if (!match('punct', ')')) {
            do {
              args.push(parseExpression());
            } while (match('punct', ','));
            if (!match('punct', ')')) throw new Error('Expected closing parenthesis');
          }
          const fn = functions[token.value];
          if (!fn) throw new Error(`Unsupported formula function: ${token.value}`);
          return fn(...args);
        }
        return 0;
      }
      if (token.type === 'punct' && token.value === '(') {
        const value = parseExpression();
        if (!match('punct', ')')) throw new Error('Expected closing parenthesis');
        return value;
      }
      throw new Error('Unexpected formula token');
    };

    const value = parseExpression();
    if (peek().type !== 'eof') throw new Error('Unexpected trailing formula token');
    return value;
  }

  private extractInputsFromSheet(sheet: exceljs.Worksheet) {
    const inputs: any[] = [];
    const inputMap: Record<string, string> = {};
    for (let i = 5; i <= 20; i++) {
      const bCell = sheet.getCell('B' + i);
      let label = bCell.value;
      if (label && typeof label === 'object' && 'richText' in label) {
        label = (label as any).richText.map((rt: any) => rt.text).join('');
      }
      if (!label) continue;
      label = String(label).trim().replace(/:$/, '');
      const lower = label.toLowerCase();
      
      if (lower.includes('n/a') || lower.includes('---')) continue;
      if (lower.includes('diện tích') || lower.includes('tổng') || lower.includes('thành tiền') || lower.includes('tỉ trọng')) continue;
      
      let key = 'field_' + i;
      let type = 'number';
      
      if (lower.includes('rộng')) key = 'width';
      else if (lower.includes('cao')) key = 'height';
      else if (lower.includes('b1')) key = 'h1';
      else if (lower.includes('h1') || lower.includes('hở chân')) key = 'h2';
      else if (lower.includes('kính') && !lower.includes('giá')) { key = 'glass_type'; type = 'string'; }
      else if (lower.includes('bộ')) key = 'quantity';
      else if (lower.includes('giá nhôm')) key = 'aluminum_price';
      else if (lower.includes('giá kính')) key = 'glass_price';

      const cCell = sheet.getCell('C' + i);
      const defaultVal = cCell.value?.valueOf() ?? cCell.value;
      if (!defaultVal && ['h1', 'h2', 'glass_type'].includes(key)) continue;

      let unit = '';
      if (lower.includes('mm')) unit = 'mm';
      else if (lower.includes('kg')) unit = 'VNĐ/Kg';
      else if (lower.includes('m2')) unit = 'VNĐ/m2';

      inputs.push({
        id: key,
        name: label,
        type,
        unit
      });
      if (inputMap[key]) {
        key = 'field_' + i;
        inputs[inputs.length - 1].id = key;
      }
      inputMap[key] = 'C' + i;
    }
    return { inputs, inputMap };
  }

  private shortSystemCode(systemName: string) {
    const clean = systemName.replace(/^\d+\s*/, '').trim();
    return clean.split(/\s+-\s+|\s+/).slice(0, 3).join(' ');
  }

  private toTemplateDto(template: any) {
    return {
      ...template,
      id: template.templateId,
      sourceSystemName: template.systemName,
      imageUrl: this.findTemplateImageUrl(template),
    };
  }

  private findTemplateImageUrl(template: { templateId?: string; windowTypeName?: string; templateName?: string; imagePath?: string }) {
    let files: string[] = [];
    try {
      files = fs.readdirSync(this.doorImagesDir);
    } catch {
      return '';
    }

    const exact = template.templateId ? files.find((file) => file.startsWith(`${template.templateId}__`)) : '';
    const fallback = exact || files.find((file) => {
      const text = normalizeText(file);
      return normalizeText(template.windowTypeName).split(/\s+/).every((part) => !part || text.includes(part))
        && (!template.templateName || text.includes(normalizeText(template.templateName).slice(0, 12)));
    }) || files.find((file) => normalizeText(file).includes(normalizeText(template.windowTypeName)));

    return fallback ? `/static/images/doors/${encodeURIComponent(fallback)}` : '';
  }
}
