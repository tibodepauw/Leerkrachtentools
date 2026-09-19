import { afterEach,describe,it,expect,vi } from "vitest";
import { createHmac,randomUUID,createHash } from "node:crypto";
import { getDatabase } from "@/lib/db/sqlite";
import { requestLoginCode,verifyLoginCode } from "@/lib/auth/service";
import { CURRENT_TERMS_VERSION } from "./terms";
import { TERMS_HASH,TERMS_TEXT,registerTermsDocument } from "./acceptance";
vi.mock("@/lib/email/brevo",()=>({isBrevoConfigured:()=>false,sendBrevoEmail:vi.fn()}));
const email="terms-proof@example.com";
afterEach(()=>vi.unstubAllEnvs());
function seedCode(at:number,withProof=true){
 const db=getDatabase(); const code="234567";
 db.prepare("DELETE FROM login_codes WHERE email=?").run(email);
 const hash=createHmac("sha256",process.env.AUTH_SECRET!).update(`otp:${email}:${code}`).digest("hex");
 db.prepare("INSERT INTO login_codes (id,email,code_hash,ip_hash,privacy_accepted,created_at,expires_at,terms_hash,terms_accepted_at) VALUES (?,?,?,'synthetic',1,?,?,?,?)").run(randomUUID(),email,hash,at,Date.now()+60_000,withProof?registerTermsDocument(db):null,withProof?at:null);
 return code;
}
describe("versioned terms evidence",()=>{
 it("requires the displayed version and checkbox before issuing a code",async()=>{
  const base={email,privacyAccepted:true,marketingOptIn:false,ipHash:"synthetic",ipTrusted:true};
  await expect(requestLoginCode(base)).rejects.toThrow("voorwaarden");
  await expect(requestLoginCode({...base,termsVersion:CURRENT_TERMS_VERSION,privacyAccepted:false})).rejects.toThrow("akkoord");
  vi.stubEnv("TESTER_EMAILS",email);
  const requested=await requestLoginCode({...base,termsVersion:CURRENT_TERMS_VERSION,exposeDevCode:true});
  expect(requested.devCode).toMatch(/^\d{6}$/);
  const pending=getDatabase().prepare("SELECT terms_hash,terms_accepted_at FROM login_codes WHERE email=? ORDER BY created_at DESC LIMIT 1").get(email) as {terms_hash:string;terms_accepted_at:number};
  expect(pending.terms_hash).toBe(TERMS_HASH); expect(pending.terms_accepted_at).toBeGreaterThan(0);
  expect(createHash("sha256").update(TERMS_TEXT).digest("hex")).toBe(TERMS_HASH);
 });
 it("preserves the first evidence across later logins and never invents old evidence",()=>{
  vi.stubEnv("TESTER_EMAILS",email); const db=getDatabase();
  db.prepare("INSERT INTO users (id,email,email_verified_at,created_at,updated_at,privacy_accepted_at) VALUES ('old-user',?,1,1,1,123)").run(email);
  expect(db.prepare("SELECT * FROM terms_acceptances WHERE user_id='old-user'").all()).toEqual([]);
  expect(()=>verifyLoginCode(email,seedCode(Date.now()-1000,false))).toThrow("akkoord ontbreekt");
  const at=Date.now()-500; verifyLoginCode(email,seedCode(at));
  verifyLoginCode(email,seedCode(Date.now()));
  const proofs=db.prepare("SELECT * FROM terms_acceptances WHERE user_id='old-user'").all() as {accepted_at:number}[];
  expect(proofs).toHaveLength(1);expect(proofs[0].accepted_at).toBe(at);
  expect(db.prepare("SELECT privacy_accepted_at FROM users WHERE id='old-user'").get()).toEqual({privacy_accepted_at:123});
 });
});
