/** Public result cap, independent of the larger internal retrieval candidate pool. */
export const MAX_PUBLIC_GOAL_MATCHES = 5;

export function limitGoalMatches<T>(payload: T, limit = MAX_PUBLIC_GOAL_MATCHES): T {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const count = Number.isInteger(limit) ? Math.max(1, Math.min(limit, MAX_PUBLIC_GOAL_MATCHES)) : MAX_PUBLIC_GOAL_MATCHES;
  const value = { ...payload } as Record<string, unknown>;
  if (Array.isArray(value.results)) value.results = value.results.slice(0, count);
  if (Array.isArray(value.alternatives)) value.alternatives = value.alternatives.slice(0, count - 1);
  if (value.data && typeof value.data === "object") value.data = limitGoalMatches(value.data, count);
  return value as T;
}

export function limitCachedMatchResponse(body: string, limit = MAX_PUBLIC_GOAL_MATCHES) {
  try { return JSON.stringify(limitGoalMatches(JSON.parse(body), limit)); }
  catch { return JSON.stringify({ error: "Het opgeslagen antwoord is niet beschikbaar." }); }
}
