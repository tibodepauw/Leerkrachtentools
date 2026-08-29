export const USER_TIERS = [
  "student",
  "tester",
  "partner",
  "admin",
  "unapproved",
] as const;

export type UserTier = (typeof USER_TIERS)[number];

export function isUserTier(value: string): value is UserTier {
  return (USER_TIERS as readonly string[]).includes(value);
}

export function normalizeAccountTier(tier: string): UserTier {
  if (isUserTier(tier)) return tier;
  if (tier === "free") return "student";
  return "unapproved";
}
