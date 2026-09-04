export function clientIpFromRequest(request: Request): string {
  const trustProxyHeaders =
    process.env.VERCEL === "1" ||
    process.env.TRUST_PROXY_IP_HEADERS === "true";
  if (!trustProxyHeaders) return "unknown";

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const trusted = parts[0];
    if (trusted) {
      return trusted;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
