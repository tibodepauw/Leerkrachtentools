import { NextResponse, type NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth/service";

const PUBLIC_API_PATHS = new Set([
  "/api/auth/request-code",
  "/api/auth/verify-code",
  "/api/auth/logout",
]);

function isPublicPath(pathname: string) {
  if (pathname === "/" || pathname === "/privacy") return true;
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
  if (session) return NextResponse.next();

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

export const proxyConfig = {
  matcher: ["/settings/:path*", "/dev/:path*", "/api/:path*"],
  runtime: "nodejs",
};
