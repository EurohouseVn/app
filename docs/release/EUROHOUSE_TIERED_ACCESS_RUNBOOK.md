# Eurohouse tiered access release runbook

This runbook releases public workshop registration with two independent Eurohouse permissions:
`FORMULA_CUTTING` and `EUROHOUSE_ORDERING`. The migration never activates ordering automatically.

## Release order

1. Take a database snapshot and record the current application revision.
2. Deploy database migrations through `20261109_eurohouse_feature_access` while the old
   formula routes remain available.
3. Run the backfill in dry-run mode:

   ```powershell
   pnpm --filter @eurohouse/api eurohouse-access:backfill
   ```

4. Review the JSON report. It must show `orderingActivations: 0`. Resolve every cross-NPP
   conflict with the business owner before applying; do not choose an NPP automatically.
5. Apply the reviewed backfill exactly once:

   ```powershell
   pnpm --filter @eurohouse/api eurohouse-access:backfill -- --apply
   ```

6. Run the dry-run again. `plannedFormulaMigrations` must be `0`; already migrated rows are
   reported in `skippedExisting`. Deploy API, Admin, NPP and Mobile only after that check.

The script defaults to dry-run. `--apply` is deliberately required for writes. Duplicate legacy
rows are collapsed by organization using the most recently updated row. Existing Eurohouse rows
are never overwritten. A different non-empty NPP on the legacy and current row is reported as a
conflict and left untouched. Formula `ACTIVE`/`REVOKED` status and revoke provenance are preserved.
An apply run with any unresolved conflict fails closed and writes no candidate rows.

## Smoke acceptance

Use a disposable verified CSSX and check:

- Public catalog/library/program endpoints are readable without a token and expose no price,
  stock, supplier-cost or unpublished fields.
- Registration by phone or email succeeds; `/auth/me` shows both Eurohouse permissions locked.
- NPP search returns masked identity fields and cannot accept an NPP scope from the client.
- A formula-only invite activates formulas and leaves ordering locked.
- Direct ordering activation enables ordering without changing formula status.
- Revoking ordering takes effect on the next mutation. Existing orders remain readable, while
  create/edit/delete/submit mutations return `EUROHOUSE_ORDERING_REQUIRED`.
- Admin `/eurohouse-access`, NPP factory management and Mobile render without horizontal overflow
  at 375, 768, 1024, 1280 and 1440 pixels.

## Security gate

- Invite tables contain only SHA-256 `codeHash`, display prefix and last four characters; the
  one-time plaintext code exists only in the creation response.
- Invite redemption claims an `ACTIVE` row with one conditional update inside a transaction, so
  only one concurrent request can succeed.
- NPP scope comes from the authenticated JWT organization. Client-provided NPP identifiers are
  ignored by NPP controllers.
- Public serializers use allowlists and re-evaluate publication state per request.
- Locked Mobile screens do not mount Eurohouse catalog/order loaders and issue no mutations.

## Rollback

1. Disable new invite creation and direct activation in the application deployment.
2. Roll application services back to the previous compatible revision. Keep the new tables and
   all `EurohouseAccessAudit` rows intact; do not reverse business grants by deleting audit data.
3. If a grant must be neutralized, revoke it through Admin with a rollback reason. This preserves
   the actor, timestamp, previous NPP and reason.
4. Keep legacy formula tables/routes enabled during rollback. Re-run the dry-run report to measure
   any grants created after the snapshot before attempting another release.

Never drop the new tables as an operational rollback. A database restore is a last-resort incident
procedure and must restore audit data from the same recovery point.

## Legacy compatibility removal gate

Remove `FormulaAccessGrant`, `FormulaInvite`, `FormulaAccessAudit` and `/formula-access` only after
all of the following are true for two consecutive production releases:

- dry-run reports no planned formula migrations or unresolved conflicts;
- telemetry shows no requests to legacy formula endpoints for at least 30 days;
- all supported Mobile, NPP and Admin versions consume `/eurohouse-access`;
- sampled active and revoked grants match legacy status, NPP and revoke provenance;
- rollback no longer depends on a legacy client revision; and
- a separate reviewed migration archives legacy data before dropping any table.
