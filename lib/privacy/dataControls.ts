import type Database from "better-sqlite3";
/** Explicit field allowlists; never export keys, auth material, arbitrary log detail or other accounts. */
export function exportUserData(db: Database.Database, userId: string) {
  return db.transaction(() => {
    const account = db.prepare(`SELECT id,email,display_name,tier,email_verified_at,marketing_opt_in,marketing_consent_at,privacy_accepted_at,created_at,updated_at,pinned_modules,use_own_api_keys,ai_provider,ai_model FROM users WHERE id=?`).get(userId);
    if (!account) throw new Error("Account niet gevonden.");
    const acceptances = db.prepare(`SELECT a.accepted_at,a.verified_at,d.version,d.hash,d.source_url,d.text FROM terms_acceptances a JOIN legal_documents d ON d.hash=a.document_hash WHERE a.user_id=? ORDER BY a.accepted_at`).all(userId);
    const usage = db.prepare("SELECT created_at FROM user_ai_usage WHERE user_id=? ORDER BY created_at").all(userId);
    const feedback = db.prepare("SELECT created_at FROM feedback_events WHERE user_id=? ORDER BY created_at").all(userId);
    return { format: "leerkrachtentools-user-v1", exportedAt: Date.now(), account, acceptances, usage, feedback, note: "Lesgegevens staan in je browser. Export daarvan verloopt afzonderlijk via de lesfuncties. Geheimen en beveiligingsidentificatoren zijn weggelaten." };
  })();
}
export function exportOrganizationData(db: Database.Database, orgId: string) {
  return db.transaction(() => {
    const organization = db.prepare("SELECT id,name,contact_email,tier,monthly_quota,created_at FROM api_organizations WHERE id=?").get(orgId);
    if (!organization) throw new Error("Organisatie niet gevonden.");
    const keys = db.prepare("SELECT id,name,scopes,is_active,expires_at,last_used_at,created_at FROM api_keys WHERE org_id=?").all(orgId);
    const usage = db.prepare("SELECT l.endpoint,l.status_code,l.tokens_used,l.duration_ms,l.created_at FROM api_usage_logs l JOIN api_keys k ON k.id=l.key_id WHERE k.org_id=? ORDER BY l.created_at").all(orgId);
    const quota = db.prepare("SELECT period,consumed,in_flight,updated_at FROM api_org_quota WHERE org_id=?").all(orgId);
    const dailyUsage = db.prepare("SELECT day,consumed FROM org_ai_daily_usage WHERE org_id=?").all(orgId);
    const requests = db.prepare("SELECT endpoint,status,status_code,response_bytes,created_at FROM api_idempotency_keys WHERE org_id=?").all(orgId);
    return { format: "leerkrachtentools-organization-v1", exportedAt: Date.now(), organization, keys, usage, quota, dailyUsage, requests, note: "Geen sleutelwaarden, hashes, sessies, ruwe logdetails of tijdelijk opgeslagen antwoordinhoud. Organisatie-id blijft behouden bij afsluiten om quota niet te resetten." };
  })();
}
/** Operator-only closure, distinct from export. Pending work must drain first. Quota is never reset. */
export function closeOrganization(db: Database.Database, orgId: string, apply = false) {
  const run = () => {
    if (!db.prepare("SELECT 1 FROM api_organizations WHERE id=?").get(orgId)) throw new Error("Organisatie niet gevonden.");
    const active = db.prepare("SELECT 1 FROM api_request_leases WHERE org_id=? AND status='active' UNION ALL SELECT 1 FROM api_idempotency_keys WHERE org_id=? AND status='pending' LIMIT 1").get(orgId, orgId);
    if (active) throw new Error("Organisatie heeft nog lopend werk. Eerst gecontroleerd afronden; er is niets gewijzigd.");
    const keys = (db.prepare("SELECT COUNT(*) AS n FROM api_keys WHERE org_id=? AND is_active=1").get(orgId) as { n: number }).n;
    const cached = (db.prepare("SELECT COUNT(*) AS n FROM api_idempotency_keys WHERE org_id=?").get(orgId) as { n: number }).n;
    if (apply) {
      db.prepare("UPDATE api_keys SET is_active=0 WHERE org_id=?").run(orgId);
      db.prepare("DELETE FROM api_idempotency_keys WHERE org_id=?").run(orgId);
      db.prepare("UPDATE api_organizations SET closed_at=? WHERE id=?").run(Date.now(),orgId);
    }
    return { dryRun: !apply, revokedKeys: keys, removedCachedResponses: cached, quotaPreserved: true, note: "Contact- en contractmetadata blijven bewaard tot een afzonderlijk onderbouwd verwijderbesluit." };
  };
  const transaction = db.transaction(run);
  return apply ? transaction.immediate() : transaction();
}
