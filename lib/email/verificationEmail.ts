const BRAND = {
  bg: "#000000",
  card: "#0e0e11",
  cardTo: "#08080a",
  badge: "#16161a",
  border: "#2a2a2e",
  hairline: "#242428",
  text: "#f4f4f5",
  muted: "#8e8e93",
  title: "#ffffff",
  font: "Rubik, Arial, Helvetica, sans-serif",
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildVerificationEmail(code: string) {
  const digits = [...code].map((digit) => escapeHtml(digit));

  return {
    subject: `${code} is je eenmalige toegangscode`,
    text: [
      "Leerkrachtentools",
      "Eenmalige toegangscode",
      "",
      `Je verificatiecode is ${code}.`,
      "",
      "Voer deze code in op het inlogscherm. De code is 10 minuten geldig.",
      "",
      "Heb je dit niet aangevraagd? Dan kun je deze mail veilig negeren.",
    ].join("\n"),
    html: `<!DOCTYPE html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Eenmalige toegangscode</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${BRAND.bg} !important; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: ${BRAND.bg} !important; }
      .email-card { background-color: ${BRAND.card} !important; }
      .email-badge, .email-digit-cell { background-color: ${BRAND.badge} !important; border-color: ${BRAND.border} !important; }
      .email-title, .email-digit { color: ${BRAND.title} !important; }
      .email-text { color: ${BRAND.text} !important; }
      .email-muted { color: ${BRAND.muted} !important; }
    }
    [data-ogsc] .email-bg { background-color: ${BRAND.bg} !important; }
    [data-ogsc] .email-card { background-color: ${BRAND.card} !important; }
    [data-ogsc] .email-badge, [data-ogsc] .email-digit-cell { background-color: ${BRAND.badge} !important; }
    [data-ogsc] .email-title, [data-ogsc] .email-digit { color: ${BRAND.title} !important; }
    [data-ogsc] .email-text { color: ${BRAND.text} !important; }
    [data-ogsc] .email-muted { color: ${BRAND.muted} !important; }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:${BRAND.bg};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    Eenmalige toegangscode voor Leerkrachtentools. 10 minuten geldig.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-bg" bgcolor="${BRAND.bg}" style="background-color:${BRAND.bg};margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;width:100%;">
          <tr>
            <td class="email-card" bgcolor="${BRAND.card}" style="background-color:${BRAND.card};background-image:linear-gradient(180deg, ${BRAND.card} 0%, ${BRAND.cardTo} 100%);border:1px solid ${BRAND.border};border-radius:20px;padding:36px 28px 28px;">
              <p class="email-muted" style="margin:0 0 18px;font-family:${BRAND.font};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.muted};">
                Leerkrachtentools
              </p>
              <h1 class="email-title" style="margin:0 0 10px;font-family:${BRAND.font};font-size:26px;font-weight:900;letter-spacing:-0.04em;line-height:1.2;color:${BRAND.title};">
                Eenmalige toegangscode
              </h1>
              <p class="email-text" style="margin:0 0 28px;font-family:${BRAND.font};font-size:16px;line-height:1.6;color:${BRAND.text};">
                Gebruik deze code om in te loggen. Typ de zes cijfers over op je telefoon of computer.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" class="email-badge" bgcolor="${BRAND.badge}" style="background-color:${BRAND.badge};border:1px solid ${BRAND.border};border-radius:16px;">
                <tr>
                  <td style="padding:18px 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%">
                      <tr>
                        ${digits
                          .map(
                            (digit, index) => `
                        <td align="center" width="16%" style="padding:${index === 0 ? "0 3px 0 0" : index === digits.length - 1 ? "0 0 0 3px" : "0 3px"};">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td class="email-digit-cell" align="center" bgcolor="${BRAND.card}" style="background-color:${BRAND.card};border:1px solid ${BRAND.hairline};border-radius:12px;height:56px;font-family:${BRAND.font};font-size:28px;font-weight:700;letter-spacing:0.08em;line-height:56px;color:${BRAND.title};">
                                <span class="email-digit" style="color:${BRAND.title};">${digit}</span>
                              </td>
                            </tr>
                          </table>
                        </td>`,
                          )
                          .join("")}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p class="email-muted" style="margin:22px 0 0;font-family:${BRAND.font};font-size:14px;line-height:1.6;color:${BRAND.muted};">
                Deze code is 10 minuten geldig.
              </p>
              <p class="email-muted" style="margin:18px 0 0;padding-top:18px;border-top:1px solid ${BRAND.border};font-family:${BRAND.font};font-size:13px;line-height:1.6;color:${BRAND.muted};">
                Heb je dit niet aangevraagd? Dan kun je deze mail veilig negeren.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
