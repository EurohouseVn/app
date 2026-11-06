# EUROHOUSE Website Admin Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the release-one vertical slice that lets authorized EUROHOUSE staff edit, upload media for, preview, review and publish the fixed public homepage from the integrated Admin without changing code.

**Architecture:** Keep `WebsiteContent(kind=PAGE, slug=trang-chu, locale=vi)` as the aggregate root and store a validated, versioned `HomepagePayloadV1` in each immutable revision. NestJS owns validation, media reconciliation, risk classification, approvals, concurrency and transactional publication; Admin is a typed fixed-section client; Public Web validates and adapts the single published revision into the approved Monumental presentation with complete local fallback.

**Tech Stack:** pnpm monorepo; TypeScript 5.8; Next.js 15 / React 19 (`apps/admin`, `apps/web`); NestJS 11; Prisma 6 / PostgreSQL; Node test runner + `tsx`; React Testing Library + jsdom for Admin components; existing storage abstraction and preview-token service.

**Spec:** `docs/superpowers/specs/2026-11-06-eurohouse-website-admin-design.md`

## Global Constraints

- Release one covers the Admin overview, fixed homepage editor, media upload/library, draft save, actual-page preview, review/publish controls, homepage history and public homepage consumption; generic content editors and cross-content review/history workbench remain phase two.
- The fixed public narrative and order are Hero, two product fields, Residential, Industrial, Evidence, Projects, Video, Contact, then SEO/GEO; release one has no editor-controlled section reordering, visibility flags, HTML, CSS or JavaScript.
- Preserve the two top-level product families exactly as **NHÔM DÂN DỤNG** and **NHÔM CÔNG NGHIỆP** and preserve the approved Monumental EUROHOUSE presentation with the orange brand identity.
- Common limits are eyebrow 80, title 120, intro/summary 360, CTA label 40 and URL 300 characters; URLs are same-site relative paths or `https:` only.
- Homepage media roles are exactly `HERO_BACKGROUND`, `FIELD_RESIDENTIAL`, `FIELD_INDUSTRIAL`, `INDUSTRIAL_BACKGROUND`, `EVIDENCE_1`–`EVIDENCE_4`, `VIDEO_PRIMARY` and `SOCIAL_SHARE`.
- Release-one video is uploaded MP4/WebM only; external video URLs and embeds are rejected.
- Preview accepts rights `PENDING|APPROVED` and intake `DISCOVERED|REVIEWED|APPROVED|OPTIMIZED|PUBLISHED`; publish additionally requires channel `PUBLIC`, rights `APPROVED` and intake `APPROVED|OPTIMIZED|PUBLISHED`.
- Saving a draft never publishes. Staff need explicit `website-publish` permission to publish; CEO/Admin retain full access; reviewer actions remain auditable.
- Technical approval carries only from the immediately preceding approved revision when the server-computed technical-risk hash is unchanged; marketing approval never carries.
- Publication atomically archives the prior published revision and publishes one new revision; at most one published revision may be current for a content record.
- Public preview is scoped to the exact revision, uses `noindex, nofollow` and `private, no-store`, and never enters sitemap or published caches.
- Public API failure, malformed payload or unsupported schema version renders the complete curated homepage; draft/internal workflow wording is never exposed.
- Publisher display and structured data use **EUROHOUSE VIỆT NAM**; privacy, terms, data-controller and legal-operator wording are not rewritten in this release.
- Do not introduce an external CMS, second product database or second component library.
- Preserve unrelated dirty-worktree changes and stage only the files named by the current task.
- Before every commit, compare against the task-start index; for any file that was already dirty, use `git add -p <file>` and inspect `git diff --cached` so pre-existing user hunks are never included by a task's abbreviated `git add` command.

## Review Focus

- A stale browser tab saving against an updated revision must receive `409 Conflict`, keep its local input and never overwrite newer work; Task 4 pins this behavior.
- A spoofed/oversized upload or storage failure must identify the rejected file, leave no selectable media row and create no broken link; Task 5 pins this behavior.
- A selected content reference that lacks a published revision must block publication; a later-archived reference must produce an Admin repair warning while Public Web fills from curated fallback; Tasks 4 and 11 pin both paths.
- A publish failure halfway through the transaction must leave the previous revision published and must not expose two published revisions; Task 4 pins rollback and uniqueness.
- At 375px the editor must have no page-level horizontal overflow, expose labeled controls and retain the primary submit/publish action; Task 10 pins responsive and accessibility behavior.

---

## File map

- `packages/types/src/website-homepage.ts`: shared homepage payload, section, CTA, media-role, API projection and permission types.
- `packages/types/src/index.ts`: re-export the contract and register the `website` Admin module.
- `apps/api/src/modules/website-content/homepage-payload.ts`: strict runtime parser, URL/length/cardinality validation and defaults boundary.
- `apps/api/src/modules/website-content/homepage-risk.ts`: normalized technical-risk material and SHA-256 hash.
- `apps/api/src/modules/website-content/homepage-publication.service.ts`: homepage save, link reconciliation, reference/media eligibility, carry-forward and transactional publish orchestration.
- `apps/api/src/modules/website-content/website-media-upload.service.ts`: multipart upload validation/storage/media creation and media-library queries.
- `apps/api/src/modules/website-content/dto/homepage.dto.ts`: save/publish concurrency DTOs.
- `apps/api/prisma/seed-homepage.ts`: idempotent approved-homepage seed helper.
- `apps/admin/app/website/**`: overview, fixed editor and media library routes.
- `apps/admin/src/website/**`: typed API client, editor reducer/model and focused UI components.
- `apps/web/lib/homepage-cms.ts`: public/preview parser and fallback adapter.
- `apps/web/components/home/*.tsx`: accept one resolved presentation instead of reading immutable copy internally.

### Task 1: Shared Homepage Contract and Admin Module Key

**Files:**
- Create: `packages/types/src/website-homepage.ts`
- Create: `packages/types/src/website-homepage.test.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/package.json`

**Interfaces:**
- Consumes: existing `WebsiteContentKind`, `WebsitePublicationStatus`, media/review types in `@eurohouse/types`.
- Produces: `HomepagePayloadV1`, the eight-key `HomepageBodySectionKey`, the nine-key `HomepageEditorSectionKey` (eight body sections plus `seo`), `HomepageMediaRole`, `HomepageCta`, `HomepageAdminDetail`, `HomepagePublicProjection` (detail plus role-bearing media and resolved reference summaries), `HomepageSaveInput`, `HomepagePublishReadiness`, `WebsiteMediaLibraryItem`, `WEBSITE_PERMISSIONS`, and the `website` Admin module at `/website`.

- [ ] **Step 1: Add failing contract tests**

  Assert the exact eight payload keys and nine editor keys (SEO is an editor section backed by the related SEO record, never duplicated in the body), the nine fixed media roles, `schemaVersion: 1`, family routes `/nhom-dan-dung` and `/nhom-cong-nghiep`, and permission strings `website`, `website-review-technical`, `website-review-marketing`, `website-media-approve`, `website-publish`.

- [ ] **Step 2: Run the focused test and verify failure**

  Run: `pnpm --filter @eurohouse/types test`
  Expected: FAIL because `website-homepage.ts` and its exports do not exist.

- [ ] **Step 3: Implement the shared types and constants**

  Define discriminated, JSON-safe section types matching spec §9.1. References are ordered `contentId` values, media remain links by fixed role, and `HomepageSaveInput` includes `expectedUpdatedAt: string`. Add `{ key: 'website', label: 'Quản trị Website', href: '/website' }` to `ADMIN_MODULES` and export the new module from `index.ts`.

- [ ] **Step 4: Add the types test to the workspace test script and verify**

  Run: `pnpm --filter @eurohouse/types test && pnpm --filter @eurohouse/types typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit only the contract files**

  Run: `git add packages/types/src/website-homepage.ts packages/types/src/website-homepage.test.ts packages/types/src/index.ts packages/types/package.json && git commit -m "feat(types): define homepage authoring contract"`

### Task 2: Strict Homepage Payload Validation

**Files:**
- Create: `apps/api/src/modules/website-content/homepage-payload.ts`
- Create: `apps/api/src/modules/website-content/homepage-payload.spec.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `HomepagePayloadV1` and fixed routes/limits from Task 1.
- Produces: `parseHomepagePayload(value: unknown): HomepagePayloadV1`, `HomepagePayloadValidationError` with `{ path, code, message }[]`, and `assertHomepageUrl(value: string, path: string): string`.

- [ ] **Step 1: Write failing parser tests**

  Cover one complete valid payload; unknown keys; schema versions other than `1`; missing required family/contact branches; title/summary/CTA/URL limits; `javascript:`, `http:` and protocol-relative URLs; residential cardinality `1 + 0..2`; industrial `1..4`; evidence `2..4`; projects `1..3`; duplicate references; HTML/script markup in every customer-copy or URL field; and external video fields.

- [ ] **Step 2: Verify the focused tests fail**

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-payload.spec.ts`
  Expected: FAIL with missing module/exports.

- [ ] **Step 3: Implement a strict allowlist parser**

  Parse each object explicitly, trim strings, reject unknown keys, preserve Vietnamese text, require the fixed family keys/routes, and collect field-path errors before throwing. Do not silently truncate or coerce invalid content.

- [ ] **Step 4: Register and run API tests**

  Add the focused spec to `apps/api/package.json` `test`, then run `pnpm --filter @eurohouse/api test`.
  Expected: PASS with all existing website-content tests unchanged.

- [ ] **Step 5: Commit**

  Run: `git add apps/api/src/modules/website-content/homepage-payload.ts apps/api/src/modules/website-content/homepage-payload.spec.ts apps/api/package.json && git commit -m "feat(api): validate fixed homepage payload"`

### Task 3: Revision Governance Schema and Technical-Risk Hash

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261106100000_website_homepage_governance/migration.sql`
- Create: `apps/api/src/modules/website-content/homepage-risk.ts`
- Create: `apps/api/src/modules/website-content/homepage-risk.spec.ts`
- Modify: `apps/api/src/modules/website-content/publication-policy.ts`
- Modify: `apps/api/src/modules/website-content/publication-policy.spec.ts`

**Interfaces:**
- Consumes: validated `HomepagePayloadV1`, revision source refs, linked media metadata and referenced published revision identities.
- Produces: revision fields `technicalRiskHash: String?` and `technicalApprovalSourceRevisionId: String?`, media field `archivedAt: DateTime?`, `computeHomepageTechnicalRiskHash(input: HomepageTechnicalRiskInput): string`, and `classifyHomepageChange(before, after): 'TECHNICAL_AND_MARKETING' | 'MARKETING_ONLY'`.

- [ ] **Step 1: Write failing risk-policy tests**

  Assert that technical specs/source refs, referenced content ID or published revision ID, industrial/evidence capability copy and caption/transcript on `INDUSTRIAL_BACKGROUND`, `EVIDENCE_*` or `VIDEO_PRIMARY` alter the hash; punctuation normalization does not; hero/product-family/residential/project/contact headline, CTA, ordinary image and SEO copy are marketing-only unless the revision already contains high-risk claims; and carry-forward is allowed only from the immediately preceding technically approved revision with the same hash.

- [ ] **Step 2: Verify focused failure**

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-risk.spec.ts src/modules/website-content/publication-policy.spec.ts`
  Expected: FAIL because the hash/classifier and schema fields do not exist.

- [ ] **Step 3: Add the additive migration and deterministic hash implementation**

  Normalize keys and whitespace, sort unordered source-reference keys, preserve ordered homepage collections, serialize only the authoritative risk-matrix inputs, then SHA-256 the canonical JSON. The server derives `hasHighRiskClaims` from those fixed paths/references/source data instead of trusting a client marker. Store the source revision ID as audit metadata without adding a mutable approval shortcut.

- [ ] **Step 4: Generate Prisma client and run policy tests**

  Run: `pnpm --filter @eurohouse/api prisma:generate && pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-risk.spec.ts src/modules/website-content/publication-policy.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261106100000_website_homepage_governance/migration.sql apps/api/src/modules/website-content/homepage-risk.ts apps/api/src/modules/website-content/homepage-risk.spec.ts apps/api/src/modules/website-content/publication-policy.ts apps/api/src/modules/website-content/publication-policy.spec.ts && git commit -m "feat(api): govern homepage revision risk"`

### Task 4: Homepage Save, Reference Repair and Transactional Publication

**Files:**
- Create: `apps/api/src/modules/website-content/dto/homepage.dto.ts`
- Create: `apps/api/src/modules/website-content/homepage-publication.service.ts`
- Create: `apps/api/src/modules/website-content/homepage-publication.service.spec.ts`
- Modify: `apps/api/src/modules/website-content/website-content.service.ts`
- Modify: `apps/api/src/modules/website-content/website-content.query.service.ts`
- Modify: `apps/api/src/modules/website-content/public-website-content.serializer.ts`
- Modify: `apps/api/src/modules/website-content/public-website-content.serializer.spec.ts`
- Modify: `apps/api/src/modules/website-content/admin-website-content.controller.ts`
- Modify: `apps/api/src/modules/website-content/website-content.module.ts`

**Interfaces:**
- Consumes: payload parser (Task 2), risk hash (Task 3), existing reviews/audit/preview services, exact media-role links and `JwtUser`.
- Produces: `getOrCreateHomepage(actor)`, `saveHomepageDraft(revisionId, input, actor)`, `getHomepageAdminDetail()`, `getHomepageReadiness(revisionId)`, `publishHomepage(revisionId, actor)`, role-bearing public media, resolved homepage reference summaries, plus endpoints `GET /website/admin/homepage`, `PATCH /website/admin/homepage/revisions/:revisionId`, `GET .../:revisionId/readiness`, and `POST .../:revisionId/publish`.

- [ ] **Step 1: Write failing service tests**

  Cover create-once behavior; update only `DRAFT`; stale `expectedUpdatedAt` returns `409`; body and media links reconcile in one transaction; unavailable selected references block publication; an archived live reference yields `repairWarnings`; Staff without `website-publish` gets `403`; Staff without the matching `website-review-technical` or `website-review-marketing` permission cannot review; rejection requires a reason and returns the revision to editable draft state; unchanged technical hash carries only immediate technical approval; marketing approval never carries; publish archives the previous row and leaves exactly one published row; injected transaction failure rolls back to the prior published row.

- [ ] **Step 2: Verify focused failure**

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-publication.service.spec.ts`
  Expected: FAIL with missing service/endpoints.

- [ ] **Step 3: Implement DTOs and homepage orchestration**

  `SaveHomepageDto` accepts payload, SEO fields, role-to-media IDs and `expectedUpdatedAt`; the update uses a conditional revision ID + `updatedAt` match rather than a check-then-write race. Resolve every referenced content item to its current published revision before computing the server-derived risk hash. Enforce the matching reviewer permission in the API service, return field/media/reference errors as structured readiness blockers, and do not make the Admin chain low-level approvals.

- [ ] **Step 4: Implement one publication transaction**

  Re-read the revision and approvals inside `prisma.$transaction`, validate readiness, `updateMany` prior `PUBLISHED` rows to `ARCHIVED`, publish the target, persist risk/carry-forward provenance, and create one audit event. Enforce publish authority server-side from role/CEO/`website-publish` permission.

- [ ] **Step 5: Expose only safe resolved references and media roles publicly**

  Extend the allowlist serializer with each link's fixed `role`. For `PAGE/trang-chu`, have the query service resolve referenced IDs to published summaries (or the latest preview-eligible revision only in exact-token preview), attach them as `resolvedReferences`, and never expose review/source/audit fields. Missing live references are omitted from this projection so the Web adapter can repair from fallback. Enrich the Admin list projection with latest editor, status and SEO completeness so Task 8 does not infer them client-side.

- [ ] **Step 6: Run service and regression tests**

  Run: `pnpm --filter @eurohouse/api test && pnpm --filter @eurohouse/api typecheck`
  Expected: PASS.

- [ ] **Step 7: Commit**

  Run: `git add apps/api/src/modules/website-content/dto/homepage.dto.ts apps/api/src/modules/website-content/homepage-publication.service.ts apps/api/src/modules/website-content/homepage-publication.service.spec.ts apps/api/src/modules/website-content/website-content.service.ts apps/api/src/modules/website-content/website-content.query.service.ts apps/api/src/modules/website-content/public-website-content.serializer.ts apps/api/src/modules/website-content/public-website-content.serializer.spec.ts apps/api/src/modules/website-content/admin-website-content.controller.ts apps/api/src/modules/website-content/website-content.module.ts && git commit -m "feat(api): publish governed homepage revisions"`

### Task 5: Governed Website Media Upload and Library API

**Files:**
- Modify: `apps/api/src/common/upload.ts`
- Modify: `apps/api/src/common/upload.spec.ts`
- Create: `apps/api/src/modules/website-content/website-media-upload.service.ts`
- Create: `apps/api/src/modules/website-content/website-media-upload.service.spec.ts`
- Modify: `apps/api/src/modules/website-content/website-assets.service.ts`
- Modify: `apps/api/src/modules/website-content/website-assets.service.spec.ts`
- Modify: `apps/api/src/modules/website-content/admin-website-content.controller.ts`
- Modify: `apps/api/src/modules/website-content/website-content.query.service.ts`
- Modify: `apps/api/src/modules/website-content/website-content.module.ts`
- Modify: `apps/api/src/modules/storage/storage.service.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `StorageService.putUpload`, `WebsiteMediaAsset`, current actor, publish/preview eligibility from the spec.
- Produces: `assertWebsiteMediaUpload(file): WebsiteUploadInspection`, `upload(file, metadata, actor): WebsiteMediaLibraryItem`, `uploadPoster(mediaId, file, actor)`, `updateMetadata(id, input, actor)`, `listMedia(filters)`, `getUsage(id)`, `archiveMedia(id, actor)`, multipart `POST /website/admin/media/upload`, multipart `POST /website/admin/media/:id/poster`, and `PATCH /website/admin/media/:id`, `GET /website/admin/media`, `GET /website/admin/media/:id/usages`, `POST /website/admin/media/:id/archive`.

- [ ] **Step 1: Write failing signature/upload/library tests**

  Accept JPG/PNG/WebP up to 8 MiB and MP4/WebM up to 250 MiB; inspect dimensions/duration and magic bytes; verify MP4 `ftyp` and WebM EBML signatures; reject MIME/extension/signature mismatch and zero dimensions; simulate oversize and storage failure and assert no `StorageObject`/`WebsiteMediaAsset` persists; assert new assets start non-public with uploader/original filename/audit; upload a valid image poster without exposing a storage ID; validate alt/caption/transcript/focal points; allow only CEO/Admin or `website-media-approve` permission to set `APPROVED` rights or `PUBLIC`; assert list filters; block archival used by a published revision and allow unused archival.

- [ ] **Step 2: Verify focused failure**

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/common/upload.spec.ts src/modules/website-content/website-media-upload.service.spec.ts`
  Expected: FAIL because website media inspection/upload does not exist.

- [ ] **Step 3: Implement validation and atomic cleanup**

  Add `image-size` for image dimensions and `ffprobe-static` for uploaded MP4/WebM dimensions/duration. Upload storage first, create media + audit transactionally, and add `StorageService.delete(id)` so DB failure removes both the provider object and `StorageObject` row; never expose pending media through public serializers. Return authenticated Admin preview URLs separately from public eligibility.

- [ ] **Step 4: Implement media eligibility and usage queries**

  Centralize `isPreviewEligibleMedia` and `assertPublishEligibleMedia`; include linked revision/content/status/role in usage results and exclude `archivedAt` assets from selectable results.

- [ ] **Step 5: Run focused and full API checks**

  Run: `pnpm --filter @eurohouse/api test && pnpm --filter @eurohouse/api typecheck`
  Expected: PASS.

- [ ] **Step 6: Commit**

  Run: `git add apps/api/src/common/upload.ts apps/api/src/common/upload.spec.ts apps/api/src/modules/storage/storage.service.ts apps/api/src/modules/website-content/website-media-upload.service.ts apps/api/src/modules/website-content/website-media-upload.service.spec.ts apps/api/src/modules/website-content/website-assets.service.ts apps/api/src/modules/website-content/website-assets.service.spec.ts apps/api/src/modules/website-content/admin-website-content.controller.ts apps/api/src/modules/website-content/website-content.query.service.ts apps/api/src/modules/website-content/website-content.module.ts apps/api/package.json pnpm-lock.yaml && git commit -m "feat(api): add governed website media library"`

### Task 6: Idempotent Approved Homepage Seed

**Files:**
- Create: `apps/api/prisma/seed-homepage.ts`
- Create: `apps/api/src/modules/website-content/homepage-seed.spec.ts`
- Modify: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: current approved copy from `apps/web/lib/homepage-presentation.ts`, existing published product/project records when available, and the Task 1 payload contract.
- Produces: `seedHomepage(prisma, actorId): Promise<{ contentId?: string; created: boolean; reason?: 'EXISTS' | 'MISSING_REFERENCES' }>` and one valid `PAGE/trang-chu/vi` revision when prerequisites exist, without overwriting authored data.

- [ ] **Step 1: Write failing idempotency tests**

  Assert first run with required published residential/industrial/project references creates one content/revision, second run creates nothing, an existing authored draft/published revision remains byte-for-byte unchanged, missing required references returns `MISSING_REFERENCES` and creates no invalid record, and publisher text is `EUROHOUSE VIỆT NAM` only where publisher display is seeded.

- [ ] **Step 2: Verify test failure**

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-seed.spec.ts`
  Expected: FAIL with missing seed helper.

- [ ] **Step 3: Implement and wire the seed**

  Build a complete payload from the approved homepage constants, attach only eligible existing media/references, return early whenever `locale_slug = vi/trang-chu` exists, and fail closed with `MISSING_REFERENCES` while Public Web retains its complete fallback. Call the helper from the existing seed after a suitable actor exists.

- [ ] **Step 4: Verify idempotency and seed compilation**

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-seed.spec.ts && pnpm --filter @eurohouse/api typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add apps/api/prisma/seed-homepage.ts apps/api/src/modules/website-content/homepage-seed.spec.ts apps/api/prisma/seed.ts apps/api/package.json && git commit -m "feat(api): seed approved homepage safely"`

### Task 7: Admin Website Client, Access and Navigation

**Files:**
- Modify: `apps/admin/package.json`
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/access.ts`
- Modify: `apps/admin/src/AdminShell.tsx`
- Create: `apps/admin/src/website/api.ts`
- Create: `apps/admin/src/website/access.ts`
- Create: `apps/admin/src/website/access.test.ts`

**Interfaces:**
- Consumes: Task 1 projections/permissions and Task 4–5 endpoints.
- Produces: `apiUpload<T>(path, formData)`, typed `websiteAdminApi`, `websiteActionsFor(user, detail)`, and the **Quản trị Website** navigation item under **Marketing & CSKH**.

- [ ] **Step 1: Write failing access/action tests**

  Assert CEO/Admin see edit/review/publish; ordinary Staff see edit/preview/submit but not publish; `website-publish` Staff see publish; technical/marketing reviewers see only their applicable review actions; users without module `website` cannot open `/website`; unauthorized server responses do not leave a visible enabled action.

- [ ] **Step 2: Verify focused failure**

  Run: `pnpm --filter @eurohouse/admin test -- src/website/access.test.ts`
  Expected: FAIL because the Admin test script and website access module do not exist.

- [ ] **Step 3: Add Admin test dependencies and typed client**

  Add `tsx`, `@testing-library/react`, `@testing-library/user-event` and `jsdom` dev dependencies plus `test: "tsx --test src/**/*.test.ts src/**/*.test.tsx"`. Keep auth headers and 401 behavior centralized in `src/lib/api.ts`; expose multipart upload without manually setting `Content-Type`.

- [ ] **Step 4: Add navigation/access mapping and verify**

  Run: `pnpm --filter @eurohouse/admin test && pnpm --filter @eurohouse/admin typecheck`
  Expected: PASS and `/website` maps to module key `website`.

- [ ] **Step 5: Commit**

  Run: `git add apps/admin/package.json apps/admin/src/lib/api.ts apps/admin/src/access.ts apps/admin/src/AdminShell.tsx apps/admin/src/website/api.ts apps/admin/src/website/access.ts apps/admin/src/website/access.test.ts pnpm-lock.yaml && git commit -m "feat(admin): add website management access"`

### Task 8: Admin Overview and Homepage History

**Files:**
- Create: `apps/admin/app/website/page.tsx`
- Create: `apps/admin/app/website/website.module.css`
- Create: `apps/admin/src/website/WebsiteOverview.tsx`
- Create: `apps/admin/src/website/overview-model.ts`
- Create: `apps/admin/src/website/overview-model.test.ts`

**Interfaces:**
- Consumes: `websiteAdminApi.listContent/getHomepage/getAudit`, module access from Task 7.
- Produces: `/website` overview with four counts, searchable/filterable content table, phase-two boundary for unsupported editors, recent homepage activity and links to `/website/pages/home` and `/website/media`.

- [ ] **Step 1: Write failing overview-model tests**

  Assert counts for published/draft/awaiting-review/missing-SEO, accent-insensitive Vietnamese search, kind/family/status filters, latest-editor/status projection, and that only `PAGE/trang-chu` returns an editable release-one route while other content shows “Giai đoạn 2”.

- [ ] **Step 2: Verify test failure**

  Run: `pnpm --filter @eurohouse/admin test -- src/website/overview-model.test.ts`
  Expected: FAIL with missing model.

- [ ] **Step 3: Implement the pure overview model and client page**

  Use existing Admin tokens and orange accent, semantic table headings, explicit loading/empty/error states and recent audit labels written for operators rather than customers.

- [ ] **Step 4: Verify tests and route typecheck**

  Run: `pnpm --filter @eurohouse/admin test && pnpm --filter @eurohouse/admin typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add apps/admin/app/website/page.tsx apps/admin/app/website/website.module.css apps/admin/src/website/WebsiteOverview.tsx apps/admin/src/website/overview-model.ts apps/admin/src/website/overview-model.test.ts && git commit -m "feat(admin): add website content overview"`

### Task 9: Fixed Homepage Editor State and Section Forms

**Files:**
- Create: `apps/admin/app/website/pages/home/page.tsx`
- Create: `apps/admin/app/website/pages/home/home-editor.module.css`
- Create: `apps/admin/src/website/home-editor/editor-state.ts`
- Create: `apps/admin/src/website/home-editor/editor-state.test.ts`
- Create: `apps/admin/src/website/home-editor/HomepageEditor.tsx`
- Create: `apps/admin/src/website/home-editor/SectionNavigator.tsx`
- Create: `apps/admin/src/website/home-editor/SectionFields.tsx`
- Create: `apps/admin/src/website/home-editor/SeoFields.tsx`
- Create: `apps/admin/src/website/home-editor/ContentReferencePicker.tsx`

**Interfaces:**
- Consumes: `HomepageAdminDetail`, parser limits, `websiteAdminApi.saveHomepage`, action policy and published-content choices.
- Produces: `createEditorState(detail)`, `homepageEditorReducer`, `buildHomepageSaveInput(state)`, fixed section navigator/forms, dirty/saving/saved/conflict/error state and 800 ms autosave after valid changes.

- [ ] **Step 1: Write failing reducer/model tests**

  Assert fixed section order; field edits stay local; validation paths map to controls; autosave never runs for invalid input; successful save updates `expectedUpdatedAt` and “Đã lưu lúc HH:mm”; failed save preserves text; `409` enters conflict state without replacing local data; server reload is an explicit user action; no action ever publishes during save.

- [ ] **Step 2: Verify focused failure**

  Run: `pnpm --filter @eurohouse/admin test -- src/website/home-editor/editor-state.test.ts`
  Expected: FAIL with missing reducer/model.

- [ ] **Step 3: Implement the reducer and typed forms**

  Keep one reducer as the source of editor state. Use persistent Vietnamese labels/helper text/character counters, two-line customer-copy guidance, fixed family routes, ordered reference pickers and inline field errors; never expose raw JSON, storage IDs or internal review prose as customer copy.

- [ ] **Step 4: Implement debounced save and conflict recovery**

  Autosave only valid dirty state after 800 ms idle, cancel on unmount/revision change, serialize one request at a time and queue one follow-up save if changes arrive during a request. Keep explicit **Lưu bản nháp** available.

- [ ] **Step 5: Verify Admin tests/typecheck**

  Run: `pnpm --filter @eurohouse/admin test && pnpm --filter @eurohouse/admin typecheck`
  Expected: PASS.

- [ ] **Step 6: Commit**

  Run: `git add apps/admin/app/website/pages/home/page.tsx apps/admin/app/website/pages/home/home-editor.module.css apps/admin/src/website/home-editor && git commit -m "feat(admin): add fixed homepage editor"`

### Task 10: Media Picker, Preview, Review, Publish and Responsive UX

**Files:**
- Create: `apps/admin/app/website/media/page.tsx`
- Create: `apps/admin/src/website/media/MediaLibrary.tsx`
- Create: `apps/admin/src/website/media/MediaPickerDialog.tsx`
- Create: `apps/admin/src/website/media/media-model.ts`
- Create: `apps/admin/src/website/media/media-model.test.ts`
- Create: `apps/admin/src/website/home-editor/PreviewPanel.tsx`
- Create: `apps/admin/src/website/home-editor/PublicationPanel.tsx`
- Create: `apps/admin/src/website/home-editor/HomepageEditor.test.tsx`
- Modify: `apps/admin/src/website/home-editor/HomepageEditor.tsx`
- Modify: `apps/admin/src/website/home-editor/SectionFields.tsx`
- Modify: `apps/admin/app/website/pages/home/home-editor.module.css`
- Modify: `apps/admin/src/AdminShell.tsx`
- Create: `apps/admin/src/AdminShell.test.tsx`

**Interfaces:**
- Consumes: Task 5 upload/library APIs, preview-token endpoint, readiness/review/publish endpoints, Task 7 action policy and Task 9 editor state.
- Produces: searchable media library/uploader/usage view, role-aware replacement, actual-site iframe/full preview, review/reject/publish dialog and responsive wireframe-A editor.

- [ ] **Step 1: Write failing media-model tests**

  Assert image/video accept lists and size copy; selected role/type compatibility; pending rights allowed for preview but visibly blocks publish; upload error identifies filename/reason and retains retry/remove; usage warning lists published relationships; stale/expired preview tokens refresh; preview errors leave editing enabled.

- [ ] **Step 2: Write failing component tests**

  Render with Staff/Admin/reviewer users and assert accessible labels, fixed section navigation, role-based primary action, publish confirmation/readiness blockers, reject-reason requirement, keyboard-operable media dialog, local input retained after save failure, and the preview iframe title/sandbox. Add `AdminShell.test.tsx` to assert the sidebar becomes a menu at 900px, no component uses a fixed minimum width above 375px and the primary action remains present in the mobile header.

- [ ] **Step 3: Verify focused failures**

  Run: `pnpm --filter @eurohouse/admin test -- src/website/media/media-model.test.ts src/website/home-editor/HomepageEditor.test.tsx`
  Expected: FAIL with missing components/behavior.

- [ ] **Step 4: Implement media library and role-aware picker**

  Show thumbnail/poster, filename, dimensions/duration, rights, intake, channels and usages. Upload media/poster via `FormData`; provide labeled editors for alt text, caption, transcript, focal point, rights, intake and channels according to permission; editing metadata never bypasses server eligibility; published usage prevents archive and replacement explains impact.

- [ ] **Step 5: Implement actual-page preview and publication controls**

  Save first, request an exact-revision token, load `${NEXT_PUBLIC_WEB_URL}/?previewToken=...` with a labeled responsive iframe, refresh near expiry, and provide **Xem trước đầy đủ**. Use one server readiness call before submit/publish; display blockers next to section/media and require explicit confirmation. The publication panel also lists the homepage's revision number, actor, review decisions, timestamps and audit summary so history is available inside the release-one editor.

- [ ] **Step 6: Implement responsive wireframe A and accessibility**

  Use three columns above 1350px, form + navigator with preview below at 901–1350px, and a single column at 900px and below. Refactor the existing fixed-width `AdminShell` sidebar into an accessible menu at 900px and below. At mobile, use an overflow-contained section tab row with faded edge, move secondary actions into a menu, retain the primary action, preserve visible focus and honor reduced motion.

- [ ] **Step 7: Run Admin verification**

  Run: `pnpm --filter @eurohouse/admin test && pnpm --filter @eurohouse/admin typecheck && pnpm --filter @eurohouse/admin build`
  Expected: PASS. Manually verify at 1440, 1280, 900, 768 and 375px with no page-level horizontal overflow.

- [ ] **Step 8: Commit**

  Run: `git add apps/admin/app/website/media/page.tsx apps/admin/src/website/media apps/admin/src/website/home-editor/PreviewPanel.tsx apps/admin/src/website/home-editor/PublicationPanel.tsx apps/admin/src/website/home-editor/HomepageEditor.test.tsx apps/admin/src/website/home-editor/HomepageEditor.tsx apps/admin/src/website/home-editor/SectionFields.tsx apps/admin/app/website/pages/home/home-editor.module.css apps/admin/src/AdminShell.tsx apps/admin/src/AdminShell.test.tsx && git commit -m "feat(admin): complete homepage publishing workspace"`

### Task 11: Public Homepage CMS Adapter, Preview and SEO/GEO

**Files:**
- Create: `apps/web/lib/homepage-cms.ts`
- Create: `apps/web/lib/homepage-cms.test.ts`
- Modify: `apps/web/lib/public-api.ts`
- Modify: `apps/web/lib/public-api.test.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/home/HomeHero.tsx`
- Modify: `apps/web/components/home/ProductFamilyChooser.tsx`
- Modify: `apps/web/components/home/FeaturedSystems.tsx`
- Modify: `apps/web/components/home/CapabilityStrip.tsx`
- Modify: `apps/web/components/home/FeaturedProjects.tsx`
- Modify: `apps/web/components/home/PrimaryVideo.tsx`
- Modify: `apps/web/components/home/ConversionPanel.tsx`
- Modify: `apps/web/lib/site.ts`

**Interfaces:**
- Consumes: published/preview `HomepagePublicProjection`, linked media roles, resolved reference summaries, current curated `homepageCopy`, fallback cards and site entity.
- Produces: `resolveHomepagePresentation(input): HomepagePresentation`, `getHomepageContent({ previewToken? })`, preview-aware `getPublishedContent`, dynamic `generateMetadata`, one resolved presentation passed to all homepage components and structured Organization/WebSite/WebPage data.

- [ ] **Step 1: Write failing adapter tests**

  Assert complete valid V1 maps all sections/media/SEO; absent API, malformed body and unsupported version return the complete curated homepage; missing optional/archived references fill from next eligible published card then curated fallback without removing the section; draft/internal fields are allowlist-stripped; invalid URLs never reach links; public mode ignores preview-only media; publisher is `EUROHOUSE VIỆT NAM` while legal-controller copy remains untouched.

- [ ] **Step 2: Write failing preview/metadata tests**

  Assert normal requests use revalidation/tags, preview requests pass the token with `cache: 'no-store'`, preview metadata has `robots: { index: false, follow: false }`, published SEO supplies title/description/canonical/schema/social image, invalid SEO falls back safely, and no preview query is emitted by sitemap.

- [ ] **Step 3: Verify focused failures**

  Run: `pnpm --filter @eurohouse/web test -- lib/homepage-cms.test.ts lib/public-api.test.ts`
  Expected: FAIL because the adapter/preview behavior does not exist.

- [ ] **Step 4: Implement one resolved presentation model**

  Parse only `schemaVersion: 1`; map role-linked media and referenced published items; merge structural fallback deterministically. Refactor home components to receive only their resolved section props, keeping current class names/layout/motion so CMS integration does not redesign the approved page.

- [ ] **Step 5: Implement preview and SEO/GEO metadata**

  Accept `previewToken` only on the homepage request path, call the exact-revision API, set no-store/noindex, and never persist the token. Emit visible semantic headings, approved internal links, accessible alt/transcript and JSON-LD from the approved publisher/entity and revision SEO.

- [ ] **Step 6: Run Public Web verification**

  Run: `pnpm --filter @eurohouse/web test && pnpm --filter @eurohouse/web typecheck && pnpm --filter @eurohouse/web build`
  Expected: PASS, including existing customer-facing copy, visual policy, motion and structure tests.

- [ ] **Step 7: Commit**

  Run: `git add apps/web/lib/homepage-cms.ts apps/web/lib/homepage-cms.test.ts apps/web/lib/public-api.ts apps/web/lib/public-api.test.ts apps/web/app/page.tsx apps/web/components/home apps/web/lib/site.ts && git commit -m "feat(web): render governed homepage content"`

### Task 12: End-to-End Acceptance, Migration Safety and Operator Notes

**Files:**
- Create: `apps/api/src/modules/website-content/homepage-authorization.e2e-spec.ts`
- Create: `apps/api/src/modules/website-content/website-observability.ts`
- Create: `apps/api/src/modules/website-content/website-observability.spec.ts`
- Modify: `apps/api/src/modules/website-content/homepage-publication.service.ts`
- Modify: `apps/api/src/modules/website-content/website-media-upload.service.ts`
- Modify: `apps/api/src/modules/website-content/public-website-content.controller.ts`
- Modify: `apps/web/lib/homepage-cms.ts`
- Create: `docs/release/website-homepage-admin-runbook.md`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: all release-one API/Admin/Web interfaces from Tasks 1–11.
- Produces: acceptance coverage and an operator runbook for migrate, seed, rights approval, review, publish, rollback-by-new-revision and fallback diagnosis.

- [ ] **Step 1: Write failing authorization/visibility acceptance tests**

  Exercise authenticated Admin, ordinary Staff, publishing Staff, technical reviewer and marketing reviewer across save/submit/review/publish; assert rejected/draft revisions and private/pending/rejected media never appear in public detail, metadata or search; assert preview token cannot open another revision and expires; assert public fallback is activated on invalid CMS response.

- [ ] **Step 2: Verify the new suite fails before fixture wiring**

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-authorization.e2e-spec.ts`
  Expected: FAIL until the application test fixture and complete route assertions are wired.

- [ ] **Step 3: Complete the acceptance fixture and run migration verification**

  Use a disposable database for migration/seed checks; run the seed twice; publish two revisions; verify one current published revision and complete audit history.

  Run: `pnpm --filter @eurohouse/api prisma:verify:disposable && pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/homepage-authorization.e2e-spec.ts`
  Expected: PASS.

- [ ] **Step 4: Add safe operational event tests and instrumentation**

  Define structured events `website_publish_failed`, `website_preview_failed`, `website_upload_failed` and `website_public_fallback_activated`. Assert emitted metadata contains route/content/revision/media IDs, status/reason class and timestamp, but never preview tokens, private file bytes or full request bodies. Emit through Nest `Logger` and the Web server logger so the deployment log backend can aggregate failure counts without introducing a new telemetry platform.

  Run: `pnpm --filter @eurohouse/api exec node --test -r ts-node/register src/modules/website-content/website-observability.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Write the operator runbook**

  Document exact environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL`, `API_URL`, preview-token secret, storage provider), deployment order (migration → API → seed → Admin/Web), media-rights checklist, reviewer roles, failure messages, rollback by a new auditable revision, and how to recognize public fallback activation. Do not include secrets.

- [ ] **Step 6: Run the full affected-workspace gate**

  Run: `pnpm --filter @eurohouse/types test && pnpm --filter @eurohouse/types typecheck && pnpm --filter @eurohouse/api test && pnpm --filter @eurohouse/api typecheck && pnpm --filter @eurohouse/admin test && pnpm --filter @eurohouse/admin typecheck && pnpm --filter @eurohouse/admin build && pnpm --filter @eurohouse/web test && pnpm --filter @eurohouse/web typecheck && pnpm --filter @eurohouse/web build`
  Expected: all commands PASS.

- [ ] **Step 7: Perform the acceptance walkthrough**

  At 1440, 1280, 900, 768 and 375px: edit Hero copy, upload/approve an image, select it, save, preview, submit/review/publish, reload the public homepage, confirm SEO/social image and audit/history, then archive a referenced card and confirm repair warning + fallback. Record results in the runbook.

- [ ] **Step 8: Commit**

  Run: `git add apps/api/src/modules/website-content/homepage-authorization.e2e-spec.ts apps/api/src/modules/website-content/website-observability.ts apps/api/src/modules/website-content/website-observability.spec.ts apps/api/src/modules/website-content/homepage-publication.service.ts apps/api/src/modules/website-content/website-media-upload.service.ts apps/api/src/modules/website-content/public-website-content.controller.ts apps/web/lib/homepage-cms.ts apps/api/package.json docs/release/website-homepage-admin-runbook.md && git commit -m "test: verify homepage admin release slice"`
