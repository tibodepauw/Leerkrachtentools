import "server-only";

const DEFAULT_RECIPIENT = "tibo.depauw06@gmail.com";

export type FeedbackKind = "idea" | "feedback" | "bug";

const kindLabels: Record<FeedbackKind, string> = {
  idea: "Idee",
  feedback: "Feedback",
  bug: "Bug / probleem",
};

export function feedbackRecipientEmail() {
  return process.env.FEEDBACK_TO_EMAIL?.trim() || DEFAULT_RECIPIENT;
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
