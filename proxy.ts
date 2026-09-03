import { NextResponse, type NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth/service";

const PUBLIC_API_PATHS = new Set([
  "/api/auth/request-code",
  "/api/auth/verify-code",
  "/api/auth/logout",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_API_PATHS.has(pathname)) {
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
