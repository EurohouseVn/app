// Lớp kết nối nhà cung cấp hoá đơn điện tử. App không giữ khoá ký: nhà cung cấp ký bằng HSM của người bán.
// GĐ1 chỉ có Bản thử (SANDBOX). MISA meInvoice nối ở GĐ2 khi xưởng có ClientID và tài khoản API.
import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { InvoiceProviderCode } from '@eurohouse/types';

export interface ProviderIssueRequest {
  series: string;
  /** Số lớn nhất đã dùng cho ký hiệu này trong xưởng, để Bản thử cấp số tiếp theo. */
  lastNumber: string | null;
  sellerTaxCode: string;
  buyerName: string;
  total: number;
}

export interface ProviderIssueResult {
  number: string;
  lookupCode: string;
  providerRef: string;
}

export interface InvoiceProvider {
  readonly code: Exclude<InvoiceProviderCode, 'NONE'>;
  issue(request: ProviderIssueRequest): Promise<ProviderIssueResult>;
  cancel(providerRef: string, reason: string): Promise<void>;
}

export const INVOICE_NUMBER_DIGITS = 8;

export function nextInvoiceNumber(lastNumber: string | null): string {
  const next = (lastNumber ? Number.parseInt(lastNumber, 10) || 0 : 0) + 1;
  return String(next).padStart(INVOICE_NUMBER_DIGITS, '0');
}

export class SandboxInvoiceProvider implements InvoiceProvider {
  readonly code = 'SANDBOX' as const;

  async issue(request: ProviderIssueRequest): Promise<ProviderIssueResult> {
    const suffix = randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
    return {
      number: nextInvoiceNumber(request.lastNumber),
      lookupCode: `TEST-${suffix}`,
      providerRef: `sandbox-${Date.now().toString(36)}-${suffix.toLowerCase()}`,
    };
  }

  async cancel(): Promise<void> {
    // Bản thử không có hệ thống bên ngoài để báo huỷ.
  }
}

export function providerFor(code: InvoiceProviderCode): InvoiceProvider {
  if (code === 'SANDBOX') return new SandboxInvoiceProvider();
  if (code === 'MISA') throw new BadRequestException('Chưa nối MISA meInvoice. Khi xưởng có tài khoản API, Eurohouse sẽ bật kết nối này.');
  throw new BadRequestException('Chưa chọn nhà cung cấp hoá đơn. Chọn Bản thử trong hồ sơ thuế, hoặc ghi số hoá đơn đã xuất ở hệ thống khác.');
}
