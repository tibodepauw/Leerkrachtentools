import "server-only";

import { parseSenderAddress } from "@/lib/email/sender";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface BrevoErrorResponse {
  message?: string;
  code?: string;
}

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
  });

  if (!response.ok) {
    let message = `Brevo HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as BrevoErrorResponse;
      if (payload.message) message = `Brevo: ${payload.message}`;
    } catch {
      // Keep generic HTTP message when Brevo returns non-JSON.
    }
    throw new Error(message);
  }
}

export function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL);
}
