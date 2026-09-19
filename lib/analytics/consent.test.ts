import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsConfiguration, analyticsProperties, captureAnalytics, readAnalyticsChoice, setAnalyticsChoice, stopAnalytics, ANALYTICS_CHOICE_KEY } from "./consent";
function setup(confirmed = true) {
  const values = new Map<string,string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k:string)=>values.get(k) ?? null, setItem: (k:string,v:string)=>values.set(k,v), removeItem:(k:string)=>values.delete(k) }, dispatchEvent: vi.fn() });
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true"); vi.stubEnv("NEXT_PUBLIC_POSTHOG_CONFIGURATION_CONFIRMED", String(confirmed));
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "synthetic-public-token"); vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_REGION", "EU"); vi.stubEnv("NEXT_PUBLIC_POSTHOG_RETENTION_DAYS", "30");
  setAnalyticsChoice("unknown");
  return values;
}
afterEach(()=>{ stopAnalytics(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("explicit analytics consent boundary",()=>{
  it("does not send before consent, after refusal or with unverified configuration",()=>{
    setup(false); const fetch=vi.fn(); vi.stubGlobal("fetch",fetch);
    captureAnalytics("$pageview","/"); setAnalyticsChoice("accepted"); captureAnalytics("$pageview","/");
    expect(fetch).not.toHaveBeenCalled(); expect(analyticsConfiguration().ready).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_CONFIGURATION_CONFIRMED","true"); setAnalyticsChoice("rejected"); captureAnalytics("$pageview","/"); expect(fetch).not.toHaveBeenCalled();
  });
  it("aborts outstanding transport on withdrawal without retrying or persisting identity",async()=>{
    const storage=setup(); const fetch=vi.fn(()=>new Promise<Response>(()=>{})); vi.stubGlobal("fetch",fetch);
    setAnalyticsChoice("accepted"); captureAnalytics("feature_completed","spellcheck");
    expect(fetch).toHaveBeenCalledOnce(); const init=fetch.mock.calls[0] as unknown as [string,RequestInit];
    expect(init[1].credentials).toBe("omit"); expect(init[1].referrerPolicy).toBe("no-referrer"); expect(init[1].signal?.aborted).toBe(false);
    setAnalyticsChoice("rejected"); expect(init[1].signal?.aborted).toBe(true);
    captureAnalytics("feature_completed","spellcheck"); expect(fetch).toHaveBeenCalledOnce();
    expect([...storage.keys()]).toEqual([ANALYTICS_CHOICE_KEY]); expect(storage.get(ANALYTICS_CHOICE_KEY)).not.toContain("distinct_id");
  });
  it("rejects stale, malformed, future or changed-configuration choices",()=>{
    const storage=setup(); setAnalyticsChoice("accepted"); const original=JSON.parse(storage.get(ANALYTICS_CHOICE_KEY)!);
    expect(readAnalyticsChoice()).toBe("accepted");
    for(const extra of [{expiresAt:null},{at:Date.now()+99999},{expiresAt:0},{version:"old"}]) {
      storage.set(ANALYTICS_CHOICE_KEY,JSON.stringify({...original,...extra})); expect(readAnalyticsChoice()).toBe("unknown");
    }
    storage.set(ANALYTICS_CHOICE_KEY,"bad json"); expect(readAnalyticsChoice()).toBe("unknown");
    setAnalyticsChoice("accepted"); vi.stubEnv("NEXT_PUBLIC_POSTHOG_RETENTION_DAYS","60"); expect(readAnalyticsChoice()).toBe("unknown");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST","https://unapproved.example"); expect(analyticsConfiguration().ready).toBe(false);
  });
  it("only allows fixed events and route/module values, never free text or URLs",()=>{
    expect(analyticsProperties("$pageview","/settings?email=private")).toBeNull();
    expect(analyticsProperties("$identify","private")).toBeNull(); expect(analyticsProperties("feature_failed","PRIVATE_PROMPT")).toBeNull();
    expect(analyticsProperties("feature_completed","spellcheck")).toEqual({feature:"spellcheck",$process_person_profile:false,$geoip_disable:true});
  });
});
