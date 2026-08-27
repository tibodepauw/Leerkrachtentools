import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

// Strict CSP only in production. In development Next/Turbopack needs eval +
// websockets; a tight CSP previously left the SSR HTML visible while React
// never hydrated — clicks did nothing.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  // Cursor previews / tunnels often hit the dev server from non-localhost hosts.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.cursor.sh",
    "*.cursor.com",
    "*.cursorusercontent.com",
  ],
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), geolocation=(), microphone=(self)",
      },
    ];

    if (!isDevelopment) {
      securityHeaders.push(
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
      );
    }

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
