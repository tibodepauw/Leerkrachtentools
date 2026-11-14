import "server-only";

import { parseSenderAddress } from "@/lib/email/sender";
import { externalApiAbortSignal } from "@/lib/http/externalTimeout";
import { reserveEmailSend, type EmailBudgetClass } from "@/lib/ai/externalBudget";
import { normalizeEmail } from "@/lib/auth/normalizeEmail";
import { getDatabase } from "@/lib/db/sqlite";
import { EmailBudgetExhaustedError } from "@/lib/email/errors";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/** What the caller is sending. Only "login" can reach the budget share kept
 * for existing accounts, and only after the recipient is confirmed below.
 * Omitted means "other": never privileged. */
export type BrevoMailClass = "login" | "feedback" | "other";

/** The caller's claim alone is not enough: the recipient must own an account.
 * Feedback goes to the operator mailbox and stays general even when that
 * mailbox happens to be an account address. */
function emailBudgetClass(mailClass: BrevoMailClass, to: string): EmailBudgetClass {
  if (mailClass !== "login") return "general";
  const account = getDatabase()
    .prepare("SELECT 1 FROM users WHERE email = ?")
    .get(normalizeEmail(to));
  return account ? "account-login" : "general";
}

export async function sendBrevoEmail({
  to,
  subject,
  text,
  html,
  mailClass = "other",
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  mailClass?: BrevoMailClass;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Brevo is nog niet geconfigureerd.");
  }

  const sender = parseSenderAddress(from);
  if (!reserveEmailSend(emailBudgetClass(mailClass, to))) {
    throw new EmailBudgetExhaustedError();
  }
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    redirect: "error",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: externalApiAbortSignal(),
  });

  // Delivery status is sufficient. Never buffer or echo provider error bodies.
  if (response.body) void response.body.cancel().catch(() => {});
  if (!response.ok) throw new Error(`Brevo HTTP ${response.status}`);
}

export function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL);
}
