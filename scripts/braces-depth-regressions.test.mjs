import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";

function bounded(source) {
  return execFileSync(process.execPath, ["--stack-size=512", "--max-old-space-size=64", "-e", source], {
    cwd: process.cwd(), encoding: "utf8", timeout: 3000, stdio: "pipe",
  }).trim();
}

it.each(["parse", "compile", "expand", "stringify"])("bounds deeply nested strings and caller ASTs in braces.%s", method => {
  expect(bounded(`
    const assert = require('node:assert/strict');
    const braces = require('braces');
    const method = ${JSON.stringify(method)};
    for (const [open, close] of [['{','}'], ['(',')'], ['{(',')}']]) {
      const pattern = open.repeat(2250) + 'a,b' + close.repeat(2250);
      assert(pattern.length < 10000);
      assert.throws(() => braces[method](pattern), /exceeds max depth/);
      assert.throws(() => braces[method](pattern, { maxDepth: Infinity }), /exceeds max depth/);
    }
    const valid = '{'.repeat(100) + 'a,b' + '}'.repeat(100);
    assert.doesNotThrow(() => braces[method](valid));
    assert.throws(() => braces[method]('{'.repeat(101) + 'a,b' + '}'.repeat(101)), /exceeds max depth/);
    assert.throws(() => braces[method]('{{a,b},c}', { maxDepth: 1.5 }), /exceeds max depth/);
    if (method !== 'parse') {
      let ast = { type: 'text', value: 'a' };
      for (let i = 0; i < 101; i++) ast = { type: 'brace', nodes: [ast] };
      ast = { type: 'root', nodes: [ast] };
      assert.throws(() => braces[method](ast), /exceeds max depth/);
      const cycle = { type: 'root', nodes: [] }; cycle.nodes.push(cycle);
      assert.throws(() => braces[method](cycle), /exceeds max depth/);
    }
    console.log('bounded');
  `)).toBe("bounded");
});

it("rejects cyclic expansion parents without hanging", () => {
  expect(bounded(`
    const assert = require('node:assert/strict'); const braces = require('braces');
    for (const multiple of [false, true]) {
      const ast = { type: 'paren', nodes: [{ type: 'text', value: 'a' }] };
      ast.parent = multiple ? { type: 'paren', parent: ast } : ast;
      assert.throws(() => braces.expand(ast), /parent chain contains a cycle/);
    }
    console.log('bounded');
  `)).toBe("bounded");
});

it("preserves normal ranges, nesting, escapes and every installed fast-glob consumer", () => {
  expect(bounded(`
    const assert = require('node:assert/strict'); const braces = require('braces');
    assert.deepEqual(braces.expand('lesson-{a,b}-{01..03}.txt'), ['lesson-a-01.txt','lesson-a-02.txt','lesson-a-03.txt','lesson-b-01.txt','lesson-b-02.txt','lesson-b-03.txt']);
    assert.deepEqual(braces.expand('foo/({a,b})'), ['foo/(a)', 'foo/(b)']);
    assert.deepEqual(braces.expand('{x,{y,z}}'), ['x','y','z']);
    assert.deepEqual(braces.expand('{3..1}'), ['3','2','1']);
    assert.deepEqual(braces.expand('{a..c}'), ['a','b','c']);
    assert.deepEqual(braces.expand('\\\\{lesson\\\\}'), ['{lesson}']);
    for (const p of ['{{a}}','{a,{b}}','{{x}y}','{a,{b,{c}}','{}{a}']) assert.equal(braces.stringify(p, { escapeInvalid: true }), p);
    assert.equal(braces.compile('lesson-{a,b}.txt'), 'lesson-(a|b).txt');
    const fs = require('node:fs'); const path = require('node:path');
    const folder = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'braces-glob-'));
    try {
      for (const file of ['lesson-a.txt', 'lesson-b.txt', 'other.txt']) fs.writeFileSync(path.join(folder, file), 'synthetic');
      const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    const paths = Object.keys(lock.packages).filter(p => p.endsWith('/fast-glob'));
    assert(paths.length > 0);
      for (const dependency of paths) {
        const fg = require(path.resolve(dependency));
        const options = { cwd: folder, onlyFiles: true };
        assert.deepEqual(fg.sync('lesson-{a,b}.txt', options).sort(), ['lesson-a.txt','lesson-b.txt']);
        assert.throws(() => fg.sync('{'.repeat(101)+'a,b'+'}'.repeat(101), options), /exceeds max depth/);
      }
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
    console.log('compatible');
  `)).toBe("compatible");
});
