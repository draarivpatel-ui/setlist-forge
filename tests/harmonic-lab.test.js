const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("../engine.js");
const Lab = require("../harmonic-lab.js");

const ROOT = path.resolve(__dirname, "..");
const SEED_IDS = ["flm-in-the-mood-for-love", "bok-after-dark-murakami", "ven-kyoto-jazz-kissa"];
const TRACK0 = "trk-midnight-train-kyoto";
const TRACK1 = "trk-roygbiv-tape-hiss";
const TRACK2 = "trk-velvet-harbor-theme";

function shaRef(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function seq(strategyId, overrides) {
  return Lab.sequenceWithStrategy(strategyId || "balanced-beam", Object.assign({
    seedIds: SEED_IDS,
    targetLength: 8,
    arcPresetId: "slow_burn"
  }, overrides || {}));
}

function trackIds(result) {
  return result.tracks.map((t) => t.track.id);
}

// ---------- module surface ----------

test("LAB-001: harmonic-lab exports the documented API surface", () => {
  const expectedFns = [
    "classifyTransition", "isCamelotCompatible", "getCamelotWheelLayout", "buildWheelPath",
    "buildEnergyTelemetry", "sequenceWithStrategy", "computeSequenceMetrics", "evaluateStrategies",
    "sha256Hex", "sha256Bytes", "utf8Encode", "canonicalStringify", "buildCanonicalPayload",
    "auditedBundle", "verifyAuditedExport", "demoTamperExport", "base64UrlEncode",
    "base64UrlDecode", "encodeSlfHash", "decodeSlfHash", "normalizeSlfState", "runSelfTests"
  ];
  for (const name of expectedFns) {
    assert.equal(typeof Lab[name], "function", name);
  }
  assert.equal(Lab.STRATEGY_IDS.length, 5);
  assert.equal(Lab.SHIPPED_ARC_IDS.length, 4);
  assert.deepEqual(Lab.TRANSITION_CLASSES, ["exact", "relative-mode", "adjacent-fifth", "energy-boost", "clash"]);
});

test("LAB-002: all 5 strategies declare id, name, shortName, description", () => {
  for (const s of Lab.STRATEGIES) {
    assert.ok(typeof s.id === "string" && s.id.length > 0);
    assert.ok(typeof s.name === "string" && s.name.length > 0);
    assert.ok(typeof s.shortName === "string" && s.shortName.length > 0);
    assert.ok(typeof s.description === "string" && s.description.length > 0);
  }
  assert.equal(new Set(Lab.STRATEGY_IDS).size, 5);
});

// ---------- SHA-256 ----------

test("LAB-010: SHA-256 empty string matches FIPS 180-4", () => {
  assert.equal(Lab.sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("LAB-011: SHA-256 'abc' matches known answer", () => {
  assert.equal(Lab.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("LAB-012: SHA-256 448-bit message matches known answer", () => {
  assert.equal(
    Lab.sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
  );
});

test("LAB-013: SHA-256 quick-brown-fox matches known answer", () => {
  assert.equal(
    Lab.sha256Hex("The quick brown fox jumps over the lazy dog"),
    "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"
  );
});

test("LAB-014: SHA-256 quick-brown-fox with period matches known answer", () => {
  assert.equal(
    Lab.sha256Hex("The quick brown fox jumps over the lazy dog."),
    "ef537f25c895bfa782526529a9b63d97aa631564d5d789c2b765448c8635fb6c"
  );
});

const CRYPTO_PARITY_INPUTS = [
  "setlistforge",
  "café ∞ setlist ✓",
  "x".repeat(5000),
  '{"v":1,"arc":"slow_burn","n":8}',
  "line1\nline2\ttab",
  "0"
];

for (let i = 0; i < CRYPTO_PARITY_INPUTS.length; i += 1) {
  test(`LAB-015: SHA-256 parity with node:crypto for input ${i}`, () => {
    assert.equal(Lab.sha256Hex(CRYPTO_PARITY_INPUTS[i]), shaRef(CRYPTO_PARITY_INPUTS[i]));
  });
}

test("LAB-016: sha256Hex output is lowercase 64-char hex", () => {
  assert.match(Lab.sha256Hex("setlistforge"), /^[0-9a-f]{64}$/);
});

test("LAB-017: sha256Hex is deterministic across calls", () => {
  assert.equal(Lab.sha256Hex("repeat me"), Lab.sha256Hex("repeat me"));
});

test("LAB-018: sha256Hex accepts Uint8Array byte input", () => {
  const bytes = new TextEncoder().encode("abc");
  assert.equal(Lab.sha256Hex(bytes), Lab.sha256Hex("abc"));
});

test("LAB-019: sha256Hex coerces non-string input deterministically", () => {
  assert.equal(Lab.sha256Hex(123), shaRef("123"));
  assert.equal(Lab.sha256Hex(123), Lab.sha256Hex(123));
});

test("LAB-020: sha256Hex does not throw on null/undefined input", () => {
  assert.match(Lab.sha256Hex(null), /^[0-9a-f]{64}$/);
  assert.match(Lab.sha256Hex(undefined), /^[0-9a-f]{64}$/);
});

test("LAB-021: sha256Bytes returns a 32-byte digest", () => {
  const out = Lab.sha256Bytes(Lab.utf8Encode("abc"));
  assert.equal(out.length, 32);
  out.forEach((b) => assert.ok(Number.isInteger(b) && b >= 0 && b <= 255));
});

test("LAB-022: distinct inputs produce distinct digests", () => {
  const a = Lab.sha256Hex("alpha");
  const b = Lab.sha256Hex("beta");
  const c = Lab.sha256Hex("alpha ");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(b, c);
});

// ---------- Camelot transition classification ----------

for (let n = 1; n <= 12; n += 1) {
  test(`LAB-030: same-key self transitions for hour ${n} are exact`, () => {
    assert.equal(Lab.classifyTransition(`${n}A`, `${n}A`), "exact");
    assert.equal(Lab.classifyTransition(`${n}B`, `${n}B`), "exact");
  });
}

test("LAB-031: cyclic wraparound 12->1 and 1->12 classify as adjacent-fifth", () => {
  assert.equal(Lab.classifyTransition("12A", "1A"), "adjacent-fifth");
  assert.equal(Lab.classifyTransition("1A", "12A"), "adjacent-fifth");
  assert.equal(Lab.classifyTransition("12B", "1B"), "adjacent-fifth");
  assert.equal(Lab.classifyTransition("1B", "12B"), "adjacent-fifth");
});

test("LAB-032: same-hour A<->B transitions classify as relative-mode", () => {
  assert.equal(Lab.classifyTransition("8A", "8B"), "relative-mode");
  assert.equal(Lab.classifyTransition("8B", "8A"), "relative-mode");
  assert.equal(Lab.classifyTransition("1A", "1B"), "relative-mode");
  assert.equal(Lab.classifyTransition("12B", "12A"), "relative-mode");
});

test("LAB-033: +/-1 same-mode transitions classify as adjacent-fifth", () => {
  assert.equal(Lab.classifyTransition("3A", "4A"), "adjacent-fifth");
  assert.equal(Lab.classifyTransition("4A", "3A"), "adjacent-fifth");
  assert.equal(Lab.classifyTransition("7B", "8B"), "adjacent-fifth");
});

test("LAB-034: diagonal +/-1 and +/-2 same-mode transitions classify as energy-boost", () => {
  assert.equal(Lab.classifyTransition("8A", "10A"), "energy-boost");
  assert.equal(Lab.classifyTransition("8A", "9B"), "energy-boost");
  assert.equal(Lab.classifyTransition("11A", "1A"), "energy-boost");
  assert.equal(Lab.classifyTransition("9B", "10A"), "energy-boost");
});

test("LAB-035: wide or modal-mismatched transitions classify as clash", () => {
  assert.equal(Lab.classifyTransition("8A", "2B"), "clash");
  assert.equal(Lab.classifyTransition("1A", "7B"), "clash");
  assert.equal(Lab.classifyTransition("8A", "3A"), "clash");
  assert.equal(Lab.classifyTransition("5B", "10A"), "clash");
});

test("LAB-036: malformed Camelot strings classify as clash", () => {
  for (const bad of ["", "0A", "13A", "1C", "A8", "8AA", null, undefined, 8, {}]) {
    assert.equal(Lab.classifyTransition(bad, "8A"), "clash", JSON.stringify(bad));
    assert.equal(Lab.classifyTransition("8A", bad), "clash", JSON.stringify(bad));
  }
});

test("LAB-037: isCamelotCompatible accepts exact, relative, adjacent-fifth only", () => {
  assert.equal(Lab.isCamelotCompatible("8A", "8A"), true);
  assert.equal(Lab.isCamelotCompatible("8A", "8B"), true);
  assert.equal(Lab.isCamelotCompatible("8A", "9A"), true);
  assert.equal(Lab.isCamelotCompatible("8A", "10A"), false);
  assert.equal(Lab.isCamelotCompatible("8A", "9B"), false);
  assert.equal(Lab.isCamelotCompatible("8A", "2B"), false);
  assert.equal(Lab.isCamelotCompatible("8A", "bogus"), false);
});

// ---------- Camelot wheel layout & path ----------

test("LAB-040: wheel layout exposes 24 nodes, 12 inner and 12 outer", () => {
  const layout = Lab.getCamelotWheelLayout();
  assert.equal(layout.nodes.length, 24);
  assert.equal(layout.nodes.filter((n) => n.ring === "inner").length, 12);
  assert.equal(layout.nodes.filter((n) => n.ring === "outer").length, 12);
});

test("LAB-041: wheel node codes are unique and cover 1A..12B", () => {
  const layout = Lab.getCamelotWheelLayout();
  const codes = layout.nodes.map((n) => n.code);
  assert.equal(new Set(codes).size, 24);
  for (const code of codes) {
    assert.match(code, /^(1[0-2]|[1-9])[AB]$/);
  }
  assert.equal(new Set(Object.keys(Engine.CAMELOT_WHEEL)).size, 24);
  for (const code of codes) {
    assert.ok(Engine.CAMELOT_WHEEL[code], code);
  }
});

test("LAB-042: wheel nodes sit inside the SVG canvas bounds", () => {
  const layout = Lab.getCamelotWheelLayout();
  for (const n of layout.nodes) {
    assert.ok(n.x >= 0 && n.x <= layout.size, n.code + " x=" + n.x);
    assert.ok(n.y >= 0 && n.y <= layout.size, n.code + " y=" + n.y);
  }
});

test("LAB-043: hour 1 sits at 12 o'clock and hour 7 at 6 o'clock", () => {
  const layout = Lab.getCamelotWheelLayout();
  const n1 = layout.nodes.find((n) => n.code === "1A");
  const n7 = layout.nodes.find((n) => n.code === "7A");
  assert.equal(n1.angleDeg, -90);
  assert.ok(n1.y < layout.cy);
  assert.ok(Math.abs(n1.x - layout.cx) < 0.5);
  assert.equal(n7.angleDeg, 90);
  assert.ok(n7.y > layout.cy);
});

test("LAB-044: node polar coordinates match angle and ring radius within rounding", () => {
  const layout = Lab.getCamelotWheelLayout({ size: 420 });
  for (const n of layout.nodes) {
    const r = n.ring === "inner" ? layout.rInner : layout.rOuter;
    const rad = (n.angleDeg * Math.PI) / 180;
    const ex = layout.cx + r * Math.cos(rad);
    const ey = layout.cy + r * Math.sin(rad);
    assert.ok(Math.abs(n.x - ex) <= 0.011, n.code);
    assert.ok(Math.abs(n.y - ey) <= 0.011, n.code);
  }
});

test("LAB-045: outer ring radius exceeds inner ring radius", () => {
  const layout = Lab.getCamelotWheelLayout();
  assert.ok(layout.rOuter > layout.rInner);
});

test("LAB-046: wheel layout is deterministic and honors a valid custom size", () => {
  assert.deepEqual(Lab.getCamelotWheelLayout(), Lab.getCamelotWheelLayout());
  const big = Lab.getCamelotWheelLayout({ size: 600 });
  assert.equal(big.size, 600);
  assert.equal(big.cx, 300);
});

test("LAB-047: hostile layout sizes fall back to the 420 default", () => {
  for (const bad of [NaN, -5, 0, "x", null, {}, []]) {
    assert.equal(Lab.getCamelotWheelLayout({ size: bad }).size, 420, JSON.stringify(bad));
  }
});

test("LAB-048: every wheel node carries a non-empty musical key label", () => {
  for (const n of Lab.getCamelotWheelLayout().nodes) {
    assert.ok(typeof n.musicalKey === "string" && n.musicalKey.length > 0, n.code);
  }
});

test("LAB-049: buildWheelPath emits one key per track and one segment per transition", () => {
  const result = seq("camelot-strict");
  const path = Lab.buildWheelPath(result);
  assert.equal(path.keys.length, result.tracks.length);
  assert.equal(path.segments.length, result.transitions.length);
  assert.equal(path.segments.length, result.tracks.length - 1);
});

test("LAB-050: buildWheelPath segment classes are valid and flag-compatible", () => {
  const result = seq("balanced-beam");
  const path = Lab.buildWheelPath(result);
  for (const seg of path.segments) {
    assert.ok(Lab.TRANSITION_CLASSES.indexOf(seg.transitionClass) !== -1, seg.transitionClass);
    assert.equal(seg.compatible, Lab.COMPATIBLE_CLASSES.indexOf(seg.transitionClass) !== -1);
    assert.ok(seg.from === null || path.byCode[seg.fromCode] === seg.from);
    assert.ok(seg.to === null || path.byCode[seg.toCode] === seg.to);
  }
});

test("LAB-051: buildWheelPath tolerates a malformed result", () => {
  const path = Lab.buildWheelPath(null);
  assert.equal(path.keys.length, 0);
  assert.equal(path.segments.length, 0);
  assert.equal(path.layout.nodes.length, 24);
});

// ---------- Energy telemetry ----------

test("LAB-060: energy telemetry mirrors track count and per-slot energies", () => {
  const result = seq("energy-spline-only");
  const t = Lab.buildEnergyTelemetry(result);
  assert.equal(t.count, result.tracks.length);
  assert.equal(t.target.length, result.tracks.length);
  assert.equal(t.actual.length, result.tracks.length);
  assert.equal(t.deltas.length, result.tracks.length);
});

test("LAB-061: telemetry deltas equal actual minus target energy", () => {
  const result = seq("balanced-beam");
  const t = Lab.buildEnergyTelemetry(result);
  for (let i = 0; i < t.deltas.length; i += 1) {
    assert.ok(Math.abs(t.deltas[i] - (t.actual[i] - t.target[i])) < 0.0001);
  }
});

test("LAB-062: telemetry MSE equals the mean of squared deltas", () => {
  const result = seq("greedy-affinity");
  const t = Lab.buildEnergyTelemetry(result);
  const expected = t.deltas.reduce((s, d) => s + d * d, 0) / t.deltas.length;
  assert.ok(Math.abs(t.mse - expected) < 0.0001);
});

test("LAB-063: telemetry maxAbsDelta tracks the largest deviation", () => {
  const result = seq("balanced-beam");
  const t = Lab.buildEnergyTelemetry(result);
  const expected = Math.max.apply(null, t.deltas.map((d) => Math.abs(d)));
  assert.ok(Math.abs(t.maxAbsDelta - expected) < 0.0001);
});

test("LAB-064: telemetry values stay finite and bounded for all strategies", () => {
  for (const sid of Lab.STRATEGY_IDS) {
    const t = Lab.buildEnergyTelemetry(seq(sid));
    assert.ok(Number.isFinite(t.mse) && t.mse >= 0, sid);
    for (const v of t.target.concat(t.actual, t.deltas)) {
      assert.ok(Number.isFinite(v), sid);
    }
    for (const d of t.deltas) {
      assert.ok(Math.abs(d) <= 1.0001, sid);
    }
  }
});

test("LAB-065: telemetry tolerates malformed results without NaN", () => {
  const t = Lab.buildEnergyTelemetry(null);
  assert.equal(t.count, 0);
  assert.equal(t.mse, 0);
  assert.equal(t.maxAbsDelta, 0);
  const partial = Lab.buildEnergyTelemetry({ tracks: [{ track: {} }] });
  assert.deepEqual(partial.target, [0]);
  assert.deepEqual(partial.actual, [0]);
});

// ---------- 5-strategy x 4-arc comparator matrix ----------

const EVAL = Lab.evaluateStrategies({ seedIds: SEED_IDS, targetLength: 8 });

test("LAB-070: evaluateStrategies returns 4 arcs x 5 strategies grid plus means", () => {
  assert.deepEqual(EVAL.arcIds, Lab.SHIPPED_ARC_IDS);
  assert.deepEqual(EVAL.strategyIds, Lab.STRATEGY_IDS);
  for (const arcId of EVAL.arcIds) {
    for (const sid of EVAL.strategyIds) {
      assert.ok(EVAL.grid[arcId][sid], arcId + "/" + sid);
      assert.ok(EVAL.grid[arcId][sid].result);
      assert.ok(EVAL.grid[arcId][sid].metrics);
    }
  }
  for (const sid of EVAL.strategyIds) {
    assert.ok(EVAL.means[sid], sid);
  }
});

for (const arcId of Lab.SHIPPED_ARC_IDS) {
  for (const sid of Lab.STRATEGY_IDS) {
    test(`LAB-071: ${sid} on ${arcId} produces 8 unique tracks`, () => {
      const res = EVAL.grid[arcId][sid].result;
      const ids = trackIds(res);
      assert.equal(ids.length, 8);
      assert.equal(new Set(ids).size, 8);
      assert.equal(EVAL.grid[arcId][sid].metrics.zeroDuplicateTracks, true);
    });
  }
}

for (const arcId of Lab.SHIPPED_ARC_IDS) {
  for (const sid of Lab.STRATEGY_IDS) {
    test(`LAB-072: ${sid} on ${arcId} emits tracks-1 transitions`, () => {
      const res = EVAL.grid[arcId][sid].result;
      assert.equal(res.transitions.length, res.tracks.length - 1);
      assert.equal(EVAL.grid[arcId][sid].metrics.transitionClasses.length, res.transitions.length);
    });
  }
}

for (const arcId of Lab.SHIPPED_ARC_IDS) {
  for (const sid of Lab.STRATEGY_IDS) {
    test(`LAB-073: ${sid} on ${arcId} metrics are finite and bounded`, () => {
      const m = EVAL.grid[arcId][sid].metrics;
      assert.ok(m.camelotCompatiblePct >= 0 && m.camelotCompatiblePct <= 1, "pct");
      assert.ok(Number.isFinite(m.energyMse) && m.energyMse >= 0, "mse");
      assert.ok(m.meanAffinity >= -1 && m.meanAffinity <= 1, "aff");
      assert.ok(Number.isFinite(m.maxBpmJump) && m.maxBpmJump >= 0, "bpm");
      assert.ok(Number.isFinite(m.overallScore), "score");
      assert.equal(typeof m.pinsPreserved, "boolean");
      assert.equal(m.trackCount, 8);
    });
  }
}

for (const sid of Lab.STRATEGY_IDS) {
  test(`LAB-074: four-arc mean for ${sid} equals the arithmetic mean of the grid`, () => {
    const cells = Lab.SHIPPED_ARC_IDS.map((a) => EVAL.grid[a][sid].metrics);
    const mean = EVAL.means[sid];
    const avg = (k) => cells.reduce((s, c) => s + c[k], 0) / cells.length;
    assert.ok(Math.abs(mean.camelotCompatiblePct - avg("camelotCompatiblePct")) < 0.0001);
    assert.ok(Math.abs(mean.energyMse - avg("energyMse")) < 0.0001);
    assert.ok(Math.abs(mean.meanAffinity - avg("meanAffinity")) < 0.0001);
    assert.equal(mean.maxBpmJump, Math.max.apply(null, cells.map((c) => c.maxBpmJump)));
    assert.equal(mean.zeroDuplicateTracks, cells.every((c) => c.zeroDuplicateTracks));
    assert.equal(mean.pinsPreserved, cells.every((c) => c.pinsPreserved));
  });
}

test("LAB-075: comparator invariants hold for every cell", () => {
  for (const arcId of EVAL.arcIds) {
    for (const sid of EVAL.strategyIds) {
      const m = EVAL.grid[arcId][sid].metrics;
      assert.equal(m.zeroDuplicateTracks, true, arcId + "/" + sid);
      assert.equal(m.pinsPreserved, true, arcId + "/" + sid);
    }
  }
});

test("LAB-076: every comparator transition class is a valid class string", () => {
  for (const arcId of EVAL.arcIds) {
    for (const sid of EVAL.strategyIds) {
      for (const cls of EVAL.grid[arcId][sid].metrics.transitionClasses) {
        assert.ok(Lab.TRANSITION_CLASSES.indexOf(cls) !== -1, cls);
      }
    }
  }
});

// ---------- Strategy behavior & ordering ----------

test("LAB-080: unknown strategy id throws a descriptive error", () => {
  assert.throws(() => Lab.sequenceWithStrategy("bogus"), /Unknown sequencer strategy/);
  assert.throws(() => Lab.sequenceWithStrategy("__proto__"), /Unknown sequencer strategy/);
});

test("LAB-081: non-string strategy id falls back to balanced-beam", () => {
  const res = Lab.sequenceWithStrategy(42, { targetLength: 6 });
  assert.equal(res.strategyId, "balanced-beam");
  assert.equal(res.tracks.length, 6);
});

test("LAB-082: balanced-beam output is identical to Engine.sequenceSetlist output", () => {
  const opts = { seedIds: SEED_IDS, targetLength: 8, arcPresetId: "late_night_noir" };
  const labRes = Lab.sequenceWithStrategy("balanced-beam", opts);
  const engRes = Engine.sequenceSetlist(opts);
  assert.deepEqual(trackIds(labRes), trackIds(engRes));
});

test("LAB-083: greedy-affinity mean affinity is at least the beam mean affinity", () => {
  const greedy = seq("greedy-affinity");
  const beam = seq("balanced-beam");
  assert.ok(greedy.summary.meanAffinity >= beam.summary.meanAffinity - 1e-9,
    `${greedy.summary.meanAffinity} >= ${beam.summary.meanAffinity}`);
});

test("LAB-084: energy-spline-only MSE is at most the beam and greedy MSE", () => {
  const en = seq("energy-spline-only");
  const beam = seq("balanced-beam");
  const greedy = seq("greedy-affinity");
  assert.ok(en.summary.energyMse <= beam.summary.energyMse + 1e-9);
  assert.ok(en.summary.energyMse <= greedy.summary.energyMse + 1e-9);
});

for (const arcId of Lab.SHIPPED_ARC_IDS) {
  test(`LAB-085: camelot-strict out-compatibles greedy-affinity on ${arcId}`, () => {
    const strict = EVAL.grid[arcId]["camelot-strict"].metrics;
    const greedy = EVAL.grid[arcId]["greedy-affinity"].metrics;
    assert.ok(strict.camelotCompatiblePct >= greedy.camelotCompatiblePct,
      `${strict.camelotCompatiblePct} >= ${greedy.camelotCompatiblePct}`);
  });
}

test("LAB-086: pinned-anchor-beam auto-anchors slot 0 when nothing is pinned", () => {
  const res = seq("pinned-anchor-beam");
  assert.ok(res.pinnedAnchors && res.pinnedAnchors[0], "slot 0 anchor");
  assert.equal(res.tracks[0].track.id, res.pinnedAnchors[0]);
  assert.equal(res.tracks[0].isPinned, true);
});

test("LAB-087: pinned-anchor-beam honors a user-supplied pin instead of auto-anchoring", () => {
  const res = Lab.sequenceWithStrategy("pinned-anchor-beam", {
    seedIds: SEED_IDS,
    targetLength: 8,
    arcPresetId: "slow_burn",
    pinnedTracks: { 2: TRACK0 }
  });
  assert.equal(res.tracks[2].track.id, TRACK0);
  assert.deepEqual(res.pinnedAnchors, { 2: TRACK0 });
});

for (const sid of Lab.STRATEGY_IDS) {
  test(`LAB-088: ${sid} preserves an explicit mid-set pin`, () => {
    const res = Lab.sequenceWithStrategy(sid, {
      seedIds: SEED_IDS,
      targetLength: 8,
      arcPresetId: "slow_burn",
      pinnedTracks: { 3: TRACK1 }
    });
    assert.equal(res.tracks[3].track.id, TRACK1);
    assert.equal(Lab.computeSequenceMetrics(res, { 3: TRACK1 }).pinsPreserved, true);
  });
}

for (const sid of ["greedy-affinity", "energy-spline-only", "camelot-strict"]) {
  test(`LAB-089: ${sid} respects excludedTrackIds`, () => {
    const res = Lab.sequenceWithStrategy(sid, {
      seedIds: SEED_IDS,
      targetLength: 8,
      arcPresetId: "slow_burn",
      excludedTrackIds: [TRACK0, TRACK1]
    });
    assert.equal(trackIds(res).indexOf(TRACK0), -1);
    assert.equal(trackIds(res).indexOf(TRACK1), -1);
    assert.equal(res.tracks.length, 8);
  });
}

test("LAB-090: custom control points drive the first target energy", () => {
  for (const sid of ["balanced-beam", "greedy-affinity", "energy-spline-only"]) {
    const res = Lab.sequenceWithStrategy(sid, {
      seedIds: SEED_IDS,
      targetLength: 6,
      arcPresetId: "custom",
      customControlPoints: [0.15, 0.35, 0.55, 0.75]
    });
    assert.ok(Math.abs(res.tracks[0].targetEnergy - 0.15) < 0.02, sid);
  }
});

test("LAB-091: each strategy result is stamped with strategyId and strategyName", () => {
  for (const sid of Lab.STRATEGY_IDS) {
    const res = seq(sid);
    assert.equal(res.strategyId, sid);
    assert.ok(typeof res.strategyName === "string" && res.strategyName.length > 0);
  }
});

for (const sid of Lab.STRATEGY_IDS) {
  test(`LAB-092: ${sid} honors the 6-track lower bound`, () => {
    const res = Lab.sequenceWithStrategy(sid, { seedIds: SEED_IDS, targetLength: 6 });
    assert.equal(res.tracks.length, 6);
  });
}

for (const sid of Lab.STRATEGY_IDS) {
  test(`LAB-093: ${sid} honors the 12-track upper bound`, () => {
    const res = Lab.sequenceWithStrategy(sid, { seedIds: SEED_IDS, targetLength: 12 });
    assert.equal(res.tracks.length, 12);
  });
}

test("LAB-094: missing seedIds fall back to the default seed set", () => {
  const res = Lab.sequenceWithStrategy("balanced-beam", { targetLength: 6 });
  assert.equal(res.tracks.length, 6);
  assert.ok(res.seedProfile.seeds.length >= 1);
});

// ---------- Hostile sequencing inputs ----------

test("LAB-100: NaN targetLength falls back to 8 tracks", () => {
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: NaN }).tracks.length, 8);
});

test("LAB-101: non-numeric targetLength falls back to 8 tracks", () => {
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: "abc" }).tracks.length, 8);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: "8" }).tracks.length, 8);
});

test("LAB-102: -Infinity and Infinity targetLength fall back to 8 tracks", () => {
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: -Infinity }).tracks.length, 8);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: Infinity }).tracks.length, 8);
});

test("LAB-103: out-of-range targetLength clamps into 6..12", () => {
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: 0 }).tracks.length, 6);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: -3 }).tracks.length, 6);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: 99 }).tracks.length, 12);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: 7.6 }).tracks.length, 8);
});

test("LAB-104: all-invalid seed ids throw the engine's centroid error", () => {
  assert.throws(
    () => Lab.sequenceWithStrategy("balanced-beam", { seedIds: ["bogus-1", "bogus-2"] }),
    /cultural seed|centroid/i
  );
});

test("LAB-105: mixed valid and hostile seed ids sequence normally", () => {
  const res = Lab.sequenceWithStrategy("balanced-beam", {
    seedIds: ["flm-heat-1995", 123, null, "bogus", { id: "x" }],
    targetLength: 6
  });
  assert.equal(res.tracks.length, 6);
});

test("LAB-106: non-array seedIds fall back to defaults", () => {
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { seedIds: "flm-heat-1995" }).tracks.length, 8);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { seedIds: { 0: "flm-heat-1995" } }).tracks.length, 8);
});

test("LAB-107: NaN and hostile custom control points do not crash the strategies", () => {
  for (const sid of Lab.STRATEGY_IDS) {
    const res = Lab.sequenceWithStrategy(sid, {
      arcPresetId: "custom",
      customControlPoints: [NaN, "x", 0.5, Infinity, -0],
      targetLength: 6
    });
    assert.equal(res.tracks.length, 6, sid);
    for (const item of res.tracks) {
      assert.ok(Number.isFinite(item.targetEnergy), sid);
    }
  }
});

test("LAB-108: NaN and negative weights fall back to defaults", () => {
  const res = Lab.sequenceWithStrategy("balanced-beam", {
    targetLength: 6,
    weights: { affinity: NaN, energyFit: -1, harmonic: Infinity }
  });
  assert.equal(res.tracks.length, 6);
});

test("LAB-109: all-zero weights throw a clear error", () => {
  assert.throws(
    () => Lab.sequenceWithStrategy("balanced-beam", { weights: { affinity: 0, energyFit: 0, harmonic: 0 } }),
    /positive sequencer weight/i
  );
});

test("LAB-110: duplicate pin across two slots throws", () => {
  assert.throws(
    () => Lab.sequenceWithStrategy("greedy-affinity", { pinnedTracks: { 0: TRACK0, 1: TRACK0 } }),
    /more than one slot/
  );
});

test("LAB-111: unknown pinned track id throws", () => {
  assert.throws(
    () => Lab.sequenceWithStrategy("greedy-affinity", { pinnedTracks: { 0: "trk-nope" } }),
    /not found in the music track catalog/
  );
});

test("LAB-112: pinning a non-music entity throws", () => {
  assert.throws(
    () => Lab.sequenceWithStrategy("greedy-affinity", { pinnedTracks: { 0: "flm-heat-1995" } }),
    /not found in the music track catalog/
  );
});

test("LAB-113: out-of-range and non-numeric pin slots are ignored, not fatal", () => {
  const res = Lab.sequenceWithStrategy("greedy-affinity", {
    targetLength: 6,
    pinnedTracks: { 99: TRACK0, "-2": TRACK1, x: TRACK2, 0: TRACK2 }
  });
  assert.equal(res.tracks.length, 6);
  assert.equal(res.tracks[0].track.id, TRACK2);
});

test("LAB-114: __proto__ pin key cannot pollute Object.prototype", () => {
  const hostile = JSON.parse('{"__proto__":{"pwn":1},"0":"' + TRACK0 + '"}');
  const res = Lab.sequenceWithStrategy("greedy-affinity", {
    targetLength: 6,
    pinnedTracks: hostile
  });
  assert.equal(res.tracks[0].track.id, TRACK0);
  assert.equal({}.pwn, undefined);
  assert.equal(Object.prototype.pwn, undefined);
});

test("LAB-115: unknown arc id falls back to slow_burn targets", () => {
  const res = Lab.sequenceWithStrategy("balanced-beam", { arcPresetId: "bogus_arc", targetLength: 6 });
  assert.equal(res.tracks.length, 6);
  const slow = Engine.ENERGY_ARC_PRESETS.slow_burn.controlPoints;
  assert.ok(Math.abs(res.tracks[0].targetEnergy - slow[0]) < 0.02);
});

test("LAB-116: null options and empty options produce a default 8-track setlist", () => {
  assert.equal(Lab.sequenceWithStrategy("balanced-beam").tracks.length, 8);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", null).tracks.length, 8);
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", {}).tracks.length, 8);
});

test("LAB-117: -0 targetLength behaves like 0 and clamps to 6", () => {
  assert.equal(Lab.sequenceWithStrategy("balanced-beam", { targetLength: -0 }).tracks.length, 6);
});

// ---------- computeSequenceMetrics ----------

test("LAB-120: metrics report every documented field on a real result", () => {
  const m = Lab.computeSequenceMetrics(seq("balanced-beam"), {});
  for (const k of [
    "transitionClasses", "camelotCompatiblePct", "clashCount", "energyMse",
    "meanAffinity", "maxBpmJump", "overallScore", "energyFitScore",
    "harmonicSmoothness", "zeroDuplicateTracks", "pinsPreserved", "trackCount"
  ]) {
    assert.ok(k in m, k);
  }
});

test("LAB-121: metrics percentages stay inside 0..1 and clashCount is bounded", () => {
  for (const sid of Lab.STRATEGY_IDS) {
    const m = Lab.computeSequenceMetrics(seq(sid), {});
    assert.ok(m.camelotCompatiblePct >= 0 && m.camelotCompatiblePct <= 1, sid);
    assert.ok(m.clashCount <= m.transitionClasses.length, sid);
    assert.ok(m.meanAffinity <= 1 && m.meanAffinity >= -1, sid);
  }
});

test("LAB-122: malformed results produce zeroed metrics with pct 1", () => {
  const m = Lab.computeSequenceMetrics({}, {});
  assert.equal(m.camelotCompatiblePct, 1);
  assert.equal(m.clashCount, 0);
  assert.equal(m.energyMse, 0);
  assert.equal(m.meanAffinity, 0);
  assert.equal(m.trackCount, 0);
  assert.equal(m.zeroDuplicateTracks, true);
  assert.equal(Lab.computeSequenceMetrics(null, null).camelotCompatiblePct, 1);
});

test("LAB-123: missing camelot keys degrade to clash classes", () => {
  const fake = {
    tracks: [{ track: { id: "a" } }, { track: { id: "b" } }],
    transitions: [{ fromIndex: 0, toIndex: 1, totalScore: 0.5, bpmDelta: 4 }],
    summary: {}
  };
  const m = Lab.computeSequenceMetrics(fake, {});
  assert.deepEqual(m.transitionClasses, ["clash"]);
  assert.equal(m.camelotCompatiblePct, 0);
  assert.equal(m.clashCount, 1);
});

test("LAB-124: fabricated duplicate track ids trip the zero-duplicate invariant", () => {
  const fake = {
    tracks: [{ track: { id: "same" } }, { track: { id: "same" } }],
    transitions: [],
    summary: {}
  };
  assert.equal(Lab.computeSequenceMetrics(fake, {}).zeroDuplicateTracks, false);
});

test("LAB-125: a fabricated pin mismatch fails pinsPreserved", () => {
  const res = seq("balanced-beam");
  const m = Lab.computeSequenceMetrics(res, { 0: "trk-not-the-real-one" });
  assert.equal(m.pinsPreserved, false);
  const m2 = Lab.computeSequenceMetrics(res, { 99: "trk-irrelevant" });
  assert.equal(m2.pinsPreserved, true);
});

test("LAB-126: maxBpmJump equals the largest transition bpmDelta", () => {
  const res = seq("peak_hour_festival" === "x" ? "balanced-beam" : "balanced-beam", { arcPresetId: "peak_hour_festival" });
  const m = Lab.computeSequenceMetrics(res, {});
  const expected = Math.max.apply(null, res.transitions.map((t) => t.bpmDelta));
  assert.equal(m.maxBpmJump, expected);
});

// ---------- canonical payload & audited exports ----------

function bundleFor(strategyId, overrides) {
  const res = seq(strategyId || "balanced-beam", overrides);
  return Lab.auditedBundle(res, { strategyId: res.strategyId, strategyName: res.strategyName });
}

test("LAB-130: auditedBundle returns digest, payload, canonical, and 3 exports", () => {
  const b = bundleFor();
  assert.match(b.digest, /^[0-9a-f]{64}$/);
  assert.ok(b.payload && typeof b.payload === "object");
  assert.ok(typeof b.canonical === "string" && b.canonical.length > 0);
  for (const f of ["json", "csv", "markdown"]) {
    assert.ok(typeof b.exports[f] === "string" && b.exports[f].length > 0, f);
  }
  assert.equal(b.stateKey, b.digest);
});

test("LAB-131: identical inputs produce identical digests via the cache", () => {
  const a = bundleFor();
  const b = bundleFor();
  assert.equal(a.digest, b.digest);
});

test("LAB-132: different strategy or seeds change the digest", () => {
  const a = bundleFor("balanced-beam");
  const b = bundleFor("greedy-affinity");
  const c = bundleFor("balanced-beam", { seedIds: ["flm-blade-runner-2049", "ven-berlin-kraftwerk-vault"] });
  assert.notEqual(a.digest, b.digest);
  assert.notEqual(a.digest, c.digest);
});

test("LAB-133: digest appears verbatim in JSON, CSV, and Markdown exports", () => {
  const b = bundleFor("energy-spline-only");
  assert.ok(b.exports.json.indexOf('"digest": "' + b.digest + '"') !== -1);
  assert.ok(b.exports.csv.indexOf("# setlistforge-brief-sha256: " + b.digest) !== -1);
  assert.ok(b.exports.markdown.indexOf("**Brief SHA-256**: `" + b.digest + "`") !== -1);
});

test("LAB-134: canonical digest equals sha256 of canonicalStringify(payload)", () => {
  const b = bundleFor();
  assert.equal(b.digest, Lab.sha256Hex(Lab.canonicalStringify(b.payload)));
  assert.equal(b.canonical, Lab.canonicalStringify(b.payload));
});

test("LAB-135: verify passes on all three clean exports", () => {
  const b = bundleFor();
  for (const f of ["json", "csv", "markdown"]) {
    const v = Lab.verifyAuditedExport(f, b.exports[f], b.digest);
    assert.equal(v.ok, true, f + ": " + v.detail);
    assert.equal(v.digest, b.digest, f);
  }
});

test("LAB-136: verify also passes without an expected digest", () => {
  const b = bundleFor();
  for (const f of ["json", "csv", "markdown"]) {
    assert.equal(Lab.verifyAuditedExport(f, b.exports[f]).ok, true, f);
  }
});

test("LAB-137: demoTamperExport makes every format fail verification", () => {
  const b = bundleFor();
  for (const f of ["json", "csv", "markdown"]) {
    const tampered = Lab.demoTamperExport(f, b.exports[f]);
    assert.notEqual(tampered, b.exports[f], f);
    const v = Lab.verifyAuditedExport(f, tampered, b.digest);
    assert.equal(v.ok, false, f);
  }
});

for (const f of ["json", "csv", "markdown"]) {
  test(`LAB-138: empty ${f} export text fails verification`, () => {
    const v = Lab.verifyAuditedExport(f, "");
    assert.equal(v.ok, false);
    assert.equal(v.digest, null);
  });
}

test("LAB-139: unparseable JSON export fails verification", () => {
  const v = Lab.verifyAuditedExport("json", "{not json");
  assert.equal(v.ok, false);
  const v2 = Lab.verifyAuditedExport("json", "null");
  assert.equal(v2.ok, false);
});

test("LAB-140: CSV missing provenance lines fails verification", () => {
  const v = Lab.verifyAuditedExport("csv", "position,id\n1,trk-x\n");
  assert.equal(v.ok, false);
  assert.equal(v.digest, null);
});

test("LAB-141: Markdown missing the integrity marker fails verification", () => {
  const v = Lab.verifyAuditedExport("markdown", "# Just a title\nno integrity block\n");
  assert.equal(v.ok, false);
});

test("LAB-142: wrong expected digest is caught in every format", () => {
  const b = bundleFor();
  const wrong = "0".repeat(64);
  for (const f of ["json", "csv", "markdown"]) {
    assert.equal(Lab.verifyAuditedExport(f, b.exports[f], wrong).ok, false, f);
  }
});

test("LAB-143: unknown export format fails closed", () => {
  const v = Lab.verifyAuditedExport("xml", "<x/>");
  assert.equal(v.ok, false);
  assert.match(v.detail, /unknown export format/);
});

test("LAB-144: canonical payload captures track positions, ids, keys, and counts", () => {
  const b = bundleFor("camelot-strict");
  const p = b.payload;
  assert.equal(p.schema, "setlistforge-brief/1");
  assert.equal(p.tracks.length, 8);
  for (let i = 0; i < p.tracks.length; i += 1) {
    const t = p.tracks[i];
    assert.equal(t.position, i + 1);
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(Engine.CAMELOT_WHEEL[t.camelotKey], t.camelotKey);
    assert.ok(Number.isFinite(t.bpm));
    assert.ok(Number.isFinite(t.targetEnergy));
    assert.ok(Number.isFinite(t.actualEnergy));
  }
  assert.equal(p.transitions.length, 7);
  for (const tr of p.transitions) {
    assert.ok(Lab.TRANSITION_CLASSES.indexOf(tr.transitionClass) !== -1);
  }
});

test("LAB-145: canonical payload records seeds, arc, and strategy metadata", () => {
  const b = bundleFor("greedy-affinity");
  assert.deepEqual(b.payload.seedIds, SEED_IDS);
  assert.equal(b.payload.arcPresetId, "slow_burn");
  assert.equal(b.payload.strategyId, "greedy-affinity");
  assert.ok(b.payload.centroid && typeof b.payload.centroid === "object");
  assert.ok(b.payload.controlPoints.length >= 2);
  assert.equal(b.payload.targetLength, 8);
});

test("LAB-146: canonicalStringify sorts keys so insertion order cannot change digests", () => {
  const a = Lab.canonicalStringify({ b: 1, a: 2, c: { y: 1, x: 2 } });
  const d = Lab.canonicalStringify({ c: { x: 2, y: 1 }, a: 2, b: 1 });
  assert.equal(a, d);
  assert.equal(a, '{"a":2,"b":1,"c":{"x":2,"y":1}}');
});

test("LAB-147: canonicalStringify serializes non-finite numbers as null", () => {
  assert.equal(Lab.canonicalStringify({ a: NaN, b: Infinity, c: -Infinity, d: -0 }), '{"a":null,"b":null,"c":null,"d":0}');
});

test("LAB-148: canonicalStringify drops __proto__/constructor/prototype keys", () => {
  const hostile = JSON.parse('{"__proto__":{"p":1},"constructor":2,"prototype":3,"safe":4}');
  assert.equal(Lab.canonicalStringify(hostile), '{"safe":4}');
});

test("LAB-149: canonicalStringify handles primitives, arrays, and nulls", () => {
  assert.equal(Lab.canonicalStringify("x"), '"x"');
  assert.equal(Lab.canonicalStringify(1.5), "1.5");
  assert.equal(Lab.canonicalStringify(true), "true");
  assert.equal(Lab.canonicalStringify(null), "null");
  assert.equal(Lab.canonicalStringify([1, "a", null]), '[1,"a",null]');
  assert.equal(Lab.canonicalStringify(undefined), "null");
});

test("LAB-150: audited CSV escapes a formula-injection title cell", () => {
  const fake = {
    tracks: [
      { position: 1, track: { id: "t-x", title: "=CMD()", creator: "+bad", camelotKey: "8A", bpm: 100, durationSec: 200 }, seedAffinity: 0.5, targetEnergy: 0.5, actualEnergy: 0.5, isPinned: false },
      { position: 2, track: { id: "t-y", title: "@handle", creator: "ok", camelotKey: "9A", bpm: 101, durationSec: 210 }, seedAffinity: 0.4, targetEnergy: 0.6, actualEnergy: 0.55, isPinned: false }
    ],
    transitions: [{ fromIndex: 0, toIndex: 1, totalScore: 0.5, bpmDelta: 1, camelotInfo: {} }],
    summary: {},
    arcPresetId: "slow_burn",
    arcPresetName: "Slow Burn",
    seedProfile: { seeds: [{ id: "flm-heat-1995" }], centroid: {} },
    targetEnergies: [0.5, 0.6]
  };
  const b = Lab.auditedBundle(fake, { strategyId: "balanced-beam" });
  const dataLines = b.exports.csv.split("\n").filter((l) => l.charAt(0) !== "#" && l.trim() !== "");
  const titleCells = dataLines.map((l) => l.split(",")[2]);
  assert.ok(titleCells.some((c) => c.indexOf("'=CMD()") === 0 || c.indexOf("\"'=CMD()") === 0), titleCells.join("|"));
  assert.ok(titleCells.some((c) => c.indexOf("'@handle") === 0 || c.indexOf("\"'@handle") === 0));
  const creatorCells = dataLines.map((l) => l.split(",")[3]);
  assert.ok(creatorCells.some((c) => c.indexOf("'+bad") === 0));
});

test("LAB-151: tampering a CSV provenance line fails verification", () => {
  const b = bundleFor();
  const tampered = b.exports.csv.replace(
    "# setlistforge-brief-sha256: " + b.digest,
    "# setlistforge-brief-sha256: " + "1".repeat(64)
  );
  const v = Lab.verifyAuditedExport("csv", tampered, b.digest);
  assert.equal(v.ok, false);
});

test("LAB-152: auditedBundle rejects malformed setlist results", () => {
  assert.throws(() => Lab.auditedBundle(null), /valid setlistResult/);
  assert.throws(() => Lab.auditedBundle({}), /valid setlistResult/);
  assert.throws(() => Lab.buildCanonicalPayload({ tracks: "nope" }), /valid setlistResult/);
});

test("LAB-153: JSON export round-trips through JSON.parse", () => {
  const b = bundleFor();
  const parsed = JSON.parse(b.exports.json);
  assert.equal(parsed.integrity.digest, b.digest);
  assert.equal(parsed.integrity.algorithm, "SHA-256");
  assert.equal(parsed.brief.schema, "setlistforge-brief/1");
  assert.equal(parsed.brief.tracks.length, 8);
});

test("LAB-154: tampered JSON brief still fails even when digest field is forged", () => {
  const b = bundleFor();
  const parsed = JSON.parse(b.exports.json);
  parsed.brief.tracks[0].title = "Forged Title";
  parsed.integrity.digest = b.digest;
  const v = Lab.verifyAuditedExport("json", JSON.stringify(parsed, null, 2), b.digest);
  assert.equal(v.ok, false);
});

// ---------- #slf= bookmark codec ----------

function roundTrip(state) {
  return Lab.decodeSlfHash(Lab.encodeSlfHash(state));
}

for (const arc of Lab.SHIPPED_ARC_IDS) {
  for (const n of [6, 8, 12]) {
    test(`LAB-160: #slf= round-trips arc ${arc} with length ${n}`, () => {
      const st = { arcPresetId: arc, targetLength: n, strategyId: "balanced-beam", seedIds: SEED_IDS };
      const d = roundTrip(st);
      assert.ok(d, "decoded");
      assert.equal(d.arcPresetId, arc);
      assert.equal(d.targetLength, n);
      assert.equal(d.strategyId, "balanced-beam");
      assert.deepEqual(d.seedIds, SEED_IDS);
    });
  }
}

for (const sid of Lab.STRATEGY_IDS) {
  test(`LAB-161: #slf= round-trips strategy ${sid}`, () => {
    const d = roundTrip({ arcPresetId: "slow_burn", targetLength: 8, strategyId: sid, seedIds: SEED_IDS });
    assert.equal(d.strategyId, sid);
  });
}

test("LAB-162: #slf= round-trips pins and custom control points", () => {
  const st = {
    arcPresetId: "custom",
    customControlPoints: [0.1, 0.9, 0.4, 0.6],
    targetLength: 10,
    strategyId: "camelot-strict",
    seedIds: ["flm-heat-1995", "bok-just-kids-patti-smith"],
    pinnedTracks: { 0: TRACK0, 5: TRACK1 }
  };
  const d = roundTrip(st);
  assert.equal(d.arcPresetId, "custom");
  assert.deepEqual(d.customControlPoints, [0.1, 0.9, 0.4, 0.6]);
  assert.equal(d.targetLength, 10);
  assert.equal(d.strategyId, "camelot-strict");
  assert.deepEqual(d.pinnedTracks, { 0: TRACK0, 5: TRACK1 });
});

test("LAB-163: #slf= round-trips the maximum 4 seeds and caps extras on decode", () => {
  const four = ["flm-heat-1995", "bok-just-kids-patti-smith", "ven-shibuya-vinyl-bar", "flm-paris-texas"];
  const d = roundTrip({ arcPresetId: "slow_burn", targetLength: 8, seedIds: four });
  assert.deepEqual(d.seedIds, four);
});

test("LAB-164: encoder emits a url-safe #slf= token", () => {
  const h = Lab.encodeSlfHash({ seedIds: SEED_IDS });
  assert.match(h, /^#slf=[A-Za-z0-9_-]+$/);
  assert.ok(h.indexOf("+") === -1 && h.indexOf("/") === -1 && h.indexOf("=") === 4);
});

test("LAB-165: decoder accepts the token with or without the leading #", () => {
  const h = Lab.encodeSlfHash({ seedIds: SEED_IDS });
  const withHash = Lab.decodeSlfHash(h);
  const without = Lab.decodeSlfHash(h.slice(1));
  assert.deepEqual(withHash, without);
});

test("LAB-166: encoder only serializes numeric pin keys with string values", () => {
  const h = Lab.encodeSlfHash({
    seedIds: SEED_IDS,
    pinnedTracks: { 0: TRACK0, abc: TRACK1, 2: 42 }
  });
  const d = Lab.decodeSlfHash(h);
  assert.deepEqual(d.pinnedTracks, { 0: TRACK0 });
});

test("LAB-167: encoder with __proto__ pin key cannot pollute the output", () => {
  const hostile = JSON.parse('{"0":"' + TRACK0 + '","__proto__":"trk-evil"}');
  const h = Lab.encodeSlfHash({ seedIds: SEED_IDS, pinnedTracks: hostile });
  const d = Lab.decodeSlfHash(h);
  assert.deepEqual(d.pinnedTracks, { 0: TRACK0 });
  assert.equal({}.length, undefined);
});

const HOSTILE_HASHES = [
  "garbage",
  "",
  "#other=abc",
  "#slf=",
  "#slf=!!!",
  "#slf=a+b/c=",
  "#slf=" + "A".repeat(5000),
  "#slf=e30",          // {}
  "#slf=NDI",          // 42
  "#slf=WzFd",         // [1]
  "#slf=Ingi",         // "x"
  "#slf=bnVsbA",       // null
  "#slf=eyJ2IjoyfQ",   // {"v":2}
  "#slf=eyJhcmMiOiJzbG93X2J1cm4ifQ",                 // no v
  "#slf=eyJ2IjoxLCJhcmMiOiJib2d1cyIsInNlZWRzIjpbImZsbS1oZWF0LTE5OTUiXX0", // unknown arc
  "#slf=eyJ2IjoxLCJhcmMiOiJjdXN0b20iLCJzZWVkcyI6WyJmbG0taGVhdC0xOTk1Il19", // custom w/o cp
  "#slf=eyJ2IjoxLCJzdHJhdCI6ImJvZ3VzIiwic2VlZHMiOlsiZmxtLWhlYXQtMTk5NSJdfQ", // unknown strat
  "#slf=eyJ2IjoxLCJzZWVkcyI6W119",                   // empty seeds
  "#slf=eyJ2IjoxfQ",                                 // missing seeds
  "#slf=eyJ2IjoxLCJzZWVkcyI6WyJib2d1cyJdfQ"          // all-unknown seeds
];

for (let i = 0; i < HOSTILE_HASHES.length; i += 1) {
  test(`LAB-170: hostile hash ${i} decodes fail-closed to null`, () => {
    assert.equal(Lab.decodeSlfHash(HOSTILE_HASHES[i]), null, HOSTILE_HASHES[i]);
  });
}

test("LAB-171: non-string hash inputs decode to null", () => {
  for (const bad of [42, null, undefined, {}, [], NaN]) {
    assert.equal(Lab.decodeSlfHash(bad), null, String(bad));
  }
});

test("LAB-172: seeds array longer than 8 is rejected", () => {
  const obj = { v: 1, seeds: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] };
  assert.equal(Lab.normalizeSlfState(obj), null);
});

test("LAB-173: seeds cap at the first 4 valid ids", () => {
  const obj = {
    v: 1,
    seeds: [
      "flm-heat-1995", "bok-just-kids-patti-smith", "ven-shibuya-vinyl-bar",
      "flm-paris-texas", "flm-heat-1995", "bok-after-dark-murakami"
    ]
  };
  const d = Lab.normalizeSlfState(obj);
  assert.equal(d.seedIds.length, 4);
  assert.deepEqual(d.seedIds, ["flm-heat-1995", "bok-just-kids-patti-smith", "ven-shibuya-vinyl-bar", "flm-paris-texas"]);
});

test("LAB-174: unknown seeds are filtered while valid ones survive", () => {
  const d = Lab.normalizeSlfState({ v: 1, seeds: ["bogus", "flm-heat-1995", 12, null] });
  assert.deepEqual(d.seedIds, ["flm-heat-1995"]);
});

test("LAB-175: __proto__ and constructor keys in decoded objects fail closed", () => {
  const parsed = JSON.parse('{"v":1,"seeds":["flm-heat-1995"],"__proto__":{"x":1}}');
  assert.equal(Lab.normalizeSlfState(parsed), null);
  const parsed2 = JSON.parse('{"v":1,"seeds":["flm-heat-1995"],"constructor":{}}');
  assert.equal(Lab.normalizeSlfState(parsed2), null);
  assert.equal({}.x, undefined);
});

test("LAB-176: pins object with hostile keys fails closed", () => {
  const base = { v: 1, seeds: ["flm-heat-1995"], n: 8 };
  assert.equal(Lab.normalizeSlfState(Object.assign({}, base, { pins: { abc: TRACK0 } })), null);
  const protoPins = Object.assign({}, base);
  protoPins.pins = JSON.parse('{"__proto__":"' + TRACK0 + '"}');
  assert.equal(Lab.normalizeSlfState(protoPins), null);
  assert.equal(Lab.normalizeSlfState(Object.assign({}, base, { pins: { 0: "trk-nope" } })), null);
  assert.equal(Lab.normalizeSlfState(Object.assign({}, base, { pins: { 0: "flm-heat-1995" } })), null);
  assert.equal(Lab.normalizeSlfState(Object.assign({}, base, { pins: { 0: TRACK0, 1: TRACK0 } })), null);
  assert.equal(Lab.normalizeSlfState(Object.assign({}, base, { pins: { 0: 42 } })), null);
  assert.equal(Lab.normalizeSlfState(Object.assign({}, base, { pins: "x" })), null);
  const many = { v: 1, seeds: ["flm-heat-1995"], n: 8, pins: {} };
  for (let i = 0; i < 13; i += 1) { many.pins[i] = TRACK0; }
  assert.equal(Lab.normalizeSlfState(many), null);
});

test("LAB-177: out-of-range pin slots are skipped rather than fatal", () => {
  const d = Lab.normalizeSlfState({ v: 1, seeds: ["flm-heat-1995"], n: 8, pins: { 0: TRACK0, 99: TRACK1 } });
  assert.deepEqual(d.pinnedTracks, { 0: TRACK0 });
});

test("LAB-178: n clamps into 6..12 inside decoded state", () => {
  assert.equal(Lab.normalizeSlfState({ v: 1, seeds: ["flm-heat-1995"], n: 2 }).targetLength, 6);
  assert.equal(Lab.normalizeSlfState({ v: 1, seeds: ["flm-heat-1995"], n: 99 }).targetLength, 12);
  assert.equal(Lab.normalizeSlfState({ v: 1, seeds: ["flm-heat-1995"], n: 7.6 }).targetLength, 8);
  assert.equal(Lab.normalizeSlfState({ v: 1, seeds: ["flm-heat-1995"], n: "x" }), null);
});

test("LAB-179: normalizeSlfState rejects non-objects, huge objects, and missing v", () => {
  for (const bad of [null, undefined, 42, "x", [1], { v: 2, seeds: ["flm-heat-1995"] }]) {
    assert.equal(Lab.normalizeSlfState(bad), null, JSON.stringify(bad));
  }
  const huge = { v: 1, seeds: ["flm-heat-1995"] };
  for (let i = 0; i < 30; i += 1) { huge["k" + i] = i; }
  assert.equal(Lab.normalizeSlfState(huge), null);
});

test("LAB-180: NaN inside control points is rejected via normalizeSlfState", () => {
  const d = Lab.normalizeSlfState({ v: 1, arc: "custom", cp: [0.1, NaN, 0.3], seeds: ["flm-heat-1995"] });
  assert.equal(d, null);
  const d2 = Lab.normalizeSlfState({ v: 1, arc: "custom", cp: [0.1, Infinity, -Infinity, -0, 2], seeds: ["flm-heat-1995"] });
  assert.equal(d2, null);
});

test("LAB-181: control point count bounds are enforced", () => {
  assert.equal(Lab.normalizeSlfState({ v: 1, arc: "custom", cp: [0.5], seeds: ["flm-heat-1995"] }), null);
  const tooMany = { v: 1, arc: "custom", cp: new Array(13).fill(0.5), seeds: ["flm-heat-1995"] };
  assert.equal(Lab.normalizeSlfState(tooMany), null);
  const d = Lab.normalizeSlfState({ v: 1, arc: "custom", cp: [0.1, 1.5, -0.5], seeds: ["flm-heat-1995"] });
  assert.deepEqual(d.customControlPoints, [0.1, 1, 0]);
});

test("LAB-182: non-custom arcs drop any supplied custom control points", () => {
  const d = Lab.normalizeSlfState({ v: 1, arc: "slow_burn", cp: [0.1, 0.9], seeds: ["flm-heat-1995"] });
  assert.equal(d.arcPresetId, "slow_burn");
  assert.equal(d.customControlPoints, null);
});

test("LAB-183: encode/decode round-trip restores a restored state again", () => {
  const st = { arcPresetId: "peak_hour_festival", targetLength: 9, strategyId: "camelot-strict", seedIds: ["ven-berlin-kraftwerk-vault"], pinnedTracks: { 4: TRACK2 } };
  const d1 = roundTrip(st);
  const h2 = Lab.encodeSlfHash(d1);
  const d2 = Lab.decodeSlfHash(h2);
  assert.deepEqual(d1, d2);
});

// ---------- In-page self-test battery ----------

test("LAB-190: runSelfTests executes at least 14 checks and all pass", () => {
  const r = Lab.runSelfTests();
  assert.ok(r.total >= 14, "total " + r.total);
  assert.equal(r.allPassed, true, JSON.stringify(r.tests.filter((t) => !t.passed)));
  assert.equal(r.passed, r.total);
  assert.equal(r.failed, 0);
});

test("LAB-191: every self-test entry carries id, name, and detail", () => {
  const r = Lab.runSelfTests();
  const ids = new Set();
  for (const t of r.tests) {
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(typeof t.detail === "string");
    assert.equal(ids.has(t.id), false, t.id);
    ids.add(t.id);
  }
});

test("LAB-192: runSelfTests is deterministic across runs", () => {
  const a = Lab.runSelfTests();
  const b = Lab.runSelfTests();
  assert.equal(a.total, b.total);
  assert.equal(a.passed, b.passed);
  assert.equal(a.allPassed, b.allPassed);
});

// ---------- DOM integration surface ----------

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const labJs = fs.readFileSync(path.join(ROOT, "harmonic-lab.js"), "utf8");

test("LAB-200: index.html loads engine.js, harmonic-lab.js, app.js in order", () => {
  const ei = html.indexOf('<script src="engine.js">');
  const li = html.indexOf('<script src="harmonic-lab.js">');
  const ai = html.indexOf('<script src="app.js">');
  assert.ok(ei !== -1 && li !== -1 && ai !== -1);
  assert.ok(ei < li && li < ai);
});

test("LAB-201: lab section contains every required interactive id", () => {
  const required = [
    "harmonicLabSection", "labStrategyBadge", "labArcViewSelect", "labStrategyTable",
    "labStrategyTbody", "labApplyStrategyBtn", "labApplyStatus", "camelotWheelSvg",
    "labEnergySvg", "labEnergyStats", "labFingerprint", "labExportPreview",
    "labCopyExportBtn", "labCopyHashBtn", "labVerifyBtn", "labTamperBtn",
    "labExportStatus", "labSelfTestBtn", "labSelfTestSummary", "labSelfTestList", "labStatusText"
  ];
  for (const id of required) {
    assert.ok(html.indexOf('id="' + id + '"') !== -1, id);
  }
});

test("LAB-202: comparator table declares the 7 metric columns", () => {
  for (const th of ["Strategy", "Camelot OK", "Clashes", "Energy MSE", "Affinity", "Max BPM Jump", "Arc Score", "Invariants"]) {
    assert.ok(html.indexOf("<th scope=\"col\">" + th + "</th>") !== -1, th);
  }
});

test("LAB-203: wheel and energy SVGs carry role=img and aria-labels", () => {
  assert.match(html, /id="camelotWheelSvg"[\s\S]*?role="img"/);
  assert.match(html, /aria-label="Camelot wheel of 24 keys[^"]*"/);
  assert.match(html, /id="labEnergySvg"[\s\S]*?role="img"/);
  assert.match(html, /aria-label="Target versus actual energy[^"]*"/);
});

test("LAB-204: export format tabs use aria-pressed and data-lab-format", () => {
  for (const f of ["json", "csv", "markdown"]) {
    assert.match(html, new RegExp('data-lab-format="' + f + '" aria-pressed="(true|false)"'));
  }
});

test("LAB-205: lab styles exist for grid, table, wheel, and self-test components", () => {
  for (const cls of [
    ".lab-grid-span", ".lab-grid", ".lab-panel", ".lab-strategy-table",
    ".lab-strategy-row", ".lab-invariant-pill", "#camelotWheelSvg", ".lab-key-node",
    ".lab-fingerprint", ".lab-export-preview", ".lab-selftest-list", ".lab-status-line"
  ]) {
    assert.ok(css.indexOf(cls) !== -1, cls);
  }
});

test("LAB-206: drawer module was renumbered to 6 behind the new module 5", () => {
  assert.ok(html.indexOf("5. Harmonic &amp; Beam-Search Lab") !== -1);
  assert.ok(html.indexOf("6. Live Qloo Insights API Connector") !== -1);
});

test("LAB-207: a data-URI favicon prevents a stray favicon request", () => {
  assert.match(html, /<link rel="icon" href="data:,"/);
});

test("LAB-208: lab markup contains no inline event handlers", () => {
  const labStart = html.indexOf('id="harmonicLabSection"');
  const labEnd = html.indexOf("</section>", labStart);
  const labHtml = html.slice(labStart, labEnd);
  assert.equal(/on(click|keydown|keyup|keypress|change|input|focus|blur)=/i.test(labHtml), false);
});

test("LAB-209: app.js wires the lab module with a graceful fallback", () => {
  assert.ok(appJs.indexOf("SetlistForgeHarmonicLab") !== -1);
  assert.ok(appJs.indexOf("lab.available") !== -1);
  assert.ok(appJs.indexOf("restoreStateFromHash") !== -1);
  assert.ok(appJs.indexOf("runLabSelfTests") !== -1);
});

test("LAB-210: no em dashes or en dashes in harmonic-lab.js, app.js, index.html, styles.css, tests", () => {
  const files = {
    "harmonic-lab.js": labJs,
    "app.js": appJs,
    "index.html": html,
    "styles.css": css,
    "tests/harmonic-lab.test.js": fs.readFileSync(path.join(ROOT, "tests", "harmonic-lab.test.js"), "utf8")
  };
  const EM = "\u2014";
  const EN = "\u2013";
  for (const name of Object.keys(files)) {
    assert.equal(files[name].indexOf(EM), -1, name + " em dash");
    assert.equal(files[name].indexOf(EN), -1, name + " en dash");
  }
});

// ---------- cross-module sanity ----------

test("LAB-220: lab comparator metrics agree with direct computeSequenceMetrics calls", () => {
  const res = Lab.sequenceWithStrategy("camelot-strict", { seedIds: SEED_IDS, targetLength: 8, arcPresetId: "slow_burn" });
  const direct = Lab.computeSequenceMetrics(res, res.pinnedAnchors || {});
  const gridM = EVAL.grid.slow_burn["camelot-strict"].metrics;
  assert.equal(direct.camelotCompatiblePct, gridM.camelotCompatiblePct);
  assert.equal(direct.energyMse, gridM.energyMse);
});

test("LAB-221: sequencing is deterministic for identical inputs across strategies", () => {
  for (const sid of Lab.STRATEGY_IDS) {
    const a = trackIds(seq(sid));
    const b = trackIds(seq(sid));
    assert.deepEqual(a, b, sid);
  }
});

test("LAB-222: every sequenced track exists in the engine music catalog", () => {
  const catalogIds = new Set(Engine.getMusicTracks().map((t) => t.id));
  for (const sid of Lab.STRATEGY_IDS) {
    for (const id of trackIds(seq(sid))) {
      assert.ok(catalogIds.has(id), id);
    }
  }
});

// ---------- L580 deterministic codec and verification hardening ----------

test("L580-01: base64url decode rejects impossible lengths and nonzero canonical padding bits", () => {
  assert.deepEqual(Lab.base64UrlDecode("QQ"), [65]);
  assert.equal(Lab.base64UrlDecode("QU"), null);
  assert.deepEqual(Lab.base64UrlDecode("YWI"), [97, 98]);
  assert.equal(Lab.base64UrlDecode("YWJ"), null);
  assert.equal(Lab.base64UrlDecode("A"), null);
});

test("L580-02: UTF-8 encoding replaces lone surrogates like the platform encoder", () => {
  const text = "lone\ud800 surrogate";
  assert.equal(Lab.sha256Hex(text), shaRef(text));
});

test("L580-03: audited cache bundles are deeply immutable", () => {
  const bundle = Lab.auditedBundle(seq("balanced-beam"), { strategyId: "balanced-beam" });
  bundle.payload.tracks[0].title = "rewritten";
  bundle.exports.json = "rewritten";
  assert.notEqual(bundle.payload.tracks[0].title, "rewritten");
  assert.notEqual(bundle.exports.json, "rewritten");
});

test("L580-04: CSV verification links the brief digest to the embedded canonical payload", () => {
  const bundle = Lab.auditedBundle(seq("balanced-beam"), { strategyId: "balanced-beam" });
  assert.equal(Lab.verifyAuditedExport("csv", bundle.exports.csv).ok, true);
  const other = Lab.auditedBundle(seq("camelot-strict"), { strategyId: "camelot-strict" }).digest;
  const forged = bundle.exports.csv.replace(bundle.digest, other);
  assert.equal(Lab.verifyAuditedExport("csv", forged).ok, false);
});

test("L580-05: Markdown verification links the brief digest and rejects trailing attacker text", () => {
  const bundle = Lab.auditedBundle(seq("balanced-beam"), { strategyId: "balanced-beam" });
  assert.equal(Lab.verifyAuditedExport("markdown", bundle.exports.markdown).ok, true);
  assert.equal(Lab.verifyAuditedExport("markdown", bundle.exports.markdown + "attacker controlled text").ok, false);
  const other = Lab.auditedBundle(seq("camelot-strict"), { strategyId: "camelot-strict" }).digest;
  const forged = bundle.exports.markdown.replace(bundle.digest, other);
  assert.equal(Lab.verifyAuditedExport("markdown", forged).ok, false);
});

test("L580-06: stylesheet honors reduced motion", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /transition-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /scroll-behavior:\s*auto\s*!important/);
});
