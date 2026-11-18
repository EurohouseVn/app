type OrganizationCodeRecord = {
  shortLabel: string | null;
  productionName: string | null;
  name: string;
  code: string;
};

export type ProjectCodeDatabase = {
  organization: {
    findUnique(args: Record<string, unknown>): Promise<OrganizationCodeRecord | null>;
  };
  project: {
    findMany(args: Record<string, unknown>): Promise<Array<{ code: string }>>;
  };
};

function removeVietnameseMarks(value: string) {
  return value
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function organizationInitials(value: string) {
  const words = removeVietnameseMarks(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .match(/[A-Za-z0-9]+/g) ?? [];
  if (words.length === 0) return 'XUONG';
  if (words.length === 1) return words[0].toUpperCase().slice(0, 8);
  return words.map((word) => word[0]).join('').toUpperCase().slice(0, 8);
}

export function projectCodeDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}${value('month')}${value('day')}`;
}

export async function nextProjectCode(database: ProjectCodeDatabase, organizationId?: string, now = new Date()) {
  const organization = organizationId
    ? await database.organization.findUnique({
        where: { id: organizationId },
        select: { shortLabel: true, productionName: true, name: true, code: true },
      })
    : null;
  const workshopName = organization?.shortLabel || organization?.productionName || organization?.name || organization?.code || 'XUONG';
  const prefix = `CT-${projectCodeDate(now)}-${organizationInitials(workshopName)}-`;
  const existing = await database.project.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  const sequence = existing.reduce((largest, project) => {
    const parsed = Number(project.code.slice(prefix.length));
    return Number.isInteger(parsed) ? Math.max(largest, parsed) : largest;
  }, 0) + 1;
  return `${prefix}${String(sequence).padStart(2, '0')}`;
}
