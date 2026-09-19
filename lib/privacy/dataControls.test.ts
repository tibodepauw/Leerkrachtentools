import { describe,it,expect } from "vitest";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/db/sqlite";
import { cleanupExpiredData } from "./cleanup";
import { exportUserData,exportOrganizationData,closeOrganization } from "./dataControls";
import { createOrganization,generateApiKey,validateApiKey } from "@/lib/api-keys";
import { reserveOrgApiCall } from "@/lib/api/orgQuota";
const DAY=86_400_000;
function user(id:string){const db=getDatabase();db.prepare("INSERT INTO users(id,email,email_verified_at,created_at,updated_at,ai_api_key_enc) VALUES (?,?,1,1,1,'PRIVATE_KEY')").run(id,`${id}@example.com`);}
describe("expiry and scoped data controls",()=>{
 it("dry-run mutates nothing; apply preserves live auth, pending jobs and quota",()=>{
  const db=getDatabase(),now=Date.now();user("cleanup-user");
  for(const [id,created,expires] of [["old",now-2*DAY,now-DAY],["window",now-11*60_000,now-60_000],["active",now,now+60_000]] as const){
   db.prepare("INSERT INTO login_codes(id,email,code_hash,ip_hash,created_at,expires_at) VALUES (?,'synthetic@example.com','PRIVATE','PRIVATE',?,?)").run(id,created,expires);
  }
  db.prepare("INSERT INTO sessions VALUES ('PRIVATE_SESSION','cleanup-user',?,?,?)").run(now+DAY,now,now);
  db.prepare("INSERT INTO api_org_quota(org_id,period,consumed,in_flight,updated_at) VALUES ('cleanup-org','2026-09',8,1,?)").run(now);
  db.prepare("INSERT INTO api_request_leases VALUES ('active-lease','cleanup-org','2026-09','k','PRIVATE_OWNER',?,?,'active',?)").run(now,now+60_000,now-2*DAY);
  for(const [key,status,lease] of [["pending","pending","active-lease"],["completed","completed",null]] as const) db.prepare("INSERT INTO api_idempotency_keys(org_id,key_id,idempotency_key,method,endpoint,request_digest,lease_id,status,created_at) VALUES ('cleanup-org','k',?,'POST','/test','PRIVATE',?,?,?)").run(key,lease,status,now-2*DAY);
  const before=db.prepare("SELECT COUNT(*) AS n FROM login_codes").get(); const dry=cleanupExpiredData(db,{now});
  expect(dry.dryRun).toBe(true); expect(db.prepare("SELECT COUNT(*) AS n FROM login_codes").get()).toEqual(before);
  cleanupExpiredData(db,{now,apply:true});
  expect(db.prepare("SELECT id FROM login_codes ORDER BY id").all()).toEqual([{id:"active"},{id:"window"}]);
  expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({n:1});
  expect(db.prepare("SELECT idempotency_key FROM api_idempotency_keys").all()).toEqual([{idempotency_key:"pending"}]);
  expect(db.prepare("SELECT consumed,in_flight FROM api_org_quota").get()).toEqual({consumed:8,in_flight:1});
  expect(db.prepare("SELECT id FROM api_request_leases").all()).toEqual([{id:"active-lease"}]);
 });
 it("exports only one account and no secrets; refusing unknown account never falls back to all users",()=>{
  const db=getDatabase();user("export-a");user("export-b");
  db.prepare("INSERT INTO feedback_events(user_id,created_at) VALUES ('export-a',12),('export-b',34)").run();
  const data=exportUserData(db,"export-a");expect(data.feedback).toEqual([{created_at:12}]);
  expect(JSON.stringify(data)).not.toMatch(/PRIVATE|export-b|code_hash|token_hash/);
  expect(()=>exportUserData(db,"unknown")).toThrow();
 });
 it("organization export/closure isolates tenants, preserves quota, and blocks reissue/replay",()=>{
  const db=getDatabase();const a=createOrganization({name:"A",email:"a@example.com",tier:"scale",quota:10});const b=createOrganization({name:"B",email:"b@example.com",tier:"scale",quota:10});
  const keyA=generateApiKey(a.id,"A",["curriculum:match"]);const keyB=generateApiKey(b.id,"B",["curriculum:match"]);
  const data=JSON.stringify(exportOrganizationData(db,a.id));expect(data).not.toContain(keyA.token);expect(data).not.toContain(b.id);expect(data).not.toContain("key_hash");
  expect(closeOrganization(db,a.id).dryRun).toBe(true);expect(validateApiKey(keyA.token,"curriculum:match").orgId).toBe(a.id);
  const reserve={orgId:a.id,keyId:keyA.id,monthlyLimit:10,method:"POST",endpoint:"/api/v1/curriculum/match",requestDigest:randomUUID()};
  const job=reserveOrgApiCall(reserve);expect(job.ok).toBe(true);
  expect(()=>closeOrganization(db,a.id,true)).toThrow("lopend werk");
  db.prepare("UPDATE api_request_leases SET status='completed' WHERE org_id=?").run(a.id);
  closeOrganization(db,a.id,true);
  expect(()=>validateApiKey(keyA.token,"curriculum:match")).toThrow();expect(()=>generateApiKey(a.id,"again",["curriculum:match"])).toThrow();
  expect(()=>reserveOrgApiCall(reserve)).toThrow("afgesloten");expect(validateApiKey(keyB.token,"curriculum:match").orgId).toBe(b.id);
  expect(db.prepare("SELECT consumed FROM api_org_quota WHERE org_id=?").get(a.id)).toEqual({consumed:1});
 });
});
