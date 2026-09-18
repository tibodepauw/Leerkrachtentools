import { expect, it } from "vitest";
import { sanitizeAnalyticsEvent } from "./privacy";

it("removes private URL, referrer, DOM, title and person properties", () => {
  const result = sanitizeAnalyticsEvent({ uuid: "synthetic", event: "$pageview", properties: {
    token: "public-project-token", distinct_id: "random-anonymous-id",
    $current_url: "https://app.example/settings?email=private@example.com#private-key",
    $referrer: "https://school.example/private-pupil", title: "Private pupil name",
    $set: { email: "private@example.com" }, $elements: [{ text: "private lesson" }],
    unexpected: "private lesson",
  } });
  expect(result?.properties).toEqual({ token: "public-project-token", distinct_id: "random-anonymous-id", $current_url: "https://app.example/settings", $pathname: "/settings" });
  expect(JSON.stringify(result)).not.toContain("private");
});

it("drops automatic events and routes that might contain user data", () => {
  for (const event of ["$autocapture", "$pageleave", "$exception", "$snapshot", "$identify", "custom"]) {
    expect(sanitizeAnalyticsEvent({ uuid: "synthetic", event, properties: { $current_url: "https://app.example/" } })).toBeNull();
  }
  for (const url of ["https://app.example/lessons/private-title", "invalid", "file:///settings"]) {
    expect(sanitizeAnalyticsEvent({ uuid: "synthetic", event: "$pageview", properties: { $current_url: url } })).toBeNull();
  }
});
