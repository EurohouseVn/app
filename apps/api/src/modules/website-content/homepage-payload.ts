import type {
  HomepageCta,
  HomepageContentReference,
  HomepageEvidenceItem,
  HomepagePayloadV1,
  HomepageSectionCopy,
} from '@eurohouse/types';

const WEBSITE_FAMILY_ROUTES = {
  RESIDENTIAL: '/nhom-dan-dung',
  INDUSTRIAL: '/nhom-cong-nghiep',
} as const;

export type HomepagePayloadIssue = {
  path: string;
  code: string;
  message: string;
};

export class HomepagePayloadValidationError extends Error {
  constructor(readonly issues: HomepagePayloadIssue[]) {
    super('Homepage payload is invalid.');
    this.name = 'HomepagePayloadValidationError';
  }
}

type JsonRecord = Record<string, unknown>;

const MARKUP = /[<>]/;

export function assertHomepageUrl(value: string, path: string): string {
  const normalized = String(value ?? '').trim();
  const issues: HomepagePayloadIssue[] = [];
  if (!normalized) issues.push(issue(path, 'REQUIRED', 'Liên kết là bắt buộc.'));
  if (normalized.length > 300) issues.push(issue(path, 'MAX_LENGTH', 'Liên kết không được vượt quá 300 ký tự.'));
  if (MARKUP.test(normalized)) issues.push(issue(path, 'MARKUP_NOT_ALLOWED', 'Liên kết không được chứa mã đánh dấu.'));
  const relative = normalized.startsWith('/') && !normalized.startsWith('//');
  let secureExternal = false;
  if (!relative) {
    try {
      secureExternal = new URL(normalized).protocol === 'https:';
    } catch {
      secureExternal = false;
    }
  }
  if (normalized && !relative && !secureExternal) {
    issues.push(issue(path, 'INVALID_URL', 'Chỉ chấp nhận đường dẫn nội bộ hoặc liên kết https.'));
  }
  if (issues.length) throw new HomepagePayloadValidationError(issues);
  return normalized;
}

export function parseHomepagePayload(value: unknown): HomepagePayloadV1 {
  const issues: HomepagePayloadIssue[] = [];
  const root = object(value, '', issues);
  unknownKeys(root, [
    'schemaVersion',
    'hero',
    'productFields',
    'residential',
    'industrial',
    'evidence',
    'projects',
    'video',
    'contact',
  ], '', issues);

  if (root.schemaVersion !== 1) {
    issues.push(issue('schemaVersion', 'UNSUPPORTED_VERSION', 'Phiên bản cấu trúc homepage phải là 1.'));
  }

  const heroObject = object(root.hero, 'hero', issues);
  unknownKeys(heroObject, ['eyebrow', 'title', 'summary', 'primaryCta', 'secondaryCta'], 'hero', issues);
  const hero = {
    ...sectionCopy(heroObject, 'hero', issues),
    primaryCta: cta(heroObject.primaryCta, 'hero.primaryCta', issues),
    secondaryCta: cta(heroObject.secondaryCta, 'hero.secondaryCta', issues),
  };

  const fieldsObject = object(root.productFields, 'productFields', issues);
  unknownKeys(fieldsObject, ['eyebrow', 'title', 'summary', 'residential', 'industrial'], 'productFields', issues);
  const residentialField = productField(
    fieldsObject.residential,
    'productFields.residential',
    WEBSITE_FAMILY_ROUTES.RESIDENTIAL,
    issues,
  );
  const industrialField = productField(
    fieldsObject.industrial,
    'productFields.industrial',
    WEBSITE_FAMILY_ROUTES.INDUSTRIAL,
    issues,
  );
  const productFields = {
    ...sectionCopy(fieldsObject, 'productFields', issues),
    residential: residentialField,
    industrial: industrialField,
  };

  const residentialObject = object(root.residential, 'residential', issues);
  unknownKeys(residentialObject, ['eyebrow', 'title', 'summary', 'dominant', 'supporting', 'cta'], 'residential', issues);
  const dominant = reference(residentialObject.dominant, 'residential.dominant', issues);
  const supporting = referenceArray(residentialObject.supporting, 'residential.supporting', 0, 2, issues);
  rejectDuplicateReferences([dominant, ...supporting], ['residential.dominant.contentId', ...supporting.map((_, index) => `residential.supporting.${index}.contentId`)], issues);
  const residential = {
    ...sectionCopy(residentialObject, 'residential', issues),
    dominant,
    supporting,
    cta: cta(residentialObject.cta, 'residential.cta', issues),
  };

  const industrialObject = object(root.industrial, 'industrial', issues);
  unknownKeys(industrialObject, ['eyebrow', 'title', 'summary', 'services', 'primaryCta', 'secondaryCta'], 'industrial', issues);
  const services = referenceArray(industrialObject.services, 'industrial.services', 1, 4, issues);
  rejectDuplicateReferences(services, services.map((_, index) => `industrial.services.${index}.contentId`), issues);
  const industrial = {
    ...sectionCopy(industrialObject, 'industrial', issues),
    services,
    primaryCta: cta(industrialObject.primaryCta, 'industrial.primaryCta', issues),
    secondaryCta: cta(industrialObject.secondaryCta, 'industrial.secondaryCta', issues),
  };

  const evidenceObject = object(root.evidence, 'evidence', issues);
  unknownKeys(evidenceObject, ['eyebrow', 'title', 'summary', 'items'], 'evidence', issues);
  const evidenceItems = array(evidenceObject.items, 'evidence.items', 2, 4, issues)
    .map((item, index) => evidenceItem(item, `evidence.items.${index}`, issues));
  const evidence = { ...sectionCopy(evidenceObject, 'evidence', issues), items: evidenceItems };

  const projectsObject = object(root.projects, 'projects', issues);
  unknownKeys(projectsObject, ['eyebrow', 'title', 'summary', 'featured', 'cta'], 'projects', issues);
  const featured = referenceArray(projectsObject.featured, 'projects.featured', 1, 3, issues);
  rejectDuplicateReferences(featured, featured.map((_, index) => `projects.featured.${index}.contentId`), issues);
  const projects = {
    ...sectionCopy(projectsObject, 'projects', issues),
    featured,
    cta: cta(projectsObject.cta, 'projects.cta', issues),
  };

  const videoObject = object(root.video, 'video', issues);
  unknownKeys(videoObject, ['eyebrow', 'title', 'summary'], 'video', issues);
  const video = sectionCopy(videoObject, 'video', issues);

  const contactObject = object(root.contact, 'contact', issues);
  unknownKeys(contactObject, ['eyebrow', 'title', 'summary', 'architecturalCta', 'industrialCta'], 'contact', issues);
  const contact = {
    ...sectionCopy(contactObject, 'contact', issues),
    architecturalCta: cta(contactObject.architecturalCta, 'contact.architecturalCta', issues),
    industrialCta: cta(contactObject.industrialCta, 'contact.industrialCta', issues),
  };

  if (issues.length) throw new HomepagePayloadValidationError(issues);
  return {
    schemaVersion: 1,
    hero,
    productFields,
    residential,
    industrial,
    evidence,
    projects,
    video,
    contact,
  };
}

function issue(path: string, code: string, message: string): HomepagePayloadIssue {
  return { path, code, message };
}

function object(value: unknown, path: string, issues: HomepagePayloadIssue[]): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(issue(path || '$', 'REQUIRED', 'Trường dữ liệu bắt buộc phải là một đối tượng.'));
    return {};
  }
  return value as JsonRecord;
}

function unknownKeys(value: JsonRecord, allowed: readonly string[], path: string, issues: HomepagePayloadIssue[]) {
  const allow = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allow.has(key)) issues.push(issue(path ? `${path}.${key}` : key, 'UNKNOWN_KEY', 'Trường dữ liệu không được hỗ trợ.'));
  }
}

function string(
  value: unknown,
  path: string,
  max: number,
  issues: HomepagePayloadIssue[],
): string {
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(issue(path, 'REQUIRED', 'Nội dung là bắt buộc.'));
    return '';
  }
  const normalized = value.trim();
  if (normalized.length > max) issues.push(issue(path, 'MAX_LENGTH', `Nội dung không được vượt quá ${max} ký tự.`));
  if (MARKUP.test(normalized)) issues.push(issue(path, 'MARKUP_NOT_ALLOWED', 'Nội dung không được chứa HTML hoặc mã đánh dấu.'));
  return normalized;
}

function sectionCopy(value: JsonRecord, path: string, issues: HomepagePayloadIssue[]): HomepageSectionCopy {
  return {
    eyebrow: string(value.eyebrow, `${path}.eyebrow`, 80, issues),
    title: string(value.title, `${path}.title`, 120, issues),
    summary: string(value.summary, `${path}.summary`, 360, issues),
  };
}

function cta(value: unknown, path: string, issues: HomepagePayloadIssue[]): HomepageCta {
  const input = object(value, path, issues);
  unknownKeys(input, ['label', 'href'], path, issues);
  const label = string(input.label, `${path}.label`, 40, issues);
  let href = typeof input.href === 'string' ? input.href.trim() : '';
  try {
    href = assertHomepageUrl(href, `${path}.href`);
  } catch (error) {
    if (error instanceof HomepagePayloadValidationError) issues.push(...error.issues);
    else throw error;
  }
  return { label, href };
}

function productField<const TRoute extends string>(
  value: unknown,
  path: string,
  fixedRoute: TRoute,
  issues: HomepagePayloadIssue[],
) {
  const input = object(value, path, issues);
  unknownKeys(input, ['title', 'summary', 'route', 'cta'], path, issues);
  const route = typeof input.route === 'string' ? input.route.trim() : '';
  if (route !== fixedRoute) issues.push(issue(`${path}.route`, 'FIXED_VALUE', `Đường dẫn cố định phải là ${fixedRoute}.`));
  return {
    title: string(input.title, `${path}.title`, 120, issues),
    summary: string(input.summary, `${path}.summary`, 360, issues),
    route: fixedRoute,
    cta: cta(input.cta, `${path}.cta`, issues),
  };
}

function reference(value: unknown, path: string, issues: HomepagePayloadIssue[]): HomepageContentReference {
  const input = object(value, path, issues);
  unknownKeys(input, ['contentId'], path, issues);
  return { contentId: string(input.contentId, `${path}.contentId`, 120, issues) };
}

function array(value: unknown, path: string, min: number, max: number, issues: HomepagePayloadIssue[]): unknown[] {
  if (!Array.isArray(value)) {
    issues.push(issue(path, 'REQUIRED', 'Danh sách là bắt buộc.'));
    return [];
  }
  if (value.length < min || value.length > max) {
    issues.push(issue(path, 'CARDINALITY', `Danh sách phải có từ ${min} đến ${max} mục.`));
  }
  return value;
}

function referenceArray(value: unknown, path: string, min: number, max: number, issues: HomepagePayloadIssue[]) {
  return array(value, path, min, max, issues).map((item, index) => reference(item, `${path}.${index}`, issues));
}

function rejectDuplicateReferences(
  references: HomepageContentReference[],
  paths: string[],
  issues: HomepagePayloadIssue[],
) {
  const seen = new Set<string>();
  references.forEach((referenceValue, index) => {
    if (!referenceValue.contentId || !seen.has(referenceValue.contentId)) {
      seen.add(referenceValue.contentId);
      return;
    }
    issues.push(issue(paths[index] ?? '$', 'DUPLICATE_REFERENCE', 'Nội dung tham chiếu không được lặp lại.'));
  });
}

function evidenceItem(value: unknown, path: string, issues: HomepagePayloadIssue[]): HomepageEvidenceItem {
  const input = object(value, path, issues);
  unknownKeys(input, ['title', 'summary'], path, issues);
  return {
    title: string(input.title, `${path}.title`, 80, issues),
    summary: string(input.summary, `${path}.summary`, 240, issues),
  };
}
