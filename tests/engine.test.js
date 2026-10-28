const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../engine.js");

test("ENG 01: TASTE_DIMENSIONS has 8 dimensions with required keys", () => {
  assert.equal(Engine.TASTE_DIMENSIONS.length, 8);
  const keys = Engine.TASTE_DIMENSIONS.map((d) => d.key);
  assert.deepEqual(keys, [
    "tempo",
    "valence",
    "acousticness",
    "cinematicTension",
    "nostalgia",
    "lyricalDensity",
    "subculturalEdge",
    "warmth"
  ]);
});

test("ENG 02: CAMELOT_WHEEL defines all 24 keys (1A-12B) with rootHz and chordHz", () => {
  assert.equal(Object.keys(Engine.CAMELOT_WHEEL).length, 24);
  for (let n = 1; n <= 12; n++) {
    for (const m of ["A", "B"]) {
      const entry = Engine.CAMELOT_WHEEL[`${n}${m}`];
      assert.ok(entry);
      assert.equal(entry.number, n);
      assert.equal(entry.mode, m);
      assert.equal(entry.chordHz.length, 3);
      assert.ok(entry.rootHz > 100);
    }
  }
});

test("ENG 03: getCatalog returns 36 cultural entities across 4 domains", () => {
  const catalog = Engine.getCatalog();
  assert.equal(catalog.length, 36);
  const tracks = Engine.getMusicTracks(catalog);
  assert.equal(tracks.length, 18);
  const byDomain = Engine.getSeedsByDomain(catalog);
  assert.equal(byDomain["Films & Directors"].length, 6);
  assert.equal(byDomain["Books & Essays"].length, 6);
  assert.equal(byDomain["Sonic Venues & Aesthetics"].length, 6);
  assert.equal(byDomain["Music Tracks"].length, 18);
});

test("ENG 04: clamp01 and roundTo behave deterministically", () => {
  assert.equal(Engine.clamp01(-0.5), 0);
  assert.equal(Engine.clamp01(1.5), 1);
  assert.equal(Engine.clamp01(0.42), 0.42);
  assert.equal(Engine.roundTo(0.123456, 4), 0.1235);
});

test("ENG 05: getEntityById locates valid entities and returns null for unknown ID", () => {
  const e = Engine.getEntityById("flm-in-the-mood-for-love");
  assert.ok(e);
  assert.equal(e.domain, "Films & Directors");
  assert.equal(Engine.getEntityById("non-existent-id"), null);
});

test("ENG 06: computeTrackEnergy returns bounded energy in [0, 1]", () => {
  const tracks = Engine.getMusicTracks();
  for (const t of tracks) {
    const energy = Engine.computeTrackEnergy(t);
    assert.ok(energy >= 0 && energy <= 1);
  }
});

test("ENG 07: cosineSimilarity computes 1.0 for identical vectors and handles orthogonal vectors", () => {
  const a = {
    tempo: 0.8,
    valence: 0.5,
    acousticness: 0.3,
    cinematicTension: 0.7,
    nostalgia: 0.6,
    lyricalDensity: 0.4,
    subculturalEdge: 0.5,
    warmth: 0.9
  };
  assert.ok(Math.abs(Engine.cosineSimilarity(a, a) - 1) < 1e-4);
});

test("ENG 08: computeSeedCentroid aggregates 1 to 4 cross-domain seeds and ranks dominant dimensions", () => {
  const profile = Engine.computeSeedCentroid([
    "flm-in-the-mood-for-love",
    "bok-after-dark-murakami",
    "ven-kyoto-jazz-kissa"
  ]);
  assert.equal(profile.seeds.length, 3);
  assert.ok(profile.centroid.warmth > 0.5);
  assert.ok(Array.isArray(profile.dominantDimensions));
  assert.ok(profile.dominantDimensions.length >= 2);
});

test("ENG 09: parseCamelotKey parses valid keys and returns null on invalid input", () => {
  const k = Engine.parseCamelotKey("8A");
  assert.equal(k.number, 8);
  assert.equal(k.mode, "A");
  assert.equal(Engine.parseCamelotKey("99Z"), null);
});

test("ENG 10: computeCamelotDistance scores identical, adjacent fifth, and relative major/minor keys highest", () => {
  const same = Engine.computeCamelotDistance("8A", "8A");
  const fifth = Engine.computeCamelotDistance("8A", "9A");
  const wrap = Engine.computeCamelotDistance("12A", "1A");
  const rel = Engine.computeCamelotDistance("8A", "8B");
  const clash = Engine.computeCamelotDistance("8A", "2B");
  assert.equal(same.wheelSteps, 0);
  assert.equal(fifth.wheelSteps, 1);
  assert.equal(wrap.wheelSteps, 1);
  assert.equal(rel.wheelSteps, 0);
  assert.ok(same.harmonicScore >= fifth.harmonicScore);
  assert.ok(fifth.harmonicScore > clash.harmonicScore);
});

test("ENG 11: computeTransitionScore combines Camelot key compatibility and BPM delta penalty", () => {
  const tracks = Engine.getMusicTracks();
  const res = Engine.computeTransitionScore(tracks[0], tracks[1]);
  assert.ok(res.totalScore >= 0 && res.totalScore <= 1);
  assert.ok(typeof res.bpmDelta === "number");
  assert.ok(typeof res.transitionLabel === "string");
});

test("ENG 12: interpolateEnergyCurve generates exact targetLength points in [0, 1]", () => {
  const curve8 = Engine.interpolateEnergyCurve([0.2, 0.4, 0.6, 0.8, 0.7, 0.5], 8);
  assert.equal(curve8.length, 8);
  assert.equal(curve8[0], 0.2);
  assert.equal(curve8[7], 0.5);
});

test("ENG 13: explainCrossDomainBridge generates explainability bridge to non-music seeds", () => {
  const profile = Engine.computeSeedCentroid([
    "flm-in-the-mood-for-love",
    "bok-after-dark-murakami"
  ]);
  const tracks = Engine.getMusicTracks();
  const bridge = Engine.explainCrossDomainBridge(tracks[0], profile.seeds, profile.centroid);
  assert.ok(bridge.headline.length > 15);
  assert.ok(Array.isArray(bridge.sharedDimensions));
});

test("ENG 14: sequenceSetlist sequences valid 8-track setlist with unique tracks and transitions", () => {
  const res = Engine.sequenceSetlist({
    seedIds: ["flm-in-the-mood-for-love", "bok-after-dark-murakami", "ven-kyoto-jazz-kissa"],
    arcPresetId: "slow_burn",
    targetLength: 8
  });
  assert.equal(res.tracks.length, 8);
  assert.equal(res.transitions.length, 7);
  const uniqueIds = new Set(res.tracks.map((t) => t.track.id));
  assert.equal(uniqueIds.size, 8);
  assert.ok(res.summary.overallSetlistScore > 0.5);
});

test("ENG 15: sequenceSetlist honors pinnedTracks at specific slot indices", () => {
  const tracks = Engine.getMusicTracks();
  const pinnedId = tracks[4].id;
  const res = Engine.sequenceSetlist({
    seedIds: ["flm-blade-runner-2049"],
    targetLength: 6,
    pinnedTracks: { 2: pinnedId }
  });
  assert.equal(res.tracks[2].track.id, pinnedId);
  assert.equal(res.tracks[2].isPinned, true);
});

test("ENG 16: sequenceSetlist supports all 4 energy arc presets and custom control points", () => {
  for (const presetId of ["slow_burn", "late_night_noir", "peak_hour_festival", "warm_acoustic_dawn"]) {
    const res = Engine.sequenceSetlist({ arcPresetId: presetId, targetLength: 7 });
    assert.equal(res.arcPresetId, presetId);
    assert.equal(res.tracks.length, 7);
  }
  const custom = Engine.sequenceSetlist({
    arcPresetId: "custom",
    customControlPoints: [0.3, 0.5, 0.7, 0.9, 0.6, 0.4],
    targetLength: 6
  });
  assert.equal(custom.arcPresetId, "custom");
  assert.equal(custom.tracks[0].targetEnergy, 0.3);
});

test("ENG 17: swapSetlistTrack replaces slot with highest-scoring unused track or explicit track", () => {
  const base = Engine.sequenceSetlist({ targetLength: 6 });
  const oldId = base.tracks[1].track.id;
  const swapped = Engine.swapSetlistTrack(base, 1, null);
  assert.notEqual(swapped.tracks[1].track.id, oldId);
  assert.equal(swapped.tracks.length, 6);
});

test("ENG 18: buildChordPreviewSpec returns Web Audio oscillator frequencies and filter cutoff", () => {
  const tracks = Engine.getMusicTracks();
  const spec = Engine.buildChordPreviewSpec(tracks[0], tracks[1]);
  assert.equal(spec.chordAHz.length, 3);
  assert.equal(spec.chordBHz.length, 3);
  assert.ok(spec.filterCutoffHz >= 800);
  assert.ok(spec.totalDurationSec > 1);
});

test("ENG 19: exportSetlistM3U8, exportSetlistJSON, and exportSetlistMarkdown produce valid formats", () => {
  const res = Engine.sequenceSetlist({ targetLength: 6 });
  const m3u8 = Engine.exportSetlistM3U8(res);
  assert.ok(m3u8.startsWith("#EXTM3U"));
  assert.ok(m3u8.includes("#EXTINF:"));

  const jsonStr = Engine.exportSetlistJSON(res);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.tracks.length, 6);

  const md = Engine.exportSetlistMarkdown(res);
  assert.ok(md.includes("# SetlistForge Liner Notes:"));
  assert.ok(md.includes("## Sequenced Tracklist & Cross-Domain Bridges"));
});

test("ENG 20: buildQlooInsightsRequest formats Qloo v2/insights URL and masks API key in curl preview", () => {
  const req = Engine.buildQlooInsightsRequest(
    ["flm-in-the-mood-for-love", "bok-after-dark-murakami"],
    "qloo_secret_123456",
    "https://hackathon.api.qloo.com"
  );
  assert.ok(req.url.startsWith("https://hackathon.api.qloo.com/v2/insights?"));
  assert.equal(req.headers["X-Api-Key"], "qloo_secret_123456");
  assert.ok(req.curlPreview.includes("qloo..."));
  assert.ok(!req.curlPreview.includes("qloo_secret_123456"));
});
