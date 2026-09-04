import "server-only";

import {
  normalizeAccountTier,
  type UserTier,
  USER_TIERS,
} from "@/lib/auth/tierUtils";

export { USER_TIERS, type UserTier, normalizeAccountTier };

const THOMAS_MORE_DOMAINS = ["@student.thomasmore.be", "@thomasmore.be"];

/** Lokale testaccount, nooit actief in een productieproces. */
const DEVELOPMENT_TESTER_EMAILS = ["wxdsfq@zear.cez"] as const;

export const DAILY_SERVER_AI_LIMITS: Record<UserTier, number> = {
  student: 40,
  tester: 60,
  partner: 100,
  admin: 1000,
  unapproved: 0,
};

export { isUserTier } from "@/lib/auth/tierUtils";

function parseEmailAllowlist(raw: string | undefined) {
  if (!raw?.trim()) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function adminEmails() {
  return parseEmailAllowlist(process.env.ADMIN_EMAILS);
}

function testerEmails() {
  const emails = parseEmailAllowlist(process.env.TESTER_EMAILS);
  if (process.env.NODE_ENV !== "production") {
    for (const email of DEVELOPMENT_TESTER_EMAILS) {
      emails.add(email);
    }
  }
  return emails;
}

function partnerEmails() {
  return parseEmailAllowlist(process.env.PARTNER_EMAILS);
}

export function resolveTierFromEmail(email: string): UserTier {
  const normalized = email.trim().toLowerCase();

  if (adminEmails().has(normalized)) {
    return "admin";
  }

  if (THOMAS_MORE_DOMAINS.some((domain) => normalized.endsWith(domain))) {
    return "student";
  }

  if (testerEmails().has(normalized)) {
    return "tester";
  }

  if (partnerEmails().has(normalized)) {
    return "partner";
  }

  return "unapproved";
}

export function isApprovedTier(tier: string): tier is Exclude<UserTier, "unapproved"> {
  const normalized = normalizeAccountTier(tier);
  return normalized !== "unapproved";
}

export function hasAppAccess(email: string) {
  return isApprovedTier(resolveTierFromEmail(email));
}

export function dailyServerAiLimit(tier: string) {
  return DAILY_SERVER_AI_LIMITS[normalizeAccountTier(tier)];
}

export function inviteOnlyMessage() {
  return "Leerkrachtentools is invite-only. Je account heeft nog geen toegang. Neem contact op met de beheerder om een uitnodiging te ontvangen.";
}

export function dailyAiLimitMessage(limit: number) {
  return `Je hebt je dagelijkse limiet van ${limit} AI-analyses bereikt. Vul je eigen API-key in onder Instellingen om onbeperkt door te werken, of wacht tot morgen.`;
}
