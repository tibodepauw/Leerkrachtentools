import type { NextConfig } from "next";
import { execFileSync, execSync } from "node:child_process";
import packageJson from "./package.json";
import { GENERATIVE_LABS_LEGAL } from "./lib/legal/generativeLabs";

function resolveGitCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

function resolveGitHubRepo() {
  if (process.env.NEXT_PUBLIC_GITHUB_REPO) {
    return process.env.NEXT_PUBLIC_GITHUB_REPO;
  }
  for (const name of ["github", "origin"]) {
    try {
      const remote = execFileSync("git", ["remote", "get-url", name], {
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
      if (match) return `https://github.com/${match[1]}`;
    } catch { /* try the next configured remote */ }
  }
  return "";
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Child processes resolve parsers with Node rather than Turbopack module IDs.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/{mammoth,jszip,sharp,zod,ai,@ai-sdk/*,better-sqlite3}/**/*",
      "./node_modules/{pdf-parse,pdfjs-dist,word-extractor,saxes,xmlchars,yauzl,fd-slicer,pend,buffer-crc32}/**/*",
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
  },
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_APP_COMMIT: resolveGitCommit(),
    NEXT_PUBLIC_GITHUB_REPO: resolveGitHubRepo(),
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.cursor.sh",
    "*.cursor.com",
    "*.cursorusercontent.com",
  ],
  devIndicators: false,
  serverExternalPackages: [
    "better-sqlite3",
    "pdf-parse",
    "word-extractor",
    "@google-cloud/discoveryengine",
    "google-gax",
    "@grpc/grpc-js",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/privacy",
        destination: GENERATIVE_LABS_LEGAL.privacy,
        permanent: true,
      },
      {
        source: "/voorwaarden",
        destination: GENERATIVE_LABS_LEGAL.terms,
        permanent: true,
      },
      {
        source: "/juridisch",
        destination: GENERATIVE_LABS_LEGAL.imprint,
        permanent: true,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "origin-when-cross-origin" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(self), geolocation=()",
      },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
    ];

    return [
      {
        source: "/sw.js",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
