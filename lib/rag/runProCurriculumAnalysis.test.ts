import { describe,it,expect,vi } from "vitest";
import { runProCurriculumAnalysis } from "./runProCurriculumAnalysis";
import type { CurriculumSearchResult } from "@/types";
vi.mock("@/lib/ai/providers",()=>({hasAnyAiProvider:()=>false}));
describe("pro fallback public limit",()=>{
 it("keeps at most five results even when its caller requests ten fallback candidates",async()=>{
  const retrieved=Array.from({length:15},(_,i)=>({code:String(i),titel:"Synthetisch doel",netwerk:"GO"}) as CurriculumSearchResult);
  const result=await runProCurriculumAnalysis({query:"Synthetische les",retrieved,lesson:{topic:"Les",learningArea:"",grade:"",ageRange:"",phases:[]},budget:{kind:"org",orgId:"synthetic"},fallbackLimit:10});
  expect(result.proFallback).toBe(true);expect(result.merged).toHaveLength(5);expect(retrieved).toHaveLength(15);
 });
});
