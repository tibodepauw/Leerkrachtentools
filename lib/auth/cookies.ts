type SessionCookieLifetime =
  | { expires: Date; maxAge?: never }
  | { maxAge: number; expires?: never };

export function getSessionCookieOptions(lifetime: SessionCookieLifetime) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...lifetime,
  };
}

export function safeDecodeURIComponent(value: string | undefined) {
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function readCookieValue(cookieHeader: string, name: string) {
  const encoded = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

  return safeDecodeURIComponent(encoded);
}
