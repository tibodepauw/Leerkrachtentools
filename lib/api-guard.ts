import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeOrgApiCall,
  noteOrgDenial,
  ORG_API_MAX_EXECUTION_MS,
  reserveOrgApiCall,
  type OrgQuotaDenied,
} from "@/lib/api/orgQuota";
import {
  ApiAuthError,
  hasLiveApiKeyAuthorization,
  logApiUsage,
  validateApiKey,
  type ValidatedApiKey,
} from "@/lib/api-keys";
import { publicErrorMessage } from "@/lib/http/clientError";
import {
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/lib/http/requestBody";
import { recordSecurityEvent } from "@/lib/security/events";

const JSON_BODY_LIMIT_BYTES = 64_000;

export type ApiAuthContext = ValidatedApiKey & {
  body: unknown;
  endpoint: string;
  requestId: string;
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
  requestId?: string,
) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", headers.get("Cache-Control") ?? "no-store");
  if (requestId) headers.set("X-Request-Id", requestId);
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

function denialKind(reason: OrgQuotaDenied["reason"] | "scope" | "validation") {
  if (reason === "quota") return "api_quota_denied" as const;
  if (reason === "burst") return "api_burst_denied" as const;
  if (reason === "scope") return "api_scope_denied" as const;
  return "api_denied" as const;
}

function quotaDenialMessage(reason: OrgQuotaDenied["reason"]) {
  if (reason === "quota") return "Maandelijks API-quota is bereikt.";
  if (reason === "burst") {
    return "Te veel aanvragen in een korte tijd. Probeer het zo meteen opnieuw.";
  }
  if (reason === "idempotency-pending") {
    return "Dit verzoek loopt al. Wacht tot het is afgerond.";
  }
  return "Te veel gelijktijdige aanvragen. Probeer het zo meteen opnieuw.";
}

async function recordCappedDenial({
  auth,
  requestId,
  endpoint,
  statusCode,
  reason,
  durationMs,
}: {
  auth: ValidatedApiKey;
  requestId: string;
  endpoint: string;
  statusCode: number;
  reason: OrgQuotaDenied["reason"] | "scope" | "validation";
  durationMs: number;
}) {
  const noted = noteOrgDenial(auth.orgId);
  recordSecurityEvent({
    kind: denialKind(reason),
    requestId,
    orgId: auth.orgId,
    keyId: auth.keyId,
    detail: reason,
  });
  if (!noted.shouldLog) return;
  logApiUsage({
    keyId: auth.keyId,
    endpoint,
    statusCode,
    durationMs,
    requestId,
  });
}

export function withApiAuth(
  handler: (request: Request, context: ApiAuthContext) => Promise<Response>,
  {
    requiredScope,
    bodySchema,
  }: {
    requiredScope: string;
    bodySchema?: z.ZodType;
  },
) {
  return async function POST(request: Request) {
    const started = Date.now();
    const requestId =
      request.headers.get("x-request-id")?.trim() || randomUUID();
    const endpoint = new URL(request.url).pathname;
    let auth: ValidatedApiKey | null = null;
    let reserved = false;
    let idempotencyKey: string | undefined;
    let statusCode = 500;
    let remainingAfter: number | undefined;
    let replayResponse: Response | undefined;
    let capturedBody: string | undefined;

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
        await recordCappedDenial({
          auth,
          requestId,
          endpoint,
          statusCode,
          reason: "validation",
          durationMs: Date.now() - started,
        });
        return withRateLimitHeaders(
          jsonError("Ongeldige JSON in de aanvraag.", 400),
          auth,
          undefined,
          requestId,
        );
      }

      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        statusCode = 400;
        await recordCappedDenial({
          auth,
          requestId,
          endpoint,
          statusCode,
          reason: "validation",
          durationMs: Date.now() - started,
        });
        return withRateLimitHeaders(
          jsonError("Ongeldige JSON in de aanvraag.", 400),
          auth,
          undefined,
          requestId,
        );
      }

      if (bodySchema) {
        try {
          body = bodySchema.parse(body);
        } catch (error) {
          statusCode = 400;
          await recordCappedDenial({
            auth,
            requestId,
            endpoint,
            statusCode,
            reason: "validation",
            durationMs: Date.now() - started,
          });
          return withRateLimitHeaders(
            jsonError(
              publicErrorMessage(error, "De aanvraag is ongeldig."),
              400,
            ),
            auth,
            undefined,
            requestId,
          );
        }
      }

      idempotencyKey = request.headers.get("idempotency-key")?.trim() || undefined;
      const reservation = reserveOrgApiCall({
        orgId: auth.orgId,
        monthlyLimit: auth.monthlyQuota,
        idempotencyKey,
        now: started,
      });

      if (!reservation.ok) {
        statusCode = 429;
        auth = { ...auth, usedThisMonth: reservation.consumed };
        remainingAfter = 0;
        await recordCappedDenial({
          auth,
          requestId,
          endpoint,
          statusCode,
          reason: reservation.reason,
          durationMs: Date.now() - started,
        });
        throw new ApiAuthError(quotaDenialMessage(reservation.reason), 429, {
          retryAfterSeconds: reservation.retryAfterSeconds,
          keyId: auth.keyId,
          orgId: auth.orgId,
          monthlyQuota: auth.monthlyQuota,
          usedThisMonth: reservation.consumed,
          resetAt: auth.resetAt,
        });
      }

      auth = { ...auth, usedThisMonth: reservation.consumed };
      remainingAfter = Math.max(0, auth.monthlyQuota - reservation.consumed);

      if (reservation.replay) {
        statusCode = reservation.statusCode;
        replayResponse = new NextResponse(reservation.body, {
          status: reservation.statusCode,
          headers: {
            "Content-Type": "application/json",
            "X-Idempotent-Replay": "1",
            "Cache-Control": "no-store",
          },
        });
        return withRateLimitHeaders(
          replayResponse,
          auth,
          remainingAfter,
          requestId,
        );
      }

      reserved = true;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const response = await Promise.race([
          handler(request, {
            ...auth,
            body,
            endpoint,
            requestId,
          }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(
                new ApiAuthError(
                  "De aanvraag duurde te lang. Probeer het later opnieuw.",
                  429,
                  { retryAfterSeconds: 30, orgId: auth?.orgId, keyId: auth?.keyId },
                ),
              );
            }, ORG_API_MAX_EXECUTION_MS);
          }),
        ]);
        statusCode = response.status;
        if (idempotencyKey) {
          try {
            capturedBody = await response.clone().text();
          } catch {
            capturedBody = undefined;
          }
        }
        return withRateLimitHeaders(response, auth, remainingAfter, requestId);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof ApiAuthError) {
        statusCode = error.status;
        if (error.status === 403 && auth) {
          await recordCappedDenial({
            auth,
            requestId,
            endpoint,
            statusCode,
            reason: "scope",
            durationMs: Date.now() - started,
          });
        }
        if (error.status === 403 && !auth && error.keyId && error.orgId) {
          auth = {
            keyId: error.keyId,
            orgId: error.orgId,
            orgName: "",
            keyName: "",
            scopes: [],
            monthlyQuota: error.monthlyQuota ?? 0,
            usedThisMonth: error.usedThisMonth ?? 0,
            resetAt: error.resetAt ?? Date.now(),
          };
          await recordCappedDenial({
            auth,
            requestId,
            endpoint,
            statusCode,
            reason: "scope",
            durationMs: Date.now() - started,
          });
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
          requestId,
        );
      }
      if (error instanceof RequestBodyTooLargeError || error instanceof z.ZodError) {
        statusCode = 400;
        if (auth) {
          await recordCappedDenial({
            auth,
            requestId,
            endpoint,
            statusCode,
            reason: "validation",
            durationMs: Date.now() - started,
          });
        }
        return withRateLimitHeaders(
          jsonError(
            publicErrorMessage(error, "De aanvraag is ongeldig."),
            400,
          ),
          auth,
          undefined,
          requestId,
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
        remainingAfter,
        requestId,
      );
    } finally {
      if (reserved && auth) {
        try {
          completeOrgApiCall({
            orgId: auth.orgId,
            idempotencyKey,
            statusCode,
            responseBody: capturedBody,
          });
        } catch (error) {
          console.error("[api-guard] quota complete", error);
        }
        try {
          logApiUsage({
            keyId: auth.keyId,
            endpoint,
            statusCode,
            durationMs: Date.now() - started,
            requestId,
          });
        } catch (error) {
          console.error("[api-guard] usage log", error);
        }
      }
    }
  };
}
