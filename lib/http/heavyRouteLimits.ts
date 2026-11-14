/**
 * Extra limieten bovenop de algemene API-limiet, per gebruiker per kwartier.
 * Zuivere functie zodat de proxy en de regressietest dezelfde tabel gebruiken.
 */
export type RouteLimit = { scope: string; limit: number };

const RAG_API_PATHS = new Set(["/api/rag-curriculum", "/api/rag-minimum-goals"]);
const DOCUMENT_API_PATHS = new Set([
  "/api/import-lesson-document",
  "/api/export-lesson-document",
  "/api/extract-manual",
  "/api/transcribe-reflection",
]);
const AI_API_PATHS = new Set([
  "/api/analyze-goals",
  "/api/classify-goal-taxonomy",
  "/api/format-dialogue",
  "/api/spellcheck",
  "/api/audit-timing",
  "/api/audit-alignment",
  "/api/audit-engagement",
  "/api/full-audit",
  "/api/extract-manual",
  "/api/transcribe-reflection",
]);
const AVATAR_API_PATH = "/api/account/avatar";

export function heavyRouteLimits(pathname: string, method: string): RouteLimit[] {
  const limits: RouteLimit[] = [];
  if (RAG_API_PATHS.has(pathname)) limits.push({ scope: "rag", limit: 60 });
  if (DOCUMENT_API_PATHS.has(pathname)) limits.push({ scope: "document", limit: 20 });
  if (AI_API_PATHS.has(pathname)) limits.push({ scope: "ai", limit: 60 });
  // Alleen uploaden start een beeldworker. De profielfoto wordt bij elke
  // paginaweergave met GET opgehaald en mag dit budget niet verbruiken, en
  // avatars mogen het documentbudget van dezelfde gebruiker niet opmaken.
  if (pathname === AVATAR_API_PATH && method.toUpperCase() === "POST") {
    limits.push({ scope: "avatar", limit: 10 });
  }
  return limits;
}
