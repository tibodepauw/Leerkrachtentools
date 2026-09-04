import { NextResponse, type NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth/service";
import {
  assertRequestRateLimit,
  RequestRateLimitError,
} from "@/lib/http/rateLimit";

const PUBLIC_API_PATHS = new Set([
  "/api/auth/request-code",
  "/api/auth/verify-code",
  "/api/auth/logout",
]);
const RAG_API_PATHS = new Set([
  "/api/rag-curriculum",
  "/api/rag-minimum-goals",
]);
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
const RATE_WINDOW_MS = 15 * 60 * 1000;

function isPublicPath(pathname: string) {
  if (pathname === "/" || pathname === "/privacy") return true;
  if (pathname.startsWith("/wordmark-export")) return true;
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.(?:html|ico|png|jpg|svg|txt|xml|woff2?)$/i.test(pathname)) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    if (pathname.startsWith("/api/")) {
      try {
        assertRequestRateLimit({
          scope: "api",
          subject: session.id,
          limit: 300,
          windowMs: RATE_WINDOW_MS,
        });
        if (RAG_API_PATHS.has(pathname)) {
          assertRequestRateLimit({
            scope: "rag",
            subject: session.id,
            limit: 60,
            windowMs: RATE_WINDOW_MS,
          });
        }
        if (DOCUMENT_API_PATHS.has(pathname)) {
          assertRequestRateLimit({
            scope: "document",
            subject: session.id,
            limit: 20,
            windowMs: RATE_WINDOW_MS,
          });
        }
        if (AI_API_PATHS.has(pathname)) {
          assertRequestRateLimit({
            scope: "ai",
            subject: session.id,
            limit: 60,
            windowMs: RATE_WINDOW_MS,
          });
        }
      } catch (error) {
        if (error instanceof RequestRateLimitError) {
          return NextResponse.json(
            { error: error.message },
            {
              status: 429,
              headers: {
                "Cache-Control": "no-store",
                "Retry-After": "900",
              },
            },
          );
        }
        throw error;
      }
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Je sessie is verlopen. Log opnieuw in." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/settings/:path*", "/dev/:path*", "/api/:path*"],
};
