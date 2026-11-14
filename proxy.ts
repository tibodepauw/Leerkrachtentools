import { logSafeError } from "@/lib/security/safeLog";
import { NextResponse, type NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth/service";
import {
  assertRequestRateLimit,
  RequestRateLimitError,
} from "@/lib/http/rateLimit";
import {
  hasLiveApiKeyAuthorization,
  isB2bApiPath,
} from "@/lib/api-keys";
import {
  contentSecurityPolicy,
  isSameOriginMutation,
} from "@/lib/http/security";
import { heavyRouteLimits } from "@/lib/http/heavyRouteLimits";

const PUBLIC_API_PATHS = new Set([
  "/api/auth/request-code",
  "/api/auth/verify-code",
  "/api/auth/logout",
]);
const RATE_WINDOW_MS = 15 * 60 * 1000;

function isPublicPath(pathname: string) {
  if (pathname === "/" || pathname === "/privacy" || pathname === "/voorwaarden" || pathname === "/juridisch" || pathname === "/offline") {
    return true;
  }
  if (pathname.startsWith("/wordmark-export")) return true;
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/sw.js" || pathname === "/manifest.webmanifest") return true;
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

  const b2bApi =
    isB2bApiPath(pathname) && hasLiveApiKeyAuthorization(request);

  // Cookie-CSRF blijft ongewijzigd. Alleen /api/v1 met Bearer lt_live_ mag
  // cross-origin, zodat uitgeverijen server-to-server kunnen koppelen.
  if (!b2bApi && !isSameOriginMutation(request)) {
    return secure(
      NextResponse.json(
        { error: "Aanvraag van een andere website geweigerd." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  if (isPublicPath(pathname) || b2bApi) {
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
        for (const { scope, limit } of heavyRouteLimits(pathname, request.method)) {
          assertRequestRateLimit({
            scope,
            subject: session.id,
            limit,
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
        logSafeError("[proxy]", error);
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
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$).*)",
  ],
};
