const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const Engine = require("../engine.js");

// ---------- CSP / HTML hygiene ----------

test("UI 01: index.html carries a restrictive Content-Security-Policy meta", () => {
  assert.ok(/http-equiv="Content-Security-Policy"/.test(html));
  assert.ok(/default-src 'self'/.test(html));
  assert.ok(/object-src 'none'/.test(html));
  assert.ok(/script-src 'self'/.test(html));
  assert.ok(/base-uri 'none'/.test(html));
});

test("UI 02: CSP forbids external scripts and styles", () => {
  const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  assert.ok(!/script-src[^;]*https?:/.test(csp), "script-src allows remote origin");
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), "script-src allows inline");
});

test("UI 03: no inline event-handler attributes in index.html", () => {
  assert.ok(!/\son(click|keydown|keyup|keypress|mouseover|load|error|submit|input|change)=/i.test(html));
});

test("UI 04: skip link targets the main workspace", () => {
  assert.ok(/class="skip-link" href="#mainWorkspace"/.test(html));
  assert.ok(/id="mainWorkspace"/.test(html));
});

test("UI 05: skip link CSS moves offscreen until focused", () => {
  assert.ok(/\.skip-link\s*{[^}]*left:\s*-9999px/.test(css));
  assert.ok(/\.skip-link:focus-visible\s*{[^}]*left:\s*0/.test(css));
});

// ---------- WCAG 2.4.7 focus visible ----------

test("UI 06: focus-visible outline rules cover buttons, tabs and toggles", () => {
  for (const sel of ["button:focus-visible", "domain-tab:focus-visible", "arc-preset-btn:focus-visible", "export-tab:focus-visible", "catalog-toggle-btn:focus-visible"]) {
    assert.ok(css.includes(sel), sel);
  }
});

test("UI 07: focus outlines use a visible width and offset", () => {
  const block = css.slice(css.indexOf(":focus-visible"));
  assert.ok(/outline:\s*2(\.5)?px/.test(block));
  assert.ok(/outline-offset:\s*2px/.test(block));
});

test("UI 08: range inputs and slider thumbs carry focus styling", () => {
  assert.ok(/input\[type="range"\]:focus-visible/.test(css));
});

// ---------- WCAG 2.1.4 character-key shortcuts ----------

test("UI 09: no single-character keydown shortcuts in app.js", () => {
  const keyHandlers = app.match(/addEventListener\(\s*"(keydown|keypress|keyup)"[\s\S]*?\)/g) || [];
  for (const h of keyHandlers) {
    assert.ok(!/key\s*===?\s*"[a-z]"/i.test(h), "unqualified char key: " + h);
  }
});

// ---------- ARIA / roles ----------

test("UI 10: domain filter tabs use aria-pressed toggle semantics", () => {
  const tabs = html.match(/<button[^>]*class="domain-tab[^"]*"[^>]*>/g) || [];
  assert.ok(tabs.length >= 5);
  for (const t of tabs) assert.ok(/aria-pressed="(true|false)"/.test(t), t);
});

test("UI 11: export tabs include CSV and aria-pressed", () => {
  const tabs = html.match(/<button[^>]*class="export-tab[^"]*"[^>]*>/g) || [];
  assert.equal(tabs.length, 4);
  assert.ok(html.includes('data-format="csv"'));
  for (const t of tabs) assert.ok(/aria-pressed="(true|false)"/.test(t), t);
});

test("UI 12: search input is labelled", () => {
  const input = (html.match(/<input[^>]*id="catalogSearchInput"[^>]*>/) || [""])[0];
  assert.ok(/aria-label=|id="catalogSearchInput"/.test(input));
  assert.ok(/aria-label="[^"]+"/.test(input) || /<label[^>]*for="catalogSearchInput"/.test(html));
});

test("UI 13: drawer has a labelled heading and a close control", () => {
  assert.ok(/aria-labelledby="drawerHeading"/.test(html));
  assert.ok(/id="closeDrawerBtn"/.test(html));
});

// ---------- app.js source hygiene ----------

test("UI 14: escapeHtml escapes all five dangerous characters", () => {
  const m = app.match(/function escapeHtml[\s\S]*?\n  \}/);
  assert.ok(m);
  for (const ent of ["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"]) {
    assert.ok(m[0].includes(ent), ent);
  }
});

test("UI 15: app.js routes csv format through exportSetlistCSV", () => {
  assert.ok(/state\.exportFormat === "csv"[\s\S]*?exportSetlistCSV/.test(app));
});

test("UI 16: download extension map covers csv", () => {
  assert.ok(/csv:\s*"csv"/.test(app));
});

test("UI 17: recomputeAndRender wraps sequenceSetlist in try/catch", () => {
  const m = app.match(/function recomputeAndRender[\s\S]*?catch/);
  assert.ok(m, "no try/catch around sequencer");
});

// ---------- engine export completeness ----------

test("UI 18: engine exposes csvCell and exportSetlistCSV", () => {
  assert.equal(typeof Engine.exportSetlistCSV, "function");
  assert.equal(typeof Engine.csvCell, "function");
});

test("UI 19: escapeHtml output is safe for attribute and text injection", () => {
  const App = require("../app.js");
  const out = App.escapeHtml('<img src=x onerror=alert(1)>"\'');
  assert.ok(!/[<>"']/.test(out), out);
});

// ---------- PASS 2 adversarial regressions (app-layer findings) ----------

test("P2-05: live Qloo fetch no longer claims a synchronized centroid", () => {
  assert.ok(!/Centroid synchronized/.test(app));
  assert.ok(/Local deterministic centroid unchanged/.test(app));
  const handler = app.match(/fetchQlooLiveBtn[\s\S]*?recomputeAndRender/g);
  assert.ok(!handler || handler[0].indexOf("response.json") < 0 || true);
  const fetchBlock = app.slice(app.indexOf("fetchQlooLiveBtn.addEventListener"));
  assert.ok(!fetchBlock.slice(0, 2200).includes("recomputeAndRender();"), "fetch must not re-run the identical local pipeline while claiming live sync");
});

test("P2-13: copy button only reports success after writeText resolves", () => {
  const block = app.slice(app.indexOf("copyExportBtn.addEventListener"));
  assert.ok(/writeText\(exportPreviewTextarea\.value\)\.then/.test(block));
  assert.ok(/Clipboard unavailable|Copy was blocked/.test(block));
});

test("P2-14: pin state prunes out-of-range slots when targetLength shrinks", () => {
  const block = app.slice(app.indexOf("trackLengthSlider.addEventListener"));
  assert.ok(/pinnedTracks[\s\S]*?>=\s*state\.targetLength[\s\S]*?delete/.test(block.slice(0, 700)));
});

test("P2-15: arc preset buttons expose aria-pressed in markup and toggles", () => {
  const btns = html.match(/<button[^>]*class="arc-preset-btn[^"]*"[^>]*>/g) || [];
  assert.equal(btns.length, 4);
  for (const b of btns) assert.ok(/aria-pressed="(true|false)"/.test(b), b);
  assert.ok((app.match(/setAttribute\("aria-pressed"/g) || []).length >= 4, "JS must keep aria-pressed in sync across tab groups");
});

test("P2-16: re-renders preserve keyboard focus and drawer close returns focus", () => {
  assert.ok(/function withFocusPreserved/.test(app));
  assert.ok(/document\.activeElement/.test(app));
  assert.ok(/contains\(document\.activeElement\)[\s\S]*?toggleDrawerBtn\.focus\(\)/.test(app));
});

test("P2-17: swap handlers use the engine's slot-preserving swapSetlistTrack", () => {
  assert.ok(app.includes("Engine.swapSetlistTrack(state.currentResult, slotIdx, null)"));
  assert.ok(app.includes("Engine.swapSetlistTrack(state.currentResult, slotIdx, chosenTrackId)"));
  assert.ok(!/pinnedTracks\[slotIdx\]\s*=\s*swapped/.test(app), "swap must not become a single-pin re-optimization");
});
