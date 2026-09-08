#!/usr/bin/env node
import { getDatabase } from "@/lib/db/sqlite";
import { applyQuotaLedgerBackfill } from "@/lib/db/migrateQuotaLedgers";

const result = applyQuotaLedgerBackfill(getDatabase());
process.stdout.write(
  `${result.id} applied=${result.applied} orgRows=${result.orgRows} aiRows=${result.aiRows}\n`,
);
if (!result.applied) {
  process.stdout.write("Already applied; no changes.\n");
}
