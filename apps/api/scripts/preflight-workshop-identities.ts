import { PrismaClient } from '@prisma/client';
import { normalizeIdentity } from '../src/auth/identity-normalization';

type IdentityRow = { id: string; email: string | null; phone: string | null };

export type WorkshopIdentityPreflightResult = {
  duplicateEmails: string[];
  duplicatePhones: string[];
  safe: boolean;
};

function duplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

export function analyzeWorkshopIdentities(rows: readonly IdentityRow[]): WorkshopIdentityPreflightResult {
  const emails: string[] = [];
  const phones: string[] = [];
  for (const row of rows) {
    if (row.email?.trim()) {
      try {
        const identity = normalizeIdentity(row.email);
        if (identity.kind === 'EMAIL') emails.push(identity.normalized);
      } catch {
        // Invalid legacy values are not normalized or modified by this read-only report.
      }
    }
    if (row.phone?.trim()) {
      try {
        const identity = normalizeIdentity(row.phone);
        if (identity.kind === 'PHONE') phones.push(identity.normalized);
      } catch {
        // Invalid legacy values are not normalized or modified by this read-only report.
      }
    }
  }
  const duplicateEmails = duplicates(emails);
  const duplicatePhones = duplicates(phones);
  return {
    duplicateEmails,
    duplicatePhones,
    safe: duplicateEmails.length === 0 && duplicatePhones.length === 0,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.user.findMany({ select: { id: true, email: true, phone: true } });
    const result = analyzeWorkshopIdentities(rows);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.safe) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

