import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TIER_LABELS = {
  student: "Student",
  tester: "Tester",
  partner: "Partner",
  admin: "Beheerder",
  unapproved: "Geen toegang",
} as const;

const TIER_STYLES = {
  student: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  tester: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  partner: "border-purple-500/30 bg-purple-500/15 text-purple-300",
  admin: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  unapproved: "border-red-500/30 bg-red-500/15 text-red-300",
} as const;

function normalizeTier(tier: string) {
  if (tier in TIER_LABELS) {
    return tier as keyof typeof TIER_LABELS;
  }
  if (tier === "free") return "student" as const;
  return "unapproved" as const;
}

export function tierBadgeLabel(tier: string) {
  return TIER_LABELS[normalizeTier(tier)];
}

export function TierBadge({
  tier,
  className,
}: {
  tier: string;
  className?: string;
}) {
  const normalized = normalizeTier(tier);

  return (
    <Badge
      variant="outline"
      className={cn("border capitalize", TIER_STYLES[normalized], className)}
    >
      {TIER_LABELS[normalized]}
    </Badge>
  );
}

export function tierInviteOnlyHint(tier: string) {
  if (normalizeTier(tier) !== "unapproved") return null;
  return "Leerkrachtentools is invite-only. Neem contact op met de beheerder voor toegang.";
}
