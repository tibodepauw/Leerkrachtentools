import assert from "node:assert/strict";
import Database from "better-sqlite3";

export async function checkHttpBoundaries({ origin, token, secondToken, userId, databasePath }) {
  const account = id => {
    const db = new Database(databasePath, { readonly: true });
    try { return db.prepare("SELECT display_name, marketing_opt_in, email FROM users WHERE id = ?").get(id); }
    finally { db.close(); }
  };
  const cookie = value => `__Host-leerkrachtentools_session=${value}`;
  const headers = { cookie: cookie(token), origin, "content-type": "application/json" };
  const routes = [
    ["GET", "auth/session"], ["GET", "account/api-keys"], ["GET", "account/pinned-modules"], ["GET", "account/avatar"],
    ["PATCH", "account/profile"], ["PATCH", "account/marketing-consent"], ["PATCH", "account/api-keys"],
    ["PUT", "account/pinned-modules"], ["POST", "account/list-models"], ["DELETE", "account/avatar"], ["DELETE", "account"],
  ];
  for (const [method, route] of routes) {
    const body = ["GET", "DELETE"].includes(method) ? undefined : "{}";
    const response = await fetch(`${origin}/api/${route}`, { method, headers: { origin, "content-type": "application/json", cookie: cookie("invalid"), "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" }, body });
    assert.equal(response.status, 401, `${method} ${route}`);
    if (method !== "GET") {
      for (const untrusted of [{ origin: "null" }, { origin: "https://untrusted.example" }, { origin, "sec-fetch-site": "cross-site" }]) {
        const denied = await fetch(`${origin}/api/${route}`, { method, headers: { ...headers, ...untrusted }, body });
        assert.equal(denied.status, 403, `CSRF ${method} ${route}`);
      }
    }
  }
  for (const [method, route] of routes.filter(([method]) => ["PATCH", "PUT", "POST"].includes(method))) {
    for (const body of ["{", "null", "[]", "42"]) {
      const response = await fetch(`${origin}/api/${route}`, { method, headers, body });
      assert.equal(response.status, 400, `Invalid JSON ${method} ${route}: ${body}`);
      assert.match(response.headers.get("cache-control"), /no-store/);
    }
  }
  const secondHeaders = { cookie: cookie(secondToken), origin, "content-type": "application/json" };
  const second = await (await fetch(`${origin}/api/auth/session`, { headers: secondHeaders })).json();
  assert.notEqual(second.userId, userId);
  const beforeSecond = account(second.userId);
  // Extra selectors must never override the authenticated principal.
  const changed = await fetch(`${origin}/api/account/profile?userId=${second.userId}`, { method: "PATCH", headers, body: JSON.stringify({ displayName: "Boundary fixture", userId: second.userId, id: second.userId, email: "second@example.test" }) });
  assert.equal(changed.status, 200);
  assert.equal(account(userId).display_name, "Boundary fixture");
  assert.deepEqual(account(second.userId), beforeSecond);
  const consent = await fetch(`${origin}/api/account/marketing-consent`, { method: "PATCH", headers, body: JSON.stringify({ marketingOptIn: true, userId: second.userId }) });
  assert.equal(consent.status, 200);
  assert.deepEqual(account(second.userId), beforeSecond);
  // SQL metacharacters are data, not a selector or executable query.
  const sqlName = "O'Neil; DROP TABLE users;--";
  assert.equal((await fetch(`${origin}/api/account/profile`, { method: "PATCH", headers, body: JSON.stringify({ displayName: sqlName }) })).status, 200);
  assert.equal(account(userId).display_name, sqlName);
  assert.equal((await fetch(`${origin}/api/auth/session`, { headers: secondHeaders })).status, 200);
  const html = await fetch(`${origin}/api/account/profile`, { method: "PATCH", headers, body: JSON.stringify({ displayName: "<script>alert(1)</script>" }) });
  assert.equal(html.status, 400);
  console.log("HTTP boundary matrix passed: real methods, opaque/cross-site origins, malformed JSON and cross-account selectors; SQL metacharacters remain data.");
}
