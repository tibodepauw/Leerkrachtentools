import { NextResponse, type NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth/service";
import {
  assertRequestRateLimit,
  RequestRateLimitError,
} from "@/lib/http/rateLimit";
import {
  contentSecurityPolicy,
  isSameOriginMutation,
} from "@/lib/http/security";

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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV !== "production",
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const secure = <T extends NextResponse>(response: T): T => {
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Frame-Options", "DENY");
    return response;
  };
  const next = () =>
    secure(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
    );

  if (!isSameOriginMutation(request)) {
    return secure(
      NextResponse.json(
        { error: "Aanvraag van een andere website geweigerd." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  if (isPublicPath(pathname)) {
    return next();
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
          return secure(
            NextResponse.json(
              { error: error.message },
              {
                status: 429,
                headers: {
                  "Cache-Control": "no-store",
                  "Retry-After": "900",
                },
              },
            ),
          );
        }
        console.error("[proxy]", error);
        return secure(
          NextResponse.json(
            {
              error:
                "De server kon de aanvraag niet verwerken. Probeer het opnieuw.",
            },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          ),
        );
      }
    }
    return next();
  }

  if (pathname.startsWith("/api/")) {
    return secure(
      NextResponse.json(
        { error: "Je sessie is verlopen. Log opnieuw in." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/";
  loginUrl.search = "";
  return secure(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$).*)",
  ],
};
