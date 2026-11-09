import { createHmac } from 'node:crypto';

export type VerificationChannelValue = 'EMAIL' | 'PHONE';
export type VerificationDeliveryInput = {
  channel: VerificationChannelValue;
  target: string;
  code: string;
  expiresMinutes: number;
};

export interface VerificationDeliveryPort {
  send(input: VerificationDeliveryInput): Promise<void>;
}

export const VERIFICATION_DELIVERY = Symbol('VERIFICATION_DELIVERY');

export class WebhookVerificationDelivery implements VerificationDeliveryPort {
  constructor(
    private readonly url: string,
    private readonly secret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(input: VerificationDeliveryInput): Promise<void> {
    const body = JSON.stringify({
      channel: input.channel,
      target: input.target,
      code: input.code,
      expiresMinutes: input.expiresMinutes,
    });
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-eurohouse-signature': signature,
      },
      body,
    });
    if (!response.ok) throw new Error(`VERIFICATION_DELIVERY_FAILED:${response.status}`);
  }
}

export class DevelopmentVerificationDelivery implements VerificationDeliveryPort {
  constructor(
    env: NodeJS.ProcessEnv = process.env,
    private readonly sink: (message: string) => void = console.info,
  ) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Development verification delivery is disabled in production.');
    }
  }

  async send(input: VerificationDeliveryInput): Promise<void> {
    this.sink(`[DEV verification] ${input.channel} ${input.target}: ${input.code}`);
  }
}

export function resolveVerificationDelivery(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): VerificationDeliveryPort {
  if (env.NODE_ENV === 'production') {
    const url = env.VERIFICATION_DELIVERY_WEBHOOK_URL?.trim();
    const secret = env.VERIFICATION_DELIVERY_WEBHOOK_SECRET?.trim();
    if (!url || !secret) {
      throw new Error(
        'VERIFICATION_DELIVERY_WEBHOOK_URL and VERIFICATION_DELIVERY_WEBHOOK_SECRET are required in production.',
      );
    }
    return new WebhookVerificationDelivery(url, secret, fetchImpl);
  }
  return new DevelopmentVerificationDelivery(env);
}
