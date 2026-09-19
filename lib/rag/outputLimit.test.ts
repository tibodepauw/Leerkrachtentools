import { describe,it,expect } from "vitest";
import { limitGoalMatches,limitCachedMatchResponse } from "./outputLimit";
import { curriculumMatchBodySchema } from "@/lib/b2b/schemas";
describe("public goal boundary including legacy cache",()=>{
 const ten=Array.from({length:10},(_,i)=>({code:String(i)}));
 it("caps nested old ten-result answers and alternatives without changing original candidate pool",()=>{
  const original={data:{results:ten,alternatives:ten}}; const result=limitGoalMatches(original);
  expect(result.data.results).toHaveLength(5); expect(result.data.alternatives).toHaveLength(4); expect(original.data.results).toHaveLength(10);
  expect(JSON.parse(limitCachedMatchResponse(JSON.stringify(original),2)).data.results).toHaveLength(2);
 });
 it("rejects excessive/fractional/zero limits instead of silently accepting them",()=>{
  for(const limit of [0,6,10,1.5]) expect(curriculumMatchBodySchema.safeParse({query:"Synthetisch lesdoel",limit}).success).toBe(false);
  for(const limit of [1,5]) expect(curriculumMatchBodySchema.parse({query:"Synthetisch lesdoel",limit}).limit).toBe(limit);
  expect(curriculumMatchBodySchema.parse({query:"Synthetisch lesdoel"}).limit).toBe(5);
 });
});
