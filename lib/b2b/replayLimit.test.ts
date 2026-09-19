import { describe,it,expect,vi } from "vitest";
import { NextResponse } from "next/server";
import { createOrganization,generateApiKey } from "@/lib/api-keys";
import { withApiAuth } from "@/lib/api-guard";
import { curriculumMatchBodySchema } from "@/lib/b2b/schemas";
import { getDatabase } from "@/lib/db/sqlite";
import { getOrgQuotaSnapshot } from "@/lib/api/orgQuota";
describe("legacy B2B replay after cap upgrade",()=>{
 it("trims stored ten-result content, rejects limit ten before replay, and preserves consumed quota",async()=>{
  const org=createOrganization({name:"Replay",email:"replay@example.com",tier:"scale",quota:10});const key=generateApiKey(org.id,"test",["curriculum:match"]);
  const work=vi.fn(async()=>NextResponse.json({results:[{code:"one"}]}));const handler=withApiAuth(work,{requiredScope:"curriculum:match",bodySchema:curriculumMatchBodySchema});
  const request=(limit:number)=>new Request("http://localhost/api/v1/curriculum/match",{method:"POST",headers:{authorization:`Bearer ${key.token}`,"content-type":"application/json","idempotency-key":"legacy-one","x-request-id":"PRIVATE_PROMPT_OR_KEY"},body:JSON.stringify({query:"synthetisch doel",limit})});
  expect((await handler(request(5))).status).toBe(200);
  getDatabase().prepare("UPDATE api_idempotency_keys SET response_body=? WHERE org_id=?").run(JSON.stringify({count:10,results:Array.from({length:10},(_,i)=>({code:String(i)}))}),org.id);
  const replay=await handler(request(5));expect(replay.status).toBe(200);const replayed=await replay.json();expect(replayed.results).toHaveLength(5);expect(replayed.count).toBe(5);expect(replayed.sourceMetadata.status).toBe("ONBEKEND");expect(work).toHaveBeenCalledOnce();
  expect((await handler(request(10))).status).toBe(400);expect(work).toHaveBeenCalledOnce();expect(getOrgQuotaSnapshot(org.id).consumed).toBe(1);
  expect(JSON.stringify(getDatabase().prepare("SELECT request_id FROM api_usage_logs").all())).not.toContain("PRIVATE_PROMPT_OR_KEY");
 });
});
