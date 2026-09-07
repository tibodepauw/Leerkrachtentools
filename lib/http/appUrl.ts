export function appOriginFromEnv(): string | null {
  const configured = process.env.APP_ORIGIN?.trim();
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

export function absoluteAppUrl(pathname: string): string {
  const origin = appOriginFromEnv() ?? "https://app.invalid";
  return new URL(pathname, origin).href;
}
