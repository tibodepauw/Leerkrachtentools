import { appOriginFromEnv } from "@/lib/http/appUrl";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function isDevLoginCodeAllowed(requestUrl: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.ALLOW_DEV_LOGIN_CODE !== "true") {
    return false;
  }

  let hostname = "";
  try {
    hostname = new URL(requestUrl).hostname;
  } catch {
    return false;
  }

  const configuredOrigin = appOriginFromEnv();
  if (configuredOrigin) {
    try {
      if (hostname === new URL(configuredOrigin).hostname) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return LOOPBACK_HOSTS.has(hostname);
}
