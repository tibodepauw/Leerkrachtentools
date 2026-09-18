import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { buildSync } from "esbuild";
import JSZip from "jszip";

// Synthetic malicious DOCX; all browser network requests are blocked. No user
// browser profile or account is accessed by this isolated headless test.
const zip = new JSZip();
const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";
zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
zip.file("_rels/.rels", `<Relationships xmlns="${rel}"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
zip.file("word/document.xml", `<w:document xmlns:w="${w}"><w:body><w:p><w:r><w:t>Audit fixture</w:t></w:r></w:p></w:body></w:document>`);
zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="${rel}"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
zip.file("word/styles.xml", `<w:styles xmlns:w="${w}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="x;}body{--security-audit:injected}/*"/></w:rPr></w:style></w:styles>`);
const bytes = [...await zip.generateAsync({ type: "uint8array" })];
const browser = await chromium.launch({ headless: true, ...(process.env.SECURITY_BROWSER_CHANNEL ? { channel: process.env.SECURITY_BROWSER_CHANNEL } : {}) });
try {
  const page = await browser.newPage();
  const requests = [];
  await page.route("**/*", (route) => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-audit'; style-src 'unsafe-inline'; frame-src 'self' blob:"></head><body><div id="legacy"></div></body></html>`);
  const helper = buildSync({ entryPoints: ["lib/documents/previewFrame.ts"], bundle: true, format: "iife", globalName: "PreviewSecurity", write: false }).outputFiles[0].text;
  for (const code of [readFileSync("node_modules/jszip/dist/jszip.min.js", "utf8"), readFileSync("node_modules/docx-preview/dist/docx-preview.js", "utf8"), helper]) {
    await page.evaluate((source) => { const script = document.createElement("script"); script.nonce = "audit"; script.textContent = source; document.head.append(script); }, code);
  }
  // Control: prove the fixture affects the surrounding page with the old mount.
  await page.evaluate(async (input) => { await window.docx.renderAsync(new Uint8Array(input), document.querySelector("#legacy"), undefined, { renderAltChunks: false }); }, bytes);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--security-audit")), "injected");
  await page.evaluate(() => {
    document.querySelector("#legacy").remove();
    const frame = document.createElement("iframe");
    frame.sandbox = window.PreviewSecurity.DOCUMENT_PREVIEW_SANDBOX;
    frame.srcdoc = window.PreviewSecurity.DOCUMENT_PREVIEW_HTML;
    document.body.append(frame);
  });
  await page.waitForFunction(() => document.querySelector("iframe")?.contentDocument?.getElementById("document"));
  await page.evaluate(async (input) => {
    const doc = document.querySelector("iframe").contentDocument;
    window.PreviewSecurity.preventPreviewNavigation(doc);
    await window.docx.renderAsync(new Uint8Array(input), doc.getElementById("document"), undefined, { renderAltChunks: false });
    const script = doc.createElement("script"); script.textContent = "parent.previewScriptRan = true"; doc.body.append(script);
    const image = doc.createElement("img"); image.src = "https://preview-attack.invalid/image"; doc.body.append(image);
    const link = doc.createElement("a"); link.href = "https://preview-attack.invalid/navigation"; link.textContent = "Untrusted link"; doc.body.append(link); link.click();
  }, bytes);
  const state = await page.evaluate(() => {
    const doc = document.querySelector("iframe").contentDocument;
    return { parentCss: getComputedStyle(document.body).getPropertyValue("--security-audit"), childCss: doc.defaultView.getComputedStyle(doc.body).getPropertyValue("--security-audit"), text: doc.body.textContent, scriptRan: window.previewScriptRan === true };
  });
  assert.equal(state.parentCss, "");
  assert.equal(state.childCss, "injected");
  assert.match(state.text, /Audit fixture/);
  assert.equal(state.scriptRan, false);
  assert.deepEqual(requests, []);
  console.log("Preview security passed: malicious DOCX CSS isolated; scripts, resource loads and link navigation blocked.");
} finally { await browser.close(); }
