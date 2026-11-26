(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    const engine = require("./engine.js");
    module.exports = factory(engine);
  } else {
    root.SetlistForgeHarmonicLab = factory(root.SetlistForgeEngine);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Engine) {
  "use strict";

  var DEFAULT_SEED_IDS = ["flm-in-the-mood-for-love", "bok-after-dark-murakami", "ven-kyoto-jazz-kissa"];
  var SHIPPED_ARC_IDS = ["slow_burn", "late_night_noir", "peak_hour_festival", "warm_acoustic_dawn"];

  var STRATEGIES = [
    {
      id: "greedy-affinity",
      name: "Greedy Affinity",
      shortName: "Greedy",
      description: "Picks the highest 8D seed-affinity free track per slot with no lookahead or harmonic check."
    },
    {
      id: "energy-spline-only",
      name: "Energy Spline Only",
      shortName: "Spline",
      description: "Picks the track closest to each stage's target energy, ignoring seeds and Camelot keys."
    },
    {
      id: "camelot-strict",
      name: "Camelot Strict",
      shortName: "Strict",
      description: "Restricts each pick to Camelot-compatible keys (same, relative, or +/-1 fifth) when available."
    },
    {
      id: "balanced-beam",
      name: "Balanced Beam Search",
      shortName: "Beam",
      description: "Width-24 beam search over the joint affinity + energy-fit + harmonic objective."
    },
    {
      id: "pinned-anchor-beam",
      name: "Pinned-Anchor Beam",
      shortName: "Anchor",
      description: "Beam search with slot anchors honored; anchors slot 1 to the top-affinity track when nothing is pinned."
    }
  ];

  var STRATEGY_IDS = STRATEGIES.map(function (s) { return s.id; });

  var TRANSITION_CLASSES = ["exact", "relative-mode", "adjacent-fifth", "energy-boost", "clash"];
  var COMPATIBLE_CLASSES = ["exact", "relative-mode", "adjacent-fifth"];

  function isFiniteNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isDangerousKey(key) {
    return key === "__proto__" || key === "constructor" || key === "prototype";
  }

  function oneLine(value) {
    return String(value == null ? "" : value).replace(/[\r\n]+/g, " ").trim();
  }

  // ---------------------------------------------------------------------------
  // Camelot classification, wheel layout, and path telemetry
  // ---------------------------------------------------------------------------

  function classifyTransition(keyA, keyB) {
    var info = Engine.computeCamelotDistance(keyA, keyB);
    if (!info || info.relationType === "Unmapped Key") {
      return "clash";
    }
    if (info.wheelSteps === 0) {
      return info.sameMode ? "exact" : "relative-mode";
    }
    if (info.wheelSteps === 1) {
      return info.sameMode ? "adjacent-fifth" : "energy-boost";
    }
    if (info.wheelSteps === 2 && info.sameMode) {
      return "energy-boost";
    }
    return "clash";
  }

  function isCamelotCompatible(keyA, keyB) {
    var cls = classifyTransition(keyA, keyB);
    return COMPATIBLE_CLASSES.indexOf(cls) !== -1;
  }

  function getCamelotWheelLayout(options) {
    var opts = options || {};
    var size = isFiniteNumber(opts.size) && opts.size > 120 ? opts.size : 420;
    var cx = size / 2;
    var cy = size / 2;
    var rInner = size * 0.27;
    var rOuter = size * 0.42;
    var nodes = [];
    for (var n = 1; n <= 12; n += 1) {
      var angleDeg = -90 + (n - 1) * 30;
      var rad = (angleDeg * Math.PI) / 180;
      var cos = Math.cos(rad);
      var sin = Math.sin(rad);
      var infoA = Engine.CAMELOT_WHEEL[n + "A"];
      var infoB = Engine.CAMELOT_WHEEL[n + "B"];
      nodes.push({
        code: n + "A",
        number: n,
        mode: "A",
        ring: "inner",
        musicalKey: infoA ? infoA.musicalKey : "",
        angleDeg: angleDeg,
        x: Engine.roundTo(cx + rInner * cos, 2),
        y: Engine.roundTo(cy + rInner * sin, 2)
      });
      nodes.push({
        code: n + "B",
        number: n,
        mode: "B",
        ring: "outer",
        musicalKey: infoB ? infoB.musicalKey : "",
        angleDeg: angleDeg,
        x: Engine.roundTo(cx + rOuter * cos, 2),
        y: Engine.roundTo(cy + rOuter * sin, 2)
      });
    }
    return {
      size: size,
      cx: cx,
      cy: cy,
      rInner: rInner,
      rOuter: rOuter,
      nodes: nodes
    };
  }

  function buildWheelPath(setlistResult, options) {
    var layout = getCamelotWheelLayout(options);
    var byCode = {};
    for (var i = 0; i < layout.nodes.length; i += 1) {
      byCode[layout.nodes[i].code] = layout.nodes[i];
    }
    var keys = [];
    if (setlistResult && Array.isArray(setlistResult.tracks)) {
      for (var t = 0; t < setlistResult.tracks.length; t += 1) {
        var trk = setlistResult.tracks[t] && setlistResult.tracks[t].track;
        keys.push(trk && trk.camelotKey ? trk.camelotKey : "?");
      }
    }
    var segments = [];
    var transitions = setlistResult && Array.isArray(setlistResult.transitions)
      ? setlistResult.transitions
      : [];
    for (var s = 0; s < transitions.length; s += 1) {
      var fromCode = keys[s];
      var toCode = keys[s + 1];
      var fromNode = byCode[fromCode] || null;
      var toNode = byCode[toCode] || null;
      segments.push({
        index: s,
        fromCode: fromCode,
        toCode: toCode,
        from: fromNode,
        to: toNode,
        transitionClass: classifyTransition(fromCode, toCode),
        compatible: COMPATIBLE_CLASSES.indexOf(classifyTransition(fromCode, toCode)) !== -1,
        totalScore: transitions[s] && isFiniteNumber(transitions[s].totalScore) ? transitions[s].totalScore : 0
      });
    }
    return { layout: layout, keys: keys, segments: segments, byCode: byCode };
  }

  function buildEnergyTelemetry(setlistResult) {
    var target = [];
    var actual = [];
    var deltas = [];
    var count = 0;
    if (setlistResult && Array.isArray(setlistResult.tracks)) {
      count = setlistResult.tracks.length;
      for (var i = 0; i < count; i += 1) {
        var item = setlistResult.tracks[i] || {};
        var tE = isFiniteNumber(item.targetEnergy) ? item.targetEnergy : 0;
        var aE = isFiniteNumber(item.actualEnergy) ? item.actualEnergy : 0;
        target.push(tE);
        actual.push(aE);
        deltas.push(Engine.roundTo(aE - tE, 4));
      }
    }
    var mse = 0;
    var maxAbsDelta = 0;
    for (var d = 0; d < deltas.length; d += 1) {
      mse += deltas[d] * deltas[d];
      if (Math.abs(deltas[d]) > maxAbsDelta) {
        maxAbsDelta = Math.abs(deltas[d]);
      }
    }
    mse = deltas.length ? Engine.roundTo(mse / deltas.length, 4) : 0;
    return {
      count: count,
      target: target,
      actual: actual,
      deltas: deltas,
      mse: mse,
      maxAbsDelta: Engine.roundTo(maxAbsDelta, 4)
    };
  }

  // ---------------------------------------------------------------------------
  // Sequencing strategies evaluated on top of engine.js
  // ---------------------------------------------------------------------------

  function normalizePinned(rawPinned, targetLength, catalog) {
    var pins = {};
    if (!rawPinned || typeof rawPinned !== "object") {
      return pins;
    }
    var slotById = {};
    Object.keys(rawPinned).forEach(function (slotKey) {
      var slotIdx = Number(slotKey);
      var trackId = rawPinned[slotKey];
      if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= targetLength || typeof trackId !== "string") {
        return;
      }
      if (hasOwn(slotById, trackId)) {
        throw new Error('Track "' + trackId + '" is pinned to more than one slot.');
      }
      var entity = Engine.getEntityById(trackId, catalog);
      if (!entity || entity.domain !== "Music Tracks") {
        throw new Error('Pinned track "' + trackId + '" was not found in the music track catalog.');
      }
      slotById[trackId] = slotIdx;
      pins[slotIdx] = trackId;
    });
    return pins;
  }

  function resolveSequencingInputs(options) {
    var opts = options || {};
    var catalog = Engine.getCatalog(opts.catalog);
    var seedIds = Array.isArray(opts.seedIds) && opts.seedIds.length > 0 ? opts.seedIds : DEFAULT_SEED_IDS;
    var seedProfile = Engine.computeSeedCentroid(seedIds, catalog);
    var rawLen = Number(opts.targetLength);
    var targetLength = isFiniteNumber(rawLen) ? Math.max(6, Math.min(12, Math.round(rawLen))) : 8;
    var useCustom = Array.isArray(opts.customControlPoints) &&
      (opts.arcPresetId === "custom" || !opts.arcPresetId);
    var preset = useCustom
      ? Engine.ENERGY_ARC_PRESETS.custom
      : (Engine.ENERGY_ARC_PRESETS[opts.arcPresetId] || Engine.ENERGY_ARC_PRESETS.slow_burn);
    var controlPoints = useCustom ? opts.customControlPoints.slice() : preset.controlPoints.slice();
    var targetEnergies = Engine.interpolateEnergyCurve(controlPoints, targetLength);

    var weightOr = function (value, fallback) {
      return isFiniteNumber(value) && value >= 0 ? value : fallback;
    };
    var rawWeights = opts.weights || {};
    var weights = {
      affinity: weightOr(rawWeights.affinity, 0.40),
      energyFit: weightOr(rawWeights.energyFit, 0.34),
      harmonic: weightOr(rawWeights.harmonic, 0.26)
    };
    if (weights.affinity + weights.energyFit + weights.harmonic <= 0) {
      throw new Error("At least one positive sequencer weight is required.");
    }

    var excluded = new Set(Array.isArray(opts.excludedTrackIds) ? opts.excludedTrackIds : []);
    var pinnedTracks = normalizePinned(opts.pinnedTracks, targetLength, catalog);
    var pinnedIdSet = new Set();
    Object.keys(pinnedTracks).forEach(function (k) { pinnedIdSet.add(pinnedTracks[k]); });

    var candidates = Engine.getMusicTracks(catalog).filter(function (t) {
      return !excluded.has(t.id) || pinnedIdSet.has(t.id);
    });
    if (candidates.length < targetLength) {
      throw new Error("Not enough candidate music tracks to build a setlist of length " + targetLength + ".");
    }

    var metaById = {};
    candidates.forEach(function (trk) {
      metaById[trk.id] = {
        track: trk,
        energy: Engine.computeTrackEnergy(trk),
        affinity: Engine.cosineSimilarity(trk.vector, seedProfile.centroid)
      };
    });

    return {
      catalog: catalog,
      seedIds: seedIds,
      seedProfile: seedProfile,
      targetLength: targetLength,
      useCustom: useCustom,
      preset: preset,
      controlPoints: controlPoints,
      targetEnergies: targetEnergies,
      weights: weights,
      pinnedTracks: pinnedTracks,
      pinnedIdSet: pinnedIdSet,
      candidates: candidates,
      metaById: metaById,
      originalOptions: opts
    };
  }

  function materializeGreedyResult(trackIds, resolved) {
    var fullPin = {};
    for (var i = 0; i < trackIds.length; i += 1) {
      fullPin[i] = trackIds[i];
    }
    var opts = resolved.originalOptions || {};
    var result = Engine.sequenceSetlist({
      seedIds: resolved.seedIds,
      targetLength: resolved.targetLength,
      arcPresetId: resolved.useCustom ? "custom" : resolved.preset.id,
      customControlPoints: resolved.controlPoints,
      weights: resolved.weights,
      pinnedTracks: fullPin,
      excludedTrackIds: Array.isArray(opts.excludedTrackIds) ? opts.excludedTrackIds : [],
      catalog: resolved.catalog
    });
    for (var j = 0; j < result.tracks.length; j += 1) {
      var realPinnedId = resolved.pinnedTracks[j];
      result.tracks[j].isPinned = realPinnedId === result.tracks[j].track.id;
    }
    return result;
  }

  function greedySequence(resolved, scoreFn, poolFilter) {
    var ids = [];
    var used = new Set();
    var prevTrack = null;
    for (var slot = 0; slot < resolved.targetLength; slot += 1) {
      var pinnedId = resolved.pinnedTracks[slot];
      var chosenId = null;
      if (pinnedId) {
        chosenId = pinnedId;
      } else {
        var bestId = null;
        var bestScore = -Infinity;
        var bestTie = -Infinity;
        var bestOrder = Infinity;
        for (var c = 0; c < resolved.candidates.length; c += 1) {
          var cand = resolved.candidates[c];
          if (used.has(cand.id) || resolved.pinnedIdSet.has(cand.id)) {
            continue;
          }
          if (poolFilter && prevTrack && !poolFilter(prevTrack, cand)) {
            continue;
          }
          var scored = scoreFn(cand, slot, prevTrack, resolved);
          var score = scored.score;
          var tie = scored.tie;
          if (score > bestScore ||
              (score === bestScore && tie > bestTie) ||
              (score === bestScore && tie === bestTie && c < bestOrder)) {
            bestScore = score;
            bestTie = tie;
            bestId = cand.id;
            bestOrder = c;
          }
        }
        if (bestId === null && poolFilter && prevTrack) {
          // Compatible pool ran dry: fall back to the unconstrained best score.
          for (var c2 = 0; c2 < resolved.candidates.length; c2 += 1) {
            var cand2 = resolved.candidates[c2];
            if (used.has(cand2.id) || resolved.pinnedIdSet.has(cand2.id)) {
              continue;
            }
            var s2 = scoreFn(cand2, slot, prevTrack, resolved);
            if (s2.score > bestScore ||
                (s2.score === bestScore && s2.tie > bestTie) ||
                (s2.score === bestScore && s2.tie === bestTie && c2 < bestOrder)) {
              bestScore = s2.score;
              bestTie = s2.tie;
              bestId = cand2.id;
              bestOrder = c2;
            }
          }
        }
        if (bestId === null) {
          throw new Error("No candidate track available for setlist slot " + slot + ".");
        }
        chosenId = bestId;
      }
      used.add(chosenId);
      ids.push(chosenId);
      prevTrack = resolved.metaById[chosenId] ? resolved.metaById[chosenId].track : null;
    }
    return materializeGreedyResult(ids, resolved);
  }

  function energyFitScore(energy, target) {
    var sqErr = Math.pow(energy - target, 2);
    return 1 - Math.min(1, sqErr * 4);
  }

  function sequenceWithStrategy(strategyId, options) {
    var id = typeof strategyId === "string" ? strategyId : "balanced-beam";
    if (STRATEGY_IDS.indexOf(id) === -1) {
      throw new Error('Unknown sequencer strategy "' + id + '".');
    }
    var resolved = resolveSequencingInputs(options);

    if (id === "balanced-beam" || id === "pinned-anchor-beam") {
      var opts = resolved.originalOptions || {};
      var pins = resolved.pinnedTracks;
      if (id === "pinned-anchor-beam" && Object.keys(pins).length === 0) {
        var anchorId = null;
        var anchorAffinity = -Infinity;
        resolved.candidates.forEach(function (cand) {
          var m = resolved.metaById[cand.id];
          if (m.affinity > anchorAffinity) {
            anchorAffinity = m.affinity;
            anchorId = cand.id;
          }
        });
        pins = { 0: anchorId };
      }
      var result = Engine.sequenceSetlist({
        seedIds: resolved.seedIds,
        targetLength: resolved.targetLength,
        arcPresetId: resolved.useCustom ? "custom" : resolved.preset.id,
        customControlPoints: resolved.controlPoints,
        weights: resolved.weights,
        pinnedTracks: pins,
        excludedTrackIds: Array.isArray(opts.excludedTrackIds) ? opts.excludedTrackIds : [],
        catalog: resolved.catalog
      });
      result.strategyId = id;
      result.strategyName = strategyName(id);
      result.pinnedAnchors = pins;
      return result;
    }

    var result2;
    if (id === "greedy-affinity") {
      result2 = greedySequence(resolved, function (cand, slot, prevTrack, res) {
        var meta = res.metaById[cand.id];
        return { score: meta.affinity, tie: energyFitScore(meta.energy, res.targetEnergies[slot]) };
      });
    } else if (id === "energy-spline-only") {
      result2 = greedySequence(resolved, function (cand, slot, prevTrack, res) {
        var meta = res.metaById[cand.id];
        return { score: energyFitScore(meta.energy, res.targetEnergies[slot]), tie: meta.affinity };
      });
    } else {
      // camelot-strict
      result2 = greedySequence(resolved, function (cand, slot, prevTrack, res) {
        var meta = res.metaById[cand.id];
        if (!prevTrack) {
          return {
            score: 0.5 * meta.affinity + 0.5 * energyFitScore(meta.energy, res.targetEnergies[slot]),
            tie: meta.affinity
          };
        }
        var trans = Engine.computeTransitionScore(prevTrack, cand);
        return {
          score: 0.7 * trans.totalScore + 0.3 * energyFitScore(meta.energy, res.targetEnergies[slot]),
          tie: meta.affinity
        };
      }, function (prevTrack, cand) {
        return isCamelotCompatible(prevTrack.camelotKey, cand.camelotKey);
      });
    }
    result2.strategyId = id;
    result2.strategyName = strategyName(id);
    result2.pinnedAnchors = resolved.pinnedTracks;
    return result2;
  }

  function strategyName(id) {
    for (var i = 0; i < STRATEGIES.length; i += 1) {
      if (STRATEGIES[i].id === id) {
        return STRATEGIES[i].name;
      }
    }
    return "Balanced Beam Search";
  }

  function computeSequenceMetrics(setlistResult, pinnedTracks) {
    var transitions = setlistResult && Array.isArray(setlistResult.transitions)
      ? setlistResult.transitions
      : [];
    var tracks = setlistResult && Array.isArray(setlistResult.tracks) ? setlistResult.tracks : [];

    var classes = [];
    var compatibleCount = 0;
    var clashCount = 0;
    var maxBpmJump = 0;
    for (var i = 0; i < transitions.length; i += 1) {
      var tr = transitions[i] || {};
      var info = tr.camelotInfo || {};
      var cls = classifyTransition(
        tracks[i] && tracks[i].track ? tracks[i].track.camelotKey : "",
        tracks[i + 1] && tracks[i + 1].track ? tracks[i + 1].track.camelotKey : ""
      );
      classes.push(cls);
      if (COMPATIBLE_CLASSES.indexOf(cls) !== -1) {
        compatibleCount += 1;
      }
      if (cls === "clash") {
        clashCount += 1;
      }
      if (isFiniteNumber(tr.bpmDelta) && tr.bpmDelta > maxBpmJump) {
        maxBpmJump = tr.bpmDelta;
      }
      void info;
    }

    var ids = [];
    var affinitySum = 0;
    var mseSum = 0;
    for (var t = 0; t < tracks.length; t += 1) {
      var item = tracks[t] || {};
      if (item.track && item.track.id) {
        ids.push(item.track.id);
      }
      if (isFiniteNumber(item.seedAffinity)) {
        affinitySum += item.seedAffinity;
      }
      var tE = isFiniteNumber(item.targetEnergy) ? item.targetEnergy : 0;
      var aE = isFiniteNumber(item.actualEnergy) ? item.actualEnergy : 0;
      mseSum += Math.pow(aE - tE, 2);
    }

    var pinsOk = true;
    if (pinnedTracks && typeof pinnedTracks === "object") {
      var keys = Object.keys(pinnedTracks);
      for (var p = 0; p < keys.length; p += 1) {
        var slotIdx = Number(keys[p]);
        if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= tracks.length) {
          continue;
        }
        var itemAt = tracks[slotIdx];
        if (!itemAt || !itemAt.track || itemAt.track.id !== pinnedTracks[keys[p]]) {
          pinsOk = false;
        }
      }
    }

    var summary = (setlistResult && setlistResult.summary) || {};
    return {
      transitionClasses: classes,
      camelotCompatiblePct: transitions.length ? Engine.roundTo(compatibleCount / transitions.length, 4) : 1,
      clashCount: clashCount,
      energyMse: tracks.length ? Engine.roundTo(mseSum / tracks.length, 4) : 0,
      meanAffinity: tracks.length ? Engine.roundTo(affinitySum / tracks.length, 4) : 0,
      maxBpmJump: maxBpmJump,
      overallScore: isFiniteNumber(summary.overallSetlistScore) ? summary.overallSetlistScore : 0,
      energyFitScore: isFiniteNumber(summary.energyFitScore) ? summary.energyFitScore : 0,
      harmonicSmoothness: isFiniteNumber(summary.meanHarmonicSmoothness) ? summary.meanHarmonicSmoothness : 0,
      zeroDuplicateTracks: new Set(ids).size === ids.length,
      pinsPreserved: pinsOk,
      trackCount: tracks.length
    };
  }

  function evaluateStrategies(options) {
    var opts = options || {};
    var grid = {};
    var means = {};
    for (var a = 0; a < SHIPPED_ARC_IDS.length; a += 1) {
      var arcId = SHIPPED_ARC_IDS[a];
      grid[arcId] = {};
      for (var s = 0; s < STRATEGY_IDS.length; s += 1) {
        var stratId = STRATEGY_IDS[s];
        var res = sequenceWithStrategy(stratId, Object.assign({}, opts, {
          arcPresetId: arcId,
          customControlPoints: Engine.ENERGY_ARC_PRESETS[arcId].controlPoints.slice()
        }));
        grid[arcId][stratId] = {
          result: res,
          metrics: computeSequenceMetrics(res, res.pinnedAnchors || {})
        };
      }
    }
    for (var s2 = 0; s2 < STRATEGY_IDS.length; s2 += 1) {
      var sid = STRATEGY_IDS[s2];
      var agg = {
        camelotCompatiblePct: 0,
        clashCount: 0,
        energyMse: 0,
        meanAffinity: 0,
        maxBpmJump: 0,
        overallScore: 0,
        zeroDuplicateTracks: true,
        pinsPreserved: true
      };
      for (var a2 = 0; a2 < SHIPPED_ARC_IDS.length; a2 += 1) {
        var m = grid[SHIPPED_ARC_IDS[a2]][sid].metrics;
        agg.camelotCompatiblePct += m.camelotCompatiblePct;
        agg.clashCount += m.clashCount;
        agg.energyMse += m.energyMse;
        agg.meanAffinity += m.meanAffinity;
        if (m.maxBpmJump > agg.maxBpmJump) {
          agg.maxBpmJump = m.maxBpmJump;
        }
        agg.overallScore += m.overallScore;
        if (!m.zeroDuplicateTracks) {
          agg.zeroDuplicateTracks = false;
        }
        if (!m.pinsPreserved) {
          agg.pinsPreserved = false;
        }
      }
      means[sid] = {
        camelotCompatiblePct: Engine.roundTo(agg.camelotCompatiblePct / SHIPPED_ARC_IDS.length, 4),
        clashCount: Engine.roundTo(agg.clashCount / SHIPPED_ARC_IDS.length, 4),
        energyMse: Engine.roundTo(agg.energyMse / SHIPPED_ARC_IDS.length, 4),
        meanAffinity: Engine.roundTo(agg.meanAffinity / SHIPPED_ARC_IDS.length, 4),
        maxBpmJump: agg.maxBpmJump,
        overallScore: Engine.roundTo(agg.overallScore / SHIPPED_ARC_IDS.length, 4),
        zeroDuplicateTracks: agg.zeroDuplicateTracks,
        pinsPreserved: agg.pinsPreserved
      };
    }
    return {
      arcIds: SHIPPED_ARC_IDS.slice(),
      strategyIds: STRATEGY_IDS.slice(),
      strategies: STRATEGIES.slice(),
      grid: grid,
      means: means
    };
  }

  // ---------------------------------------------------------------------------
  // Pure-JS FIPS 180-4 SHA-256
  // ---------------------------------------------------------------------------

  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr32(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function utf8Encode(str) {
    var s = String(str);
    var out = [];
    for (var i = 0; i < s.length; i += 1) {
      var code = s.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
        var low = s.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          i += 1;
        } else {
          code = 0xfffd;
        }
      } else if (code >= 0xd800 && code <= 0xdfff) {
        code = 0xfffd;
      }
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        out.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }
    return out;
  }

  function sha256Bytes(bytes) {
    var msgLen = bytes.length;
    var bitLenHi = Math.floor(msgLen / 0x20000000);
    var bitLenLo = (msgLen * 8) >>> 0;

    var padded = bytes.slice();
    padded.push(0x80);
    while (padded.length % 64 !== 56) {
      padded.push(0);
    }
    padded.push((bitLenHi >>> 24) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 8) & 0xff, bitLenHi & 0xff);
    padded.push((bitLenLo >>> 24) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 8) & 0xff, bitLenLo & 0xff);

    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);

    for (var block = 0; block < padded.length; block += 64) {
      for (var t = 0; t < 16; t += 1) {
        var o = block + t * 4;
        w[t] = ((padded[o] << 24) | (padded[o + 1] << 16) | (padded[o + 2] << 8) | padded[o + 3]) | 0;
      }
      for (var t2 = 16; t2 < 64; t2 += 1) {
        var s0 = rotr32(w[t2 - 15], 7) ^ rotr32(w[t2 - 15], 18) ^ (w[t2 - 15] >>> 3);
        var s1 = rotr32(w[t2 - 2], 17) ^ rotr32(w[t2 - 2], 19) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) | 0;
      }

      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var t3 = 0; t3 < 64; t3 += 1) {
        var S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        var ch = (e & f) ^ ((~e) & g);
        var temp1 = (hh + S1 + ch + SHA256_K[t3] + w[t3]) | 0;
        var S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        hh = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      h[0] = (h[0] + a) | 0;
      h[1] = (h[1] + b) | 0;
      h[2] = (h[2] + c) | 0;
      h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0;
      h[5] = (h[5] + f) | 0;
      h[6] = (h[6] + g) | 0;
      h[7] = (h[7] + hh) | 0;
    }

    var out = new Uint8Array(32);
    for (var i = 0; i < 8; i += 1) {
      var word = h[i] >>> 0;
      out[i * 4] = (word >>> 24) & 0xff;
      out[i * 4 + 1] = (word >>> 16) & 0xff;
      out[i * 4 + 2] = (word >>> 8) & 0xff;
      out[i * 4 + 3] = word & 0xff;
    }
    return out;
  }

  function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i += 1) {
      var b = bytes[i];
      hex += (b < 16 ? "0" : "") + b.toString(16);
    }
    return hex;
  }

  function sha256Hex(input) {
    var bytes;
    if (typeof input === "string") {
      bytes = utf8Encode(input);
    } else if (Array.isArray(input) || (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(input))) {
      bytes = Array.prototype.slice.call(input);
    } else {
      bytes = utf8Encode(String(input));
    }
    return bytesToHex(sha256Bytes(bytes));
  }

  // ---------------------------------------------------------------------------
  // Canonical digest-stamped audited brief exporter
  // ---------------------------------------------------------------------------

  function canonicalStringify(value) {
    if (value === null || value === undefined) {
      return "null";
    }
    var t = typeof value;
    if (t === "number") {
      return Number.isFinite(value) ? JSON.stringify(value) : "null";
    }
    if (t === "boolean" || t === "string") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      var parts = [];
      for (var i = 0; i < value.length; i += 1) {
        parts.push(canonicalStringify(value[i]));
      }
      return "[" + parts.join(",") + "]";
    }
    if (t === "object") {
      var keys = [];
      for (var k in value) {
        if (hasOwn(value, k)) {
          keys.push(k);
        }
      }
      keys.sort();
      var kv = [];
      for (var j = 0; j < keys.length; j += 1) {
        kv.push(JSON.stringify(keys[j]) + ":" + canonicalStringify(value[keys[j]]));
      }
      return "{" + kv.join(",") + "}";
    }
    return "null";
  }

  function buildCanonicalPayload(setlistResult, meta) {
    if (!setlistResult || !Array.isArray(setlistResult.tracks)) {
      throw new Error("A valid setlistResult is required to build an audited brief.");
    }
    var m = meta || {};
    var seeds = setlistResult.seedProfile && Array.isArray(setlistResult.seedProfile.seeds)
      ? setlistResult.seedProfile.seeds
      : [];
    var summary = setlistResult.summary || {};
    var transitions = Array.isArray(setlistResult.transitions) ? setlistResult.transitions : [];

    return {
      schema: "setlistforge-brief/1",
      generator: "SetlistForge Harmonic Lab",
      arcPresetId: setlistResult.arcPresetId || "unknown",
      arcPresetName: setlistResult.arcPresetName || "Unknown Arc",
      controlPoints: Array.isArray(setlistResult.controlPoints) ? setlistResult.controlPoints.slice() : [],
      strategyId: m.strategyId || setlistResult.strategyId || "balanced-beam",
      strategyName: m.strategyName || setlistResult.strategyName || strategyName(setlistResult.strategyId || "balanced-beam"),
      seedIds: seeds.map(function (s) { return s && s.id; }).filter(Boolean),
      centroid: (setlistResult.seedProfile && setlistResult.seedProfile.centroid) || {},
      targetLength: setlistResult.targetLength || setlistResult.tracks.length,
      targetEnergies: Array.isArray(setlistResult.targetEnergies) ? setlistResult.targetEnergies.slice() : [],
      tracks: setlistResult.tracks.map(function (item) {
        var entry = item || {};
        var trk = entry.track || {};
        return {
          position: entry.position,
          id: trk.id,
          title: trk.title,
          creator: trk.creator,
          camelotKey: trk.camelotKey,
          bpm: trk.bpm,
          durationSec: trk.durationSec,
          targetEnergy: entry.targetEnergy,
          actualEnergy: entry.actualEnergy,
          seedAffinity: entry.seedAffinity,
          isPinned: !!entry.isPinned
        };
      }),
      transitions: transitions.map(function (tr) {
        var t = tr || {};
        var info = t.camelotInfo || {};
        return {
          fromIndex: t.fromIndex,
          toIndex: t.toIndex,
          totalScore: t.totalScore,
          bpmDelta: t.bpmDelta,
          wheelSteps: info.wheelSteps,
          sameMode: info.sameMode,
          relationType: info.relationType,
          transitionClass: classifyTransition(
            setlistResult.tracks[t.fromIndex] && setlistResult.tracks[t.fromIndex].track
              ? setlistResult.tracks[t.fromIndex].track.camelotKey : "",
            setlistResult.tracks[t.toIndex] && setlistResult.tracks[t.toIndex].track
              ? setlistResult.tracks[t.toIndex].track.camelotKey : ""
          )
        };
      }),
      summary: {
        overallSetlistScore: summary.overallSetlistScore,
        meanAffinity: summary.meanAffinity,
        energyMse: summary.energyMse,
        energyFitScore: summary.energyFitScore,
        meanHarmonicSmoothness: summary.meanHarmonicSmoothness,
        totalDurationSec: summary.totalDurationSec,
        camelotPath: summary.camelotPath
      }
    };
  }

  var auditedCache = new Map();

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
      Object.freeze(value);
    }
    return value;
  }
  var AUDITED_CACHE_CAP = 24;

  function buildAuditedJsonExport(digest, payload) {
    return JSON.stringify({
      generator: "SetlistForge Harmonic Lab",
      schema: "setlistforge-brief/1",
      integrity: {
        algorithm: "SHA-256",
        digest: digest,
        scope: "canonical-brief"
      },
      brief: payload
    }, null, 2) + "\n";
  }

  function buildAuditedCsvExport(digest, payload) {
    var header = [
      "position", "id", "title", "creator", "camelotKey", "bpm", "durationSec",
      "targetEnergy", "actualEnergy", "seedAffinity", "isPinned"
    ];
    var bodyRows = [header.map(Engine.csvCell).join(",")];
    for (var i = 0; i < payload.tracks.length; i += 1) {
      var t = payload.tracks[i] || {};
      bodyRows.push([
        t.position, t.id, t.title, t.creator, t.camelotKey, t.bpm, t.durationSec,
        t.targetEnergy, t.actualEnergy, t.seedAffinity, t.isPinned ? "TRUE" : "FALSE"
      ].map(Engine.csvCell).join(","));
    }
    var body = "\n" + bodyRows.join("\r\n") + "\r\n";
    var prov = [
      "# setlistforge-brief-sha256: " + digest,
      "# setlistforge-body-sha256: " + sha256Hex(body),
      "# setlistforge-canonical-base64: " + base64UrlEncode(canonicalStringify(payload)),
      "# generator: SetlistForge Harmonic Lab"
    ].join("\n");
    return prov + "\n" + body;
  }

  function buildAuditedMarkdownExport(digest, payload) {
    var lines = [];
    lines.push("# SetlistForge Audited Setlist Brief");
    lines.push("");
    lines.push("Arc: **" + oneLine(payload.arcPresetName) + "** | Strategy: **" + oneLine(payload.strategyName) + "** | Tracks: " + payload.tracks.length);
    lines.push("");
    lines.push("## Cultural Seeds");
    lines.push("");
    for (var i = 0; i < payload.seedIds.length; i += 1) {
      lines.push("- `" + oneLine(payload.seedIds[i]) + "`");
    }
    lines.push("");
    lines.push("## Sequenced Tracklist");
    lines.push("");
    for (var j = 0; j < payload.tracks.length; j += 1) {
      var t = payload.tracks[j] || {};
      lines.push(
        (t.position == null ? j + 1 : t.position) + ". **" + oneLine(t.title) + "** - " + oneLine(t.creator) +
        " (`" + oneLine(t.camelotKey) + "`, " + oneLine(t.bpm) + " BPM)"
      );
    }
    lines.push("");
    lines.push("## Telemetry");
    lines.push("");
    lines.push("- Overall Arc Score: " + Math.round((payload.summary.overallSetlistScore || 0) * 100) + "%");
    lines.push("- Mean Seed Affinity: " + Math.round((payload.summary.meanAffinity || 0) * 100) + "%");
    lines.push("- Energy Fit: " + Math.round((payload.summary.energyFitScore || 0) * 100) + "% (MSE " + (payload.summary.energyMse || 0) + ")");
    lines.push("- Harmonic Smoothness: " + Math.round((payload.summary.meanHarmonicSmoothness || 0) * 100) + "%");
    lines.push("- Camelot Path: `" + oneLine(payload.summary.camelotPath) + "`");
    lines.push("");
    var body = lines.join("\n");
    var integrity = [
      "<!-- setlistforge-integrity -->",
      "- **Brief SHA-256**: `" + digest + "`",
      "- **Body SHA-256**: `" + sha256Hex(body) + "`",
      "- **Canonical Base64**: `" + base64UrlEncode(canonicalStringify(payload)) + "`",
      "<!-- /setlistforge-integrity -->",
      ""
    ].join("\n");
    return body + integrity;
  }

  function auditedBundle(setlistResult, meta) {
    var payload = buildCanonicalPayload(setlistResult, meta);
    var canonical = canonicalStringify(payload);
    var digest = sha256Hex(canonical);
    if (auditedCache.has(digest)) {
      return auditedCache.get(digest);
    }
    var bundle = {
      stateKey: digest,
      digest: digest,
      payload: payload,
      canonical: canonical,
      exports: {
        json: buildAuditedJsonExport(digest, payload),
        csv: buildAuditedCsvExport(digest, payload),
        markdown: buildAuditedMarkdownExport(digest, payload)
      }
    };
    if (auditedCache.size >= AUDITED_CACHE_CAP) {
      var oldest = auditedCache.keys().next();
      if (!oldest.done) {
        auditedCache.delete(oldest.value);
      }
    }
    deepFreeze(bundle);
    auditedCache.set(digest, bundle);
    return bundle;
  }

  function isHex64(value) {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  }

  function splitProvenanceLines(text) {
    var lines = String(text).split("\n");
    var i = 0;
    while (i < lines.length && lines[i].charAt(0) === "#") {
      i += 1;
    }
    var offset = 0;
    for (var k = 0; k < i; k += 1) {
      offset += lines[k].length + 1;
    }
    return { provLines: lines.slice(0, i), body: String(text).slice(offset) };
  }

  function verifyAuditedExport(format, text, expectedDigest) {
    var out = { ok: false, format: format, digest: null, detail: "" };
    if (typeof text !== "string" || text.length === 0) {
      out.detail = "empty export text";
      return out;
    }
    var expected = isHex64(expectedDigest) ? expectedDigest : null;

    if (format === "json") {
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        out.detail = "JSON parse failed";
        return out;
      }
      var digest = parsed && parsed.integrity && parsed.integrity.digest;
      out.digest = isHex64(digest) ? digest : null;
      var recomputed = sha256Hex(canonicalStringify(parsed ? parsed.brief : null));
      var ok = isHex64(digest) && digest === recomputed;
      if (ok && expected) {
        ok = digest === expected;
      }
      out.ok = ok;
      out.detail = ok ? "canonical digest verified" : "canonical digest mismatch";
      return out;
    }

    if (format === "csv") {
      var split = splitProvenanceLines(text);
      var briefDigest = null;
      var bodyDigest = null;
      var canonicalEncoded = null;
      for (var i = 0; i < split.provLines.length; i += 1) {
        var line = split.provLines[i];
        if (line.indexOf("# setlistforge-brief-sha256:") === 0) {
          briefDigest = line.slice("# setlistforge-brief-sha256:".length).trim();
        }
        if (line.indexOf("# setlistforge-body-sha256:") === 0) {
          bodyDigest = line.slice("# setlistforge-body-sha256:".length).trim();
        }
        if (line.indexOf("# setlistforge-canonical-base64:") === 0) {
          canonicalEncoded = line.slice("# setlistforge-canonical-base64:".length).trim();
        }
      }
      out.digest = isHex64(briefDigest) ? briefDigest : null;
      var recomputedBody = sha256Hex(split.body);
      var canonicalOk = false;
      if (canonicalEncoded) {
        var canonicalBytes = base64UrlDecode(canonicalEncoded);
        if (canonicalBytes) {
          try {
            canonicalOk = sha256Hex(utf8Decode(canonicalBytes)) === briefDigest;
          } catch (e2) {
            canonicalOk = false;
          }
        }
      }
      var csvOk = isHex64(briefDigest) && isHex64(bodyDigest) && bodyDigest === recomputedBody && canonicalOk;
      if (csvOk && expected) {
        csvOk = briefDigest === expected;
      }
      out.ok = csvOk;
      out.detail = csvOk ? "brief and body digests verified" : "CSV body or brief digest mismatch";
      return out;
    }

    if (format === "markdown") {
      var marker = "<!-- setlistforge-integrity -->";
      var markerIdx = text.indexOf(marker);
      if (markerIdx === -1) {
        out.detail = "integrity block missing";
        return out;
      }
      var body = text.slice(0, markerIdx);
      var footer = text.slice(markerIdx);
      var endMarker = "<!-- /setlistforge-integrity -->";
      var endIdx = footer.indexOf(endMarker);
      var terminal = endIdx !== -1 && footer.slice(endIdx + endMarker.length).trim() === "";
      var briefMatch = footer.match(/Brief SHA-256\*\*: `([0-9a-f]{64})`/);
      var bodyMatch = footer.match(/Body SHA-256\*\*: `([0-9a-f]{64})`/);
      var canonicalMatch = footer.match(/Canonical Base64\*\*: `([A-Za-z0-9_-]+)`/);
      out.digest = briefMatch ? briefMatch[1] : null;
      var canonicalOk = false;
      if (canonicalMatch) {
        var canonicalBytes = base64UrlDecode(canonicalMatch[1]);
        if (canonicalBytes) {
          try {
            canonicalOk = !!briefMatch && sha256Hex(utf8Decode(canonicalBytes)) === briefMatch[1];
          } catch (e3) {
            canonicalOk = false;
          }
        }
      }
      var mdOk = terminal && !!briefMatch && !!bodyMatch && sha256Hex(body) === bodyMatch[1] && canonicalOk;
      if (mdOk && expected) {
        mdOk = briefMatch[1] === expected;
      }
      out.ok = mdOk;
      out.detail = mdOk ? "brief and body digests verified" : "Markdown body or brief digest mismatch";
      return out;
    }

    out.detail = 'unknown export format "' + String(format) + '"';
    return out;
  }

  function demoTamperExport(format, text) {
    if (typeof text !== "string" || text.length === 0) {
      return text;
    }
    if (format === "json") {
      try {
        var parsed = JSON.parse(text);
        if (parsed && parsed.brief && Array.isArray(parsed.brief.tracks) && parsed.brief.tracks.length) {
          parsed.brief.tracks[0].title = "TAMPERED " + String(parsed.brief.tracks[0].title || "");
          return JSON.stringify(parsed, null, 2) + "\n";
        }
      } catch (e) {
        return "!" + text;
      }
      return "!" + text;
    }
    if (format === "csv") {
      var lines = text.split("\n");
      for (var i = 0; i < lines.length; i += 1) {
        if (lines[i].charAt(0) === "#" || lines[i].trim() === "") {
          continue;
        }
        var m = lines[i].match(/\d/);
        if (m) {
          var d = m[0];
          var repl = String((Number(d) + 1) % 10);
          lines[i] = lines[i].slice(0, m.index) + repl + lines[i].slice(m.index + 1);
          return lines.join("\n");
        }
      }
      return "!" + text;
    }
    if (format === "markdown") {
      var markerIdx2 = text.indexOf("<!-- setlistforge-integrity -->");
      var body = markerIdx2 === -1 ? text : text.slice(0, markerIdx2);
      var rest = markerIdx2 === -1 ? "" : text.slice(markerIdx2);
      var m2 = body.match(/\d/);
      if (m2) {
        var d2 = m2[0];
        var repl2 = String((Number(d2) + 1) % 10);
        body = body.slice(0, m2.index) + repl2 + body.slice(m2.index + 1);
      } else {
        body += " tampered";
      }
      return body + rest;
    }
    return "!" + text;
  }

  // ---------------------------------------------------------------------------
  // Strict #slf= URL-hash bookmark codec
  // ---------------------------------------------------------------------------

  var B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function base64UrlEncode(str) {
    var bytes = utf8Encode(str);
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i];
      var b1 = i + 1 < bytes.length ? bytes[i + 1] : null;
      var b2 = i + 2 < bytes.length ? bytes[i + 2] : null;
      var triplet = (b0 << 16) | ((b1 == null ? 0 : b1) << 8) | (b2 == null ? 0 : b2);
      out += B64_ALPHABET[(triplet >> 18) & 63];
      out += B64_ALPHABET[(triplet >> 12) & 63];
      out += b1 == null ? "" : B64_ALPHABET[(triplet >> 6) & 63];
      out += b2 == null ? "" : B64_ALPHABET[triplet & 63];
    }
    return out.replace(/\+/g, "-").replace(/\//g, "_");
  }

  function base64UrlDecode(str) {
    var s = String(str).replace(/-/g, "+").replace(/_/g, "/");
    if (!s || s.length % 4 === 1) {
      return null;
    }
    var rev = {};
    for (var i = 0; i < 64; i += 1) {
      rev[B64_ALPHABET[i]] = i;
    }
    var bytes = [];
    var buffer = 0;
    var bits = 0;
    for (var j = 0; j < s.length; j += 1) {
      var ch = s[j];
      if (!hasOwn(rev, ch)) {
        return null;
      }
      buffer = (buffer << 6) | rev[ch];
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
    var rem = s.length % 4;
    if (rem === 2 && (rev[s[s.length - 1]] & 15) !== 0) return null;
    if (rem === 3 && (rev[s[s.length - 1]] & 3) !== 0) return null;
    return bytes;
  }

  function utf8Decode(bytes) {
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      var code, extra;
      if (b < 0x80) {
        code = b;
        extra = 0;
      } else if (b >= 0xc2 && b < 0xe0) {
        code = b & 31;
        extra = 1;
      } else if (b >= 0xe0 && b < 0xf0) {
        code = b & 15;
        extra = 2;
      } else if (b >= 0xf0 && b <= 0xf4) {
        code = b & 7;
        extra = 3;
      } else {
        throw new RangeError("invalid UTF-8 lead byte");
      }
      if (i + extra >= bytes.length) throw new RangeError("truncated UTF-8 sequence");
      for (var j = 0; j < extra; j += 1) {
        var cb = bytes[++i];
        if ((cb & 0xc0) !== 0x80) throw new RangeError("invalid UTF-8 continuation byte");
        code = (code << 6) | (cb & 63);
      }
      var minimum = extra === 1 ? 0x80 : (extra === 2 ? 0x800 : 0x10000);
      if (extra && (code < minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))) {
        throw new RangeError("invalid UTF-8 code point");
      }
      if (code > 0xffff) {
        code -= 0x10000;
        out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
      } else {
        out += String.fromCharCode(code);
      }
      i += 1;
    }
    return out;
  }

  function normalizeSlfState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    var keys = Object.keys(raw);
    if (keys.length > 24) {
      return null;
    }
    for (var k = 0; k < keys.length; k += 1) {
      if (isDangerousKey(keys[k])) {
        return null;
      }
    }
    if (!hasOwn(raw, "v") || raw.v !== 1) {
      return null;
    }

    var arcPresetId = "slow_burn";
    var customControlPoints = null;
    if (hasOwn(raw, "arc")) {
      if (typeof raw.arc !== "string" || !Engine.ENERGY_ARC_PRESETS[raw.arc]) {
        return null;
      }
      arcPresetId = raw.arc;
    }
    if (hasOwn(raw, "cp")) {
      if (!Array.isArray(raw.cp) || raw.cp.length < 2 || raw.cp.length > 12) {
        return null;
      }
      customControlPoints = [];
      for (var c = 0; c < raw.cp.length; c += 1) {
        if (!isFiniteNumber(raw.cp[c])) {
          return null;
        }
        customControlPoints.push(Engine.roundTo(Engine.clamp01(raw.cp[c]), 4));
      }
    }
    if (arcPresetId === "custom" && !customControlPoints) {
      return null;
    }
    if (arcPresetId !== "custom") {
      customControlPoints = null;
    }

    var targetLength = 8;
    if (hasOwn(raw, "n")) {
      if (!isFiniteNumber(raw.n)) {
        return null;
      }
      targetLength = Math.max(6, Math.min(12, Math.round(raw.n)));
    }

    var strategyId = "balanced-beam";
    if (hasOwn(raw, "strat")) {
      if (typeof raw.strat !== "string" || STRATEGY_IDS.indexOf(raw.strat) === -1) {
        return null;
      }
      strategyId = raw.strat;
    }

    if (!hasOwn(raw, "seeds") || !Array.isArray(raw.seeds) || raw.seeds.length === 0 || raw.seeds.length > 8) {
      return null;
    }
    var seedIds = [];
    var seenSeeds = new Set();
    for (var s = 0; s < raw.seeds.length && seedIds.length < 4; s += 1) {
      var sid = raw.seeds[s];
      if (typeof sid !== "string" || sid.length === 0 || sid.length > 128) {
        continue;
      }
      var ent = Engine.getEntityById(sid);
      if (ent && !seenSeeds.has(ent.id)) {
        seenSeeds.add(ent.id);
        seedIds.push(ent.id);
      }
    }
    if (seedIds.length === 0) {
      return null;
    }

    var pinnedTracks = {};
    if (hasOwn(raw, "pins")) {
      if (!raw.pins || typeof raw.pins !== "object" || Array.isArray(raw.pins)) {
        return null;
      }
      var pinKeys = Object.keys(raw.pins);
      if (pinKeys.length > 12) {
        return null;
      }
      var usedPinIds = new Set();
      for (var p = 0; p < pinKeys.length; p += 1) {
        var pk = pinKeys[p];
        if (isDangerousKey(pk) || !/^-?\d+$/.test(pk)) {
          return null;
        }
        var slot = Number(pk);
        var tid = raw.pins[pk];
        if (!Number.isInteger(slot) || slot < 0 || slot >= targetLength) {
          continue;
        }
        if (typeof tid !== "string") {
          return null;
        }
        var tent = Engine.getEntityById(tid);
        if (!tent || tent.domain !== "Music Tracks") {
          return null;
        }
        if (usedPinIds.has(tid)) {
          return null;
        }
        usedPinIds.add(tid);
        pinnedTracks[slot] = tid;
      }
    }

    return {
      arcPresetId: arcPresetId,
      customControlPoints: customControlPoints,
      targetLength: targetLength,
      strategyId: strategyId,
      seedIds: seedIds,
      pinnedTracks: pinnedTracks
    };
  }

  function encodeSlfHash(state) {
    var src = state || {};
    var obj = {
      v: 1,
      arc: typeof src.arcPresetId === "string" ? src.arcPresetId : "slow_burn",
      n: src.targetLength,
      strat: typeof src.strategyId === "string" ? src.strategyId : "balanced-beam",
      seeds: Array.isArray(src.seedIds) ? src.seedIds.slice(0, 4) : []
    };
    if (obj.arc === "custom" && Array.isArray(src.customControlPoints)) {
      obj.cp = src.customControlPoints.slice(0, 12);
    }
    if (src.pinnedTracks && typeof src.pinnedTracks === "object" && Object.keys(src.pinnedTracks).length > 0) {
      obj.pins = {};
      Object.keys(src.pinnedTracks).forEach(function (k) {
        if (/^-?\d+$/.test(k) && typeof src.pinnedTracks[k] === "string") {
          obj.pins[k] = src.pinnedTracks[k];
        }
      });
    }
    return "#slf=" + base64UrlEncode(JSON.stringify(obj));
  }

  function decodeSlfHash(hashStr) {
    if (typeof hashStr !== "string") {
      return null;
    }
    var h = hashStr.trim();
    if (h.charAt(0) === "#") {
      h = h.slice(1);
    }
    if (h.indexOf("slf=") !== 0) {
      return null;
    }
    var payload = h.slice(4);
    if (payload.length === 0 || payload.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(payload)) {
      return null;
    }
    var bytes = base64UrlDecode(payload);
    if (!bytes) {
      return null;
    }
    var jsonText = utf8Decode(bytes);
    var parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      return null;
    }
    return normalizeSlfState(parsed);
  }

  // ---------------------------------------------------------------------------
  // Deterministic in-page self-test battery
  // ---------------------------------------------------------------------------

  function runSelfTests() {
    var results = [];
    function check(id, name, fn) {
      var entry = { id: id, name: name, passed: false, detail: "" };
      try {
        var detail = fn();
        entry.passed = true;
        entry.detail = typeof detail === "string" ? detail : "ok";
      } catch (e) {
        entry.detail = (e && e.message) ? e.message : String(e);
      }
      results.push(entry);
    }

    function assertEq(actual, expected, label) {
      if (actual !== expected) {
        throw new Error((label || "assert") + " expected " + expected + " got " + actual);
      }
    }

    check("SHA-KAT-1", "SHA-256 of the empty string matches FIPS 180-4", function () {
      assertEq(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
      return "empty vector ok";
    });
    check("SHA-KAT-2", "SHA-256 of abc matches FIPS 180-4", function () {
      assertEq(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
      return "abc vector ok";
    });
    check("SHA-KAT-3", "SHA-256 of the 448-bit two-block vector matches FIPS 180-4", function () {
      assertEq(
        sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
        "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
      );
      return "two-block vector ok";
    });
    check("SHA-KAT-4", "SHA-256 of one million a characters matches FIPS 180-4", function () {
      var big = new Array(1000000 + 1).join("a");
      assertEq(sha256Hex(big), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
      return "1M-byte vector ok";
    });
    check("CAM-WRAP-A", "Camelot wraparound 12A -> 1A is exactly one fifth step", function () {
      var d = Engine.computeCamelotDistance("12A", "1A");
      assertEq(d.wheelSteps, 1);
      assertEq(classifyTransition("12A", "1A"), "adjacent-fifth");
      return "12A->1A adjacent-fifth";
    });
    check("CAM-WRAP-B", "Camelot wraparound 12B -> 1B is exactly one fifth step", function () {
      var d = Engine.computeCamelotDistance("12B", "1B");
      assertEq(d.wheelSteps, 1);
      assertEq(classifyTransition("12B", "1B"), "adjacent-fifth");
      return "12B->1B adjacent-fifth";
    });
    check("CAM-REL", "Relative mode switch 8A -> 8B is a zero-step relative bridge", function () {
      var d = Engine.computeCamelotDistance("8A", "8B");
      assertEq(d.wheelSteps, 0);
      assertEq(d.sameMode, false);
      assertEq(classifyTransition("8A", "8B"), "relative-mode");
      return "8A->8B relative-mode";
    });
    check("INV-NODUP", "Zero-duplicate invariant holds for all 5 strategies across all 4 arcs", function () {
      var evald = evaluateStrategies({ targetLength: 8 });
      for (var a = 0; a < evald.arcIds.length; a += 1) {
        for (var s = 0; s < evald.strategyIds.length; s += 1) {
          var m = evald.grid[evald.arcIds[a]][evald.strategyIds[s]].metrics;
          if (!m.zeroDuplicateTracks) {
            throw new Error("duplicate track in " + evald.arcIds[a] + "/" + evald.strategyIds[s]);
          }
        }
      }
      return "20/20 grids duplicate-free";
    });
    check("INV-PINS", "Pin preservation holds across re-sequencing for all strategies", function () {
      var tracks = Engine.getMusicTracks();
      var pinId = tracks[3].id;
      for (var s = 0; s < STRATEGY_IDS.length; s += 1) {
        var res = sequenceWithStrategy(STRATEGY_IDS[s], {
          targetLength: 7,
          pinnedTracks: { 2: pinId }
        });
        if (res.tracks[2].track.id !== pinId) {
          throw new Error(STRATEGY_IDS[s] + " dropped pin at slot 2");
        }
      }
      return "pin preserved by 5/5 strategies";
    });
    check("BEAM-SANE", "Beam objective matches or beats greedy-affinity on identical inputs", function () {
      var beam = sequenceWithStrategy("balanced-beam", { targetLength: 8, arcPresetId: "slow_burn" });
      var greedy = sequenceWithStrategy("greedy-affinity", { targetLength: 8, arcPresetId: "slow_burn" });
      if (beam.summary.overallSetlistScore + 1e-9 < greedy.summary.overallSetlistScore) {
        throw new Error("beam " + beam.summary.overallSetlistScore + " < greedy " + greedy.summary.overallSetlistScore);
      }
      return "beam " + beam.summary.overallSetlistScore + " >= greedy " + greedy.summary.overallSetlistScore;
    });
    check("CSV-ESC", "Formula-leading CSV cells are apostrophe-escaped", function () {
      var cell = Engine.csvCell("=CMD()| calc!A0");
      if (cell.charAt(0) !== "'") {
        throw new Error("formula cell not escaped: " + cell);
      }
      var cell2 = Engine.csvCell("@SUM(1)");
      if (cell2.charAt(0) !== "'") {
        throw new Error("at-formula cell not escaped");
      }
      return "formula cells escaped";
    });
    check("TAMPER", "Tampering with the JSON export is detected by verification", function () {
      var res = sequenceWithStrategy("balanced-beam", { targetLength: 6 });
      var bundle = auditedBundle(res, { strategyId: "balanced-beam" });
      var v1 = verifyAuditedExport("json", bundle.exports.json, bundle.digest);
      if (!v1.ok) {
        throw new Error("clean export failed verify");
      }
      var tampered = demoTamperExport("json", bundle.exports.json);
      var v2 = verifyAuditedExport("json", tampered, bundle.digest);
      if (v2.ok) {
        throw new Error("tampered export passed verify");
      }
      return "tamper detected";
    });
    check("SLF-RT", "#slf= hash round-trips arc, length, strategy, and seeds", function () {
      var state = {
        arcPresetId: "peak_hour_festival",
        targetLength: 10,
        strategyId: "camelot-strict",
        seedIds: ["flm-heat-1995", "bok-ghosts-of-my-life"]
      };
      var decoded = decodeSlfHash(encodeSlfHash(state));
      if (!decoded) {
        throw new Error("decode returned null");
      }
      assertEq(decoded.arcPresetId, "peak_hour_festival");
      assertEq(decoded.targetLength, 10);
      assertEq(decoded.strategyId, "camelot-strict");
      assertEq(decoded.seedIds.join(","), "flm-heat-1995,bok-ghosts-of-my-life");
      return "round-trip clean";
    });
    check("SLF-HOSTILE", "Hostile and malformed #slf= payloads fail closed", function () {
      var cases = [
        "#slf=!!!notbase64",
        "#slf=",
        "slf=AAAA",
        "#other=abc",
        "#slf=" + base64UrlEncode('{"v":2,"arc":"slow_burn","seeds":["flm-heat-1995"]}'),
        "#slf=" + base64UrlEncode('{"v":1,"arc":"evil_arc","seeds":["flm-heat-1995"]}'),
        "#slf=" + base64UrlEncode('{"v":1,"seeds":["flm-heat-1995"],"__proto__":{"x":1}}'),
        "#slf=" + base64UrlEncode('{"v":1,"seeds":["nope-1","nope-2"]}')
      ];
      for (var i = 0; i < cases.length; i += 1) {
        if (decodeSlfHash(cases[i]) !== null) {
          throw new Error("hostile hash accepted: " + cases[i]);
        }
      }
      var polluted = {};
      assertEq(polluted.x, undefined);
      return String(cases.length) + " hostile payloads rejected";
    });
    check("GRID", "5x4 strategy comparator returns bounded metrics for every cell", function () {
      var evald = evaluateStrategies({ targetLength: 6 });
      if (evald.arcIds.length !== 4 || evald.strategyIds.length !== 5) {
        throw new Error("grid dimensions wrong");
      }
      for (var a = 0; a < 4; a += 1) {
        for (var s = 0; s < 5; s += 1) {
          var m = evald.grid[evald.arcIds[a]][evald.strategyIds[s]].metrics;
          if (!isFiniteNumber(m.camelotCompatiblePct) || m.camelotCompatiblePct < 0 || m.camelotCompatiblePct > 1) {
            throw new Error("bad compatibility pct at " + evald.arcIds[a] + "/" + evald.strategyIds[s]);
          }
          if (!isFiniteNumber(m.energyMse) || m.energyMse < 0) {
            throw new Error("bad mse at " + evald.arcIds[a] + "/" + evald.strategyIds[s]);
          }
        }
      }
      return "20 cells bounded";
    });
    check("DIGEST-PARITY", "JSON, CSV, Markdown, and fingerprint digests are identical", function () {
      var res = sequenceWithStrategy("energy-spline-only", { targetLength: 6 });
      var bundle = auditedBundle(res, { strategyId: "energy-spline-only" });
      if (bundle.exports.json.indexOf(bundle.digest) === -1) {
        throw new Error("json missing digest");
      }
      if (bundle.exports.csv.indexOf("setlistforge-brief-sha256: " + bundle.digest) === -1) {
        throw new Error("csv missing digest");
      }
      if (bundle.exports.markdown.indexOf("Brief SHA-256**: `" + bundle.digest + "`") === -1) {
        throw new Error("markdown missing digest");
      }
      return "digest " + bundle.digest.slice(0, 16) + " uniform";
    });

    var passed = 0;
    for (var i = 0; i < results.length; i += 1) {
      if (results[i].passed) {
        passed += 1;
      }
    }
    return {
      tests: results,
      total: results.length,
      passed: passed,
      failed: results.length - passed,
      allPassed: passed === results.length
    };
  }

  return {
    STRATEGIES: STRATEGIES,
    STRATEGY_IDS: STRATEGY_IDS,
    SHIPPED_ARC_IDS: SHIPPED_ARC_IDS,
    TRANSITION_CLASSES: TRANSITION_CLASSES,
    COMPATIBLE_CLASSES: COMPATIBLE_CLASSES,
    classifyTransition: classifyTransition,
    isCamelotCompatible: isCamelotCompatible,
    getCamelotWheelLayout: getCamelotWheelLayout,
    buildWheelPath: buildWheelPath,
    buildEnergyTelemetry: buildEnergyTelemetry,
    sequenceWithStrategy: sequenceWithStrategy,
    computeSequenceMetrics: computeSequenceMetrics,
    evaluateStrategies: evaluateStrategies,
    sha256Hex: sha256Hex,
    sha256Bytes: sha256Bytes,
    utf8Encode: utf8Encode,
    canonicalStringify: canonicalStringify,
    buildCanonicalPayload: buildCanonicalPayload,
    auditedBundle: auditedBundle,
    verifyAuditedExport: verifyAuditedExport,
    demoTamperExport: demoTamperExport,
    base64UrlEncode: base64UrlEncode,
    base64UrlDecode: base64UrlDecode,
    encodeSlfHash: encodeSlfHash,
    decodeSlfHash: decodeSlfHash,
    normalizeSlfState: normalizeSlfState,
    runSelfTests: runSelfTests
  };
});
