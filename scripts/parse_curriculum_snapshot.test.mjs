import { describe, expect, it } from "vitest";
import { decodeSnapshot } from "./parse_curriculum_snapshot.mjs";

const page = value => `<script>let __sveltekit_test={};__sveltekit_test.data=${value};</script>`;
describe("static curriculum snapshot decoder", () => {
  it("preserves shared graph references and finite relations without executing functions", () => {
    const data = decodeSnapshot(page('(function(a,b){a.uuid="one";b.uuid="two";a.relaties={children:[b]};return {q:{first:{v:a},second:{v:b}}}})({},{})'));
    expect(data.q.first.v.relaties.children[0].uuid).toBe("two");
    expect(data.q.second.v.uuid).toBe("two");
  });
  it("decodes literal UI preferences and secondary data", () => {
    expect(decodeSnapshot(page('{q:{state:{v:new Set([])},absent:void 0}}')).q.state.v).toEqual([]);
    expect(decodeSnapshot(page('{updated:new Date("2026-11-13")}')).updated).toBe("2026-11-13");
    const secondary = '<script>let __sveltekit_test={};kit.start(app,element,{data:[null,{type:"data",data:{goals:[{id:"one"}]}}]});</script>';
    expect(decodeSnapshot(secondary, "secondary")[1].data.goals).toEqual([{ id: "one" }]);
  });
  it("does not run source scripts, imported functions or access host globals", () => {
    globalThis.__snapshotProbe = false;
    expect(decodeSnapshot('<script>globalThis.__snapshotProbe=true;let __sveltekit_test={};__sveltekit_test.data={safe:true};</script>').safe).toBe(true);
    expect(globalThis.__snapshotProbe).toBe(false);
    for (const value of ['process.exit(1)', 'globalThis.process.env', '(function(){throw Error("run")})()', 'new Date()', '(()=>{globalThis.__snapshotProbe=true})()']) {
      expect(() => decodeSnapshot(page(value))).toThrow();
    }
    expect(globalThis.__snapshotProbe).toBe(false);
    delete globalThis.__snapshotProbe;
  });
  it("rejects prototype mutation, accessors and duplicate snapshots", () => {
    for (const value of ['{"__proto__":{polluted:true}}', '{constructor:{}}', '{get secret(){return 1}}', '(function(a){a.__proto__.polluted=true;return a})({})']) {
      expect(() => decodeSnapshot(page(value))).toThrow();
    }
    expect({}.polluted).toBeUndefined();
    expect(() => decodeSnapshot(page('{}')+page('{}'))).toThrow(/exactly one/);
  });
  it("rejects oversized input and unexpectedly deep graphs", () => {
    expect(() => decodeSnapshot("x".repeat(8*1024*1024+1))).toThrow(/size limit/);
    expect(() => decodeSnapshot(page("[".repeat(220)+"0"+"]".repeat(220)))).toThrow(/Graph limit/);
  });
});
