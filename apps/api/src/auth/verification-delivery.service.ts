import { Resend } from 'resend';

export type VerificationChannelValue = 'EMAIL' | 'PHONE';
export type VerificationDeliveryInput = { channel: VerificationChannelValue; target: string; code: string; expiresMinutes: number };
export interface VerificationDeliveryPort { send(input: VerificationDeliveryInput): Promise<void>; }
export const VERIFICATION_DELIVERY = Symbol('VERIFICATION_DELIVERY');

type ResendClient = Pick<Resend, 'emails'>;

export class ResendVerificationDelivery implements VerificationDeliveryPort {
  constructor(private readonly from: string, private readonly client: ResendClient) {}

  async send(input: VerificationDeliveryInput): Promise<void> {
    if (input.channel !== 'EMAIL') throw new Error('EMAIL_VERIFICATION_ONLY');
    const result = await this.client.emails.send({
      from: this.from,
      to: input.target,
      subject: 'Mã xác minh tài khoản EUROHOUSE',
      html: `<div style="font-family:Arial,sans-serif;color:#12263a"><h2>Xác minh tài khoản EUROHOUSE</h2><p>Mã xác minh của bạn:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${escapeHtml(input.code)}</p><p>Mã có hiệu lực trong ${input.expiresMinutes} phút. Không chia sẻ mã này với người khác.</p></div>`,
      text: `Mã xác minh EUROHOUSE: ${input.code}. Mã có hiệu lực trong ${input.expiresMinutes} phút.`,
    });
    if (result.error) throw new Error(`VERIFICATION_DELIVERY_FAILED:${result.error.name}`);
  }
}

export class DevelopmentVerificationDelivery implements VerificationDeliveryPort {
  constructor(env: NodeJS.ProcessEnv = process.env, private readonly sink: (message: string) => void = console.info) {
    if (env.NODE_ENV === 'production') throw new Error('Development verification delivery is disabled in production.');
  }
  async send(input: VerificationDeliveryInput): Promise<void> { this.sink(`[DEV verification] ${input.channel} ${input.target}: ${input.code}`); }
}

export function resolveVerificationDelivery(env: NodeJS.ProcessEnv = process.env): VerificationDeliveryPort {
  if (env.NODE_ENV === 'production') {
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.RESEND_FROM_EMAIL?.trim();
    if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL are required in production.');
    return new ResendVerificationDelivery(from, new Resend(apiKey));
  }
  return new DevelopmentVerificationDelivery(env);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
