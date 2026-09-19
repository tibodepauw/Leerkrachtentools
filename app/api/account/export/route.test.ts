import { afterEach,describe,it,expect,vi } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { GET } from "./route";
vi.mock("@/lib/auth/guard",()=>({sessionFromRequest:vi.fn(),unauthorizedResponse:()=>Response.json({error:"Unauthorized"},{status:401})}));
import { sessionFromRequest } from "@/lib/auth/guard";
afterEach(()=>vi.resetAllMocks());
describe("account export authorization",()=>{
 it("requires a session",()=>{vi.mocked(sessionFromRequest).mockReturnValue(null);expect(GET(new Request("http://localhost/api/account/export")).status).toBe(401);});
 it("ignores arbitrary target IDs and exports only the authenticated account without caching",async()=>{
  const db=getDatabase();for(const id of ["alice","bob"])db.prepare("INSERT INTO users(id,email,email_verified_at,created_at,updated_at,ai_api_key_enc) VALUES (?,?,1,1,1,'PRIVATE_SECRET')").run(id,`${id}@example.com`);
  vi.mocked(sessionFromRequest).mockReturnValue({id:"alice",email:"alice@example.com",tier:"tester",displayName:null,marketingOptIn:false,profileImageUrl:null,pinnedModules:[],expiresAt:Date.now()+60_000});
  const response=GET(new Request("http://localhost/api/account/export?userId=bob&orgId=other"));const text=await response.text();
  expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("content-disposition")).toContain("attachment");expect(text).toContain("alice@example.com");expect(text).not.toMatch(/bob|PRIVATE_SECRET|ai_api_key_enc/);
  expect(db.prepare("SELECT COUNT(*) AS n FROM users").get()).toEqual({n:2});
 });
});
