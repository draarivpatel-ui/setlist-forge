const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("../engine.js");
const App = require("../app.js");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("DOM 01: index.html has valid doctype, lang, charset, viewport, and SetlistForge title", () => {
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta charset="UTF-8"/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<title>SetlistForge/);
});

test("DOM 02: styles.css defines Blue Note / analog mastering console color tokens", () => {
  assert.match(css, /#F6F3EC/i);
  assert.match(css, /#ECE7DC/i);
  assert.match(css, /#C84B31/i);
  assert.match(css, /#1E5E4A/i);
  assert.match(css, /#2B4C7E/i);
});

test("DOM 03: package.json has zero runtime dependencies and uses node --test", () => {
  assert.deepEqual(pkg.dependencies || {}, {});
  assert.match(pkg.scripts.test, /node --test/);
});

test("DOM 04: index.html includes all required interactive console IDs", () => {
  const requiredIds = [
    "scenarioSelect",
    "auditionFullArcBtn",
    "toggleDrawerBtn",
    "selectedSeedsTray",
    "centroidBarsContainer",
    "catalogSearchInput",
    "seedCatalogList",
    "arcPresetButtons",
    "splineSlidersContainer",
    "trackLengthSlider",
    "weightAffinitySlider",
    "weightEnergySlider",
    "weightHarmonicSlider",
    "clearPinsBtn",
    "resequenceBtn",
    "energyArcSvg",
    "setlistTrackContainer",
    "qlooExportDrawer",
    "qlooEndpointSelect",
    "qlooApiKeyInput",
    "fetchQlooLiveBtn",
    "exportPreviewTextarea",
    "copyExportBtn",
    "downloadExportBtn"
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `Missing id="${id}" in index.html`);
  }
});

test("DOM 05: App.SCENARIOS defines 4 curated cultural scenarios with valid seedIds", () => {
  const keys = Object.keys(App.SCENARIOS);
  assert.equal(keys.length, 4);
  for (const k of keys) {
    const sc = App.SCENARIOS[k];
    assert.ok(sc.seedIds.length >= 2);
    for (const sid of sc.seedIds) {
      assert.ok(Engine.getEntityById(sid), `Unknown seed ${sid}`);
    }
  }
});

test("DOM 06: App.formatDuration and App.formatTrackClock format seconds accurately", () => {
  assert.equal(App.formatDuration(2020), "33m 40s");
  assert.equal(App.formatDuration(65), "1m 05s");
  assert.equal(App.formatTrackClock(245), "4:05");
  assert.equal(App.formatTrackClock(180), "3:00");
});

test("DOM 07: App.escapeHtml escapes special HTML characters", () => {
  assert.equal(App.escapeHtml('<script>"a"&b</script>'), "&lt;script&gt;&quot;a&quot;&amp;b&lt;/script&gt;");
});

test("DOM 08: App.buildEnergyArcSvgMarkup renders target and actual polylines plus Camelot badges", () => {
  const res = Engine.sequenceSetlist({ targetLength: 8 });
  const svg = App.buildEnergyArcSvgMarkup(res);
  assert.ok(svg.includes("<polyline"));
  assert.ok(svg.includes("data-slot-idx="));
  assert.ok(svg.includes("data-transition-idx="));
  assert.ok(svg.includes("#C84B31"));
  assert.ok(svg.includes("#2B4C7E"));
});

test("DOM 09: App.createWebAudioPreviewSynth degrades gracefully in headless Node without AudioContext", () => {
  const synth = App.createWebAudioPreviewSynth();
  const tracks = Engine.getMusicTracks();
  const res = synth.playChordTransition(tracks[0], tracks[1]);
  assert.ok(res);
  assert.equal(res.camelotA, tracks[0].camelotKey);
  assert.equal(res.camelotB, tracks[1].camelotKey);
});

test("DOM 10: anti-slop check confirms zero em-dashes and zero en-dashes", () => {
  for (const file of ["index.html", "styles.css", "engine.js", "app.js"]) {
    const content = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.equal(content.includes("\u2014"), false, `Em-dash found in ${file}`);
    assert.equal(content.includes("\u2013"), false, `En-dash found in ${file}`);
  }
});
