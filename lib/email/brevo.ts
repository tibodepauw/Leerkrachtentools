import "server-only";

import { parseSenderAddress } from "@/lib/email/sender";
import { externalApiAbortSignal } from "@/lib/http/externalTimeout";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendBrevoEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Brevo is nog niet geconfigureerd.");
  }

  const sender = parseSenderAddress(from);
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
