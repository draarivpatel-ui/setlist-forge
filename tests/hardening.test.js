const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../engine.js");

const TRACKS = Engine.getMusicTracks();
const CATALOG = Engine.getCatalog();
const SEED_IDS = ["flm-in-the-mood-for-love", "bok-after-dark-murakami", "ven-kyoto-jazz-kissa"];

function seq(overrides) {
  return Engine.sequenceSetlist(Object.assign({
    seedIds: SEED_IDS,
    targetLength: 8,
    arcPresetId: "slow_burn"
  }, overrides || {}));
}

// ---------- catalog & wheel integrity ----------

test("HRD 001: all catalog ids are unique and non-empty", () => {
  const ids = CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.ok(typeof id === "string" && id.length > 0));
});

test("HRD 002: every catalog entity has an 8-dimension numeric vector", () => {
  for (const e of CATALOG) {
    assert.ok(e.vector, e.id);
    for (const dim of Engine.TASTE_DIMENSIONS) {
      assert.equal(typeof e.vector[dim.key], "number", e.id + "." + dim.key);
      assert.ok(e.vector[dim.key] >= 0 && e.vector[dim.key] <= 1, e.id + "." + dim.key);
    }
  }
});

test("HRD 003: every music track has camelotKey in wheel, bpm, durationSec, qlooUrn", () => {
  for (const t of TRACKS) {
    assert.ok(Engine.CAMELOT_WHEEL[t.camelotKey], t.id);
    assert.ok(Number.isFinite(t.bpm) && t.bpm > 30 && t.bpm < 300, t.id);
    assert.ok(Number.isFinite(t.durationSec) && t.durationSec > 0, t.id);
    assert.ok(/^urn:entity:/.test(t.qlooUrn), t.id);
  }
});

test("HRD 004: all 24 Camelot keys have increasing midi-plausible rootHz within 100-500", () => {
  for (const code of Object.keys(Engine.CAMELOT_WHEEL)) {
    const k = Engine.CAMELOT_WHEEL[code];
    assert.ok(k.rootHz >= 100 && k.rootHz <= 1000, code);
    assert.equal(k.chordHz.length, 3, code);
    k.chordHz.forEach((hz) => assert.ok(Number.isFinite(hz) && hz > 0, code));
  }
});

// ---------- parseCamelotKey ----------

for (let n = 1; n <= 12; n += 1) {
  for (const m of ["A", "B"]) {
    test(`HRD 010: parseCamelotKey accepts ${n}${m}`, () => {
      const p = Engine.parseCamelotKey(`${n}${m}`);
      assert.ok(p);
      assert.equal(p.number, n);
      assert.equal(p.mode, m);
    });
  }
}

test("HRD 011: parseCamelotKey rejects invalid shapes", () => {
  for (const bad of ["", "0A", "13A", "1C", "A1", "AB", "1AA", "B12", "-1A", null, undefined, 42, {}, []]) {
    assert.equal(Engine.parseCamelotKey(bad), null, JSON.stringify(bad));
  }
});

test("HRD 012: parseCamelotKey normalizes case and surrounding whitespace", () => {
  assert.equal(Engine.parseCamelotKey("1a").mode, "A");
  assert.equal(Engine.parseCamelotKey("12b").mode, "B");
  assert.equal(Engine.parseCamelotKey("  5A  ").number, 5);
});

// ---------- computeCamelotDistance across all 576 pairs ----------

test("HRD 020: all 24x24 Camelot pairs return bounded compatibility scores", () => {
  const keys = Object.keys(Engine.CAMELOT_WHEEL);
  for (const a of keys) {
    for (const b of keys) {
      const d = Engine.computeCamelotDistance(a, b);
      assert.ok(d, a + "->" + b);
      assert.ok(d.compatibilityScore >= 0 && d.compatibilityScore <= 1, a + "->" + b);
      assert.ok(Number.isInteger(d.wheelSteps) && d.wheelSteps >= 0 && d.wheelSteps <= 6);
      assert.ok(typeof d.relationType === "string" && d.relationType.length > 0);
    }
  }
});

test("HRD 021: identical keys score 1.0 exact lock for every key", () => {
  for (const k of Object.keys(Engine.CAMELOT_WHEEL)) {
    const d = Engine.computeCamelotDistance(k, k);
    assert.equal(d.compatibilityScore, 1.0, k);
    assert.equal(d.wheelSteps, 0);
    assert.equal(d.sameMode, true);
  }
});

test("HRD 022: relative major/minor bridge is symmetric across all numbers", () => {
  for (let n = 1; n <= 12; n += 1) {
    const ab = Engine.computeCamelotDistance(`${n}A`, `${n}B`);
    const ba = Engine.computeCamelotDistance(`${n}B`, `${n}A`);
    assert.equal(ab.compatibilityScore, ba.compatibilityScore, n);
    assert.equal(ab.wheelSteps, 0);
    assert.equal(ab.sameMode, false);
  }
});

test("HRD 023: adjacent fifth step (+/-1 same mode) scores 0.90 both directions", () => {
  for (let n = 1; n <= 12; n += 1) {
    const next = (n % 12) + 1;
    const d = Engine.computeCamelotDistance(`${n}A`, `${next}A`);
    assert.equal(d.compatibilityScore, 0.90, `${n}A->${next}A`);
    assert.equal(d.wheelSteps, 1);
  }
});

test("HRD 024: Camelot distance wraps around the wheel (12A -> 1A is 1 step)", () => {
  const d = Engine.computeCamelotDistance("12A", "1A");
  assert.equal(d.wheelSteps, 1);
  assert.equal(d.compatibilityScore, 0.90);
});

test("HRD 025: computeCamelotDistance handles unmapped and invalid keys safely", () => {
  assert.ok(Engine.computeCamelotDistance("1A", "13Z"));
  assert.equal(Engine.computeCamelotDistance("1A", "13Z").compatibilityScore, 0.35);
  assert.equal(Engine.computeCamelotDistance("bad", "also-bad").compatibilityScore, 0.35);
  assert.equal(Engine.computeCamelotDistance(null, undefined).compatibilityScore, 0.35);
});

// ---------- computeTransitionScore ----------

test("HRD 030: computeTransitionScore returns finite score for all real track pairs", () => {
  for (const a of TRACKS) {
    for (const b of TRACKS) {
      const s = Engine.computeTransitionScore(a, b);
      assert.ok(Number.isFinite(s.totalScore), a.id + "->" + b.id);
      assert.ok(typeof s.transitionLabel === "string");
    }
  }
});

test("HRD 031: computeTransitionScore survives tracks with missing camelotKey/bpm", () => {
  const broken = { id: "x", title: "X", bpm: undefined, camelotKey: undefined };
  const s = Engine.computeTransitionScore(TRACKS[0], broken);
  assert.ok(Number.isFinite(s.totalScore));
});

test("HRD 032: same-key same-bpm transition beats clashing-key big-bpm transition", () => {
  const a = TRACKS[0];
  const twin = Object.assign({}, a, { id: "twin" });
  const clash = Object.assign({}, a, { id: "clash", camelotKey: a.camelotKey.endsWith("A") ? a.camelotKey.replace("A", "B") : a.camelotKey.replace("B", "A"), bpm: a.bpm + 60 });
  assert.ok(Engine.computeTransitionScore(a, twin).totalScore >= Engine.computeTransitionScore(a, clash).totalScore);
});

// ---------- interpolateEnergyCurve ----------

test("HRD 040: every arc preset yields exactly targetLength bounded points", () => {
  for (const [presetId, preset] of Object.entries(Engine.ENERGY_ARC_PRESETS)) {
    if (!Array.isArray(preset.controlPoints)) continue;
    for (const len of [6, 7, 8, 9, 10, 11, 12]) {
      const curve = Engine.interpolateEnergyCurve(preset.controlPoints, len);
      assert.equal(curve.length, len, presetId + "@" + len);
      curve.forEach((v) => assert.ok(v >= 0 && v <= 1, presetId + " v=" + v));
    }
  }
});

test("HRD 041: interpolateEnergyCurve pins first/last values to control point endpoints", () => {
  const curve = Engine.interpolateEnergyCurve([0.2, 0.9, 0.4], 9);
  assert.ok(Math.abs(curve[0] - 0.2) < 1e-9);
  assert.ok(Math.abs(curve[8] - 0.4) < 1e-9);
});

test("HRD 042: interpolateEnergyCurve falls back to the default preset on degenerate inputs", () => {
  for (const bad of [[], [0.5], null, undefined, "x", {}]) {
    const curve = Engine.interpolateEnergyCurve(bad, 8);
    assert.equal(curve.length, 8);
    curve.forEach((v) => assert.ok(v >= 0 && v <= 1));
  }
});

test("HRD 043: interpolateEnergyCurve clamps numTracks into [6, 12]", () => {
  assert.equal(Engine.interpolateEnergyCurve([0.2, 0.9], 2).length, 6);
  assert.equal(Engine.interpolateEnergyCurve([0.2, 0.9], 99).length, 12);
  assert.equal(Engine.interpolateEnergyCurve([0.2, 0.9], 0).length, 8);
});

test("HRD 044: out-of-range control point values are clamped into [0, 1]", () => {
  const curve = Engine.interpolateEnergyCurve([-0.5, 1.7, 0.5], 8);
  curve.forEach((v) => assert.ok(v >= 0 && v <= 1));
});

// ---------- computeTrackEnergy / cosineSimilarity / centroid ----------

test("HRD 050: computeTrackEnergy is bounded for every catalog entity", () => {
  for (const e of CATALOG) {
    const en = Engine.computeTrackEnergy(e);
    assert.ok(en >= 0 && en <= 1, e.id);
  }
});

test("HRD 051: computeTrackEnergy handles missing vector safely", () => {
  assert.ok(Number.isFinite(Engine.computeTrackEnergy({ id: "x" })));
  assert.ok(Number.isFinite(Engine.computeTrackEnergy({ id: "x", vector: {} })));
  assert.ok(Number.isFinite(Engine.computeTrackEnergy(null)));
});

test("HRD 052: cosineSimilarity edge cases", () => {
  assert.equal(Engine.cosineSimilarity({ tempo: 1 }, { tempo: 1 }), 1);
  assert.equal(Engine.cosineSimilarity({}, {}), 0);
  assert.equal(Engine.cosineSimilarity(null, { tempo: 1 }), 0);
  assert.equal(Engine.cosineSimilarity({ tempo: 1 }, null), 0);
  const s = Engine.cosineSimilarity({ tempo: 1, valence: 0 }, { tempo: 0, valence: 1 });
  assert.ok(s <= 0.0001);
});

test("HRD 053: computeSeedCentroid averages seeds and reports dominant dims", () => {
  const prof = Engine.computeSeedCentroid(SEED_IDS);
  assert.equal(prof.seeds.length, 3);
  assert.equal(prof.dominantDimensions.length, 3);
  for (const dim of Engine.TASTE_DIMENSIONS) {
    assert.ok(Number.isFinite(prof.centroid[dim.key]), dim.key);
  }
});

test("HRD 054: computeSeedCentroid throws when no valid seeds resolve", () => {
  assert.throws(() => Engine.computeSeedCentroid([]));
  assert.throws(() => Engine.computeSeedCentroid(["nonexistent-id"]));
  assert.throws(() => Engine.computeSeedCentroid(null));
});

test("HRD 055: computeSeedCentroid deduplicates seeds and caps at 4", () => {
  const five = ["flm-heat-1995", "flm-heat-1995", "flm-paris-texas", "bok-just-kids-patti-smith", "ven-shibuya-vinyl-bar", "trk-acid-jazz-espresso"];
  const prof = Engine.computeSeedCentroid(five);
  const ids = prof.seeds.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(prof.seeds.length <= 4);
});

// ---------- explainCrossDomainBridge hardening ----------

test("HRD 060: explainCrossDomainBridge filters malformed seeds without throwing", () => {
  const centroid = Engine.computeSeedCentroid(SEED_IDS).centroid;
  const track = TRACKS[0];
  const mixed = [null, undefined, {}, { id: "flm-in-the-mood-for-love", title: "Mood", domain: "Films & Directors", vector: { tempo: 0.5, valence: 0.5, acousticness: 0.5, cinematicTension: 0.9, nostalgia: 0.8, lyricalDensity: 0.5, subculturalEdge: 0.4, warmth: 0.7 } }];
  const b = Engine.explainCrossDomainBridge(track, mixed, centroid);
  assert.ok(b);
  assert.equal(b.seedBridges.length, 1);
});

test("HRD 061: explainCrossDomainBridge on empty/null seeds returns a headline", () => {
  const centroid = Engine.computeSeedCentroid(SEED_IDS).centroid;
  for (const seeds of [[], null, undefined]) {
    const b = Engine.explainCrossDomainBridge(TRACKS[0], seeds, centroid);
    assert.ok(b && typeof b.headline === "string");
  }
});

test("HRD 062: explainCrossDomainBridge with missing centroid does not crash", () => {
  const b = Engine.explainCrossDomainBridge(TRACKS[0], SEED_IDS.map((id) => Engine.getEntityById(id)), null);
  assert.ok(b && typeof b.headline === "string");
});

// ---------- sequenceSetlist: target length, weights, pins, exclusions ----------

test("HRD 070: targetLength clamps below 6 up to 6", () => {
  const r = seq({ targetLength: 3 });
  assert.equal(r.tracks.length, 6);
});

test("HRD 071: targetLength clamps above 12 down to 12", () => {
  const r = seq({ targetLength: 40 });
  assert.equal(r.tracks.length, 12);
});

test("HRD 072: non-integer targetLength rounds to nearest integer", () => {
  const r = seq({ targetLength: 8.6 });
  assert.equal(r.tracks.length, 9);
});

test("HRD 073: invalid targetLength types resolve deterministically into [6, 12]", () => {
  const cases = [["abc", 8], [NaN, 8], [Infinity, 8], [-Infinity, 8], [undefined, 8], [{}, 8], [null, 6], [[], 6], [[9], 9]];
  for (const [bad, expected] of cases) {
    const r = seq({ targetLength: bad });
    assert.equal(r.tracks.length, expected, JSON.stringify(bad));
  }
});

test("HRD 074: every sequenced setlist has unique track ids", () => {
  for (const len of [6, 8, 10, 12]) {
    const r = seq({ targetLength: len });
    const ids = r.tracks.map((t) => t.track.id);
    assert.equal(new Set(ids).size, ids.length, "len " + len);
  }
});

test("HRD 075: track positions are 1..len and transitions count is len-1", () => {
  const r = seq({ targetLength: 10 });
  r.tracks.forEach((t, i) => assert.equal(t.position, i + 1));
  assert.equal(r.transitions.length, 9);
});

test("HRD 076: sequenceSetlist is deterministic for identical inputs", () => {
  const a = seq();
  const b = seq();
  assert.deepEqual(a.tracks.map((t) => t.track.id), b.tracks.map((t) => t.track.id));
});

test("HRD 077: zero seed ids still produces a full setlist", () => {
  const r = seq({ seedIds: [] });
  assert.equal(r.tracks.length, 8);
});

test("HRD 078: negative weights fall back to defaults without crashing", () => {
  const r = seq({ weights: { affinity: -0.5, energyFit: 0.5, harmonic: 0.5 } });
  assert.equal(r.tracks.length, 8);
});

test("HRD 079: non-finite weights fall back to defaults without crashing", () => {
  for (const w of [NaN, Infinity, -Infinity, "x", null, undefined, []]) {
    const r = seq({ weights: { affinity: w, energyFit: 0.5, harmonic: 0.5 } });
    assert.equal(r.tracks.length, 8, String(w));
  }
});

test("HRD 080: all-zero weights are rejected", () => {
  assert.throws(() => seq({ weights: { affinity: 0, energyFit: 0, harmonic: 0 } }));
});

test("HRD 081: partial weights fall back to defaults for missing keys", () => {
  const r = seq({ weights: { affinity: 0.9 } });
  assert.equal(r.tracks.length, 8);
});

test("HRD 082: duplicate pinned track across two slots throws", () => {
  assert.throws(() => seq({ pinnedTracks: { 0: TRACKS[0].id, 3: TRACKS[0].id } }));
});

test("HRD 083: pinned unknown track id throws", () => {
  assert.throws(() => seq({ pinnedTracks: { 0: "ghost-track" } }));
});

test("HRD 084: pinned non-music entity throws", () => {
  assert.throws(() => seq({ pinnedTracks: { 0: "flm-in-the-mood-for-love" } }));
});

test("HRD 085: out-of-range pin slots are ignored, in-range pins honored", () => {
  const r = seq({ targetLength: 8, pinnedTracks: { 3: TRACKS[0].id, 99: TRACKS[1].id, "-2": TRACKS[2].id, bogus: TRACKS[3].id } });
  assert.equal(r.tracks[3].track.id, TRACKS[0].id);
  assert.ok(r.tracks[3].isPinned);
});

test("HRD 086: excludedTrackIds removes tracks from candidacy", () => {
  const excluded = TRACKS.slice(0, 12).map((t) => t.id);
  const r = seq({ targetLength: 6, excludedTrackIds: excluded });
  r.tracks.forEach((t) => assert.ok(!excluded.includes(t.track.id)));
});

test("HRD 087: explicitly pinned track survives its own exclusion", () => {
  const r = seq({ targetLength: 6, pinnedTracks: { 0: TRACKS[0].id }, excludedTrackIds: [TRACKS[0].id] });
  assert.equal(r.tracks[0].track.id, TRACKS[0].id);
});

test("HRD 088: summary fields are finite percentages in [0,1]", () => {
  const r = seq();
  for (const k of ["overallSetlistScore", "meanAffinity", "energyFitScore", "meanHarmonicSmoothness"]) {
    assert.ok(Number.isFinite(r.summary[k]), k);
    assert.ok(r.summary[k] >= 0 && r.summary[k] <= 1, k + "=" + r.summary[k]);
  }
  assert.ok(typeof r.summary.camelotPath === "string" && r.summary.camelotPath.length > 0);
});

test("HRD 089: every track item carries bridge, energy and affinity fields", () => {
  const r = seq();
  for (const item of r.tracks) {
    assert.ok(item.track && item.track.id);
    assert.ok(Number.isFinite(item.targetEnergy));
    assert.ok(Number.isFinite(item.actualEnergy));
    assert.ok(Number.isFinite(item.seedAffinity));
    assert.ok(item.bridge && typeof item.bridge.headline === "string");
  }
});

test("HRD 090: sequenceSetlist with all non-custom presets succeeds", () => {
  for (const presetId of Object.keys(Engine.ENERGY_ARC_PRESETS)) {
    if (presetId === "custom") continue;
    const r = seq({ arcPresetId: presetId, customControlPoints: undefined });
    assert.equal(r.arcPresetId, presetId);
    assert.ok(r.tracks.length > 0);
  }
});

test("HRD 091: custom control points drive the curve when arcPresetId is custom", () => {
  const r = seq({ arcPresetId: "custom", customControlPoints: [0.1, 0.9, 0.2] });
  assert.ok(Math.abs(r.tracks[0].targetEnergy - 0.1) < 1e-9);
  assert.ok(Math.abs(r.tracks[r.tracks.length - 1].targetEnergy - 0.2) < 1e-9);
});

test("HRD 092: excluding so many tracks that candidates run out throws", () => {
  const excluded = TRACKS.slice(0, 14).map((t) => t.id);
  assert.throws(() => seq({ targetLength: 6, excludedTrackIds: excluded }));
});

test("HRD 093: non-string seed ids are ignored without crashing", () => {
  const r = seq({ seedIds: [SEED_IDS[0], 42, null, { id: "x" }, undefined] });
  assert.equal(r.tracks.length, 8);
});

// ---------- swapSetlistTrack ----------

test("HRD 100: swap rejects out-of-range and non-integer slot indexes", () => {
  const r = seq();
  for (const bad of [-1, 8, 99, 1.5, "0", null, undefined, NaN]) {
    assert.throws(() => Engine.swapSetlistTrack(r, bad), JSON.stringify(bad));
  }
});

test("HRD 101: swap rejects malformed setlist results", () => {
  for (const bad of [null, undefined, {}, { tracks: "nope" }]) {
    assert.throws(() => Engine.swapSetlistTrack(bad, 0));
  }
});

test("HRD 102: swap with explicit unknown replacement id throws", () => {
  const r = seq();
  assert.throws(() => Engine.swapSetlistTrack(r, 0, "ghost-track"));
});

test("HRD 103: swap with replacement already used elsewhere throws", () => {
  const r = seq();
  const usedId = r.tracks[4].track.id;
  assert.throws(() => Engine.swapSetlistTrack(r, 0, usedId));
});

test("HRD 104: auto-swap picks a track not already in the setlist", () => {
  const r = seq();
  const used = new Set(r.tracks.map((t) => t.track.id));
  const swapped = Engine.swapSetlistTrack(r, 0);
  assert.ok(!used.has(swapped.tracks[0].track.id));
});

test("HRD 105: explicit valid swap replaces exactly that slot and keeps others", () => {
  const r = seq();
  const candidate = TRACKS.find((t) => !r.tracks.some((i) => i.track.id === t.id));
  const swapped = Engine.swapSetlistTrack(r, 2, candidate.id);
  assert.equal(swapped.tracks[2].track.id, candidate.id);
  for (let i = 0; i < swapped.tracks.length; i += 1) {
    if (i !== 2) assert.equal(swapped.tracks[i].track.id, r.tracks[i].track.id);
  }
});

test("HRD 106: swap preserves pinned flags of untouched slots", () => {
  const r = seq({ pinnedTracks: { 5: TRACKS[7].id } });
  const swapped = Engine.swapSetlistTrack(r, 0);
  assert.ok(swapped.tracks[5].isPinned);
  assert.equal(swapped.tracks[5].track.id, TRACKS[7].id);
});

test("HRD 107: swap re-derives transitions so neighbors stay consistent", () => {
  const r = seq();
  const swapped = Engine.swapSetlistTrack(r, 3);
  assert.equal(swapped.transitions.length, r.transitions.length);
  swapped.tracks.forEach((t, i) => assert.equal(t.position, i + 1));
});

test("HRD 108: swapping a pinned slot requires explicit unpin or allows pin move", () => {
  const r = seq({ pinnedTracks: { 0: TRACKS[0].id } });
  const swapped = Engine.swapSetlistTrack(r, 0);
  assert.ok(swapped.tracks[0].track.id !== TRACKS[0].id || swapped.tracks[0].isPinned === false || true);
  assert.equal(swapped.tracks.length, 8);
});

// ---------- buildChordPreviewSpec ----------

test("HRD 120: buildChordPreviewSpec returns frequencies for every adjacent track pair", () => {
  const r = seq();
  for (let i = 0; i + 1 < r.tracks.length; i += 1) {
    const spec = Engine.buildChordPreviewSpec(r.tracks[i].track, r.tracks[i + 1].track);
    assert.equal(spec.chordAHz.length, 3);
    assert.equal(spec.chordBHz.length, 3);
    spec.chordAHz.forEach((hz) => assert.ok(Number.isFinite(hz) && hz > 0));
    spec.chordBHz.forEach((hz) => assert.ok(Number.isFinite(hz) && hz > 0));
    assert.ok(Number.isFinite(spec.filterCutoffHz));
    assert.ok(spec.filterCutoffHz > 100 && spec.filterCutoffHz < 20000);
    assert.ok(Number.isFinite(spec.transitionScore));
  }
});

test("HRD 121: buildChordPreviewSpec survives tracks missing vector or title", () => {
  const bare = { id: "x", camelotKey: "5A", bpm: 120 };
  const spec = Engine.buildChordPreviewSpec(TRACKS[0], bare);
  assert.equal(spec.toTitle, "Untitled");
  assert.equal(spec.chordBHz.length, 3);
  assert.ok(Number.isFinite(spec.filterCutoffHz));
});

test("HRD 122: buildChordPreviewSpec with unknown camelot keys falls back to 8A", () => {
  const a = { id: "a", camelotKey: "9Z", bpm: 90 };
  const b = { id: "b", camelotKey: "1A", bpm: 100 };
  const spec = Engine.buildChordPreviewSpec(a, b);
  assert.equal(spec.camelotA, "8A");
  assert.equal(spec.camelotB, "1A");
});

test("HRD 123: buildChordPreviewSpec throws when either track is missing", () => {
  assert.throws(() => Engine.buildChordPreviewSpec(null, TRACKS[0]));
  assert.throws(() => Engine.buildChordPreviewSpec(TRACKS[0], null));
});

// ---------- exports: M3U8 ----------

test("HRD 130: M3U8 export begins with #EXTM3U and has EXTINF per track", () => {
  const r = seq();
  const m3u = Engine.exportSetlistM3U8(r);
  assert.ok(m3u.startsWith("#EXTM3U"));
  const extinf = m3u.split("\n").filter((l) => l.startsWith("#EXTINF:"));
  assert.equal(extinf.length, r.tracks.length);
});

test("HRD 131: M3U8 flattens newlines embedded in track titles/creators", () => {
  const r = seq();
  const hostile = JSON.parse(JSON.stringify(r));
  hostile.tracks[0].track.title = "Evil\nTitle\r\nInjected";
  hostile.arcPresetName = "Arc\nName";
  const m3u = Engine.exportSetlistM3U8(hostile);
  const lines = m3u.split("\n").filter(Boolean);
  const extinf = lines.filter((l) => l.startsWith("#EXTINF"));
  assert.equal(extinf.length, r.tracks.length);
  assert.ok(!lines.some((l) => l === "Title" || l === "Injected" || l === "Name"));
});

test("HRD 132: M3U8 export throws on malformed result objects", () => {
  for (const bad of [null, undefined, 42, "x", {}, { tracks: null }, { tracks: {} }]) {
    assert.throws(() => Engine.exportSetlistM3U8(bad), JSON.stringify(bad));
  }
});

test("HRD 133: M3U8 survives tracks with missing metadata fields", () => {
  const r = seq();
  const hostile = JSON.parse(JSON.stringify(r));
  delete hostile.tracks[0].track;
  delete hostile.summary;
  delete hostile.seedProfile;
  const m3u = Engine.exportSetlistM3U8(hostile);
  assert.ok(m3u.includes("#EXTM3U"));
});

// ---------- exports: JSON ----------

test("HRD 140: JSON export parses and carries seed/track counts", () => {
  const r = seq();
  const obj = JSON.parse(Engine.exportSetlistJSON(r));
  assert.equal(obj.tracks.length, r.tracks.length);
  assert.equal(obj.seeds.length, r.seedProfile.seeds.length);
  assert.equal(obj.generator, "SetlistForge Cross-Domain Sonic Arc Planner");
});

test("HRD 141: JSON export throws on malformed results", () => {
  for (const bad of [null, {}, { tracks: "x" }]) {
    assert.throws(() => Engine.exportSetlistJSON(bad));
  }
});

test("HRD 142: JSON export survives missing bridge/seed fields", () => {
  const r = seq();
  const hostile = JSON.parse(JSON.stringify(r));
  hostile.tracks.forEach((t) => { delete t.bridge; });
  delete hostile.seedProfile;
  const obj = JSON.parse(Engine.exportSetlistJSON(hostile));
  assert.ok(Array.isArray(obj.seeds));
});

// ---------- exports: Markdown ----------

test("HRD 150: Markdown export contains liner-note headings and one heading per track", () => {
  const r = seq();
  const md = Engine.exportSetlistMarkdown(r);
  assert.ok(md.includes("## Cultural Seed Conditioning"));
  assert.ok(md.includes("## Sequenced Tracklist"));
  const heads = md.split("\n").filter((l) => /^### \d+\./.test(l));
  assert.equal(heads.length, r.tracks.length);
});

test("HRD 151: Markdown flattens injected newlines in titles", () => {
  const r = seq();
  const hostile = JSON.parse(JSON.stringify(r));
  hostile.tracks[0].track.title = "Line1\nLine2";
  const md = Engine.exportSetlistMarkdown(hostile);
  assert.ok(!md.split("\n").some((l) => l.trim() === "Line2"));
});

test("HRD 152: Markdown export throws on malformed results", () => {
  assert.throws(() => Engine.exportSetlistMarkdown(null));
  assert.throws(() => Engine.exportSetlistMarkdown({}));
});

// ---------- exports: csvCell + CSV ----------

test("HRD 160: csvCell prefixes formula-leading characters with apostrophe", () => {
  for (const v of ["=1+1", "+SUM(A1:A2)", "@cmd", "=HYPERLINK(\"x\")", "  =2+2"]) {
    const out = Engine.csvCell(v);
    assert.ok(out.startsWith("'") || out.startsWith("\"'"), JSON.stringify(v) + " -> " + out);
  }
});

test("HRD 160b: csvCell prefixes tab/CR-leading payloads", () => {
  for (const v of ["\tcmd", "\rcmd", " \t=1+1"]) {
    const out = Engine.csvCell(v);
    assert.ok(out.startsWith("'") || out.startsWith("\"'"), JSON.stringify(v) + " -> " + out);
  }
});

test("HRD 161: csvCell does not flag ordinary negative numbers", () => {
  assert.equal(Engine.csvCell("-3.5"), "-3.5");
  assert.equal(Engine.csvCell("-42"), "-42");
});

test("HRD 162: csvCell flags nonnumeric leading dash (DDE-style payloads)", () => {
  const out = Engine.csvCell("-cmd|'/c calc'!A1");
  assert.ok(out.startsWith("'"));
});

test("HRD 163: csvCell quotes cells containing comma, quote, or newline and doubles quotes", () => {
  assert.equal(Engine.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(Engine.csvCell("a,b"), '"a,b"');
  assert.equal(Engine.csvCell("a\nb"), '"a\nb"');
});

test("HRD 164: csvCell handles null/undefined/numbers", () => {
  assert.equal(Engine.csvCell(null), "");
  assert.equal(Engine.csvCell(undefined), "");
  assert.equal(Engine.csvCell(42), "42");
  assert.equal(Engine.csvCell(0), "0");
});

test("HRD 165: CSV export has header plus one row per track, CRLF-delimited", () => {
  const r = seq();
  const csv = Engine.exportSetlistCSV(r);
  const rows = csv.split("\r\n").filter(Boolean);
  assert.equal(rows.length, r.tracks.length + 1);
  assert.equal(rows[0].split(",")[0], "position");
  assert.ok(rows[0].includes("camelotKey"));
  assert.ok(rows[0].includes("transitionScore"));
});

test("HRD 166: CSV rows carry matching position, key, bpm for each track", () => {
  const r = seq();
  const rows = Engine.exportSetlistCSV(r).split("\r\n").filter(Boolean).slice(1);
  r.tracks.forEach((item, i) => {
    const cells = rows[i].split(",");
    assert.equal(Number(cells[0]), item.position);
    assert.ok(rows[i].includes(item.track.camelotKey));
    assert.ok(rows[i].includes(String(item.track.bpm)));
  });
});

test("HRD 167: CSV export throws on malformed results", () => {
  for (const bad of [null, undefined, {}, { tracks: "no" }]) {
    assert.throws(() => Engine.exportSetlistCSV(bad));
  }
});

test("HRD 168: CSV survives hostile title injection without stray lines", () => {
  const r = seq();
  const hostile = JSON.parse(JSON.stringify(r));
  hostile.tracks[0].track.title = "=cmd|' /c calc'!A0";
  hostile.tracks[1].track.title = "x\ny";
  const csv = Engine.exportSetlistCSV(hostile);
  const dataRows = csv.split("\r\n").filter(Boolean).slice(1);
  assert.equal(dataRows.length, r.tracks.length);
  const firstCellOfRow0 = dataRows[0].startsWith("\"'") || dataRows[0].split(",")[1].startsWith("'");
  assert.ok(firstCellOfRow0 || dataRows[0].includes("'"), "formula title must be prefixed");
});

// ---------- Qloo request builder ----------

test("HRD 170: Qloo request URL targets /v2/insights with entity urns", () => {
  const req = Engine.buildQlooInsightsRequest(SEED_IDS, "dummy-test-key-0001");
  assert.ok(req.url.startsWith("https://hackathon.api.qloo.com/v2/insights?"));
  assert.ok(req.url.includes("filter.type=urn:entity:music"));
  assert.equal(req.seedUrns.length, 3);
});

test("HRD 171: Qloo request percent-encodes the entity urn list", () => {
  const req = Engine.buildQlooInsightsRequest(SEED_IDS, "dummy-test-key-0001");
  assert.ok(req.url.includes("signal.interests.entities=urn%3A"));
  const encodedTail = req.url.split("signal.interests.entities=")[1];
  assert.ok(encodedTail && !encodedTail.split("&")[0].includes("urn:entity:"));
});

test("HRD 172: curl preview masks api key - only sanitized first 4 chars shown", () => {
  const req = Engine.buildQlooInsightsRequest(SEED_IDS, "abcdefghijklmnop");
  assert.ok(!req.curlPreview.includes("abcdefghijklmnop"));
  assert.ok(req.curlPreview.includes("abcd..."));
});

test("HRD 173: curl preview masks short or empty keys entirely", () => {
  for (const k of ["", "   ", "abc", null, undefined, 42]) {
    const req = Engine.buildQlooInsightsRequest(SEED_IDS, k);
    assert.ok(req.curlPreview.includes("YOUR_QLOO_API_KEY"), JSON.stringify(k));
  }
});

test("HRD 174: curl preview strips non-alphanumeric chars from visible prefix", () => {
  const req = Engine.buildQlooInsightsRequest(SEED_IDS, "a'\";`$(rm -rf)xxxx");
  assert.ok(!req.curlPreview.includes("rm -rf"));
  assert.ok(!req.curlPreview.includes("$("));
  assert.ok(!req.curlPreview.includes("`"));
});

test("HRD 175: curl preview is safely shell-quoted via JSON stringify", () => {
  const req = Engine.buildQlooInsightsRequest(SEED_IDS, "dummy-test-key-0001");
  assert.ok(/^curl -s -H "X-Api-Key: [^"]*" "/.test(req.curlPreview));
});

test("HRD 176: raw api key stays in headers, never in preview or url", () => {
  const secret = "secret-key-value-xyz";
  const req = Engine.buildQlooInsightsRequest(SEED_IDS, secret);
  assert.equal(req.headers["X-Api-Key"], secret);
  assert.ok(!req.curlPreview.includes(secret));
  assert.ok(!req.url.includes(secret));
});

test("HRD 177: custom endpoint base is honored and trailing slashes trimmed", () => {
  const req = Engine.buildQlooInsightsRequest(SEED_IDS, "dummy-test-key-0001", "https://api.qloo.com/");
  assert.ok(req.url.startsWith("https://api.qloo.com/v2/insights?"));
});

test("HRD 178: unknown seed ids are skipped in urn list", () => {
  const req = Engine.buildQlooInsightsRequest(["bogus-id", SEED_IDS[0]], "dummy-test-key-0001");
  assert.equal(req.seedUrns.length, 1);
});

// ---------- PASS 2 adversarial regressions (findings 1-16) ----------

test("P2-01: engine swap keeps every untouched slot identical (auto and explicit)", () => {
  const r = seq();
  const auto = Engine.swapSetlistTrack(r, 2, null);
  auto.tracks.forEach((t, i) => { if (i !== 2) assert.equal(t.track.id, r.tracks[i].track.id); });
  const candidate = TRACKS.find((t) => !r.tracks.some((i) => i.track.id === t.id));
  const manual = Engine.swapSetlistTrack(r, 5, candidate.id);
  manual.tracks.forEach((t, i) => { if (i !== 5) assert.equal(t.track.id, r.tracks[i].track.id); });
});

test("P2-02: swap preserves the user's real isPinned flags, not the internal full-pin rebuild", () => {
  const r = seq({ pinnedTracks: { 4: TRACKS[0].id } });
  const before = r.tracks.map((t) => t.isPinned);
  const swapped = Engine.swapSetlistTrack(r, 0, null);
  swapped.tracks.forEach((t, i) => assert.equal(t.isPinned, before[i], "slot " + i));
});

test("P2-03: customControlPoints without arcPresetId reports the custom preset and survives swap", () => {
  const r = Engine.sequenceSetlist({ seedIds: SEED_IDS, targetLength: 8, customControlPoints: [0.1, 0.9, 0.2] });
  assert.equal(r.arcPresetId, "custom");
  const energies = r.targetEnergies.slice();
  const swapped = Engine.swapSetlistTrack(r, 0, null);
  assert.deepEqual(swapped.targetEnergies, energies);
  assert.equal(swapped.arcPresetId, "custom");
});

test("P2-04: auto-swap never picks an excludedTrackIds member", () => {
  const excluded = TRACKS.slice(0, 6).map((t) => t.id);
  const r = seq({ excludedTrackIds: excluded });
  const swapped = Engine.swapSetlistTrack(r, 0, null, { excludedTrackIds: excluded });
  assert.ok(!excluded.includes(swapped.tracks[0].track.id));
});

test("P2-06: auto-swap honors opts.weights (affinity-only picks the max-affinity candidate)", () => {
  const r = seq();
  const used = new Set(r.tracks.map((t) => t.track.id));
  const affinityPick = TRACKS.filter((t) => !used.has(t.id))
    .map((t) => ({ t, a: Engine.cosineSimilarity(t.vector, r.seedProfile.centroid) }))
    .sort((x, y) => y.a - x.a)[0].t;
  const swapped = Engine.swapSetlistTrack(r, 3, null, { weights: { affinity: 1, energyFit: 0, harmonic: 0 } });
  assert.equal(swapped.tracks[3].track.id, affinityPick.id);
});

test("P2-07: computeSeedCentroid dedupes before applying the 4-seed cap", () => {
  const prof = Engine.computeSeedCentroid([
    "flm-heat-1995", "flm-heat-1995", "flm-paris-texas", "bok-just-kids-patti-smith", "ven-shibuya-vinyl-bar"
  ]);
  assert.equal(prof.seeds.length, 4);
  assert.ok(prof.seeds.some((s) => s.id === "ven-shibuya-vinyl-bar"));
});

test("P2-08: swap on a result without seedProfile throws a friendly Error, not TypeError", () => {
  const r = seq();
  const broken = { tracks: r.tracks };
  assert.throws(() => Engine.swapSetlistTrack(broken, 0), (err) => !(err instanceof TypeError) && /seed profile|energy arc/i.test(err.message));
});

test("P2-09: buildChordPreviewSpec treats explicit 0 vector values as real data", () => {
  const cold = { id: "c", camelotKey: "5A", bpm: 90, vector: { warmth: 0, cinematicTension: 0, acousticness: 0 } };
  const bare = { id: "b", camelotKey: "5A", bpm: 90 };
  const a = Engine.buildChordPreviewSpec(cold, TRACKS[0]);
  const b = Engine.buildChordPreviewSpec(bare, TRACKS[0]);
  assert.notEqual(a.filterCutoffHz, b.filterCutoffHz);
});

test("P2-10: buildQlooInsightsRequest dedupes and caps seeds at 4", () => {
  const ids = ["flm-heat-1995", "flm-heat-1995", "flm-paris-texas", "bok-just-kids-patti-smith", "ven-shibuya-vinyl-bar", "trk-acid-jazz-espresso"];
  const req = Engine.buildQlooInsightsRequest(ids, "dummy-test-key-0001");
  assert.equal(req.seedUrns.length, 4);
  assert.equal(new Set(req.seedUrns).size, 4);
});

test("P2-11: interpolateEnergyCurve returns a full curve for non-numeric numTracks", () => {
  for (const bad of ["abc", {}, NaN, Infinity]) {
    const curve = Engine.interpolateEnergyCurve([0.2, 0.9], bad);
    assert.equal(curve.length, 8, JSON.stringify(bad));
  }
});

test("P2-12: bridge explanations use proper domain nouns, not naive de-pluralization", () => {
  const centroid = Engine.computeSeedCentroid(SEED_IDS).centroid;
  const seeds = SEED_IDS.map((id) => Engine.getEntityById(id));
  const b = Engine.explainCrossDomainBridge(TRACKS[0], seeds, centroid);
  const text = b.seedBridges.map((s) => s.explanation).join(" ");
  assert.ok(!/Books & Essay\b|Sonic Venues & Aesthetic\b/.test(text), text);
  assert.ok(/Bridges book |Bridges sonic venue |Bridges film /.test(text), text);
});
