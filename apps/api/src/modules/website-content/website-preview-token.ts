import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebsitePreviewTokenPayload {
  purpose: 'website-preview';
  revisionId: string;
  exp: number;
}

const DEVELOPMENT_PREVIEW_SECRET = 'eurohouse-development-preview-secret-change-me';

export function resolveWebsitePreviewSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = (env.WEBSITE_PREVIEW_SECRET ?? '').trim();
  if (env.NODE_ENV === 'production' && value.length < 32) {
    throw new Error('WEBSITE_PREVIEW_SECRET must contain at least 32 characters in production.');
  }
  return value || DEVELOPMENT_PREVIEW_SECRET;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function createWebsitePreviewToken(
  revisionId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 600,
): string {
  if (!revisionId.trim()) throw new Error('Preview revision id is required.');
  if (ttlSeconds < 1 || ttlSeconds > 900) throw new Error('Preview token TTL must be between 1 and 900 seconds.');
  const payload: WebsitePreviewTokenPayload = {
    purpose: 'website-preview',
    revisionId,
    exp: nowSeconds + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyWebsitePreviewToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): WebsitePreviewTokenPayload {
  const [encodedPayload, suppliedSignature, extra] = token.split('.');
  if (!encodedPayload || !suppliedSignature || extra) throw new Error('Invalid preview token.');
  const expectedSignature = sign(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error('Invalid preview token.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid preview token.');
  }
  if (
    !payload
    || typeof payload !== 'object'
    || (payload as Record<string, unknown>).purpose !== 'website-preview'
    || typeof (payload as Record<string, unknown>).revisionId !== 'string'
    || typeof (payload as Record<string, unknown>).exp !== 'number'
  ) {
    throw new Error('Invalid preview token.');
  }
  const typed = payload as WebsitePreviewTokenPayload;
  if (typed.exp <= nowSeconds) throw new Error('Preview token has expired.');
  return typed;
}

@Injectable()
export class WebsitePreviewTokenService {
  private readonly secret = resolveWebsitePreviewSecret();

  issue(revisionId: string) {
    return {
      token: createWebsitePreviewToken(revisionId, this.secret),
      expiresInSeconds: 600,
    };
  }

  verify(token: string): WebsitePreviewTokenPayload {
    try {
      return verifyWebsitePreviewToken(token, this.secret);
    } catch (error) {
      throw new UnauthorizedException(error instanceof Error ? error.message : 'Invalid preview token.');
    }
  }
}
