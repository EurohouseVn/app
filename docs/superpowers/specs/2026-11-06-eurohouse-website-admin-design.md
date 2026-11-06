# EUROHOUSE Website Admin Design

**Date:** 2026-11-06  
**Status:** Proposed for final approval  
**Selected UX:** Option A — fixed-section editor with live preview  
**Primary applications:** `apps/admin`, `apps/api`, `apps/web`  
**Public domain:** `nhomeurohouse.com`

## 1. Intent

Add a governed website-management area to the existing EUROHOUSE Admin so authorized staff can replace images and video, edit customer-facing content, maintain SEO/GEO fields, preview a draft and publish it without editing source code.

The public website remains a professionally designed, fixed-layout product platform. Editors control approved content slots; they do not freely drag sections, alter the design system or inject arbitrary markup. This protects the approved Monumental EUROHOUSE presentation while making day-to-day content operations independent of developers.

The legal publisher shown by the public site is **EUROHOUSE VIỆT NAM**. This decision supersedes the older `LELOI EXIM GLOBAL` publisher wording in prior design documents.

## 2. Context and existing foundation

The repository already provides most of the backend foundation:

- `apps/admin`: Next.js 15 and React 19 Admin Pro, with shared navigation, access checks and EUROHOUSE orange visual tokens.
- `apps/api`: NestJS, Prisma, storage services, RBAC and audit-capable website-content APIs.
- `apps/web`: Next.js public website with CMS-backed product/project/media loading and curated fallbacks.
- Prisma website entities for content, revisions, reviews, SEO, media, content-media links, documents, redirects and audit records.
- Admin endpoints for content listing, revisions, technical/marketing review, publication, archiving, preview tokens, media metadata, documents and redirects.
- Public endpoints that return only published content, or one preview revision when supplied a valid short-lived preview token.

The missing product surface is the Admin user interface and a fixed homepage configuration contract. The website currently mixes published CMS data with static homepage presentation copy and local images, so not every visible homepage field is editable yet.

## 3. Decisions already approved

- Use the integrated Admin approach, not an external CMS.
- Use fixed editable sections, not a free drag-and-drop page builder.
- Use selected wireframe **A: biên tập + xem trước**.
- Preserve one shared API/data platform for Public Web, Admin and NPP.
- Preserve the approved public-site visual direction and EUROHOUSE orange identity.
- Keep the top-level product split exactly **NHÔM DÂN DỤNG** and **NHÔM CÔNG NGHIỆP**.
- Support desktop-first authoring; mobile supports review, approval and small edits.
- The public legal publisher is **EUROHOUSE VIỆT NAM**.

## 4. Goals

### 4.1 Editor goals

- Find a page or content item quickly by type, status, family or last update.
- Edit text, CTA labels/links, media, alt text and SEO fields in Vietnamese.
- Replace a public image or video without copying files into the codebase.
- See a faithful draft preview before publication.
- Know whether a change is saved, under review or published.
- Review revision history and identify who changed what.

### 4.2 Governance goals

- Keep unpublished or rejected revisions out of public API payloads, metadata, sitemap and search results.
- Preserve technical and marketing review for claims that require governance.
- Give CEO/Admin a concise publish path while keeping an audit trail.
- Restrict Staff to draft and submission workflows unless explicitly granted a publish permission.
- Keep media rights, alt text and usage relationships visible.

### 4.3 Technical goals

- Reuse the current website-content models, controllers, preview-token mechanism and storage abstraction.
- Add the smallest schema/API surface needed for fixed page configuration and direct media upload.
- Keep server-rendered public pages indexable and resilient when the API is unavailable.
- Avoid introducing a second component library or external CMS.

## 5. Non-goals

The first release does not include:

- Arbitrary drag-and-drop section placement.
- Custom HTML, JavaScript or CSS entered by an editor.
- Theme, font, navigation-shell or global layout editing.
- Automatic mirroring of Google Drive folders.
- Editing Admin, NPP or Mobile operational content through this module.
- Scheduled publication, localization or simultaneous collaborative editing.
- Replacing the existing technical product master with CMS copies.
- Automatic publication of unverified technical claims.

## 6. Anti-goals

The result is considered a failure if it:

- Lets an editor accidentally break the approved public layout.
- Publishes a draft merely because it was saved.
- exposes private/NPP-only documents or media publicly.
- Creates a second disconnected media store or product database.
- Shows internal workflow language on customer-facing pages.
- Requires a developer to replace routine text, images or videos.
- Makes the Admin editor unusable below 1280px or horizontally scroll at 375px.

## 7. Approaches considered

### A. Fixed-section Admin editor — selected

Each supported page has a typed section schema. The left column selects a section, the center column edits fields and the right column previews the draft. Editors may hide an optional section but cannot reorder structural sections unless the schema explicitly permits it.

This best balances editorial independence, preview quality and protection of the approved design.

### B. Visual canvas editor

The public page is the primary canvas; selecting a section opens an inspector. This is visually intuitive but slower for long copy, SEO and repeated structured fields. It also requires more complex iframe selection and cross-window state synchronization.

Rejected for the first release; it may become an enhancement after the fixed editor is stable.

### C. Publishing workbench

The content queue and review status are primary, with editing opened after choosing an item. This is strong for a large editorial team but adds a step before the common job of changing homepage content.

Retained as the list/dashboard pattern, not the primary editor layout.

## 8. Selected UX

### 8.1 Admin navigation

Add **Quản trị Website** under **Marketing & CSKH** in the existing Admin shell. It uses the existing Admin brand, typography and navigation behavior.

Primary routes:

- `/website`: website-content overview and searchable content list.
- `/website/pages/home`: fixed homepage editor.
- `/website/content/[id]`: product, service, project, article or capability editor.
- `/website/media`: media library.
- `/website/reviews`: review queue for authorized reviewers.
- `/website/history`: revision and publication audit view.

### 8.2 Overview

Show four compact counts in one grouped block: published, draft, awaiting review and missing SEO. Below it, show a searchable/filterable content table with name, content type, last update, editor and status. A recent-activity panel answers “who changed what.”

The overview is not the homepage editor. Selecting **Trang chủ** opens the fixed-section editor.

### 8.3 Fixed-section editor

Desktop layout follows approved wireframe A:

1. Existing Admin sidebar.
2. Page header with site/domain context, saved state, View Website, Save Draft and Publish/Submit action.
3. Section navigator: fixed section names and status.
4. Form editor for the selected section.
5. Sticky live-preview panel where space permits; it moves below the form on narrower desktop/tablet widths.

Homepage section contract:

1. Hero.
2. Two product fields.
3. Residential systems.
4. Industrial capability.
5. Evidence/capability.
6. Projects.
7. Brand film/video.
8. Consultation and contact CTA.
9. SEO/GEO and social preview.

The exact public homepage narrative remains governed by the approved Monumental EUROHOUSE design. The Admin labels map to that implementation rather than creating a separate layout.

### 8.4 Field behavior

- Inputs have persistent labels and optional helper text.
- Character guidance is shown where responsive line count matters.
- Customer-facing copy guidance discourages internal/admin wording.
- Media fields show current thumbnail, dimensions, file size and where the asset is used.
- Replacing media opens the Media Library or upload flow; it never asks the user for a storage object ID.
- SEO is a dedicated collapsible card or tab, not mixed into every visual field group.
- Save Draft never publishes.
- Successful autosave displays “Đã lưu lúc HH:mm.”
- Validation errors remain next to the affected field and prevent publish/submit.

### 8.5 Responsive behavior

- At large desktop widths, section navigator, form and preview appear together.
- At 901–1350px, preview moves below the form.
- At 900px and below, Admin sidebar becomes a menu, section navigation becomes a horizontally scrollable row with a faded edge and the form is single-column.
- Mobile shows only the primary publish/submit action in the page header; secondary actions move into the page action menu.
- Media replacement and quick text edits remain available; dense bulk authoring is not optimized as a primary mobile task.

## 9. Content contracts

### 9.1 Homepage page record

Use one website content record representing the homepage:

- `kind`: `PAGE`
- `slug`: `trang-chu`
- `title`: `Trang chủ`
- current revision stores the editable homepage payload.

The revision body is a versioned JSON document validated by the API before save or publication. Recommended envelope:

```ts
type HomepagePayloadV1 = {
  schemaVersion: 1;
  hero: HeroSection;
  productFields: ProductFieldsSection;
  residential: ResidentialSection;
  industrial: IndustrialSection;
  evidence: EvidenceSection;
  projects: ProjectsSection;
  video: VideoSection;
  contact: ContactSection;
};
```

SEO remains in the existing revision SEO relationship where possible, rather than being duplicated inside the body.

Each section has:

- stable section key;
- editable copy fields;
- optional visibility flag only where the public design allows hiding;
- media references by `WebsiteMediaAsset` ID;
- CTA label and validated internal/external URL;
- accessible alt/caption fields when semantically required.

The API rejects unknown section keys, arbitrary markup, unsupported URL schemes and payloads that exceed configured field lengths.

Release-one homepage contract is authoritative as follows:

| Section | Editable fields | Cardinality / rules |
| --- | --- | --- |
| `hero` | eyebrow, title, summary, primary CTA, secondary CTA, background media | Required; title max 120, summary max 360, CTA label max 40 |
| `productFields` | section eyebrow/title/intro; Residential and Industrial title, summary, CTA and media | Both family entrances required; family keys and routes are fixed |
| `residential` | eyebrow, title, intro, dominant content reference, supporting content references, section CTA | Exactly 1 dominant and up to 2 supporting published-content references |
| `industrial` | eyebrow, title, intro, service content references, background media, primary/secondary CTA | 1–4 service references; the four approved offer types remain the intended set |
| `evidence` | eyebrow, title, intro and 2–4 evidence items | Each item has title max 80, summary max 240 and optional media |
| `projects` | eyebrow, title, intro, featured project references and section CTA | 1–3 project content references |
| `video` | eyebrow, title, summary and primary video media | One approved uploaded video; poster/transcript/caption come from the media asset |
| `contact` | eyebrow, title, summary, architectural CTA and industrial CTA | Required; both conversion paths remain present |

Common limits: eyebrow 80 characters, section title 120, intro/summary 360, CTA label 40 and URL 300. URLs allow same-site relative paths and `https:` external URLs only. Release one has no editor-controlled section reordering or visibility flags; the approved homepage narrative remains complete. If optional referenced content is unavailable, the renderer uses the documented fallback behavior rather than silently removing a structural section.

Homepage media use stable `WebsiteContentMedia.role` values rather than unconstrained media IDs embedded throughout JSON: `HERO_BACKGROUND`, `FIELD_RESIDENTIAL`, `FIELD_INDUSTRIAL`, `INDUSTRIAL_BACKGROUND`, `EVIDENCE_1` through `EVIDENCE_4`, `VIDEO_PRIMARY` and `SOCIAL_SHARE`. Saving a revision reconciles these links transactionally with the payload.

Homepage product/project collections store ordered references to existing `WebsiteContent` records. They do **not** duplicate product or project card copy in the homepage payload. Preview may render the referenced item’s latest eligible revision; publication requires every selected reference to have a published revision. If a referenced item is later archived, the live homepage omits that card and fills the slot from the curated fallback/next eligible published item while Admin shows a repair warning. The containing structural section remains present.

### 9.2 Product and service content

Product/service editors continue to use individual `WebsiteContent` records linked to the shared technical identity. Public presentation copy does not replace `AluSystem`, `Profile` or technical datasets.

The Admin editor groups fields by:

- identity and public route;
- customer-facing summary and benefits;
- verified applications/specifications;
- media and documents;
- related products/projects;
- SEO/GEO;
- revision and review history.

### 9.3 Media

`WebsiteMediaAsset` remains the public-media authority. Add a website media upload endpoint that:

- uses the existing storage service;
- validates MIME type, file signature, size and dimensions;
- creates the storage object and media record in one authorized workflow;
- stores original filename separately from generated storage key;
- records uploader, rights status, alt text and audit event;
- returns a media item the editor can select immediately.

Initial public-authoring types:

- images: JPG, PNG, WebP;
- video: uploaded MP4/WebM only in release one;
- document attachment uses the existing website-document workflow.

Uploads are not public merely because they exist. Public URLs are returned only for assets with the required channel/rights status and a published usage relationship.

Media eligibility is explicit:

- Draft preview may use an asset with `rightsStatus` of `PENDING` or `APPROVED` and `intakeStatus` of `DISCOVERED`, `REVIEWED`, `APPROVED`, `OPTIMIZED` or `PUBLISHED`, provided it is not rejected/quarantined and the preview token is authorized for the containing revision.
- Publication requires `PUBLIC` in `channels`, `rightsStatus = APPROVED` and `intakeStatus` of `APPROVED`, `OPTIMIZED` or `PUBLISHED`.
- `UNKNOWN`, `PENDING` rights or `REJECTED` intake block publication with a field-level/media-level explanation.
- External video URLs and provider embeds are out of scope for release one.

## 10. API design

Reuse existing `/website/admin/content` and revision endpoints. Add or normalize the following responsibilities:

- fetch homepage record and current working revision;
- create homepage record only once, then create revisions;
- validate `HomepagePayloadV1` on draft save and publish;
- upload public website media through a multipart endpoint;
- list/search media by type, rights state and usage;
- return media usage relationships before replacement or archive;
- issue preview token for the exact draft revision;
- provide a single Admin-facing publish command that enforces role/review policy server-side.

The Admin client never chains hidden approvals by directly calling low-level endpoints. Publication policy belongs in the API service so web, scripts and future clients cannot bypass it.

## 11. Preview architecture

Preview uses the existing short-lived token scoped to one revision:

1. Editor saves or autosaves the current draft.
2. Admin requests a preview token for that revision.
3. Preview panel opens the public page with `previewToken` in a same-origin or configured preview URL.
4. Public Web requests only that revision through the preview-aware public API.
5. Preview responses use `noindex`, are excluded from sitemap and are not cached as published content.

The preview panel may begin as a responsive iframe. It receives no Admin credentials and cannot access unrelated drafts. Refreshing the preview obtains a new token when the previous token is near expiry.

The mini preview in the editor is a convenience; **Xem trước đầy đủ** opens the actual public route in a new tab at desktop and mobile widths.

## 12. Roles and publication policy

### 12.1 CEO/Admin

- View all website content and audit history.
- Create and edit drafts.
- Upload/approve media according to rights policy.
- Preview drafts.
- Publish after confirmation when server validation and required reviews pass.
- Archive published content.

### 12.2 Staff

- View content in allowed modules.
- Create/edit drafts and upload pending media.
- Preview their accessible drafts.
- Submit for technical or marketing review.
- Cannot publish unless granted an explicit website-publish permission.

### 12.3 Reviewers

- Technical reviewer approves specifications, capability and warranty claims.
- Marketing reviewer approves language, media, SEO and brand presentation.
- Review rejection requires a reason and returns the revision to an editable state.

### 12.4 Homepage review call

Pure copy/media homepage edits still use the existing review model, but the publish service may treat fields by risk class:

- **Technical-risk changes** require technical and marketing approval.
- **Marketing-only changes** require marketing approval; technical approval is carried forward only when technical fields and their source references are unchanged.

This prevents trivial image/copy updates from forcing irrelevant technical review while preserving governance. The implementation plan must include explicit field-risk classification and tests; it must not infer risk from UI labels.

Authoritative release-one risk matrix:

| Change | Review required |
| --- | --- |
| Technical specifications, dimensions, alloy/temper, tolerance, warranty, factory capability, production/process claim or source reference | Technical + Marketing |
| Product/service/project reference changed to a different content record or revision containing technical claims | Technical + Marketing |
| Customer-facing headline, summary, CTA label/link or section order within an approved collection | Marketing |
| Image/video replacement, alt text, caption, transcript or focal point | Marketing; Technical also required when the media/copy itself asserts a technical capability |
| SEO title/description/canonical/social image/schema type | Marketing; Technical also required when newly asserting a technical fact |
| Pure punctuation/formatting that does not change normalized meaning | Marketing |

Technical approval may carry forward only from the immediately preceding approved revision when the server-computed technical-risk hash is unchanged. The hash covers normalized technical fields, technical source references, referenced content IDs plus their published revision IDs, and technical media/caption/transcript content. Any change to that hash invalidates carried technical approval. Marketing approval never carries forward to a newly edited revision.

## 13. Public Web integration

`apps/web` adds a homepage parser/adapter that:

- fetches published `PAGE/trang-chu` content;
- validates `schemaVersion` and section shape;
- maps media IDs/URLs into the approved homepage presentation model;
- merges missing optional fields with curated local fallbacks;
- falls back to the complete curated homepage when API data is absent or invalid;
- never shows draft/internal review wording publicly.

The legal publisher configuration is `EUROHOUSE VIỆT NAM`.

SEO/GEO behavior:

- published SEO record supplies title, description, canonical and social image;
- Organization/WebSite/WebPage structured data uses existing site configuration and verified fields;
- image alt text and video transcript remain visible/indexable where appropriate;
- preview mode adds `noindex, nofollow`;
- invalid or missing CMS SEO falls back to safe static metadata.

Release-one SEO/GEO fields are exactly: title, description, canonical path, schema type, review date and social-share media. Social media is a governed `WebsiteContentMedia` link with role `SOCIAL_SHARE`, not an unvalidated URL field. “GEO” in this release means visible entity-rich copy, source-backed facts, semantic headings, internal links and structured data derived from approved content; it does not introduce a separate hidden keyword or AI-prompt field.

Publishing one revision is a transaction that archives/supersedes the previously published revision for that content and marks the new revision `PUBLISHED`. The public query has a single current published revision invariant; rollback creates or republishes an auditable revision rather than leaving multiple competing published rows.

The **EUROHOUSE VIỆT NAM** decision changes the publisher/brand entity shown in public site configuration, footer publisher label and relevant structured data. It does not silently rewrite privacy-policy, terms, data-controller or legal-operator statements. Those remain as currently approved until EUROHOUSE supplies legal confirmation; implementation separates publisher display fields from legal-controller copy where necessary.

## 14. Error and failure behavior

- Draft save failure keeps entered text, shows field/server error and never claims the draft was saved.
- Preview failure keeps the editor usable and offers retry; it does not publish as a workaround.
- Upload failure identifies the file and reason, supports retry/removal and does not create a broken media link.
- Publishing is transactional from the revision/status perspective: either the validated revision becomes current published content or the previous published revision remains active.
- Public API failure shows curated fallback content; a malformed CMS payload does not break the homepage.
- Media archival is blocked while an asset is used by a published revision, unless it is replaced in the same governed operation.
- Concurrent edits use revision identity/version checks; a stale editor cannot silently overwrite a newer revision.

## 15. Audit and observability

Audit events include:

- content/revision created;
- draft updated;
- media uploaded, linked, replaced or archived;
- submitted, approved, rejected, published or archived;
- redirect and SEO changes;
- actor, timestamp, content/revision IDs and a concise change summary.

Do not log preview tokens, uploaded private file contents or full sensitive request bodies.

Operational metrics should include publish failures, preview failures, upload failures and public fallback activation.

## 16. Migration and rollout

Release one is the complete vertical slice needed for the immediate homepage operation: Admin overview, fixed homepage editor, media upload/library selection, draft save, preview, review/publish controls, revision history for the homepage and public homepage consumption. Generic product/service/project editors and a cross-content review/history workbench are phase two, built from the same primitives after the homepage slice is accepted. The overview may list existing generic content in release one, but opening unsupported types uses their current Admin/API surface or a clear “coming in phase two” boundary rather than a partial editor.

1. Add Admin module key/permission mapping and navigation item.
2. Add/normalize homepage schema validation and media upload API.
3. Seed one `PAGE/trang-chu` record from the current approved homepage presentation.
4. Keep existing local fallbacks active.
5. Build Admin overview, homepage editor, media library and preview.
6. Switch public homepage to prefer the published homepage record.
7. Validate that draft, rejected and pending media cannot appear publicly.
8. Phase two: roll out product/service/project editors and the cross-content review/history workbench using the same editor primitives.

The seed/import step is idempotent. It must not overwrite an existing authored homepage revision.

## 17. Verification

### API

- Unit tests for homepage payload validation and field-risk classification.
- Authorization tests for Admin, Staff and reviewer actions.
- Publication-policy tests covering technical-risk and marketing-only changes.
- Upload tests for allowed type, spoofed MIME, oversize, rights/channel state and storage failure.
- Preview-token scope/expiry tests.
- Concurrency/stale-revision tests.

### Admin

- Component tests for section selection, dirty/saved state, validation and role-based actions.
- Media selection/replacement and usage-warning tests.
- Preview-token refresh and preview error tests.
- Responsive visual checks at 1440, 1280, 900, 768 and 375px.
- Keyboard and screen-reader labeling checks for form fields and dialogs.

### Public Web

- Parser tests for valid, partial, unsupported-version and malformed payloads.
- Draft content never appears without a valid preview token.
- Preview pages are noindex and excluded from sitemap/cache.
- Fallback homepage remains complete when API is unavailable.
- Customer-facing copy tests continue to reject internal/admin language.
- Typecheck, tests and production builds pass for affected workspaces.

## 18. Acceptance criteria

- **Quản trị Website** appears in Admin for authorized users.
- An Admin can edit every approved homepage section, replace an image, preview the draft and publish it without code changes.
- Staff can save/preview drafts and submit them but cannot bypass publish policy.
- The editor matches approved wireframe A and has no horizontal overflow at 375px.
- The public website continues to use the approved Monumental EUROHOUSE layout.
- Saving a draft never changes the live site.
- A published revision updates public content and SEO atomically while retaining revision/audit history.
- Draft, rejected, private and unapproved media never appear in public API responses, metadata or sitemap.
- Public fallback content works during API failure or invalid CMS content.
- The legal publisher displayed by the public site is **EUROHOUSE VIỆT NAM**.

## 19. Builder calls left open

These are implementation decisions that do not change the approved product:

- Exact component/file decomposition within existing Admin conventions.
- Whether form autosave uses a short debounce or explicit section save, provided publish always requires a saved revision.
- Exact query-cache library or plain hooks, based on what the Admin already uses at implementation time.
- Exact image optimization presets and thumbnail sizes, based on current storage/CDN capabilities.
- Whether preview uses an embedded iframe first or opens a full preview tab first; both must use the same preview token and actual public renderer.

## 20. Approval gate

Approval of this document authorizes creation of the implementation plan. It does not yet authorize product-code implementation. After approval, the next artifact is a task-by-task implementation plan with exact files, tests, commands and review checkpoints.
