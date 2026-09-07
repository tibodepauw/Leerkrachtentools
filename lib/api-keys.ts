import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getOrgQuotaSnapshot } from "@/lib/api/orgQuota";
import { startOfNextUtcMonth, startOfUtcMonth } from "@/lib/api/utcMonth";
import { getDatabase } from "@/lib/db/sqlite";

export { startOfNextUtcMonth, startOfUtcMonth };

export const API_KEY_PREFIX = "lt_live_";

export const API_KEY_SCOPES = [
  "curriculum:match",
  "curriculum:audit",
  "goals:improve",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export type ApiOrganizationTier = "internal" | "scale" | "enterprise";

const ORGANIZATION_TIERS = new Set<ApiOrganizationTier>([
  "internal",
  "scale",
  "enterprise",
]);

const SCOPE_SET = new Set<string>(API_KEY_SCOPES);
const DUMMY_HASH = "0".repeat(64);

export class ApiAuthError extends Error {
  readonly status: 401 | 403 | 429;
  readonly retryAfterSeconds?: number;
  readonly keyId?: string;
  readonly orgId?: string;
  readonly monthlyQuota?: number;
  readonly usedThisMonth?: number;
  readonly resetAt?: number;

  constructor(
    message: string,
    status: 401 | 403 | 429,
    extras?: {
      retryAfterSeconds?: number;
      keyId?: string;
      orgId?: string;
      monthlyQuota?: number;
      usedThisMonth?: number;
      resetAt?: number;
    },
  ) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
    this.retryAfterSeconds = extras?.retryAfterSeconds;
    this.keyId = extras?.keyId;
    this.orgId = extras?.orgId;
    this.monthlyQuota = extras?.monthlyQuota;
    this.usedThisMonth = extras?.usedThisMonth;
    this.resetAt = extras?.resetAt;
  }
}

type OrganizationRow = {
  id: string;
  name: string;
  contact_email: string;
  tier: ApiOrganizationTier;
  monthly_quota: number;
  created_at: number;
};

type ApiKeyRow = {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string;
  is_active: number;
  expires_at: number | null;
  last_used_at: number | null;
  created_at: number;
};

export type ValidatedApiKey = {
  keyId: string;
  orgId: string;
  orgName: string;
  keyName: string;
  scopes: string[];
  monthlyQuota: number;
  usedThisMonth: number;
  resetAt: number;
};

export function hashApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function timingSafeHashEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (Buffer.byteLength(a) !== Buffer.byteLength(b)) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function parseApiKeyScopes(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export function normalizeApiKeyScopes(scopes: string[]) {
  const unique = [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Geef minstens één geldige scope op.");
  }
  for (const scope of unique) {
    if (!SCOPE_SET.has(scope)) {
      throw new Error(`Onbekende API-scope: ${scope}`);
    }
  }
  return unique;
}

function orgUsedThisMonth(orgId: string, now = Date.now()) {
  return getOrgQuotaSnapshot(orgId, now).consumed;
}

function parseOrganizationTier(value: string): ApiOrganizationTier {
  if (!ORGANIZATION_TIERS.has(value as ApiOrganizationTier)) {
    throw new Error("Tier moet internal, scale of enterprise zijn.");
  }
  return value as ApiOrganizationTier;
}

export function createOrganization({
  name,
  email,
  tier,
  quota = 10_000,
}: {
  name: string;
  email: string;
  tier: string;
  quota?: number;
}) {
  const trimmedName = name.trim();
  const contactEmail = email.trim().toLowerCase();
  if (!trimmedName) throw new Error("Organisatienaam is verplicht.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(contactEmail)) {
    throw new Error("Vul een geldig contact-e-mailadres in.");
  }
  const monthlyQuota = Number.parseInt(String(quota), 10);
  if (!Number.isFinite(monthlyQuota) || monthlyQuota < 0) {
    throw new Error("Quota moet een geheel getal van 0 of meer zijn.");
  }

  const db = getDatabase();
  const organization: OrganizationRow = {
    id: randomUUID(),
    name: trimmedName,
    contact_email: contactEmail,
    tier: parseOrganizationTier(tier),
    monthly_quota: monthlyQuota,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO api_organizations
      (id, name, contact_email, tier, monthly_quota, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    organization.id,
    organization.name,
    organization.contact_email,
    organization.tier,
    organization.monthly_quota,
    organization.created_at,
  );
  return organization;
}

export function generateApiKey(
  orgId: string,
  name: string,
  scopes: string[],
) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Sleutelnaam is verplicht.");
  const normalizedScopes = normalizeApiKeyScopes(scopes);
  const db = getDatabase();
  const organization = db
    .prepare(
      `SELECT id, name, contact_email, tier, monthly_quota, created_at
       FROM api_organizations WHERE id = ?`,
    )
    .get(orgId) as OrganizationRow | undefined;
  if (!organization) {
    throw new Error("Organisatie niet gevonden.");
  }

  const plaintext = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  const key = {
    id: randomUUID(),
    orgId: organization.id,
    name: trimmedName,
    keyPrefix: API_KEY_PREFIX,
    scopes: normalizedScopes,
    createdAt: Date.now(),
  };
  db.prepare(
    `INSERT INTO api_keys
      (id, org_id, name, key_prefix, key_hash, scopes, is_active, expires_at, last_used_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?)`,
  ).run(
    key.id,
    key.orgId,
    key.name,
    key.keyPrefix,
    hashApiKey(plaintext),
    JSON.stringify(normalizedScopes),
    key.createdAt,
  );

  return {
    ...key,
    token: plaintext,
  };
}

function touchLastUsedAt(keyId: string) {
  queueMicrotask(() => {
    try {
      getDatabase()
        .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
        .run(Date.now(), keyId);
    } catch (error) {
      console.error("[api-keys] last_used_at", error);
    }
  });
}

export function validateApiKey(
  bearerToken: string,
  requiredScope: string,
  now = Date.now(),
): ValidatedApiKey {
  const token = bearerToken.trim();
  if (!token.startsWith(API_KEY_PREFIX)) {
    throw new ApiAuthError("Ongeldige API-sleutel.", 401);
  }

  const computedHash = hashApiKey(token);
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT id, org_id, name, key_prefix, key_hash, scopes, is_active, expires_at, last_used_at, created_at
       FROM api_keys WHERE key_hash = ?`,
    )
    .get(computedHash) as ApiKeyRow | undefined;

  let hashesMatch = false;
  try {
    hashesMatch = timingSafeHashEqual(computedHash, row?.key_hash ?? DUMMY_HASH);
  } catch {
    throw new ApiAuthError("Ongeldige API-sleutel.", 401);
  }

  if (!row || !hashesMatch) {
    throw new ApiAuthError("Ongeldige API-sleutel.", 401);
  }
  if (row.is_active !== 1) {
    throw new ApiAuthError("Deze API-sleutel is ingetrokken.", 401);
  }
  if (row.expires_at != null && row.expires_at <= now) {
    throw new ApiAuthError("Deze API-sleutel is verlopen.", 401);
  }

  const organization = db
    .prepare(
      `SELECT id, name, contact_email, tier, monthly_quota, created_at
       FROM api_organizations WHERE id = ?`,
    )
    .get(row.org_id) as OrganizationRow | undefined;
  if (!organization) {
    throw new ApiAuthError("Ongeldige API-sleutel.", 401);
  }

  const usedThisMonth = orgUsedThisMonth(organization.id, now);
  const resetAt = startOfNextUtcMonth(now);
  const quotaExtras = {
    keyId: row.id,
    orgId: organization.id,
    monthlyQuota: organization.monthly_quota,
    usedThisMonth,
    resetAt,
  };

  const scopes = parseApiKeyScopes(row.scopes);
  if (!scopes.includes(requiredScope)) {
    throw new ApiAuthError(
      "Deze API-sleutel mist de vereiste scope.",
      403,
      quotaExtras,
    );
  }

  touchLastUsedAt(row.id);

  return {
    keyId: row.id,
    orgId: organization.id,
    orgName: organization.name,
    keyName: row.name,
    scopes,
    monthlyQuota: organization.monthly_quota,
    usedThisMonth,
    resetAt,
  };
}

export function logApiUsage({
  keyId,
  endpoint,
  statusCode,
  durationMs,
  tokensUsed = 0,
  createdAt = Date.now(),
  requestId = "",
}: {
  keyId: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  tokensUsed?: number;
  createdAt?: number;
  requestId?: string;
}) {
  getDatabase()
    .prepare(
      `INSERT INTO api_usage_logs
        (key_id, endpoint, status_code, tokens_used, duration_ms, created_at, request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      keyId,
      endpoint.slice(0, 200),
      statusCode,
      Math.max(0, Math.round(tokensUsed)),
      Math.max(0, Math.round(durationMs)),
      createdAt,
      requestId.slice(0, 80),
    );
}

export function revokeApiKey(keyId: string) {
  const db = getDatabase();
  const result = db
    .prepare("UPDATE api_keys SET is_active = 0 WHERE id = ?")
    .run(keyId.trim());
  if (result.changes === 0) {
    throw new Error("API-sleutel niet gevonden.");
  }
}

export function inspectOrganization(orgId: string, now = Date.now()) {
  const db = getDatabase();
  const organization = db
    .prepare(
      `SELECT id, name, contact_email, tier, monthly_quota, created_at
       FROM api_organizations WHERE id = ?`,
    )
    .get(orgId.trim()) as OrganizationRow | undefined;
  if (!organization) {
    throw new Error("Organisatie niet gevonden.");
  }

  const monthStart = startOfUtcMonth(now);
  const keys = db
    .prepare(
      `SELECT id, name, key_prefix, scopes, is_active, expires_at, last_used_at, created_at
       FROM api_keys WHERE org_id = ? ORDER BY created_at DESC`,
    )
    .all(organization.id) as Array<
    Omit<ApiKeyRow, "org_id" | "key_hash">
  >;

  return {
    organization,
    monthStart,
    resetAt: startOfNextUtcMonth(now),
    keys: keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      scopes: parseApiKeyScopes(key.scopes),
      isActive: key.is_active === 1,
      expiresAt: key.expires_at,
      lastUsedAt: key.last_used_at,
      createdAt: key.created_at,
      usedThisMonth: orgUsedThisMonth(organization.id, now),
    })),
  };
}

export function hasLiveApiKeyAuthorization(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return /^Bearer\s+lt_live_/i.test(authorization.trim());
}

export function isB2bApiPath(pathname: string) {
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}
