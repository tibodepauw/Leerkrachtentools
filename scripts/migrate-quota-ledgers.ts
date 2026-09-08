#!/usr/bin/env node

if (process.env.QUOTA_LEDGER_BACKUP_CONFIRMED !== "1") {
  process.stderr.write(
    "Refusing to migrate. Back up data/leerkrachtentools.db (and the WAL/SHM files), then rerun with QUOTA_LEDGER_BACKUP_CONFIRMED=1.\n",
  );
  process.exit(1);
}

void (async () => {
  const { getDatabase } = await import("@/lib/db/sqlite");
  const { applyQuotaLedgerBackfill } = await import(
    "@/lib/db/migrateQuotaLedgers"
  );
  const result = applyQuotaLedgerBackfill(getDatabase());
  process.stdout.write(
    `${result.id} applied=${result.applied} orgRows=${result.orgRows} aiRows=${result.aiRows}\n`,
  );
  if (!result.applied) {
    process.stdout.write("Already applied; no changes.\n");
  }
})().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
