// One bounded request per process. stdout is protocol-only; do not log inputs.
export async function readJob(maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("input limit");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function writeJob(result: unknown, maxBytes: number) {
  const json = JSON.stringify(result);
  if (Buffer.byteLength(json) > maxBytes) throw new Error("output limit");
  process.stdout.write(json, () => process.exit(0));
}
