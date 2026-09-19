/** Never serialize exception messages, stacks, causes, requests or arbitrary metadata. */
export function safeErrorDetails(error: unknown) {
  const names = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "AbortError", "TimeoutError", "SqliteError", "ZodError"]);
  const codes = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EACCES", "ENOENT", "SQLITE_BUSY", "SQLITE_FULL", "SQLITE_CONSTRAINT"]);
  try {
    const e = error as { name?: unknown; code?: unknown; status?: unknown; statusCode?: unknown } | null;
    const status = e?.statusCode ?? e?.status;
    return {
      type: typeof e?.name === "string" && names.has(e.name) ? e.name : "UnknownError",
      ...(typeof e?.code === "string" && codes.has(e.code) ? { code: e.code } : {}),
      ...(typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599 ? { status } : {}),
    };
  } catch { return { type: "UnknownError" }; }
}

/** Call sites pass fixed operation labels; never pass user-controlled text as scope. */
export function logSafeError(scope: string, error: unknown) {
  console.error(scope, safeErrorDetails(error));
}
