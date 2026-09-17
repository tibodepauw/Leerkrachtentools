#!/usr/bin/env node
import {
  API_KEY_SCOPES,
  createOrganization,
  generateApiKey,
  inspectOrganization,
  revokeApiKey,
  rotateApiKey,
  normalizeApiKeyScopes,
  apiKeyExpiry,
} from "../lib/api-keys";

function printHelp() {
  process.stdout.write(`Beheer B2B API-organisaties en sleutels.

Aanmaken:
  npx tsx scripts/manage-api-keys.ts create --org "Uitgeverij die Keure" --email "redactie@diekeure.be" --tier enterprise --quota 50000 --scopes "curriculum:match,curriculum:audit,goals:improve"

Intrekken:
  npx tsx scripts/manage-api-keys.ts revoke --key-id <id>

Uitgeven aan bestaande organisatie (verplicht beperkte scopes; standaard 90 dagen):
  npm run manage-api-keys -- issue --org-id <id> --name productie --scopes curriculum:match --days 90

Roteren (oude sleutel direct ingetrokken, gedeeld budget blijft behouden):
  npm run manage-api-keys -- rotate --key-id <id> --days 90

Inspecteren:
  npx tsx scripts/manage-api-keys.ts inspect --org-id <id>

Scopes: ${API_KEY_SCOPES.join(", ")}
`);
}

function readFlag(args: string[], name: string) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function requireFlag(args: string[], name: string) {
  const value = readFlag(args, name)?.trim();
  if (!value) {
    throw new Error(`Ontbrekende vlag --${name}`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "create") {
    const scopes = normalizeApiKeyScopes(requireFlag(args, "scopes").split(","));
    const days = Number(readFlag(args, "days") ?? "90");
    apiKeyExpiry(days);
    const organization = createOrganization({
      name: requireFlag(args, "org"),
      email: requireFlag(args, "email"),
      tier: requireFlag(args, "tier"),
      quota: Number.parseInt(readFlag(args, "quota") ?? "10000", 10),
    });
    const key = generateApiKey(
      organization.id,
      readFlag(args, "name") ?? "default",
      scopes,
      days,
    );
    process.stdout.write(
      [
        `Organisatie: ${organization.name} (${organization.id})`,
        `Tier: ${organization.tier}`,
        `Quota: ${organization.monthly_quota}/maand`,
        `Sleutel-id: ${key.id}`,
        `Scopes: ${key.scopes.join(", ")}`,
        `Vervalt: ${new Date(key.expiresAt).toISOString()}`,
        "",
        "Bewaar deze plaintext sleutel. Hij wordt niet opnieuw getoond:",
        key.token,
        "",
      ].join("\n"),
    );
    return;
  }

  if (command === "revoke") {
    const keyId = requireFlag(args, "key-id");
    revokeApiKey(keyId);
    process.stdout.write(`Sleutel ${keyId} is ingetrokken.\n`);
    return;
  }

  if (command === "issue" || command === "rotate") {
    const days = Number(readFlag(args, "days") ?? "90");
    const key = command === "rotate"
      ? rotateApiKey(requireFlag(args, "key-id"), days)
      : generateApiKey(requireFlag(args, "org-id"), requireFlag(args, "name"), requireFlag(args, "scopes").split(","), days);
    process.stdout.write(`Sleutel-id: ${key.id}\nVervalt: ${new Date(key.expiresAt).toISOString()}\nBewaar deze sleutel nu; hij wordt niet opnieuw getoond:\n${key.token}\n`);
    return;
  }

  if (command === "inspect") {
    const report = inspectOrganization(requireFlag(args, "org-id"));
    process.stdout.write(
      [
        `Organisatie: ${report.organization.name} (${report.organization.id})`,
        `Contact: ${report.organization.contact_email}`,
        `Tier: ${report.organization.tier}`,
        `Quota: ${report.organization.monthly_quota}/maand`,
        `Reset: ${new Date(report.resetAt).toISOString()}`,
        "",
        ...report.keys.flatMap((key) => [
          `- ${key.name} (${key.id})`,
          `  actief: ${key.isActive ? "ja" : "nee"}`,
          `  vervalt: ${key.expiresAt ? new Date(key.expiresAt).toISOString() : "geen vervaldatum (oude sleutel; roteer)"}`,
          `  scopes: ${key.scopes.join(", ")}`,
          `  gebruikt deze maand: ${key.usedThisMonth}`,
          `  laatst gebruikt: ${key.lastUsedAt ? new Date(key.lastUsedAt).toISOString() : "-"}`,
        ]),
        "",
      ].join("\n"),
    );
    return;
  }

  throw new Error(`Onbekend commando: ${command}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
