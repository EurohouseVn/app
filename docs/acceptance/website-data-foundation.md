# EUROHOUSE website data foundation — acceptance checkpoint

Date: 2026-10-31
Branch: `codex/eurohouse-unified-platform`
Scope: governed public content, Admin revisions/reviews, public projections, media/documents, redirects, and audit.

## Preconditions

Set environment variables locally; never paste a real token into this document or commit one.

```bash
export API_BASE="http://localhost:3001"
export ADMIN_TOKEN="<ADMIN_OR_STAFF_BEARER_TOKEN>"
export CONTENT_ID="<WEBSITE_CONTENT_ID>"
export REVISION_ID="<WEBSITE_REVISION_ID>"
```

Production must also provide `WEBSITE_PREVIEW_SECRET` with at least 32 characters. Preview tokens expire after 10 minutes, carry exactly one revision ID, and are accepted only by the public detail endpoint.

## Seed-independent API examples

### Public list and detail

```bash
curl --fail-with-body \
  "$API_BASE/api/public/website/content?family=RESIDENTIAL&kind=PRODUCT&page=1"

curl --fail-with-body \
  "$API_BASE/api/public/website/content/he-cua-eu55?locale=vi"
```

The list response has stable `items`, `page`, `pageSize`, `total`, and `totalPages` fields. Both endpoints return only the latest published revision. Public responses use CDN-compatible cache headers; preview responses use `private, no-store`.

### Create an identity and draft revision 1

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/website/admin/content" \
  --data '{
    "kind": "PRODUCT",
    "family": "RESIDENTIAL",
    "slug": "he-cua-eu55",
    "locale": "vi",
    "aluSystemId": "<REAL_ALU_SYSTEM_ID>",
    "title": "Hệ cửa EUROHOUSE EU55",
    "summary": "Giải pháp nhôm dân dụng đồng bộ.",
    "body": {"blocks": []},
    "specifications": {"thickness": "1.4 mm"},
    "sourceRefs": [{"source": "Catalog R19"}],
    "hasHighRiskClaims": true,
    "seo": {
      "title": "Hệ cửa nhôm EUROHOUSE EU55",
      "description": "Thông số và ứng dụng hệ cửa EU55.",
      "canonicalPath": "/nhom-dan-dung/he-cua-eu55",
      "schemaType": "Product"
    }
  }'
```

To clone the current published/archived revision into a new draft:

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/website/admin/content/$CONTENT_ID/revisions"
```

### Technical review, marketing review, and publish

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/website/admin/revisions/$REVISION_ID/submit/TECHNICAL"

curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/website/admin/revisions/$REVISION_ID/review" \
  --data '{"stage":"TECHNICAL","decision":"APPROVED","note":"Thông số đạt."}'

curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/website/admin/revisions/$REVISION_ID/submit/MARKETING"

curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/website/admin/revisions/$REVISION_ID/review" \
  --data '{"stage":"MARKETING","decision":"APPROVED"}'

curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/website/admin/revisions/$REVISION_ID/publish"
```

Publishing is rejected unless the current revision is in `MARKETING_REVIEW`, the latest technical and marketing decisions are both `APPROVED`, and every high-risk claim has a source reference.

### Archive

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/website/admin/content/$CONTENT_ID/archive"
```

Published revisions are immutable. A new edit starts by cloning a published/archived revision into a new draft.

### Redirect validation and resolution

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/website/admin/redirects" \
  --data '{
    "sourcePath": "/san-pham-cu/eu55/",
    "destinationPath": "/nhom-dan-dung/he-cua-eu55",
    "statusCode": 301
  }'

curl --fail-with-body \
  "$API_BASE/api/public/website/redirect?path=/san-pham-cu/eu55"
```

The resolver returns only `destinationPath` and `statusCode`. Release one rejects external destinations, query strings, fragments, self-redirects, loops, and chains longer than one hop. Inactive redirects resolve to `null`.

## Negative-boundary acceptance

Run these checks against a disposable database or a deployed staging environment.

| Boundary | Reproducible check | Expected result | Automated evidence |
| --- | --- | --- | --- |
| Draft is private | Request the draft slug without a preview token | HTTP 404 | Query filters `status=PUBLISHED`; serializer returns `null` without a published revision |
| Operational data is private | Search a published detail response for `pricePerKg`, `stockBars`, `objectKey`, `sha256`, `reviews`, `sourceRefs`, or audit notes | No match | `public-website-content.serializer.spec.ts` negative-data fixture |
| NPP document is private | Link one `NPP`-only and one `PUBLIC` document, then request public detail/documents | Only the `PUBLIC` document appears | Serializer and asset channel tests |
| Invalid transition fails closed | Submit `DRAFT` directly to marketing or publish it | HTTP 4xx | Publication-policy and revision-service transition tests |
| Incomplete video is private | Set a video to `PUBLISHED` without poster or transcript/description | HTTP 400 | Website-assets service tests |
| Redirect is single-hop | Create `/a → /b`, then try `/b → /c` or `/z → /a` | HTTP 400 | Website-redirects service tests |

Example local assertions with `jq`:

```bash
curl -sS "$API_BASE/api/public/website/content/he-cua-eu55?locale=vi" \
  | jq -e 'has("pricePerKg") or has("stockBars") or has("reviews") or has("sourceRefs") | not'

curl -sS "$API_BASE/api/public/website/content/he-cua-eu55?locale=vi" \
  | jq -e '[.documents[] | select(.title == "<NPP_ONLY_DOCUMENT_TITLE>")] | length == 0'
```

## Audit and rollback

Every identity/revision transition, governed media/document change, asset link/unlink, and redirect mutation writes `WebsitePublicationAudit` inside the same database transaction. Inspect recent entries with:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/api/website/admin/audit?entityId=$REVISION_ID"
```

Rollback is data-safe and does not require deleting history:

1. Archive the newly published content revision.
2. Reactivate or create a direct redirect to the previous canonical path if required.
3. Disable the affected redirect through the Admin endpoint.
4. Preserve audits and source references for incident review.
5. Roll back the application release; the foundation migration is additive.

## Verification record

Automated gates executed on 2026-10-31:

- `pnpm --filter @eurohouse/api test` — 150/150 passed after Task 6.
- `pnpm --filter @eurohouse/api typecheck` — passed.
- `pnpm --filter @eurohouse/api build` — passed, including Prisma Client generation.
- Red/green evidence exists for publication policy, revision service, public serializer, preview token, assets, and redirects.

Database migration parity remains a release-blocking verification debt: PostgreSQL at `localhost:55432` was unavailable in this session, so `prisma migrate dev --create-only` and `prisma:baseline:verify` returned `P1001`. Before production deployment, start the disposable PostgreSQL environment, run both parity checks, apply migrations to staging, and execute the HTTP checks above.
