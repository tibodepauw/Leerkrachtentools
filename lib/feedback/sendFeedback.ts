import "server-only";

import { isBrevoConfigured, sendBrevoEmail } from "@/lib/email/brevo";
import {
  escapeHtml,
  feedbackKindLabel,
  feedbackRecipientEmail,
  normalizeFeedbackKind,
  normalizeFeedbackMessage,
} from "@/lib/feedback/feedback";

export async function sendFeedbackEmail({
  fromEmail,
  kind,
  message,
  activeModule,
}: {
  fromEmail: string;
  kind?: unknown;
  message: string;
  activeModule?: string;
}) {
  if (!isBrevoConfigured()) {
    throw new Error(
      "Feedback versturen is nog niet beschikbaar. Brevo is niet geconfigureerd.",
    );
  }

  const normalizedMessage = normalizeFeedbackMessage(message);
  const normalizedKind = normalizeFeedbackKind(kind);
  const recipient = feedbackRecipientEmail();
  const kindLabel = feedbackKindLabel(normalizedKind);
  const moduleLine = activeModule?.trim()
    ? `Actieve module: ${activeModule.trim()}`
    : "Actieve module: onbekend";

  const text = [
    `Nieuwe ${kindLabel.toLowerCase()} via Leerkrachtentools`,
    "",
    `Van: ${fromEmail}`,
    moduleLine,
    "",
    normalizedMessage,
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;line-height:1.5">
    <h1 style="font-size:18px;margin:0 0 12px">Nieuwe ${escapeHtml(kindLabel.toLowerCase())}</h1>
    <p style="margin:0 0 8px"><strong>Van:</strong> ${escapeHtml(fromEmail)}</p>
    <p style="margin:0 0 16px"><strong>${escapeHtml(moduleLine)}</strong></p>
    <div style="white-space:pre-wrap;border:1px solid #ddd;border-radius:8px;padding:12px">${escapeHtml(normalizedMessage)}</div>
  </div>`;

  await sendBrevoEmail({
    to: recipient,
    subject: `[Leerkrachtentools] ${kindLabel} van ${fromEmail}`,
    text,
    html,
  });

  return { recipient };
}
