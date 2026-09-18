import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeOrgApiCall,
  heartbeatOrgApiCall,
  noteOrgDenial,
  orgApiExecutionLimitMs,
  reserveOrgApiCall,
  type OrgQuotaDenied,
  type OrgQuotaReservation,
} from "@/lib/api/orgQuota";
import {
  parseIdempotencyKey,
  requestFingerprint,
  utf8ByteLength,
  API_IDEMPOTENCY_BODY_MAX_BYTES,
} from "@/lib/api/idempotency";
import * as apiKeys from "@/lib/api-keys";
import {
  ApiAuthError,
  hasLiveApiKeyAuthorization,
  validateApiKey,
  type ValidatedApiKey,
} from "@/lib/api-keys";
import { publicErrorMessage } from "@/lib/http/clientError";
import {
  RequestBodyTooLargeError,
  RequestBodyTimeoutError,
  readJsonBody,
  readResponseTextBounded,
} from "@/lib/http/requestBody";
import { recordSecurityEvent } from "@/lib/security/events";

const JSON_BODY_LIMIT_BYTES = 64_000;

export type ApiAuthContext = ValidatedApiKey & {
  body: unknown;
  endpoint: string;
  requestId: string;
  signal: AbortSignal;
  leaseId?: string;
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
  if (reason === "idempotency-conflict") {
    return "Idempotency-Key is al gebruikt voor een ander verzoek.";
  }
  if (reason === "idempotency-expired") {
    return "Dit verzoek is verlopen. Gebruik een nieuwe Idempotency-Key.";
  }
  return "Te veel gelijktijdige aanvragen. Probeer het zo meteen opnieuw.";
}

function denialStatus(reason: OrgQuotaDenied["reason"]) {
  if (
    reason === "idempotency-conflict" ||
    reason === "idempotency-expired"
  ) {
    return 409;
  }
  return 429;
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
  let shouldLog = true;
  try {
    shouldLog = noteOrgDenial(auth.orgId).shouldLog;
  } catch (error) {
    console.error("[api-guard] denial ledger", error);
  }
  try {
    recordSecurityEvent({
      kind: denialKind(reason),
      requestId,
      orgId: auth.orgId,
      keyId: auth.keyId,
      detail: reason,
    });
  } catch (error) {
    console.error("[api-guard] security event", error);
  }
  if (!shouldLog) return;
  try {
    apiKeys.logApiUsage({
      keyId: auth.keyId,
      endpoint,
      statusCode,
      durationMs,
      requestId,
    });
  } catch (error) {
    console.error("[api-guard] usage log", error);
  }
}

function lateComplete(params: Parameters<typeof completeOrgApiCall>[0]) {
  try {
    completeOrgApiCall(params);
  } catch (error) {
    console.error("[api-guard] late quota complete", error);
  }
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
    const method = request.method.toUpperCase();
    let auth: ValidatedApiKey | null = null;
    let reserved = false;
    let completeInFinally = false;
    let logExecutedWork = false;
    let reservation: OrgQuotaReservation | undefined;
    let idempotencyKey: string | undefined;
    let statusCode = 500;
    let remainingAfter: number | undefined;
    let capturedBody: string | undefined;
    const abortController = new AbortController();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const disconnect = () => abortController.abort();
    request.signal.addEventListener("abort", disconnect, { once: true });
    if (request.signal.aborted) disconnect();

    try {
      if (!hasLiveApiKeyAuthorization(request)) {
        throw new ApiAuthError("Ongeldige API-sleutel.", 401);
      }

      auth = validateApiKey(parseBearerToken(request), requiredScope);

      let body: unknown;
      try {
        const bodyTimeoutRaw = Number(process.env.ORG_API_BODY_TIMEOUT_MS);
        const bodyTimeoutMs =
          Number.isFinite(bodyTimeoutRaw) && bodyTimeoutRaw >= 10
            ? bodyTimeoutRaw
            : undefined;
        body = await readJsonBody(request, JSON_BODY_LIMIT_BYTES, bodyTimeoutMs);
      } catch (error) {
        if (error instanceof RequestBodyTooLargeError) {
          throw error;
        }
        if (error instanceof RequestBodyTimeoutError) {
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

      const parsedKey = parseIdempotencyKey(
        request.headers.get("idempotency-key"),
      );
      if (!parsedKey.ok) {
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
          jsonError("Idempotency-Key is ongeldig.", 400),
          auth,
          undefined,
          requestId,
        );
      }
      idempotencyKey = parsedKey.key;
      const digest = requestFingerprint({ method, endpoint, body });
      const quota = reserveOrgApiCall({
        orgId: auth.orgId,
        keyId: auth.keyId,
        monthlyLimit: auth.monthlyQuota,
        method,
        endpoint,
        requestDigest: digest,
        idempotencyKey,
        now: Date.now(),
      });

      if (!quota.ok) {
        statusCode = denialStatus(quota.reason);
        auth = { ...auth, usedThisMonth: quota.consumed };
        remainingAfter = statusCode === 429 ? 0 : Math.max(0, auth.monthlyQuota - quota.consumed);
        await recordCappedDenial({
          auth,
          requestId,
          endpoint,
          statusCode,
          reason: quota.reason,
          durationMs: Date.now() - started,
        });
        if (statusCode === 409) {
          return withRateLimitHeaders(
            jsonError(quotaDenialMessage(quota.reason), 409),
            auth,
            remainingAfter,
            requestId,
          );
        }
        throw new ApiAuthError(quotaDenialMessage(quota.reason), 429, {
          retryAfterSeconds: quota.retryAfterSeconds,
          keyId: auth.keyId,
          orgId: auth.orgId,
          monthlyQuota: auth.monthlyQuota,
          usedThisMonth: quota.consumed,
          resetAt: auth.resetAt,
        });
      }

      auth = { ...auth, usedThisMonth: quota.consumed };
      remainingAfter = Math.max(0, auth.monthlyQuota - quota.consumed);

      if (quota.replay) {
        statusCode = quota.statusCode;
        const replayResponse = new NextResponse(quota.body, {
          status: quota.statusCode,
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
      completeInFinally = true;
      logExecutedWork = true;
      reservation = quota;
      heartbeat = setInterval(() => {
        try {
          if (!heartbeatOrgApiCall({ leaseId: quota.leaseId, ownerToken: quota.ownerToken })) abortController.abort();
        }
        catch { abortController.abort(); }
      }, 1_000);
      heartbeat.unref?.();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const publicServerErrorBody = JSON.stringify({
        error: "De server kon de aanvraag niet verwerken. Probeer het opnieuw.",
      });

      const executionAuth = auth;
      const work = Promise.resolve().then(() => handler(request, {
        ...executionAuth,
        body,
        endpoint,
        requestId,
        signal: abortController.signal,
        leaseId: quota.leaseId,
      }))
        .then(async (response) => {
          statusCode = response.status;
          const bounded = await readResponseTextBounded(
            response,
            API_IDEMPOTENCY_BODY_MAX_BYTES,
          );
          const tooLarge =
            bounded.truncated || utf8ByteLength(bounded.text) > API_IDEMPOTENCY_BODY_MAX_BYTES;
          if (tooLarge) {
            capturedBody = JSON.stringify({
              error: "Het antwoord is te groot om idempotent te bewaren.",
              code: "idempotency_payload_too_large",
            });
            statusCode = 413;
          } else {
            capturedBody = bounded.text;
          }
          if (auth && reservation) {
            const stored = completeOrgApiCall({
              orgId: auth.orgId,
              keyId: auth.keyId,
              leaseId: reservation.leaseId,
              ownerToken: reservation.ownerToken,
              period: reservation.period,
              idempotencyKey,
              statusCode,
              responseBody: capturedBody,
              storeIdempotency: !timedOut,
            });
            completeInFinally = false;
            if (!timedOut) {
              statusCode = stored.statusCode;
              capturedBody = stored.body;
            }
          }
          return new NextResponse(capturedBody, {
            status: statusCode,
            headers: tooLarge
              ? {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-store",
                }
              : response.headers,
          });
        })
        .catch((error) => {
          if (timedOut) throw error;
          console.error("[api-guard]", error);
          statusCode = 500;
          capturedBody = publicServerErrorBody;
          if (auth && reservation) {
            const stored = completeOrgApiCall({
              orgId: auth.orgId,
              keyId: auth.keyId,
              leaseId: reservation.leaseId,
              ownerToken: reservation.ownerToken,
              period: reservation.period,
              idempotencyKey,
              statusCode,
              responseBody: capturedBody,
            });
            completeInFinally = false;
            statusCode = stored.statusCode;
            capturedBody = stored.body ?? capturedBody;
          }
          return new NextResponse(capturedBody, {
            status: statusCode,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        });

      try {
        // A timed-out task still owns its slot until actual completion.
        void work.finally(() => {
          if (heartbeat) clearInterval(heartbeat);
          request.signal.removeEventListener("abort", disconnect);
        }).catch(() => undefined);
        const response = await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              timedOut = true;
              abortController.abort();
              reject(
                new ApiAuthError(
                  "De aanvraag duurde te lang. Probeer het later opnieuw.",
                  429,
                  { retryAfterSeconds: 30, orgId: auth?.orgId, keyId: auth?.keyId },
                ),
              );
            }, orgApiExecutionLimitMs());
          }),
        ]);
        return withRateLimitHeaders(response, auth, remainingAfter, requestId);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (timedOut && reservation && auth) {
          completeInFinally = false;
          lateComplete({
            orgId: auth.orgId,
            keyId: auth.keyId,
            leaseId: reservation.leaseId,
            ownerToken: reservation.ownerToken,
            period: reservation.period,
            idempotencyKey,
            statusCode: 429,
            responseBody: JSON.stringify({
              error: "De aanvraag duurde te lang. Probeer het later opnieuw.",
            }),
            releaseLease: false,
            storeIdempotency: true,
          });
          void work.then(
            () => {
              if (!auth || !reservation) return;
              lateComplete({
                orgId: auth.orgId,
                keyId: auth.keyId,
                leaseId: reservation.leaseId,
                ownerToken: reservation.ownerToken,
                period: reservation.period,
                idempotencyKey,
                statusCode,
                responseBody: capturedBody,
                releaseLease: true,
                storeIdempotency: false,
              });
            },
            () => {
              if (!auth || !reservation) return;
              lateComplete({
                orgId: auth.orgId,
                keyId: auth.keyId,
                leaseId: reservation.leaseId,
                ownerToken: reservation.ownerToken,
                period: reservation.period,
                idempotencyKey,
                statusCode: 500,
                releaseLease: true,
                storeIdempotency: false,
              });
            },
          );
        }
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
      if (
        error instanceof RequestBodyTooLargeError ||
        error instanceof RequestBodyTimeoutError ||
        error instanceof z.ZodError
      ) {
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
      if (!reserved) {
        request.signal.removeEventListener("abort", disconnect);
        if (heartbeat) clearInterval(heartbeat);
      }
      if (reserved && completeInFinally && auth && reservation) {
        try {
          completeOrgApiCall({
            orgId: auth.orgId,
            keyId: auth.keyId,
            leaseId: reservation.leaseId,
            ownerToken: reservation.ownerToken,
            period: reservation.period,
            idempotencyKey,
            statusCode,
            responseBody: capturedBody,
          });
        } catch (error) {
          console.error("[api-guard] quota complete", error);
        }
      }
      if (logExecutedWork && auth) {
        try {
          apiKeys.logApiUsage({
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
