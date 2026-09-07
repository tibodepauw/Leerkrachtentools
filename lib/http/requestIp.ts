export type ClientIpSource = "vercel" | "trusted-proxy" | "unavailable";

export type ClientIpResolution = {
  address: string;
  trusted: boolean;
  source: ClientIpSource;
};

function firstHop(value: string | null) {
  if (!value) return "";
  return (
    value
      .split(",")
      .map((part) => part.trim())
      .find(Boolean) ?? ""
  );
}

/**
 * Client IP for rate limits. Headers are only used when this process sits
 * behind a proxy that overwrites them (Vercel, or TRUST_PROXY_IP_HEADERS=true).
 * Missing or untrusted IP is `unavailable`, never a shared "unknown" visitor bucket.
 */
export function resolveClientIp(request: Request): ClientIpResolution {
  if (process.env.VERCEL === "1") {
    const vercel = firstHop(request.headers.get("x-vercel-forwarded-for"));
    if (vercel) {
      return { address: vercel, trusted: true, source: "vercel" };
    }
    const forwarded = firstHop(request.headers.get("x-forwarded-for"));
    if (forwarded) {
      return { address: forwarded, trusted: true, source: "vercel" };
    }
    return { address: "unavailable", trusted: false, source: "unavailable" };
  }

  if (process.env.TRUST_PROXY_IP_HEADERS === "true") {
    const forwarded = firstHop(request.headers.get("x-forwarded-for"));
    if (forwarded) {
      return { address: forwarded, trusted: true, source: "trusted-proxy" };
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return { address: realIp, trusted: true, source: "trusted-proxy" };
    }
    return { address: "unavailable", trusted: false, source: "unavailable" };
  }

  return { address: "unavailable", trusted: false, source: "unavailable" };
}

export function clientIpFromRequest(request: Request): string {
  return resolveClientIp(request).address;
}
