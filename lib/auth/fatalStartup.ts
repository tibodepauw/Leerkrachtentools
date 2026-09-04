export function terminateInvalidProductionStartup(error: unknown): never {
  console.error("Fatale fout in de productieconfiguratie.", error);
  process.exit(1);
}
