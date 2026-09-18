// Disposable Linux CI/staging acceptance. Must run as root on a systemd host.
// Uses uniquely named temporary units; does not start or modify the real app.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

assert.equal(process.platform, "linux");
assert.equal(process.getuid(), 0, "Run with sudo on a disposable Linux CI/staging host");
const folder = mkdtempSync(path.join(tmpdir(), "lt-isolation-"));
const prefix = `lt-audit-${process.pid}`;
const root = path.join(folder, "root");
const workerDir = path.join(folder, "workers");
mkdirSync(root); mkdirSync(workerDir);
// Parent temp directory must be traversable when systemd switches to DynamicUser.
execFileSync("chmod", ["755", folder]);
const standalone = path.resolve(".next/standalone");
const socketPath = path.join(folder, "parser.sock");
const probePath = path.join(workerDir, "probe.cjs");
const secretPath = path.join(folder, "host-secret.txt");
writeFileSync(secretPath, "synthetic-host-secret");
writeFileSync(probePath, `const fs=require('node:fs');const net=require('node:net');
const chunks=[];process.stdin.on('data',c=>chunks.push(c));process.stdin.on('end',async()=>{
const job=JSON.parse(Buffer.concat(chunks));
if(job.mode==='spin'){while(true){Math.sqrt(Math.random());}}
if(job.mode==='native'){const buffers=[];setInterval(()=>buffers.push(Buffer.alloc(32*1024*1024,1)),30);return;}
let read=false,write=false;try{fs.readFileSync(job.hostPath);read=true;}catch{}
try{fs.writeFileSync('/app/node_modules/lt-probe-write','bad');write=true;}catch{}
const network=await new Promise(resolve=>{try{const s=net.connect({host:'1.1.1.1',port:443});s.on('connect',()=>{s.destroy();resolve('connected')});s.on('error',e=>resolve(e.code));s.setTimeout(1000,()=>{s.destroy();resolve('timeout')});}catch(e){resolve(e.code)}});
process.stdout.write(JSON.stringify({read,write,network,secret:process.env.AUTH_SECRET??null,uid:process.getuid()}),()=>process.exit(0));
});`);
const units = [];
const ctl = (...args) => execFileSync("systemctl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function install(name, content) {
  const file = `/run/systemd/system/${name}`;
  writeFileSync(file, content); units.push(file);
}
function service(entry) {
  return readFileSync("deploy/leerkrachtentools-parser@.service", "utf8")
    .replaceAll("/var/lib/leerkrachtentools-parser/root", root)
    .replaceAll("/opt/leerkrachtentools/current", standalone)
    .replace("ExecStart=/usr/bin/node", `BindReadOnlyPaths=${realpathSync(process.execPath)}:/runtime/node\nBindReadOnlyPaths=${workerDir}:/probe\nExecStart=/runtime/node`)
    .replace("/app/workers/document.cjs", entry)
    .replace("leerkrachtentools-parsers.slice", `${prefix}.slice`);
}
async function exchange(payload, maxMs = 14000) {
  return await new Promise((resolve, reject) => {
    const s = net.createConnection({ path: socketPath, allowHalfOpen: true });
    const chunks = [];
    const timer = setTimeout(() => { s.destroy(); reject(new Error("Kernel deadline did not close the worker")); }, maxMs);
    s.once("connect", () => s.end(JSON.stringify(payload)));
    s.on("data", c => chunks.push(c));
    s.once("error", error => { clearTimeout(timer); reject(error); });
    s.once("end", () => { clearTimeout(timer); s.destroy(); resolve(Buffer.concat(chunks).toString()); });
  });
}
try {
  install(`${prefix}.slice`, readFileSync("deploy/leerkrachtentools-parsers.slice", "utf8"));
  install(`${prefix}.socket`, readFileSync("deploy/leerkrachtentools-parser.socket", "utf8")
    .replace("/run/leerkrachtentools-parser.sock", socketPath).replace("SocketGroup=leerkrachtentools", "SocketGroup=root"));
  install(`${prefix}@.service`, service("/probe/probe.cjs"));
  ctl("daemon-reload"); ctl("start", `${prefix}.socket`);
  const probe = JSON.parse(await exchange({ hostPath: secretPath }));
  assert.deepEqual({ ...probe, uid: 1, network: false }, { read: false, write: false, network: false, secret: null, uid: 1 });
  assert(["EAFNOSUPPORT", "EPERM", "EACCES"].includes(probe.network), `Expected a kernel network denial, got ${probe.network}`);
  assert.notEqual(probe.uid, 0);
  for (const [mode, expected] of [["spin", "timeout"], ["native", "oom-kill"]]) {
    assert.equal(await exchange({ mode }), "", `${mode} should be killed without a successful response`);
    let results = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const names = ctl("list-units", "--all", "--plain", "--no-legend", `${prefix}@*.service`).split("\n").map(line => line.trim().split(/\s+/)[0]).filter(Boolean);
      results = names.map(name => ctl("show", name, "--property=Result", "--value"));
      if (results.includes(expected)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(results.includes(expected), `Expected ${expected}, observed ${results.join(', ')}`);
  }
  // The same service restrictions must also run the real compiled parser.
  writeFileSync(`/run/systemd/system/${prefix}@.service`, service("/app/workers/document.cjs"));
  ctl("daemon-reload");
  assert.deepEqual(JSON.parse(await exchange({ operation: "extract", fileName: "test.txt", bytes: Buffer.from("Linux sandbox works").toString("base64") })), { text: "Linux sandbox works" });
  const smoke = spawn(process.execPath, ["scripts/check-standalone.mjs"], {
    env: { ...process.env, DOCUMENT_WORKER_SOCKET: socketPath }, stdio: "inherit",
  });
  assert.equal(await new Promise(resolve => smoke.once("exit", resolve)), 0);
  console.log("Linux isolation passed: denied host files/writes/network; CPU deadline; native OOM limit; real standalone parsing.");
} finally {
  try { ctl("stop", `${prefix}.socket`, `${prefix}@*.service`); } catch { /* already stopped */ }
  for (const file of units) { try { unlinkSync(file); } catch { /* no file */ } }
  try { ctl("reset-failed", `${prefix}@*.service`); ctl("daemon-reload"); } catch { /* preserve original error */ }
  // folder was created above by mkdtemp, never obtained from a request.
  rmSync(folder, { recursive: true, force: true });
}
