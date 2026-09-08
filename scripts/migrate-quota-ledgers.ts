#!/usr/bin/env node
import { getDatabase } from "@/lib/db/sqlite";
import { applyQuotaLedgerBackfill } from "@/lib/db/migrateQuotaLedgers";

if (process.env.QUOTA_LEDGER_BACKUP_CONFIRMED !== "1") {
  process.stderr.write(
    "Refusing to migrate. Back up data/leerkrachtentools.db (and the WAL/SHM files), then rerun with QUOTA_LEDGER_BACKUP_CONFIRMED=1.\n",
  );
  process.exit(1);
}

const result = applyQuotaLedgerBackfill(getDatabase());
process.stdout.write(
  `${result.id} applied=${result.applied} orgRows=${result.orgRows} aiRows=${result.aiRows}\n`,
);
if (!result.applied) {
  process.stdout.write("Already applied; no changes.\n");
}
