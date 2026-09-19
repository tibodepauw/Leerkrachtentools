import { describe,it,expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/db/sqlite";
describe("offline maintenance CLI",()=>{
 it("opens only an explicit existing DB, dry-runs without mutation, and exports without overwriting",()=>{
  const db=getDatabase();db.prepare("INSERT INTO users(id,email,email_verified_at,created_at,updated_at) VALUES ('cli-user','cli@example.com',1,1,1)").run();
  const database=process.env.DATABASE_PATH!;const output=path.join(path.dirname(database),"private-export.json");
  const run=(...args:string[])=>execFileSync(process.execPath,["workers/privacy-maintenance.cjs",...args],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","pipe"]});
  expect(()=>run("cleanup")).toThrow();
  expect(JSON.parse(run("cleanup","--database",database)).dryRun).toBe(true);
  run("export-user","--database",database,"--id","cli-user","--output",output);
  expect(JSON.parse(readFileSync(output,"utf8")).account.id).toBe("cli-user");
  expect(()=>run("export-user","--database",database,"--id","cli-user","--output",output)).toThrow();
  expect(db.prepare("SELECT COUNT(*) AS n FROM users").get()).toEqual({n:1});
 });
});
