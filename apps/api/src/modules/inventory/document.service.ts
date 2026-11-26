import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateDocumentDraftInput,
  CreateOrderInput,
  DocumentDraftItem,
  DocumentDraftKind,
  DocumentDraftLine,
  DocumentDraftLineInput,
  DocumentDraftStatus,
  DocumentServiceStatus,
  ExtractedGroup,
  UpdateDocumentDraftInput,
} from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { InventoryService } from './inventory.service';
import { OCR_PROVIDER, type OcrProviderPort } from './ocr-provider';
import {
  convertToBars,
  learnTermFromLine,
  matchColor,
  matchLine,
  parseQuantityUnit,
  type CatalogProfile,
  type GlossaryEntry,
  type QuantityUnit,
} from './document-matching';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type CatalogRow = CatalogProfile & { kgPerMeter: number };
type DraftRow = {
  id: string; nppOrgId: string; kind: string; status: string; imageObjectId: string | null; engine: string; note: string; lines: unknown;
  factoryOrgId: string | null; resultRef: string; createdAt: Date; confirmedAt: Date | null;
};

function toUnit(value: string | null | undefined): QuantityUnit {
  if (value === 'BUNDLE' || value === 'BAR' || value === 'SET') return value;
  return value ? parseQuantityUnit(`1 ${value}`).unit : null;
}

/**
 * Phiếu viết tay của thợ và hóa đơn in: chụp ảnh → bản nháp (máy đọc, ghép danh mục) → người xem, sửa → chốt thành đơn hoặc nhập kho.
 * Máy đọc luôn có thể sai, nên không có đường nào đi thẳng từ ảnh vào kho hay đơn hàng.
 */
@Injectable()
export class NppDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProviderPort,
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly inventory?: InventoryService,
  ) {}

  status(): DocumentServiceStatus {
    return { ocrConfigured: this.ocr.configured, engine: this.ocr.engine };
  }

  private async loadCatalog(): Promise<CatalogRow[]> {
    const rows = (await this.prisma.profile.findMany({
      select: { id: true, code: true, name: true, barsPerBundle: true, kgPerMeter: true, aluSystem: { select: { code: true, name: true } } },
    })) as Array<{ id: string; code: string; name: string; barsPerBundle: number; kgPerMeter: number; aluSystem: { code: string; name: string } }>;
    return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, barsPerBundle: r.barsPerBundle, kgPerMeter: r.kgPerMeter, systemCode: r.aluSystem.code, systemName: r.aluSystem.name }));
  }

  private async loadGlossary(nppOrgId: string): Promise<GlossaryEntry[]> {
    const rows = (await this.prisma.nppOcrGlossary.findMany({ where: { nppOrgId } })) as Array<{ term: string; profileId: string | null }>;
    return rows.map((r) => ({ term: r.term, profileId: r.profileId ?? undefined }));
  }

  private toLine(base: ReturnType<typeof matchLine>, meta: { id: string; group: string; removed: boolean; userChosen: boolean }, catalog: CatalogRow[]): DocumentDraftLine {
    const profile = base.profileId ? catalog.find((c) => c.id === base.profileId) : undefined;
    return {
      id: meta.id, group: meta.group, text: base.text, quantity: base.quantity, unit: base.unit, bars: base.bars, colorCode: base.colorCode,
      profileId: base.profileId, profileCode: profile?.code, profileName: profile?.name, confidence: base.confidence,
      candidates: base.candidates, warnings: base.warnings, userChosen: meta.userChosen, removed: meta.removed,
    };
  }

  private buildLines(groups: ExtractedGroup[], catalog: CatalogRow[], glossary: GlossaryEntry[]): DocumentDraftLine[] {
    const lines: DocumentDraftLine[] = [];
    for (const group of groups) {
      for (const raw of group.lines) {
        const parsed = parseQuantityUnit(raw.text);
        const quantity = raw.quantity ?? parsed.quantity;
        const unit = toUnit(raw.unit) ?? parsed.unit;
        const base = matchLine({ text: raw.text, quantity, unit, colorHint: group.heading, systemHint: group.heading }, catalog, glossary);
        lines.push(this.toLine(base, { id: randomUUID(), group: group.heading, removed: false, userChosen: false }, catalog));
      }
    }
    return lines;
  }

  private toItem(row: DraftRow): DocumentDraftItem {
    return {
      id: row.id,
      kind: row.kind as DocumentDraftKind,
      status: row.status as DocumentDraftStatus,
      engine: row.engine,
      note: row.note,
      factoryOrgId: row.factoryOrgId,
      resultRef: row.resultRef,
      hasImage: !!row.imageObjectId,
      lines: row.lines as DocumentDraftLine[],
      createdAt: row.createdAt.toISOString(),
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : undefined,
    };
  }

  private async load(nppOrgId: string, id: string): Promise<DraftRow> {
    const row = (await this.prisma.nppDocumentDraft.findFirst({ where: { id, nppOrgId } })) as DraftRow | null;
    if (!row) throw new NotFoundException('Không tìm thấy phiếu.');
    return row;
  }

  async createDraft(nppOrgId: string, actorId: string, input: CreateDocumentDraftInput): Promise<DocumentDraftItem> {
    if (input.kind !== 'ORDER' && input.kind !== 'RECEIPT') throw new BadRequestException('Loại phiếu phải là ORDER hoặc RECEIPT.');
    let imageObjectId: string | null = null;
    let engine = 'manual';
    let note = input.note?.trim() ?? '';
    let groups: ExtractedGroup[] = input.groups ?? [];

    if (input.imageBase64) {
      if (!input.mime || !ALLOWED_MIME.has(input.mime)) throw new BadRequestException('Ảnh phiếu phải là JPEG, PNG hoặc WebP.');
      if ((input.imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) throw new BadRequestException('Ảnh quá lớn (tối đa 10 MB). Hãy chụp lại hoặc thu nhỏ ảnh.');
      if (this.storage) {
        const stored = await this.storage.putUpload({ buffer: Buffer.from(input.imageBase64, 'base64'), mime: input.mime, purpose: 'npp-document', ownerOrganizationId: nppOrgId, ownerUserId: actorId });
        imageObjectId = stored.id;
      }
      if (groups.length === 0 && this.ocr.configured) {
        try {
          const result = await this.ocr.extract({ imageBase64: input.imageBase64, mime: input.mime, kind: input.kind });
          groups = result.groups;
          engine = result.engine;
        } catch (error) {
          note = `${note ? `${note}\n` : ''}Không đọc được ảnh tự động: ${(error as Error).message} Hãy nhập các dòng bằng tay.`;
        }
      }
    }

    const [catalog, glossary] = await Promise.all([this.loadCatalog(), this.loadGlossary(nppOrgId)]);
    const lines = this.buildLines(groups, catalog, glossary);
    const row = (await this.prisma.nppDocumentDraft.create({
      data: {
        nppOrgId, kind: input.kind, imageObjectId, engine, note, factoryOrgId: input.factoryOrgId ?? null, createdById: actorId,
        lines: lines as unknown as Prisma.InputJsonValue,
      },
    })) as DraftRow;
    return this.toItem(row);
  }

  async listDrafts(nppOrgId: string): Promise<DocumentDraftItem[]> {
    const rows = (await this.prisma.nppDocumentDraft.findMany({ where: { nppOrgId }, orderBy: { createdAt: 'desc' }, take: 30 })) as DraftRow[];
    return rows.map((row) => this.toItem(row));
  }

  async getDraft(nppOrgId: string, id: string): Promise<DocumentDraftItem> {
    return this.toItem(await this.load(nppOrgId, id));
  }

  /** Người dùng gửi lại toàn bộ danh sách dòng sau khi sửa: tính lại số cây, ghép lại, và học từ viết tắt khi họ chọn thanh mà máy không tự chọn được. */
  async updateDraft(nppOrgId: string, id: string, input: UpdateDocumentDraftInput): Promise<DocumentDraftItem> {
    const draft = await this.load(nppOrgId, id);
    if (draft.status !== 'DRAFT') throw new BadRequestException('Phiếu không còn là bản nháp, không sửa được.');
    const [catalog, glossary] = await Promise.all([this.loadCatalog(), this.loadGlossary(nppOrgId)]);
    const previous = new Map((draft.lines as DocumentDraftLine[]).map((l) => [l.id, l]));
    const learn = input.learn !== false;
    const lines: DocumentDraftLine[] = [];
    const toLearn = new Map<string, string>();

    for (const item of input.lines) {
      const group = item.group ?? previous.get(item.id ?? '')?.group ?? '';
      const unit = toUnit(item.unit);
      const base = matchLine({ text: item.text, quantity: item.quantity, unit, colorHint: group, systemHint: group }, catalog, glossary);
      const meta = { id: item.id ?? randomUUID(), group, removed: item.removed === true, userChosen: false };
      let line = this.toLine(base, meta, catalog);

      if (item.profileId === null) {
        line = { ...line, profileId: null, profileCode: undefined, profileName: undefined, bars: null, confidence: 'NONE' };
      } else if (item.profileId !== undefined) {
        const chosen = catalog.find((c) => c.id === item.profileId);
        if (!chosen) throw new BadRequestException(`Không tìm thấy thanh nhôm đã chọn (${item.profileId}).`);
        const bars = convertToBars(item.quantity, unit, chosen.barsPerBundle);
        const warnings = base.warnings.filter((w) => !/quy cách bó/i.test(w));
        if (unit === 'BUNDLE' && item.quantity !== null && item.quantity > 0 && chosen.barsPerBundle <= 0) warnings.push(`Thanh ${chosen.code} chưa có quy cách bó nên chưa đổi được sang cây.`);
        line = { ...line, profileId: chosen.id, profileCode: chosen.code, profileName: chosen.name, bars, confidence: 'HIGH', userChosen: true, warnings };
        if (learn && base.profileId !== chosen.id && !line.removed) {
          const term = learnTermFromLine(item.text);
          if (term) toLearn.set(term, chosen.id);
        }
      }
      if (item.colorCode !== undefined && item.colorCode !== null) line = { ...line, colorCode: item.colorCode };
      lines.push(line);
    }

    for (const [term, profileId] of toLearn) {
      await this.prisma.nppOcrGlossary.upsert({
        where: { nppOrgId_term: { nppOrgId, term } },
        create: { nppOrgId, term, profileId },
        update: { profileId, hits: { increment: 1 } },
      });
    }
    const saved = (await this.prisma.nppDocumentDraft.update({
      where: { id },
      data: {
        lines: lines as unknown as Prisma.InputJsonValue,
        ...(input.factoryOrgId !== undefined ? { factoryOrgId: input.factoryOrgId } : {}),
        ...(input.note !== undefined ? { note: input.note.trim() } : {}),
      },
    })) as DraftRow;
    return this.toItem(saved);
  }

  /** Mọi dòng còn lại phải xác định được thanh, số cây và màu; báo rõ dòng nào chưa đạt để sửa. */
  private requireResolved(draft: DraftRow, needColor: boolean): DocumentDraftLine[] {
    const all = draft.lines as DocumentDraftLine[];
    const active = all.filter((l) => !l.removed);
    if (active.length === 0) throw new BadRequestException('Phiếu chưa có dòng nào để chốt.');
    all.forEach((line, index) => {
      if (line.removed) return;
      const n = index + 1;
      if (!line.profileId) throw new BadRequestException(`Dòng ${n} chưa chọn thanh nhôm.`);
      // Máy chỉ "đoán" theo tên (không phải mã hay từ điển đã học): người dùng phải xem và xác nhận hoặc chọn lại trước khi chốt.
      if (!line.userChosen && line.confidence !== 'HIGH') throw new BadRequestException(`Dòng ${n}: máy mới chỉ đoán thanh ${line.profileCode ?? ''}, hãy xem lại rồi bấm "Đúng" hoặc chọn lại.`);
      if (!line.bars || line.bars <= 0) throw new BadRequestException(`Dòng ${n} chưa có số cây (kiểm tra số lượng và đơn vị bó/cây).`);
      if (needColor && !line.colorCode) throw new BadRequestException(`Dòng ${n} chưa chọn màu nhôm.`);
    });
    return active;
  }

  async buildOrderInput(nppOrgId: string, id: string): Promise<CreateOrderInput> {
    const draft = await this.load(nppOrgId, id);
    if (draft.kind !== 'ORDER') throw new BadRequestException('Chỉ phiếu đơn hàng của thợ mới tạo được đơn.');
    if (draft.status !== 'DRAFT') throw new BadRequestException('Phiếu không còn là bản nháp.');
    if (!draft.factoryOrgId) throw new BadRequestException('Chọn xưởng thợ gửi đơn trước khi chốt.');
    const lines = this.requireResolved(draft, true);
    const factory = (await this.prisma.organization.findFirst({ where: { id: draft.factoryOrgId, type: 'FACTORY' } })) as { id: string; name: string; phone: string | null; address: string | null } | null;
    if (!factory) throw new NotFoundException('Không tìm thấy xưởng thợ đã chọn.');
    const catalog = new Map((await this.loadCatalog()).map((c) => [c.id, c]));
    return {
      sourceType: 'NPP',
      factoryOrgId: factory.id,
      clientRequestId: `doc-${draft.id}`,
      customerName: factory.name,
      customerPhone: factory.phone ?? undefined,
      deliveryAddress: factory.address ?? undefined,
      colorCode: lines[0].colorCode!,
      note: `Tạo từ phiếu viết tay ${draft.id}`,
      items: lines.map((line) => {
        const profile = catalog.get(line.profileId!)!;
        return { profileId: profile.id, productCode: profile.code, productName: profile.name, colorCode: line.colorCode!, quantity: line.bars!, kgPerMeter: profile.kgPerMeter };
      }),
    };
  }

  async confirmOrder(nppOrgId: string, actorId: string, id: string, input: { resultRef: string }): Promise<DocumentDraftItem> {
    const draft = await this.load(nppOrgId, id);
    if (draft.kind !== 'ORDER') throw new BadRequestException('Đây không phải phiếu đơn hàng.');
    if (draft.status === 'CONFIRMED') return this.toItem(draft);
    if (draft.status === 'REJECTED') throw new BadRequestException('Bản nháp đã bị bỏ, không chốt được.');
    await this.prisma.nppDocumentDraft.updateMany({
      where: { id, nppOrgId, status: 'DRAFT' },
      data: { status: 'CONFIRMED', resultRef: (input.resultRef ?? '').slice(0, 80), confirmedById: actorId, confirmedAt: new Date() },
    });
    return this.getDraft(nppOrgId, id);
  }

  /**
   * Nhập kho theo phiếu của nhà cung cấp: từng dòng cộng vào kho nhôm của NPP với khóa chống trùng ổn định theo (phiếu, dòng),
   * nên chốt lại sau khi lỗi giữa chừng không cộng hai lần.
   */
  async confirmReceipt(nppOrgId: string, actorId: string, id: string): Promise<DocumentDraftItem> {
    const draft = await this.load(nppOrgId, id);
    if (draft.kind !== 'RECEIPT') throw new BadRequestException('Chỉ phiếu nhập hàng mới nhập được vào kho.');
    if (draft.status === 'CONFIRMED') return this.toItem(draft);
    if (draft.status === 'REJECTED') throw new BadRequestException('Bản nháp đã bị bỏ, không chốt được.');
    if (!this.inventory) throw new BadRequestException('Chưa nối với dịch vụ kho.');
    const lines = this.requireResolved(draft, true);
    for (const line of lines) {
      await this.withRetry(() => this.inventory!.adjustNppProfileStock(
        nppOrgId,
        line.profileId!,
        { direction: 'IN', quantity: line.bars!, colorCode: line.colorCode!, reason: 'Nhập kho theo phiếu', note: `Phiếu ${draft.id}` },
        { idempotencyKey: `doc-${draft.id}-${line.id}`, actorId, organizationId: nppOrgId, ownerType: 'NPP_STOCK', ownerId: nppOrgId, command: 'NPP_PROFILE_STOCK_ADJUST' },
      ));
    }
    await this.prisma.nppDocumentDraft.updateMany({
      where: { id, nppOrgId, status: 'DRAFT' },
      data: { status: 'CONFIRMED', resultRef: `Nhập kho ${lines.length} dòng`, confirmedById: actorId, confirmedAt: new Date() },
    });
    return this.getDraft(nppOrgId, id);
  }

  /**
   * Lệnh kho chạy ở mức Serializable nên hai yêu cầu cùng khóa chống trùng (bấm đúp, hai máy cùng chốt) có thể va nhau:
   * bên thua nhận lỗi xung đột. Vì khóa ổn định theo (phiếu, dòng), thử lại là an toàn: lần sau sẽ thấy lệnh đã xong và trả lại kết quả cũ.
   */
  retryDelayMs = 120;

  private async withRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await work();
      } catch (error) {
        const code = (error as { code?: string }).code;
        const transient = error instanceof ConflictException || code === 'P2034' || code === 'P2002' || /write conflict|could not serialize|deadlock/i.test(String((error as Error).message));
        if (!transient || attempt >= 6) throw error;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
  }

  async reject(nppOrgId: string, id: string): Promise<DocumentDraftItem> {
    const draft = await this.load(nppOrgId, id);
    if (draft.status === 'CONFIRMED') throw new BadRequestException('Phiếu đã chốt, không bỏ được.');
    if (draft.status === 'REJECTED') return this.toItem(draft);
    await this.prisma.nppDocumentDraft.updateMany({ where: { id, nppOrgId, status: 'DRAFT' }, data: { status: 'REJECTED' } });
    return this.getDraft(nppOrgId, id);
  }

  async readImage(nppOrgId: string, id: string): Promise<{ mime: string; body: Buffer }> {
    const draft = await this.load(nppOrgId, id);
    if (!draft.imageObjectId || !this.storage) throw new BadRequestException('Phiếu này không có ảnh.');
    const { object, body } = await this.storage.read(draft.imageObjectId);
    return { mime: object.mime, body: body as Buffer };
  }
}

// Màu trong tiêu đề nhóm được nhận bằng matchColor khi ghép dòng; xuất lại để nơi khác (giao diện) dùng chung nếu cần.
export { matchColor };
