import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiAuthError,
  hasLiveApiKeyAuthorization,
  logApiUsage,
  validateApiKey,
  type ValidatedApiKey,
} from "@/lib/api-keys";
import {
  publicErrorMessage,
} from "@/lib/http/clientError";
import {
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/lib/http/requestBody";

const JSON_BODY_LIMIT_BYTES = 64_000;

export type ApiAuthContext = ValidatedApiKey & {
  body: unknown;
  endpoint: string;
};

function jsonError(
  message: string,
  status: number,
  extraHeaders?: HeadersInit,
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    },
  );
}

function parseBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return match?.[1] ?? "";
}

function rateLimitHeaders(auth: ValidatedApiKey | null, remainingOverride?: number) {
  if (!auth) return {};
  const remaining =
    remainingOverride ??
    Math.max(0, auth.monthlyQuota - auth.usedThisMonth);
  return {
    "X-RateLimit-Limit": String(auth.monthlyQuota),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.floor(auth.resetAt / 1000)),
  };
}

function withRateLimitHeaders(
  response: Response,
  auth: ValidatedApiKey | null,
  remainingOverride?: number,
) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", headers.get("Cache-Control") ?? "no-store");
  for (const [key, value] of Object.entries(
    rateLimitHeaders(auth, remainingOverride),
  )) {
    headers.set(key, value);
  }
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withApiAuth(
  handler: (request: Request, context: ApiAuthContext) => Promise<Response>,
  { requiredScope }: { requiredScope: string },
) {
  return async function POST(request: Request) {
    const started = Date.now();
    const endpoint = new URL(request.url).pathname;
    let auth: ValidatedApiKey | null = null;
    let statusCode = 500;
    let remainingAfter: number | undefined;

    try {
      if (!hasLiveApiKeyAuthorization(request)) {
        throw new ApiAuthError("Ongeldige API-sleutel.", 401);
      }

      auth = validateApiKey(parseBearerToken(request), requiredScope);

      let body: unknown;
      try {
        body = await readJsonBody(request, JSON_BODY_LIMIT_BYTES);
      } catch (error) {
        if (error instanceof RequestBodyTooLargeError) {
          throw error;
        }
        statusCode = 400;
        const response = jsonError("Ongeldige JSON in de aanvraag.", 400);
        return withRateLimitHeaders(response, auth);
      }

      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        statusCode = 400;
        return withRateLimitHeaders(
          jsonError("Ongeldige JSON in de aanvraag.", 400),
          auth,
        );
      }

      const response = await handler(request, {
        ...auth,
        body,
        endpoint,
      });
      statusCode = response.status;
      remainingAfter = Math.max(0, auth.monthlyQuota - (auth.usedThisMonth + 1));
      return withRateLimitHeaders(response, auth, remainingAfter);
    } catch (error) {
      if (error instanceof ApiAuthError) {
        statusCode = error.status;
        if (error.keyId && !auth) {
          auth = {
            keyId: error.keyId,
            orgId: "quota",
            orgName: "",
            keyName: "",
            scopes: [],
            monthlyQuota: error.monthlyQuota ?? 0,
            usedThisMonth: error.usedThisMonth ?? 0,
            resetAt: error.resetAt ?? Date.now(),
          };
        }
        const retryHeaders =
          error.status === 429 && error.retryAfterSeconds
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : undefined;
        remainingAfter =
          error.status === 429
            ? 0
            : auth
              ? Math.max(0, auth.monthlyQuota - auth.usedThisMonth)
              : undefined;
        return withRateLimitHeaders(
          jsonError(error.message, error.status, retryHeaders),
          auth,
          remainingAfter,
        );
      }
      if (error instanceof RequestBodyTooLargeError || error instanceof z.ZodError) {
        statusCode = 400;
        return withRateLimitHeaders(
          jsonError(
            publicErrorMessage(error, "De aanvraag is ongeldig."),
            400,
          ),
          auth,
        );
      }
      console.error("[api-guard]", error);
      statusCode = 500;
      return withRateLimitHeaders(
        jsonError(
          "De server kon de aanvraag niet verwerken. Probeer het opnieuw.",
          500,
        ),
        auth,
      );
    } finally {
      if (auth?.keyId) {
        try {
          logApiUsage({
            keyId: auth.keyId,
            endpoint,
            statusCode,
            durationMs: Date.now() - started,
          });
        } catch (error) {
          console.error("[api-guard] usage log", error);
        }
      }
    }
  };
}
