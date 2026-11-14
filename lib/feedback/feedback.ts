import "server-only";

import { ALL_MODULE_IDS } from "@/lib/auth/moduleVisibilityConfig";

export type FeedbackKind = "idea" | "feedback" | "bug";

const kindLabels: Record<FeedbackKind, string> = {
  idea: "Idee",
  feedback: "Feedback",
  bug: "Bug / probleem",
};

export function feedbackRecipientEmail() {
  const configured = process.env.FEEDBACK_TO_EMAIL?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("FEEDBACK_TO_EMAIL is not configured.");
  }
  return "feedback-not-configured@invalid";
}

export function normalizeFeedbackMessage(value: string) {
  const message = value.trim();
  if (message.length < 10) {
    throw new Error("Schrijf minstens 10 tekens zodat je boodschap duidelijk is.");
  }
  if (message.length > 4000) {
    throw new Error("Je bericht is te lang. Houd het onder 4000 tekens.");
  }
  return message;
}

export function normalizeFeedbackKind(value: unknown): FeedbackKind {
  if (value === "idea" || value === "feedback" || value === "bug") {
    return value;
  }
  return "feedback";
}

const MODULE_IDS: ReadonlySet<string> = new Set(ALL_MODULE_IDS);

/** Client-supplied metadata. Only an exact canonical module id is echoed into
 * the mail; anything else (other types, unknown ids, text with line breaks)
 * becomes "onbekend" so it cannot add or forge metadata lines. */
export function normalizeFeedbackModule(value: unknown): string {
  return typeof value === "string" && MODULE_IDS.has(value) ? value : "onbekend";
}

export function feedbackKindLabel(kind: FeedbackKind) {
  return kindLabels[kind];
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
