import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "playwright";
const engine = { chromium, firefox, webkit }[process.env.PREVIEW_BROWSER ?? "chromium"];
if (!engine) throw new Error("Unknown browser");
const browser = await engine.launch({ headless: true, ...(process.env.SECURITY_BROWSER_CHANNEL ? { channel: process.env.SECURITY_BROWSER_CHANNEL } : {}) });
try {
 for (const configured of [false, true]) {
  const bundle = await build({
   stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
    import { PostHogProvider } from './components/providers/posthog-provider';
    import * as analytics from './lib/analytics/consent';
    window.analyticsProbe=analytics;
    createRoot(document.getElementById('root')).render(React.createElement(PostHogProvider, null, React.createElement('button', {id:'lesson',onClick:()=>{document.getElementById('lesson').textContent='Lesson works';analytics.captureAnalytics('feature_completed','spellcheck');}}, 'Synthetic lesson')));`, resolveDir: process.cwd() },
   bundle: true,write:false,platform:"browser",format:"iife",tsconfig:"tsconfig.json",
   define: { "process.env.NODE_ENV":'"production"', "process.env.NEXT_PUBLIC_POSTHOG_KEY":'"phc_synthetic"', "process.env.NEXT_PUBLIC_POSTHOG_HOST":'"https://eu.i.posthog.com"', "process.env.NEXT_PUBLIC_ANALYTICS_ENABLED":'"true"', "process.env.NEXT_PUBLIC_POSTHOG_CONFIGURATION_CONFIRMED":JSON.stringify(String(configured)), "process.env.NEXT_PUBLIC_POSTHOG_REGION":'"EU"', "process.env.NEXT_PUBLIC_POSTHOG_RETENTION_DAYS":'"30"' },
   plugins:[{name:"synthetic-route",setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:"route",namespace:"probe"}));b.onLoad({filter:/.*/,namespace:"probe"},()=>({contents:'export function usePathname(){return "/settings";}'}));}}],
  });
  const context=await browser.newContext({serviceWorkers:"block"}); const requests=[],errors=[];
  await context.route("**/*",async route=>{
   const r=route.request();
   if(new URL(r.url()).hostname==="127.0.0.1") return route.fulfill({contentType:"text/html",body:'<!doctype html><title>PRIVATE_TITLE</title><div id="root"></div><input value="PRIVATE_PUPIL">'});
   requests.push({url:r.url(),body:r.postData()??"",headers:r.headers()});
   // A failing service must never create a retry/buffer that survives withdrawal.
   await route.fulfill({status:503,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:'{}'});
  });
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  const mount=async()=>{await page.goto("http://127.0.0.1:18998/settings?email=PRIVATE_EMAIL#PRIVATE_KEY");await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole("button",{name:"Privacy & cookies",exact:true}).waitFor();};
  await mount();await page.locator("#lesson").click(); await page.waitForTimeout(200);assert.equal(requests.length,0,"No events before explicit consent");
  if(!configured){
   await page.getByRole("button",{name:"Privacy & cookies",exact:true}).click();
   assert.equal(await page.getByRole("button",{name:"Toestaan",exact:true}).isDisabled(),true);
   await page.evaluate(()=>{analyticsProbe.setAnalyticsChoice("accepted");analyticsProbe.captureAnalytics("$pageview","/");});
   assert.equal(requests.length,0,"Even stale stored consent cannot enable an unverified project");
  } else {
   await page.getByRole("button",{name:"Weigeren",exact:true}).click();await page.locator("#lesson").click();assert.equal(requests.length,0);
   await page.getByRole("button",{name:"Privacy & cookies",exact:true}).click();await page.getByRole("button",{name:"Toestaan",exact:true}).click();
   await page.waitForFunction(()=>analyticsProbe.readAnalyticsChoice()==="accepted");await page.locator("#lesson").click();await page.waitForTimeout(300);
   assert.ok(requests.some(r=>r.body.includes('"feature_completed"')),"Explicit consent enables useful function events");
   await page.evaluate(()=>{analyticsProbe.captureAnalytics("$identify","PRIVATE_EMAIL");analyticsProbe.captureAnalytics("$pageview","/settings?PRIVATE_QUERY");analyticsProbe.captureAnalytics("feature_failed","PRIVATE_PROMPT");});
   await page.getByRole("button",{name:"Privacy & cookies",exact:true}).click();await page.getByRole("button",{name:"Intrekken",exact:true}).click();
   const count=requests.length;await page.locator("#lesson").click();await mount();await page.locator("#lesson").click();await page.waitForTimeout(5500);assert.equal(requests.length,count,"No queued retries after withdrawal or reload");
   // Expiry and another tab's withdrawal must stop capture as well.
   await page.evaluate(()=>{analyticsProbe.setAnalyticsChoice("accepted");const key=analyticsProbe.ANALYTICS_CHOICE_KEY;const c=JSON.parse(localStorage.getItem(key));c.expiresAt=0;localStorage.setItem(key,JSON.stringify(c));window.dispatchEvent(new StorageEvent("storage",{key}));analyticsProbe.captureAnalytics("$pageview","/");});
   await page.waitForTimeout(100);assert.equal(requests.length,count);
   assert.ok(!JSON.stringify(requests).includes("PRIVATE_"),"Private URL/DOM/identity data crossed transport");
   for(const request of requests){assert.equal(new URL(request.url).hostname,"eu.i.posthog.com");assert.ok(!request.headers.cookie);assert.ok(!request.headers.referer);if(request.body){const e=JSON.parse(request.body);assert.ok(["$pageview","feature_completed"].includes(e.event));assert.equal(e.properties.$process_person_profile,false);assert.equal(e.properties.$geoip_disable,true);}}
   const storage=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));assert.ok(!storage.includes("distinct_id"));
  }
  assert.deepEqual(errors,[]);
  const blockedPage=await context.newPage();
  await blockedPage.addInitScript(()=>{for(const name of ["localStorage","sessionStorage"])Object.defineProperty(window,name,{get(){throw new Error("blocked");}});});
  blockedPage.on("pageerror",e=>errors.push(e.message));
  const beforeBlocked=requests.length;
  await blockedPage.goto("http://127.0.0.1:18998/settings");await blockedPage.addScriptTag({content:bundle.outputFiles[0].text});await blockedPage.locator("#lesson").click();await blockedPage.waitForTimeout(100);
  assert.equal(await blockedPage.locator("#lesson").textContent(),"Lesson works");assert.equal(requests.length,beforeBlocked);assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log("Analytics consent wire checks passed: disabled configuration, before consent, reject, allow, withdrawal, reload, expiry; no content, identity, retries or external scripts.");
} finally {await browser.close();}
