import { describe,it,expect,vi } from "vitest";
import { logSafeError, safeErrorDetails } from "./safeLog";
describe("safe diagnostics",()=>{
 it("drops secret-bearing errors, response bodies, causes and stacks but keeps known diagnosis",()=>{
  const error=Object.assign(new Error("PRIVATE_PROMPT"),{code:"ECONNRESET",statusCode:503,request:{headers:{authorization:"PRIVATE_KEY",cookie:"PRIVATE_COOKIE"}},cause:"PRIVATE_FILE",responseBody:"PRIVATE_DOC"});
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  logSafeError("synthetic-provider",error);
  expect(log).toHaveBeenCalledWith("synthetic-provider",{type:"Error",code:"ECONNRESET",status:503}); expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE"); log.mockRestore();
  expect(safeErrorDetails({name:"PRIVATE_NAME",code:"PRIVATE_KEY",status:200})).toEqual({type:"UnknownError"});
 });
 it("does not expose parser input or hostile property getters",()=>{
  try { JSON.parse("PRIVATE_DOCUMENT"); } catch(e) { expect(JSON.stringify(safeErrorDetails(e))).not.toContain("PRIVATE"); }
  expect(safeErrorDetails({get name(){throw new Error("PRIVATE");}})).toEqual({type:"UnknownError"});
 });
});
