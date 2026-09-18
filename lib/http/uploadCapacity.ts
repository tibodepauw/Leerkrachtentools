import "server-only";
import { RequestRateLimitError } from "@/lib/http/rateLimit";

const state = globalThis as typeof globalThis & { uploadUsers?: Set<string> };

// One app instance per VM. Hold the slot across body reading, decoding and
// persistence; checking only after buffering does not bound upload memory.
export async function withUploadCapacity<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const users = state.uploadUsers ??= new Set<string>();
  if (users.has(userId) || users.size >= 4) {
    throw new RequestRateLimitError("Er lopen al meerdere uploads. Probeer het zo opnieuw.");
  }
  users.add(userId);
  try { return await task(); }
  finally { users.delete(userId); }
}
