#!/usr/bin/env node
import {
  API_KEY_SCOPES,
  createOrganization,
  generateApiKey,
  inspectOrganization,
  revokeApiKey,
} from "../lib/api-keys";

function printHelp() {
  process.stdout.write(`Beheer B2B API-organisaties en sleutels.

Aanmaken:
  npx tsx scripts/manage-api-keys.ts create --org "Uitgeverij die Keure" --email "redactie@diekeure.be" --tier enterprise --quota 50000 --scopes "curriculum:match,curriculum:audit,goals:improve"

Intrekken:
  npx tsx scripts/manage-api-keys.ts revoke --key-id <id>

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
    const organization = createOrganization({
      name: requireFlag(args, "org"),
      email: requireFlag(args, "email"),
      tier: requireFlag(args, "tier"),
      quota: Number.parseInt(readFlag(args, "quota") ?? "10000", 10),
    });
    const scopes = (readFlag(args, "scopes") ?? API_KEY_SCOPES.join(","))
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
    const key = generateApiKey(
      organization.id,
      readFlag(args, "name") ?? "default",
      scopes,
    );
    process.stdout.write(
      [
        `Organisatie: ${organization.name} (${organization.id})`,
        `Tier: ${organization.tier}`,
        `Quota: ${organization.monthly_quota}/maand`,
        `Sleutel-id: ${key.id}`,
        `Scopes: ${key.scopes.join(", ")}`,
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
