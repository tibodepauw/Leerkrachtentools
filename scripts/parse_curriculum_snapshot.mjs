// Decode only the literal graph emitted by Svelte. Never execute source scripts.
import { readFileSync } from "node:fs";
import { parse } from "acorn";

const banned = new Set(["__proto__", "prototype", "constructor"]);
let remaining = 500_000;
function key(node, env) {
  const value = node.computed ? literal(node.property, env) : node.property.name;
  if (!["string", "number"].includes(typeof value) || banned.has(String(value))) throw Error("Unsafe graph key");
  return value;
}
function literal(node, env = new Map(), depth = 0) {
  if (--remaining < 0 || depth > 200) throw Error("Graph limit");
  const next = n => literal(n, env, depth + 1);
  switch (node.type) {
    case "Literal":
      if (node.regex || typeof node.value === "bigint") throw Error("Unsupported literal");
      return node.value;
    case "Identifier":
      if (node.name === "undefined") return null;
      if (!env.has(node.name)) throw Error("Unknown graph binding");
      return env.get(node.name);
    case "ArrayExpression": return node.elements.map(n => n ? next(n) : null);
    case "ObjectExpression": {
      const result = Object.create(null);
      for (const p of node.properties) {
        if (p.type !== "Property" || p.kind !== "init" || p.method || p.computed) throw Error("Unsupported graph property");
        const name = p.key.name ?? p.key.value;
        if (typeof name !== "string" || banned.has(name) || Object.hasOwn(result, name)) throw Error("Unsafe graph property");
        result[name] = next(p.value);
      }
      return result;
    }
    case "UnaryExpression":
      if (node.operator === "void" && node.argument.type === "Literal") return null;
      if (node.operator === "-" && node.argument.type === "Literal" && typeof node.argument.value === "number") return -node.argument.value;
      throw Error("Unsupported graph unary operation");
    case "MemberExpression": {
      const object = next(node.object), name = key(node, env);
      if (!object || typeof object !== "object" || !Object.hasOwn(object, name)) throw Error("Unknown graph member");
      return object[name];
    }
    case "AssignmentExpression": {
      if (node.operator !== "=" || node.left.type !== "MemberExpression") throw Error("Unsupported graph assignment");
      const object = next(node.left.object), name = key(node.left, env);
      if (!object || typeof object !== "object" || Object.getPrototypeOf(object) !== null) throw Error("Unsafe graph target");
      return object[name] = next(node.right);
    }
    case "SequenceExpression": {
      let result;
      for (const expression of node.expressions) result = next(expression);
      return result;
    }
    case "NewExpression":
      if (node.callee.type === "Identifier" && node.callee.name === "Set" && node.arguments.length === 1 && node.arguments[0].type === "ArrayExpression") return next(node.arguments[0]);
      // Preserve serialized dates as their literal source value, without
      // constructing a Date or executing any constructor from the source.
      if (node.callee.type === "Identifier" && node.callee.name === "Date" && node.arguments.length === 1 && node.arguments[0].type === "Literal" && ["string", "number"].includes(typeof node.arguments[0].value)) return node.arguments[0].value;
      throw Error("Unsupported graph constructor");
    case "CallExpression": {
      const fn = node.callee;
      if (fn.type !== "FunctionExpression" || fn.async || fn.generator || fn.params.length !== node.arguments.length || fn.params.some(p => p.type !== "Identifier")) throw Error("Unsupported graph call");
      const scope = new Map(env);
      fn.params.forEach((p, i) => scope.set(p.name, next(node.arguments[i])));
      for (const statement of fn.body.body) {
        if (statement.type === "ReturnStatement") return literal(statement.argument, scope, depth + 1);
        if (statement.type !== "ExpressionStatement") throw Error("Unsupported graph statement");
        literal(statement.expression, scope, depth + 1);
      }
      throw Error("Missing graph return");
    }
    default: throw Error(`Unsupported graph node: ${node.type}`);
  }
}

export function decodeSnapshot(html, kind = "primary") {
  if (Buffer.byteLength(html) > 8 * 1024 * 1024) throw Error("Snapshot size limit");
  const results = [];
  remaining = 500_000;
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const source = match[1];
    if (!source.includes("__sveltekit_")) continue;
    const stack = [parse(source, { ecmaVersion: "latest", sourceType: "module" })];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== "object") continue;
      if (kind === "primary" && n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && !n.left.computed && n.left.property.name === "data" && n.left.object.type === "Identifier" && n.left.object.name.startsWith("__sveltekit_")) results.push(literal(n.right));
      if (kind === "secondary" && n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.name === "kit" && n.callee.property.name === "start" && n.arguments.length === 3) results.push(literal(n.arguments[2]).data);
      for (const value of Object.values(n)) if (value && typeof value === "object") stack.push(...(Array.isArray(value) ? value : [value]));
    }
  }
  if (results.length !== 1) throw Error("Expected exactly one curriculum snapshot");
  return results[0];
}

if (process.argv[1]?.endsWith("parse_curriculum_snapshot.mjs")) {
  try {
    const input = readFileSync(0);
    if (input.length > 8 * 1024 * 1024) throw Error("Snapshot size limit");
    const data = JSON.stringify(decodeSnapshot(input.toString("utf8"), process.argv[2] ?? "primary"));
    if (Buffer.byteLength(data) > 16 * 1024 * 1024) throw Error("Decoded graph size limit");
    process.stdout.write(data);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
