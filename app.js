(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    const engine = require("./engine.js");
    module.exports = factory(engine);
  } else {
    root.SetlistForgeApp = factory(root.SetlistForgeEngine);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Engine) {
  "use strict";

  const SCENARIOS = {
    kyoto_cinema: {
      id: "kyoto_cinema",
      label: "Late-Night Kyoto Cinema",
      seedIds: ["flm-in-the-mood-for-love", "bok-after-dark-murakami", "ven-kyoto-jazz-kissa"],
      arcPresetId: "slow_burn",
      targetLength: 8
    },
    berlin_noir: {
      id: "berlin_noir",
      label: "Brutalist Cyber-Noir",
      seedIds: ["flm-blade-runner-2049", "bok-pattern-recognition-gibson", "ven-berlin-kraftwerk-vault"],
      arcPresetId: "peak_hour_festival",
      targetLength: 8
    },
    desert_canyon: {
      id: "desert_canyon",
      label: "Widescreen Desert & Canyon",
      seedIds: ["flm-paris-texas", "bok-the-white-album-didion", "ven-joshua-tree-desert-studio"],
      arcPresetId: "warm_acoustic_dawn",
      targetLength: 7
    },
    tokyo_hauntology: {
      id: "tokyo_hauntology",
      label: "Tokyo Jetlag & Hauntology",
      seedIds: ["flm-lost-in-translation", "bok-ghosts-of-my-life", "ven-london-pirate-rooftop"],
      arcPresetId: "late_night_noir",
      targetLength: 9
    }
  };

  function formatDuration(totalSeconds) {
    const sec = Math.max(0, Math.round(totalSeconds || 0));
    const minutes = Math.floor(sec / 60);
    const rem = sec % 60;
    return minutes + "m " + (rem < 10 ? "0" + rem : rem) + "s";
  }

  function formatTrackClock(seconds) {
    const sec = Math.max(0, Math.round(seconds || 0));
    const minutes = Math.floor(sec / 60);
    const rem = sec % 60;
    return minutes + ":" + (rem < 10 ? "0" + rem : rem);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildEnergyArcSvgMarkup(setlistResult) {
    if (!setlistResult || !Array.isArray(setlistResult.tracks) || setlistResult.tracks.length === 0) {
      return "";
    }

    const width = 860;
    const height = 280;
    const padLeft = 54;
    const padRight = 36;
    const padTop = 28;
    const padBottom = 54;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const count = setlistResult.tracks.length;

    function xForIndex(i) {
      if (count <= 1) {
        return padLeft + plotW / 2;
      }
      return Math.round((padLeft + (i / (count - 1)) * plotW) * 10) / 10;
    }

    function yForEnergy(e) {
      const clamped = Engine.clamp01(e);
      return Math.round((padTop + (1 - clamped) * plotH) * 10) / 10;
    }

    const parts = [];

    // Horizontal grid lines (25%, 50%, 75%, 100%)
    const gridLevels = [0.25, 0.50, 0.75, 1.0];
    for (let g = 0; g < gridLevels.length; g += 1) {
      const lvl = gridLevels[g];
      const gy = yForEnergy(lvl);
      parts.push(
        '<line x1="' + padLeft + '" y1="' + gy + '" x2="' + (width - padRight) + '" y2="' + gy +
        '" stroke="#D8D2C5" stroke-dasharray="3 3" stroke-width="1" />'
      );
      parts.push(
        '<text x="' + (padLeft - 8) + '" y="' + (gy + 4) +
        '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#5F5B52">' +
        Math.round(lvl * 100) + '%</text>'
      );
    }

    // Build Target Energy polyline & area
    const targetPoints = [];
    const actualPoints = [];
    for (let i = 0; i < count; i += 1) {
      const item = setlistResult.tracks[i];
      const tx = xForIndex(i);
      const tyTarget = yForEnergy(item.targetEnergy);
      const tyActual = yForEnergy(item.actualEnergy);
      targetPoints.push(tx + "," + tyTarget);
      actualPoints.push(tx + "," + tyActual);
    }

    const areaPoints =
      xForIndex(0) + "," + (padTop + plotH) + " " +
      actualPoints.join(" ") + " " +
      xForIndex(count - 1) + "," + (padTop + plotH);

    parts.push(
      '<polygon points="' + areaPoints + '" fill="rgba(43, 76, 126, 0.10)" />'
    );

    parts.push(
      '<polyline fill="none" stroke="#9F3520" stroke-width="2.5" stroke-dasharray="6 4" points="' +
      targetPoints.join(" ") + '" />'
    );

    parts.push(
      '<polyline fill="none" stroke="#2B4C7E" stroke-width="3" points="' +
      actualPoints.join(" ") + '" />'
    );

    // Camelot Key Transition Badges between adjacent tracks
    for (let i = 0; i < setlistResult.transitions.length; i += 1) {
      const tr = setlistResult.transitions[i];
      const x1 = xForIndex(i);
      const x2 = xForIndex(i + 1);
      const y1 = yForEnergy(setlistResult.tracks[i].actualEnergy);
      const y2 = yForEnergy(setlistResult.tracks[i + 1].actualEnergy);
      const midX = Math.round(((x1 + x2) / 2) * 10) / 10;
      const midY = Math.round(((y1 + y2) / 2 - 16) * 10) / 10;
      const badgeColor = tr.totalScore >= 0.80 ? "#1E5E4A" : "#2B4C7E";
      const keyLabel = setlistResult.tracks[i].track.camelotKey + "->" + setlistResult.tracks[i + 1].track.camelotKey;

      parts.push(
        '<g class="svg-transition-badge" data-transition-idx="' + i + '" style="cursor:pointer">' +
        '<rect x="' + (midX - 28) + '" y="' + (midY - 10) + '" width="56" height="18" rx="4" fill="' + badgeColor + '" />' +
        '<text x="' + midX + '" y="' + (midY + 2) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700" fill="#FAF8F3">' +
        escapeHtml(keyLabel) + '</text>' +
        '</g>'
      );
    }

    // Track Nodes + X-axis labels
    for (let i = 0; i < count; i += 1) {
      const item = setlistResult.tracks[i];
      const cx = xForIndex(i);
      const cyTarget = yForEnergy(item.targetEnergy);
      const cyActual = yForEnergy(item.actualEnergy);
      const rawTitle = (item.track && item.track.title) || "";
      const shortTitle = rawTitle.length > 14
        ? rawTitle.slice(0, 12) + ".."
        : rawTitle;

      parts.push(
        '<circle cx="' + cx + '" cy="' + cyTarget + '" r="4" fill="#9F3520" />'
      );

      parts.push(
        '<g class="svg-track-node" data-slot-idx="' + i + '" style="cursor:pointer">' +
        '<circle cx="' + cx + '" cy="' + cyActual + '" r="6.5" fill="#FAF8F3" stroke="#2B4C7E" stroke-width="2.5" />' +
        '<text x="' + cx + '" y="' + (padTop + plotH + 18) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" fill="#151514">#' +
        escapeHtml(item.position) + ' (' + escapeHtml(item.track.camelotKey) + ')</text>' +
        '<text x="' + cx + '" y="' + (padTop + plotH + 33) + '" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="#52504A">' +
        escapeHtml(shortTitle) + '</text>' +
        '</g>'
      );
    }

    return parts.join("");
  }

  function createWebAudioPreviewSynth() {
    let audioCtx = null;

    function getAudioContext() {
      if (typeof window === "undefined") {
        return null;
      }
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }
      if (!audioCtx) {
        audioCtx = new AudioContextCtor();
      }
      if (audioCtx.state === "suspended" && typeof audioCtx.resume === "function") {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function playChordTransition(trackA, trackB, onStatusUpdate) {
      const spec = Engine.buildChordPreviewSpec(trackA, trackB);
      if (typeof onStatusUpdate === "function") {
        onStatusUpdate(spec);
      }

      const ctx = getAudioContext();
      if (!ctx) {
        return spec;
      }

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.18, now);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.max(400, spec.filterCutoffHz * 0.65), now);
      filter.frequency.exponentialRampToValueAtTime(spec.filterCutoffHz, now + spec.chordDurationSec);
      filter.frequency.exponentialRampToValueAtTime(Math.max(500, spec.filterCutoffHz * 0.75), now + spec.totalDurationSec);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      function scheduleTriad(freqs, startTime, duration, wave) {
        for (let i = 0; i < freqs.length; i += 1) {
          const osc = ctx.createOscillator();
          const voiceGain = ctx.createGain();
          osc.type = wave;
          osc.frequency.setValueAtTime(freqs[i], startTime);

          voiceGain.gain.setValueAtTime(0.001, startTime);
          voiceGain.gain.linearRampToValueAtTime(0.28 / freqs.length, startTime + 0.08);
          voiceGain.gain.setValueAtTime(0.24 / freqs.length, startTime + duration - 0.22);
          voiceGain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

          osc.connect(voiceGain);
          voiceGain.connect(filter);

          osc.start(startTime);
          osc.stop(startTime + duration + 0.02);
        }
      }

      scheduleTriad(spec.chordAHz, now, spec.chordDurationSec, spec.waveform);
      const secondStart = now + spec.chordDurationSec - spec.crossfadeOverlapSec;
      scheduleTriad(spec.chordBHz, secondStart, spec.chordDurationSec, spec.waveform);

      return spec;
    }

    return {
      playChordTransition: playChordTransition
    };
  }

  function initBrowserApp() {
    if (typeof document === "undefined") {
      return null;
    }

    const state = {
      seedIds: SCENARIOS.kyoto_cinema.seedIds.slice(),
      domainFilter: "ALL",
      searchQuery: "",
      arcPresetId: "slow_burn",
      controlPoints: Engine.ENERGY_ARC_PRESETS.slow_burn.controlPoints.slice(),
      targetLength: 8,
      weights: {
        affinity: 0.40,
        energyFit: 0.34,
        harmonic: 0.26
      },
      pinnedTracks: {},
      exportFormat: "m3u8",
      strategyId: "balanced-beam",
      currentResult: null
    };

    const synth = createWebAudioPreviewSynth();

    // DOM References
    const scenarioSelect = document.getElementById("scenarioSelect");
    const auditionFullArcBtn = document.getElementById("auditionFullArcBtn");
    const toggleDrawerBtn = document.getElementById("toggleDrawerBtn");
    const closeDrawerBtn = document.getElementById("closeDrawerBtn");
    const qlooExportDrawer = document.getElementById("qlooExportDrawer");

    const seedCountBadge = document.getElementById("seedCountBadge");
    const selectedSeedsTray = document.getElementById("selectedSeedsTray");
    const dominantTraitsLabel = document.getElementById("dominantTraitsLabel");
    const centroidBarsContainer = document.getElementById("centroidBarsContainer");
    const catalogSearchInput = document.getElementById("catalogSearchInput");
    const seedCatalogList = document.getElementById("seedCatalogList");

    const activeArcBadge = document.getElementById("activeArcBadge");
    const resetSplineBtn = document.getElementById("resetSplineBtn");
    const trackLengthSlider = document.getElementById("trackLengthSlider");
    const trackLengthValue = document.getElementById("trackLengthValue");
    const weightAffinitySlider = document.getElementById("weightAffinitySlider");
    const weightAffinityValue = document.getElementById("weightAffinityValue");
    const weightEnergySlider = document.getElementById("weightEnergySlider");
    const weightEnergyValue = document.getElementById("weightEnergyValue");
    const weightHarmonicSlider = document.getElementById("weightHarmonicSlider");
    const weightHarmonicValue = document.getElementById("weightHarmonicValue");
    const clearPinsBtn = document.getElementById("clearPinsBtn");
    const resequenceBtn = document.getElementById("resequenceBtn");

    const metricOverallScore = document.getElementById("metricOverallScore");
    const metricMeanAffinity = document.getElementById("metricMeanAffinity");
    const metricEnergyFit = document.getElementById("metricEnergyFit");
    const metricEnergyMse = document.getElementById("metricEnergyMse");
    const metricHarmonicScore = document.getElementById("metricHarmonicScore");
    const metricCamelotPath = document.getElementById("metricCamelotPath");
    const metricTotalDuration = document.getElementById("metricTotalDuration");

    const energyArcSvg = document.getElementById("energyArcSvg");
    const synthStatusText = document.getElementById("synthStatusText");
    const synthFreqReadout = document.getElementById("synthFreqReadout");
    const setlistTrackContainer = document.getElementById("setlistTrackContainer");

    const qlooEndpointSelect = document.getElementById("qlooEndpointSelect");
    const qlooApiKeyInput = document.getElementById("qlooApiKeyInput");
    const qlooCurlPreview = document.getElementById("qlooCurlPreview");
    const fetchQlooLiveBtn = document.getElementById("fetchQlooLiveBtn");
    const qlooApiStatus = document.getElementById("qlooApiStatus");
    const exportPreviewTextarea = document.getElementById("exportPreviewTextarea");
    const copyExportBtn = document.getElementById("copyExportBtn");
    const downloadExportBtn = document.getElementById("downloadExportBtn");
    const exportFeedbackText = document.getElementById("exportFeedbackText");

    // Harmonic Lab integration (graceful: panel hides if harmonic-lab.js is absent)
    const LabApi = typeof SetlistForgeHarmonicLab !== "undefined" ? SetlistForgeHarmonicLab : null;
    const labSection = document.getElementById("harmonicLabSection");
    const labRefs = {
      badge: document.getElementById("labStrategyBadge"),
      arcView: document.getElementById("labArcViewSelect"),
      tbody: document.getElementById("labStrategyTbody"),
      applyBtn: document.getElementById("labApplyStrategyBtn"),
      applyStatus: document.getElementById("labApplyStatus"),
      wheelSvg: document.getElementById("camelotWheelSvg"),
      energySvg: document.getElementById("labEnergySvg"),
      energyStats: document.getElementById("labEnergyStats"),
      fingerprint: document.getElementById("labFingerprint"),
      exportPreview: document.getElementById("labExportPreview"),
      copyExportBtn: document.getElementById("labCopyExportBtn"),
      copyHashBtn: document.getElementById("labCopyHashBtn"),
      verifyBtn: document.getElementById("labVerifyBtn"),
      tamperBtn: document.getElementById("labTamperBtn"),
      exportStatus: document.getElementById("labExportStatus"),
      selfTestBtn: document.getElementById("labSelfTestBtn"),
      selfTestSummary: document.getElementById("labSelfTestSummary"),
      selfTestList: document.getElementById("labSelfTestList"),
      statusText: document.getElementById("labStatusText")
    };
    const lab = {
      available: !!(LabApi && labSection),
      selectedStrategyId: "balanced-beam",
      arcView: "active",
      exportFormat: "json",
      comparator: null,
      comparatorKey: "",
      comparatorTimer: null,
      bundle: null,
      previewTampered: false
    };
    if (!lab.available && labSection) {
      labSection.setAttribute("hidden", "");
    }

    function syncSplineSlidersUI() {
      const sliders = document.querySelectorAll(".spline-slider");
      sliders.forEach(function (slider) {
        const idx = Number(slider.getAttribute("data-stage"));
        const pct = Math.round((state.controlPoints[idx] || 0.5) * 100);
        slider.value = String(pct);
        const labelEl = document.getElementById("splineVal" + idx);
        if (labelEl) {
          labelEl.textContent = pct + "%";
        }
      });
    }

    function renderSelectedSeedsAndCentroid(seedProfile) {
      if (seedCountBadge) {
        seedCountBadge.textContent = seedProfile.seeds.length + " / 4 seeds";
      }

      if (selectedSeedsTray) {
        selectedSeedsTray.innerHTML = seedProfile.seeds.map(function (seed) {
          return (
            '<div class="seed-chip">' +
              '<div class="seed-chip-info">' +
                '<span class="seed-chip-title">' + escapeHtml(seed.title) + ' (' + escapeHtml(seed.creator) + ')</span>' +
                '<span class="seed-chip-meta">' + escapeHtml(seed.domain) + ' // Key ' + escapeHtml(seed.camelotKey) + ' // ' + escapeHtml(seed.qlooUrn) + '</span>' +
              '</div>' +
              '<button type="button" class="seed-remove-btn" data-remove-seed="' + escapeHtml(seed.id) + '" aria-label="Remove seed ' + escapeHtml(seed.title) + '">Remove</button>' +
            '</div>'
          );
        }).join("");
      }

      if (dominantTraitsLabel && seedProfile.dominantDimensions.length >= 2) {
        dominantTraitsLabel.textContent =
          seedProfile.dominantDimensions[0].shortLabel + " + " +
          seedProfile.dominantDimensions[1].shortLabel;
      }

      if (centroidBarsContainer) {
        centroidBarsContainer.innerHTML = Engine.TASTE_DIMENSIONS.map(function (dim) {
          const val = seedProfile.centroid[dim.key] || 0;
          const pct = Math.round(val * 100);
          return (
            '<div class="centroid-bar-row">' +
              '<div class="centroid-bar-label">' +
                '<span>' + escapeHtml(dim.shortLabel) + '</span>' +
                '<span>' + pct + '%</span>' +
              '</div>' +
              '<div class="centroid-bar-track">' +
                '<div class="centroid-bar-fill" style="width:' + pct + '%"></div>' +
              '</div>' +
            '</div>'
          );
        }).join("");
      }
    }

    function renderCatalogList() {
      if (!seedCatalogList) {
        return;
      }
      const catalog = Engine.getCatalog();
      const q = state.searchQuery.trim().toLowerCase();
      const selectedSet = new Set(state.seedIds);

      const filtered = catalog.filter(function (entity) {
        if (state.domainFilter !== "ALL" && entity.domain !== state.domainFilter) {
          return false;
        }
        if (!q) {
          return true;
        }
        const hay = (
          (entity.title || "") + " " +
          (entity.creator || "") + " " +
          (entity.domain || "") + " " +
          (entity.camelotKey || "") + " " +
          (entity.tags || []).join(" ")
        ).toLowerCase();
        return hay.indexOf(q) !== -1;
      });

      seedCatalogList.innerHTML = filtered.map(function (entity) {
        const isSelected = selectedSet.has(entity.id);
        return (
          '<div class="catalog-item ' + (isSelected ? "is-selected" : "") + '" role="listitem">' +
            '<div class="catalog-item-main">' +
              '<span class="catalog-item-title">' + escapeHtml(entity.title) + ' - ' + escapeHtml(entity.creator) + '</span>' +
              '<span class="catalog-item-sub">' +
                escapeHtml(entity.domain) + ' // ' + escapeHtml(entity.camelotKey) + ' (' + escapeHtml(entity.bpm) + ' BPM) // ' +
                escapeHtml((entity.tags || []).slice(0, 3).join(", ")) +
              '</span>' +
            '</div>' +
            '<button type="button" class="catalog-toggle-btn ' + (isSelected ? "active" : "") + '" data-toggle-seed="' + escapeHtml(entity.id) + '">' +
              (isSelected ? "Seed Active" : "+ Add Seed") +
            '</button>' +
          '</div>'
        );
      }).join("");
    }

    function renderTelemetryAndSvg(result) {
      if (metricOverallScore) {
        metricOverallScore.textContent = Math.round(result.summary.overallSetlistScore * 100) + "%";
      }
      if (metricMeanAffinity) {
        metricMeanAffinity.textContent = Math.round(result.summary.meanAffinity * 100) + "%";
      }
      if (metricEnergyFit) {
        metricEnergyFit.textContent = Math.round(result.summary.energyFitScore * 100) + "%";
      }
      if (metricEnergyMse) {
        metricEnergyMse.textContent = "MSE " + result.summary.energyMse.toFixed(3);
      }
      if (metricHarmonicScore) {
        metricHarmonicScore.textContent = Math.round(result.summary.meanHarmonicSmoothness * 100) + "%";
      }
      if (metricCamelotPath) {
        metricCamelotPath.textContent = result.summary.camelotPath;
      }
      if (metricTotalDuration) {
        metricTotalDuration.textContent = formatDuration(result.summary.totalDurationSec);
      }
      if (activeArcBadge) {
        activeArcBadge.textContent = result.arcPresetName;
      }
      if (energyArcSvg) {
        energyArcSvg.innerHTML = buildEnergyArcSvgMarkup(result);
      }
    }

    function renderSetlistDeck(result) {
      if (!setlistTrackContainer) {
        return;
      }

      const allTracks = Engine.getMusicTracks();
      const usedIds = new Set(result.tracks.map(function (t) { return t.track.id; }));
      const blocks = [];

      for (let i = 0; i < result.tracks.length; i += 1) {
        const item = result.tracks[i];
        const trk = item.track;
        const keyInfo = Engine.parseCamelotKey(trk.camelotKey);
        const musicalKeyLabel = keyInfo ? keyInfo.musicalKey : trk.camelotKey;
        const targetPct = Math.round(item.targetEnergy * 100);
        const actualPct = Math.round(item.actualEnergy * 100);
        const affPct = Math.round(item.seedAffinity * 100);

        const swapOptionsHtml = allTracks
          .filter(function (candidate) {
            return !usedIds.has(candidate.id) || candidate.id === trk.id;
          })
          .map(function (candidate) {
            const sel = candidate.id === trk.id ? " selected" : "";
            return (
              '<option value="' + escapeHtml(candidate.id) + '"' + sel + '>' +
              escapeHtml(candidate.title) + " (" + escapeHtml(candidate.camelotKey) + ", " + escapeHtml(candidate.bpm) + " BPM)" +
              "</option>"
            );
          })
          .join("");

        const seedBridgePills = ((item.bridge && item.bridge.seedBridges) || []).map(function (sb) {
          return (
            '<span class="bridge-pill">' +
              escapeHtml(sb.seedTitle) + ": " + Math.round(sb.similarity * 100) + "% (" +
              escapeHtml(sb.sharedTraits.join("/")) + ")" +
            "</span>"
          );
        }).join("");

        blocks.push(
          '<article class="track-card ' + (item.isPinned ? "is-pinned" : "") + '" role="listitem" data-slot-card="' + i + '">' +
            '<div class="track-card-top">' +
              '<div class="track-title-cluster">' +
                '<span class="track-slot-num">' + String(item.position).padStart(2, "0") + '</span>' +
                '<h3 class="track-name">' + escapeHtml(trk.title) + '</h3>' +
                '<span class="track-creator">by ' + escapeHtml(trk.creator) + ' (' + escapeHtml(trk.year) + ' // ' + formatTrackClock(trk.durationSec) + ')</span>' +
              '</div>' +
              '<div class="track-badges">' +
                '<span class="camelot-badge">' + escapeHtml(trk.camelotKey) + " // " + escapeHtml(musicalKeyLabel) + '</span>' +
                '<span class="bpm-badge">' + escapeHtml(trk.bpm) + ' BPM</span>' +
                '<span class="affinity-badge">' + affPct + '% Seed Match</span>' +
              '</div>' +
            '</div>' +

            '<div class="track-energy-comparison">' +
              '<div class="energy-bar-wrap">' +
                '<span>Target Stage Energy: ' + targetPct + '%</span>' +
                '<div class="energy-bar-track"><div class="energy-bar-target" style="width:' + targetPct + '%"></div></div>' +
              '</div>' +
              '<div class="energy-bar-wrap">' +
                '<span>Actual Track Energy: ' + actualPct + '% (Fit ' + Math.round(item.energyFitScore * 100) + '%)</span>' +
                '<div class="energy-bar-track"><div class="energy-bar-actual" style="width:' + actualPct + '%"></div></div>' +
              '</div>' +
            '</div>' +

            '<div class="explainability-box">' +
              '<div class="explainability-headline">Cross-Domain Bridge: ' + escapeHtml(item.bridge && item.bridge.headline) + '</div>' +
              '<div class="seed-bridge-pills">' + seedBridgePills + '</div>' +
            '</div>' +

            '<div class="track-actions-row">' +
              '<button type="button" class="btn btn-secondary btn-small" data-pin-slot="' + i + '">' +
                (item.isPinned ? "Pinned to Slot #" + item.position + " (Click to Unpin)" : "Pin Track to Slot #" + item.position) +
              '</button>' +
              '<div class="swap-controls">' +
                '<label for="swapSelect' + i + '" class="control-label">Swap Slot:</label>' +
                '<select id="swapSelect' + i + '" class="console-select" data-swap-select="' + i + '">' +
                  swapOptionsHtml +
                '</select>' +
                '<button type="button" class="btn btn-secondary btn-small" data-auto-swap="' + i + '">Best Alt Swap</button>' +
              '</div>' +
            '</div>' +
          '</article>'
        );

        // Render Harmonic Transition Strip between Track i and Track i+1
        if (i < result.transitions.length) {
          const tr = result.transitions[i];
          blocks.push(
            '<div class="transition-strip" data-transition-strip="' + i + '">' +
              '<div class="transition-meta">' +
                '<span class="transition-score-pill">' + Math.round(tr.totalScore * 100) + '% Harmonic Lock</span>' +
                '<span>' + escapeHtml(tr.camelotInfo.relationType) + '</span>' +
                '<span>' + escapeHtml(result.tracks[i].track.camelotKey) + ' -&gt; ' + escapeHtml(result.tracks[i + 1].track.camelotKey) + ' (dBPM ' + tr.bpmDelta + ')</span>' +
              '</div>' +
              '<button type="button" class="btn btn-primary btn-small" data-audition-transition="' + i + '">' +
                'Audition Transition (' + escapeHtml(result.tracks[i].track.camelotKey) + ' -&gt; ' + escapeHtml(result.tracks[i + 1].track.camelotKey) + ')' +
              '</button>' +
            '</div>'
          );
        }
      }

      setlistTrackContainer.innerHTML = blocks.join("");
    }

    function updateDrawerPreviews() {
      if (!state.currentResult) {
        return;
      }
      const apiKey = qlooApiKeyInput ? qlooApiKeyInput.value : "";
      const endpoint = qlooEndpointSelect ? qlooEndpointSelect.value : "https://hackathon.api.qloo.com";
      const reqSpec = Engine.buildQlooInsightsRequest(state.seedIds, apiKey, endpoint);
      if (qlooCurlPreview) {
        qlooCurlPreview.textContent = reqSpec.curlPreview;
      }

      if (exportPreviewTextarea) {
        if (state.exportFormat === "json") {
          exportPreviewTextarea.value = Engine.exportSetlistJSON(state.currentResult);
        } else if (state.exportFormat === "markdown") {
          exportPreviewTextarea.value = Engine.exportSetlistMarkdown(state.currentResult);
        } else if (state.exportFormat === "csv") {
          exportPreviewTextarea.value = Engine.exportSetlistCSV(state.currentResult);
        } else {
          exportPreviewTextarea.value = Engine.exportSetlistM3U8(state.currentResult);
        }
      }
    }

    function focusKeyOf(el) {
      if (!el || el === document.body || el === document.documentElement) {
        return null;
      }
      if (el.id) {
        return "#" + el.id;
      }
      const attrs = [
        "data-pin-slot", "data-auto-swap", "data-swap-select", "data-audition-transition",
        "data-toggle-seed", "data-format", "data-preset", "data-domain", "data-stage"
      ];
      for (const attr of attrs) {
        const v = typeof el.getAttribute === "function" ? el.getAttribute(attr) : null;
        if (v != null) {
          return "[" + attr + "=\"" + String(v).replace(/"/g, '\\"') + "\"]";
        }
      }
      return null;
    }

    function withFocusPreserved(fn) {
      const key = focusKeyOf(document.activeElement);
      fn();
      if (key) {
        const el = document.querySelector(key);
        if (el && typeof el.focus === "function") {
          el.focus();
        }
      }
    }

    function renderCurrentResult() {
      const result = state.currentResult;
      if (!result) {
        return;
      }
      withFocusPreserved(function () {
        renderSelectedSeedsAndCentroid(result.seedProfile);
        renderCatalogList();
        renderTelemetryAndSvg(result);
        renderSetlistDeck(result);
        updateDrawerPreviews();
      });
      labRefreshVisuals();
    }

    function recomputeAndRender() {
      let result;
      try {
        if (lab.available) {
          result = LabApi.sequenceWithStrategy(state.strategyId || "balanced-beam", {
            seedIds: state.seedIds,
            targetLength: state.targetLength,
            arcPresetId: state.arcPresetId,
            customControlPoints: state.controlPoints,
            pinnedTracks: state.pinnedTracks,
            weights: state.weights
          });
        } else {
          result = Engine.sequenceSetlist({
            seedIds: state.seedIds,
            targetLength: state.targetLength,
            arcPresetId: state.arcPresetId,
            customControlPoints: state.controlPoints,
            pinnedTracks: state.pinnedTracks,
            weights: state.weights
          });
          result.strategyId = "balanced-beam";
          result.strategyName = "Balanced Beam Search";
        }
      } catch (err) {
        if (synthStatusText) {
          synthStatusText.textContent = "Sequencer could not run: " + (err && err.message ? err.message : err);
        }
        return;
      }
      state.currentResult = result;
      renderCurrentResult();
    }

    function triggerTransitionAudition(transitionIdx) {
      if (!state.currentResult || !state.currentResult.tracks[transitionIdx] || !state.currentResult.tracks[transitionIdx + 1]) {
        return;
      }
      const trackA = state.currentResult.tracks[transitionIdx].track;
      const trackB = state.currentResult.tracks[transitionIdx + 1].track;

      synth.playChordTransition(trackA, trackB, function (spec) {
        if (synthStatusText) {
          synthStatusText.textContent =
            "Synthesizing " + spec.fromTitle + " (" + spec.camelotA + " " + spec.musicalKeyA + ") -> " +
            spec.toTitle + " (" + spec.camelotB + " " + spec.musicalKeyB + ") [" + spec.camelotRelation + "]";
        }
        if (synthFreqReadout) {
          synthFreqReadout.textContent =
            spec.chordAHz[0] + "Hz -> " + spec.chordBHz[0] + "Hz // LP " + spec.filterCutoffHz + "Hz";
        }
      });
    }

    // -----------------------------------------------------------------
    // Harmonic Beam-Search & Camelot Transition Lab
    // -----------------------------------------------------------------

    const LAB_ARC_COLORS = {
      "exact": "#1E5E4A",
      "relative-mode": "#2B4C7E",
      "adjacent-fifth": "#2B4C7E",
      "energy-boost": "#B87D1E",
      "clash": "#9F3520"
    };

    function labStatus(msg) {
      if (labRefs.statusText) {
        labRefs.statusText.textContent = msg || "";
      }
    }

    function labInputsKey() {
      return JSON.stringify([
        state.seedIds,
        state.targetLength,
        state.weights.affinity,
        state.weights.energyFit,
        state.weights.harmonic,
        state.pinnedTracks
      ]);
    }

    function labRefreshComparator() {
      if (!lab.available) {
        return;
      }
      try {
        lab.comparator = LabApi.evaluateStrategies({
          seedIds: state.seedIds,
          targetLength: state.targetLength,
          weights: state.weights,
          pinnedTracks: state.pinnedTracks
        });
        lab.comparatorKey = labInputsKey();
        labRenderComparator();
      } catch (err) {
        labStatus("Comparator could not run: " + (err && err.message ? err.message : err));
      }
    }

    function labScheduleComparator() {
      if (!lab.available) {
        return;
      }
      if (lab.comparatorTimer) {
        clearTimeout(lab.comparatorTimer);
      }
      lab.comparatorTimer = setTimeout(labRefreshComparator, 180);
    }

    function labRenderComparator() {
      const evald = lab.comparator;
      if (!lab.available || !evald || !labRefs.tbody) {
        return;
      }
      const shippedArc = Engine.ENERGY_ARC_PRESETS[state.arcPresetId] && state.arcPresetId !== "custom"
        ? state.arcPresetId
        : null;
      const useMean = lab.arcView === "mean" || !shippedArc;

      labRefs.tbody.innerHTML = evald.strategyIds.map(function (id) {
        const metrics = useMean ? evald.means[id] : evald.grid[shippedArc][id].metrics;
        const strat = evald.strategies.filter(function (s) { return s.id === id; })[0] || {};
        const isSel = id === lab.selectedStrategyId;
        const isApplied = id === (state.strategyId || "balanced-beam");
        const compatPct = Math.round(metrics.camelotCompatiblePct * 100);
        const compatCls = metrics.clashCount > 0 ? "lab-metric-warn" : "lab-metric-good";
        const viewTag = useMean ? " (4-arc mean)" : "";
        return (
          '<tr class="lab-strategy-row' + (isSel ? " is-selected" : "") + (isApplied ? " is-applied" : "") + '" ' +
            'data-strategy-id="' + escapeHtml(id) + '" tabindex="0" role="button" aria-pressed="' + (isSel ? "true" : "false") + '">' +
            '<td><span class="lab-strat-name">' + escapeHtml(strat.name || id) + '</span>' +
              '<div class="lab-strat-desc">' + escapeHtml(strat.description || "") + '</div></td>' +
            '<td class="' + compatCls + '">' + compatPct + '%' + viewTag + '</td>' +
            '<td class="' + (metrics.clashCount > 0 ? "lab-metric-warn" : "") + '">' + escapeHtml(metrics.clashCount) + '</td>' +
            '<td>' + escapeHtml(metrics.energyMse.toFixed ? metrics.energyMse.toFixed(4) : metrics.energyMse) + '</td>' +
            '<td>' + Math.round(metrics.meanAffinity * 100) + '%</td>' +
            '<td>' + escapeHtml(metrics.maxBpmJump) + ' BPM</td>' +
            '<td>' + Math.round(metrics.overallScore * 100) + '%</td>' +
            '<td>' +
              '<span class="lab-invariant-pill ' + (metrics.zeroDuplicateTracks ? "ok" : "bad") + '">' +
                (metrics.zeroDuplicateTracks ? "DUP-FREE" : "DUP FOUND") + '</span>' +
              '<span class="lab-invariant-pill ' + (metrics.pinsPreserved ? "ok" : "bad") + '">' +
                (metrics.pinsPreserved ? "PINS OK" : "PINS LOST") + '</span>' +
            '</td>' +
          '</tr>'
        );
      }).join("");
    }

    function buildCamelotWheelSvgMarkup(result) {
      if (!lab.available || !result) {
        return "";
      }
      const model = LabApi.buildWheelPath(result, { size: 420 });
      const layout = model.layout;
      const usedKeys = new Set(model.keys);
      const parts = [];

      parts.push(
        '<defs>' +
          '<marker id="labArrowE" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">' +
          '<path d="M0,0 L7,3.5 L0,7 Z" fill="#1E5E4A"/></marker>' +
          '<marker id="labArrowC" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">' +
          '<path d="M0,0 L7,3.5 L0,7 Z" fill="#2B4C7E"/></marker>' +
          '<marker id="labArrowA" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">' +
          '<path d="M0,0 L7,3.5 L0,7 Z" fill="#B87D1E"/></marker>' +
          '<marker id="labArrowV" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">' +
          '<path d="M0,0 L7,3.5 L0,7 Z" fill="#9F3520"/></marker>' +
        '</defs>'
      );

      const markerFor = {
        "exact": "labArrowE",
        "relative-mode": "labArrowC",
        "adjacent-fifth": "labArrowC",
        "energy-boost": "labArrowA",
        "clash": "labArrowV"
      };

      // Hour spoke ticks between rings
      for (let s = 1; s <= 12; s += 1) {
        const rad = ((-90 + (s - 1) * 30) * Math.PI) / 180;
        const x1 = layout.cx + (layout.rInner - 16) * Math.cos(rad);
        const y1 = layout.cy + (layout.rInner - 16) * Math.sin(rad);
        const x2 = layout.cx + (layout.rOuter + 16) * Math.cos(rad);
        const y2 = layout.cy + (layout.rOuter + 16) * Math.sin(rad);
        parts.push(
          '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' +
          y2.toFixed(1) + '" stroke="#E2DDD0" stroke-width="1" />'
        );
      }

      parts.push(
        '<circle cx="' + layout.cx + '" cy="' + layout.cy + '" r="' + layout.rOuter +
        '" fill="none" stroke="#CFC8B8" stroke-width="1.4" />',
        '<circle cx="' + layout.cx + '" cy="' + layout.cy + '" r="' + (layout.rOuter + 16) +
        '" fill="none" stroke="#E2DDD0" stroke-width="1" />',
        '<circle cx="' + layout.cx + '" cy="' + layout.cy + '" r="' + (layout.rInner - 16) +
        '" fill="none" stroke="#CFC8B8" stroke-width="1.4" />'
      );

      // Transition arcs under the key nodes
      for (let i = 0; i < model.segments.length; i += 1) {
        const seg = model.segments[i];
        const color = LAB_ARC_COLORS[seg.transitionClass] || "#52504A";
        const marker = markerFor[seg.transitionClass] || "labArrowC";
        const label = escapeHtml("Setlist transition " + (i + 1) + ": " + seg.fromCode + " to " + seg.toCode + ", class " + seg.transitionClass);
        if (!seg.from || !seg.to) {
          continue;
        }
        if (seg.from.code === seg.to.code) {
          parts.push(
            '<circle class="lab-wheel-arc" tabindex="0" focusable="true" role="button" data-arc-idx="' + i +
            '" aria-label="' + label + '" cx="' + seg.from.x + '" cy="' + seg.from.y +
            '" r="19" stroke="' + color + '" stroke-dasharray="4 3" />'
          );
        } else {
          parts.push(
            '<path class="lab-wheel-arc" tabindex="0" focusable="true" role="button" data-arc-idx="' + i +
            '" aria-label="' + label + '" d="M ' + seg.from.x + ' ' + seg.from.y + ' L ' + seg.to.x + ' ' + seg.to.y +
            '" stroke="' + color + '" marker-end="url(#' + marker + ')" />'
          );
        }
      }

      // 24 key nodes
      for (const node of layout.nodes) {
        const inPath = usedKeys.has(node.code);
        parts.push(
          '<g class="lab-key-node' + (inPath ? " in-path" : "") + '" tabindex="0" focusable="true" role="button" ' +
          'data-key="' + escapeHtml(node.code) + '" ' +
          'aria-label="Camelot ' + escapeHtml(node.code) + ", " + escapeHtml(node.musicalKey) + (inPath ? ", in setlist path" : "") + '">' +
          '<circle cx="' + node.x + '" cy="' + node.y + '" r="13.5" />' +
          '<text x="' + node.x + '" y="' + (node.y + 4) + '">' + escapeHtml(node.code) + '</text>' +
          '</g>'
        );
      }

      return parts.join("");
    }

    function buildLabEnergySvgMarkup(result) {
      if (!result || !Array.isArray(result.tracks) || result.tracks.length === 0) {
        return "";
      }
      const telemetry = LabApi.buildEnergyTelemetry(result);
      const width = 460;
      const height = 240;
      const padLeft = 40;
      const padRight = 18;
      const padTop = 18;
      const padBottom = 34;
      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;
      const count = telemetry.count;

      const xFor = function (i) {
        return count <= 1 ? padLeft + plotW / 2 : Math.round((padLeft + (i / (count - 1)) * plotW) * 10) / 10;
      };
      const yFor = function (e) {
        return Math.round((padTop + (1 - Engine.clamp01(e)) * plotH) * 10) / 10;
      };

      const parts = [];
      for (const lvl of [0.25, 0.5, 0.75, 1.0]) {
        const gy = yFor(lvl);
        parts.push(
          '<line x1="' + padLeft + '" y1="' + gy + '" x2="' + (width - padRight) + '" y2="' + gy +
          '" stroke="#D8D2C5" stroke-dasharray="3 3" stroke-width="1" />' +
          '<text x="' + (padLeft - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9.5" fill="#5F5B52">' +
          Math.round(lvl * 100) + '%</text>'
        );
      }

      const targetPts = [];
      const actualPts = [];
      for (let i = 0; i < count; i += 1) {
        targetPts.push(xFor(i) + "," + yFor(telemetry.target[i]));
        actualPts.push(xFor(i) + "," + yFor(telemetry.actual[i]));
      }

      parts.push(
        '<polyline fill="none" stroke="#9F3520" stroke-width="2" stroke-dasharray="5 4" points="' + targetPts.join(" ") + '" />' +
        '<polyline fill="none" stroke="#2B4C7E" stroke-width="2.5" points="' + actualPts.join(" ") + '" />'
      );

      for (let i = 0; i < count; i += 1) {
        const cx = xFor(i);
        parts.push(
          '<circle cx="' + cx + '" cy="' + yFor(telemetry.target[i]) + '" r="3.5" fill="#9F3520" />' +
          '<g class="lab-energy-node" tabindex="0" focusable="true" role="button" data-lab-slot="' + i +
          '" aria-label="Slot ' + (i + 1) + ", target " + Math.round(telemetry.target[i] * 100) + "%, actual " + Math.round(telemetry.actual[i] * 100) + '%">' +
          '<circle cx="' + cx + '" cy="' + yFor(telemetry.actual[i]) + '" r="5.5" fill="#FAF8F3" stroke="#2B4C7E" stroke-width="2.2" />' +
          '<text x="' + cx + '" y="' + (padTop + plotH + 16) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700" fill="#151514">#' + (i + 1) + '</text>' +
          '</g>'
        );
      }

      return parts.join("");
    }

    function labRefreshBundle() {
      if (!lab.available || !state.currentResult) {
        return;
      }
      lab.bundle = LabApi.auditedBundle(state.currentResult, { strategyId: state.strategyId });
      lab.previewTampered = false;
      if (labRefs.fingerprint) {
        labRefs.fingerprint.textContent = "SHA-256 " + lab.bundle.digest;
      }
      if (labRefs.exportPreview) {
        labRefs.exportPreview.value = lab.bundle.exports[lab.exportFormat] || "";
      }
    }

    function labRefreshVisuals() {
      if (!lab.available) {
        return;
      }
      const result = state.currentResult;
      if (!result) {
        return;
      }
      if (labRefs.badge) {
        labRefs.badge.textContent = result.strategyName || "Balanced Beam Search";
      }
      if (labRefs.wheelSvg) {
        labRefs.wheelSvg.innerHTML = buildCamelotWheelSvgMarkup(result);
      }
      if (labRefs.energySvg) {
        labRefs.energySvg.innerHTML = buildLabEnergySvgMarkup(result);
      }
      if (labRefs.energyStats) {
        const tele = LabApi.buildEnergyTelemetry(result);
        labRefs.energyStats.textContent =
          "Strategy: " + (result.strategyName || "Balanced Beam Search") +
          " | Energy MSE: " + tele.mse +
          " | Max |dE|: " + Math.round(tele.maxAbsDelta * 100) + "%" +
          " | " + tele.count + " tracks";
      }
      labRefreshBundle();
      if (lab.comparatorKey !== labInputsKey()) {
        labScheduleComparator();
      } else {
        labRenderComparator();
      }
    }

    function labApplyStrategy(strategyId) {
      if (!lab.available) {
        return;
      }
      let result;
      try {
        result = LabApi.sequenceWithStrategy(strategyId, {
          seedIds: state.seedIds,
          targetLength: state.targetLength,
          arcPresetId: state.arcPresetId,
          customControlPoints: state.controlPoints,
          weights: state.weights,
          pinnedTracks: state.pinnedTracks
        });
      } catch (err) {
        labStatus("Strategy failed: " + (err && err.message ? err.message : err));
        return;
      }
      state.strategyId = result.strategyId;
      lab.selectedStrategyId = result.strategyId;
      state.currentResult = result;
      renderCurrentResult();
      if (labRefs.applyStatus) {
        labRefs.applyStatus.textContent =
          result.strategyName + " applied: " + result.summary.camelotPath;
      }
    }

    function runLabSelfTests() {
      if (!lab.available || !labRefs.selfTestList || !labRefs.selfTestSummary) {
        return;
      }
      const out = LabApi.runSelfTests();
      labRefs.selfTestSummary.textContent =
        out.passed + "/" + out.total + " deterministic lab checks passed" +
        (out.failed ? " (" + out.failed + " failed)" : "");
      labRefs.selfTestSummary.classList.toggle("all-pass", out.allPassed);
      labRefs.selfTestSummary.classList.toggle("has-fail", !out.allPassed);
      labRefs.selfTestList.innerHTML = out.tests.map(function (t) {
        return (
          '<li class="' + (t.passed ? "pass" : "fail") + '">' +
          (t.passed ? "[PASS] " : "[FAIL] ") + escapeHtml(t.name) +
          " - " + escapeHtml(t.detail) +
          '</li>'
        );
      }).join("");
      return out;
    }

    function buildShareUrl() {
      const hash = LabApi.encodeSlfHash({
        arcPresetId: state.arcPresetId,
        customControlPoints: state.controlPoints,
        targetLength: state.targetLength,
        strategyId: state.strategyId,
        seedIds: state.seedIds,
        pinnedTracks: state.pinnedTracks
      });
      const base = String(window.location.href).split("#")[0];
      return { hash: hash, url: base + hash };
    }

    function syncArcPresetButtonsUI() {
      document.querySelectorAll(".arc-preset-btn").forEach(function (btn) {
        const active = btn.getAttribute("data-preset") === state.arcPresetId;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function restoreStateFromHash(hashStr) {
      if (!lab.available || typeof hashStr !== "string") {
        return false;
      }
      const stripped = hashStr.replace(/^#/, "");
      if (stripped.indexOf("slf=") !== 0) {
        return false;
      }
      const decoded = LabApi.decodeSlfHash(hashStr);
      if (!decoded) {
        labStatus("Bookmark hash was malformed; default console state kept.");
        return false;
      }
      state.seedIds = decoded.seedIds.slice();
      state.arcPresetId = decoded.arcPresetId;
      state.controlPoints = decoded.customControlPoints
        ? decoded.customControlPoints.slice()
        : Engine.ENERGY_ARC_PRESETS[decoded.arcPresetId].controlPoints.slice();
      state.targetLength = decoded.targetLength;
      state.pinnedTracks = decoded.pinnedTracks;
      state.strategyId = decoded.strategyId;
      lab.selectedStrategyId = decoded.strategyId;

      if (trackLengthSlider) {
        trackLengthSlider.value = String(state.targetLength);
      }
      if (trackLengthValue) {
        trackLengthValue.textContent = state.targetLength + " Tracks";
      }
      syncArcPresetButtonsUI();
      syncSplineSlidersUI();
      labApplyStrategy(decoded.strategyId);
      labStatus(
        "Restored #slf= bookmark: " + Engine.ENERGY_ARC_PRESETS[decoded.arcPresetId].name +
        ", " + decoded.targetLength + " tracks, " + decoded.seedIds.length + " seeds, strategy " +
        decoded.strategyId + "."
      );
      return true;
    }

    function initHarmonicLab() {
      if (!lab.available) {
        return;
      }

      if (labRefs.tbody) {
        labRefs.tbody.addEventListener("click", function (ev) {
          const row = ev.target.closest("[data-strategy-id]");
          if (!row) {
            return;
          }
          lab.selectedStrategyId = row.getAttribute("data-strategy-id");
          labRenderComparator();
        });
        labRefs.tbody.addEventListener("keydown", function (ev) {
          if (ev.key !== "Enter" && ev.key !== " ") {
            return;
          }
          const row = ev.target.closest("[data-strategy-id]");
          if (!row) {
            return;
          }
          ev.preventDefault();
          lab.selectedStrategyId = row.getAttribute("data-strategy-id");
          labRenderComparator();
        });
      }

      if (labRefs.arcView) {
        labRefs.arcView.addEventListener("change", function () {
          lab.arcView = labRefs.arcView.value === "mean" ? "mean" : "active";
          labRenderComparator();
        });
      }

      if (labRefs.applyBtn) {
        labRefs.applyBtn.addEventListener("click", function () {
          labApplyStrategy(lab.selectedStrategyId);
        });
      }

      if (labRefs.wheelSvg) {
        const wheelActivate = function (el) {
          const arc = el.closest("[data-arc-idx]");
          if (arc) {
            const idx = Number(arc.getAttribute("data-arc-idx"));
            if (Number.isInteger(idx) && idx >= 0 && idx < state.currentResult.transitions.length) {
              const a = state.currentResult.tracks[idx].track;
              const b = state.currentResult.tracks[idx + 1].track;
              labStatus("Auditioning " + a.camelotKey + " -> " + b.camelotKey + " via Web Audio synth.");
              triggerTransitionAudition(idx);
            }
            return;
          }
          const node = el.closest("[data-key]");
          if (node) {
            const code = node.getAttribute("data-key");
            const info = Engine.parseCamelotKey(code);
            if (info) {
              const neighbors = [];
              const prev = ((info.number + 10) % 12) + 1;
              const next = (info.number % 12) + 1;
              neighbors.push(prev + info.mode, next + info.mode, info.number + (info.mode === "A" ? "B" : "A"));
              labStatus(
                "Camelot " + code + " (" + info.musicalKey + "). Compatible neighbors: " +
                neighbors.join(", ") + "."
              );
            }
          }
        };
        labRefs.wheelSvg.addEventListener("click", function (ev) {
          wheelActivate(ev.target);
        });
        labRefs.wheelSvg.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            wheelActivate(ev.target);
          }
        });
      }

      document.querySelectorAll(".lab-export-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          lab.exportFormat = tab.getAttribute("data-lab-format") || "json";
          document.querySelectorAll(".lab-export-tab").forEach(function (t) {
            t.classList.toggle("active", t === tab);
            t.setAttribute("aria-pressed", t === tab ? "true" : "false");
          });
          lab.previewTampered = false;
          labRefreshBundle();
        });
      });

      if (labRefs.copyExportBtn) {
        labRefs.copyExportBtn.addEventListener("click", function () {
          const text = labRefs.exportPreview ? labRefs.exportPreview.value : "";
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text).then(function () {
              if (labRefs.exportStatus) {
                labRefs.exportStatus.textContent = "Copied audited " + lab.exportFormat + " brief.";
              }
            }).catch(function () {
              if (labRefs.exportStatus) {
                labRefs.exportStatus.textContent = "Copy was blocked; select the preview text manually.";
              }
            });
          }
        });
      }

      if (labRefs.copyHashBtn) {
        labRefs.copyHashBtn.addEventListener("click", function () {
          const share = buildShareUrl();
          if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState(null, "", share.hash);
          }
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(share.url).then(function () {
              labStatus("Share link copied: " + share.hash.slice(0, 28) + "...");
            }).catch(function () {
              labStatus("Clipboard blocked; the address bar now holds the #slf= bookmark.");
            });
          } else {
            labStatus("Address bar now holds the #slf= bookmark.");
          }
        });
      }

      if (labRefs.verifyBtn) {
        labRefs.verifyBtn.addEventListener("click", function () {
          if (!lab.bundle || !labRefs.exportPreview) {
            return;
          }
          const verdict = LabApi.verifyAuditedExport(
            lab.exportFormat,
            labRefs.exportPreview.value,
            lab.bundle.digest
          );
          if (labRefs.exportStatus) {
            labRefs.exportStatus.textContent = verdict.ok
              ? "Integrity verified: SHA-256 " + (verdict.digest || "").slice(0, 20) + "..."
              : "TAMPER DETECTED: " + verdict.detail;
          }
        });
      }

      if (labRefs.tamperBtn) {
        labRefs.tamperBtn.addEventListener("click", function () {
          if (!lab.bundle || !labRefs.exportPreview) {
            return;
          }
          labRefs.exportPreview.value = LabApi.demoTamperExport(
            lab.exportFormat,
            lab.bundle.exports[lab.exportFormat]
          );
          lab.previewTampered = true;
          if (labRefs.exportStatus) {
            labRefs.exportStatus.textContent = "Tamper demo artifact injected. Run Verify Integrity to catch it.";
          }
        });
      }

      if (labRefs.selfTestBtn) {
        labRefs.selfTestBtn.addEventListener("click", runLabSelfTests);
      }

      window.addEventListener("hashchange", function () {
        restoreStateFromHash(window.location.hash);
      });
    }

    // Event Wiring
    if (scenarioSelect) {
      scenarioSelect.addEventListener("change", function () {
        const sc = SCENARIOS[scenarioSelect.value];
        if (!sc) {
          return;
        }
        state.seedIds = sc.seedIds.slice();
        state.arcPresetId = sc.arcPresetId;
        state.controlPoints = Engine.ENERGY_ARC_PRESETS[sc.arcPresetId].controlPoints.slice();
        state.targetLength = sc.targetLength;
        state.pinnedTracks = {};

        if (trackLengthSlider) {
          trackLengthSlider.value = String(state.targetLength);
        }
        if (trackLengthValue) {
          trackLengthValue.textContent = state.targetLength + " Tracks";
        }
        document.querySelectorAll(".arc-preset-btn").forEach(function (btn) {
          const active = btn.getAttribute("data-preset") === state.arcPresetId;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
        syncSplineSlidersUI();
        recomputeAndRender();
      });
    }

    if (auditionFullArcBtn) {
      auditionFullArcBtn.addEventListener("click", function () {
        triggerTransitionAudition(0);
      });
    }

    if (toggleDrawerBtn && qlooExportDrawer) {
      toggleDrawerBtn.addEventListener("click", function () {
        const isHidden = qlooExportDrawer.hasAttribute("hidden");
        if (isHidden) {
          qlooExportDrawer.removeAttribute("hidden");
          toggleDrawerBtn.setAttribute("aria-expanded", "true");
          updateDrawerPreviews();
        } else {
          qlooExportDrawer.setAttribute("hidden", "");
          toggleDrawerBtn.setAttribute("aria-expanded", "false");
        }
      });
    }

    if (closeDrawerBtn && qlooExportDrawer) {
      closeDrawerBtn.addEventListener("click", function () {
        qlooExportDrawer.setAttribute("hidden", "");
        if (toggleDrawerBtn) {
          toggleDrawerBtn.setAttribute("aria-expanded", "false");
          if (qlooExportDrawer.contains(document.activeElement)) {
            toggleDrawerBtn.focus();
          }
        }
      });
    }

    if (selectedSeedsTray) {
      selectedSeedsTray.addEventListener("click", function (ev) {
        const btn = ev.target.closest("[data-remove-seed]");
        if (!btn) {
          return;
        }
        const idToRemove = btn.getAttribute("data-remove-seed");
        if (state.seedIds.length <= 1) {
          if (synthStatusText) {
            synthStatusText.textContent = "At least 1 cultural seed must remain active to anchor the 8D taste centroid.";
          }
          return;
        }
        state.seedIds = state.seedIds.filter(function (id) { return id !== idToRemove; });
        recomputeAndRender();
      });
    }

    document.querySelectorAll(".domain-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.domainFilter = tab.getAttribute("data-domain") || "ALL";
        document.querySelectorAll(".domain-tab").forEach(function (t) {
          const active = t === tab;
          t.classList.toggle("active", active);
          t.setAttribute("aria-pressed", active ? "true" : "false");
        });
        renderCatalogList();
      });
    });

    if (catalogSearchInput) {
      catalogSearchInput.addEventListener("input", function () {
        state.searchQuery = catalogSearchInput.value || "";
        renderCatalogList();
      });
    }

    if (seedCatalogList) {
      seedCatalogList.addEventListener("click", function (ev) {
        const btn = ev.target.closest("[data-toggle-seed]");
        if (!btn) {
          return;
        }
        const entityId = btn.getAttribute("data-toggle-seed");
        const existingIdx = state.seedIds.indexOf(entityId);
        if (existingIdx !== -1) {
          if (state.seedIds.length > 1) {
            state.seedIds.splice(existingIdx, 1);
          }
        } else {
          if (state.seedIds.length >= 4) {
            state.seedIds.shift();
          }
          state.seedIds.push(entityId);
        }
        recomputeAndRender();
      });
    }

    document.querySelectorAll(".arc-preset-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const presetId = btn.getAttribute("data-preset");
        if (!Engine.ENERGY_ARC_PRESETS[presetId]) {
          return;
        }
        state.arcPresetId = presetId;
        state.controlPoints = Engine.ENERGY_ARC_PRESETS[presetId].controlPoints.slice();
        document.querySelectorAll(".arc-preset-btn").forEach(function (b) {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        syncSplineSlidersUI();
        recomputeAndRender();
      });
    });

    document.querySelectorAll(".spline-slider").forEach(function (slider) {
      slider.addEventListener("input", function () {
        const stageIdx = Number(slider.getAttribute("data-stage"));
        const pct = Number(slider.value);
        state.controlPoints[stageIdx] = Engine.roundTo(pct / 100, 2);
        state.arcPresetId = "custom";
        const labelEl = document.getElementById("splineVal" + stageIdx);
        if (labelEl) {
          labelEl.textContent = pct + "%";
        }
        document.querySelectorAll(".arc-preset-btn").forEach(function (b) {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        recomputeAndRender();
      });
    });

    if (resetSplineBtn) {
      resetSplineBtn.addEventListener("click", function () {
        const fallbackId = state.arcPresetId === "custom" ? "slow_burn" : state.arcPresetId;
        state.arcPresetId = fallbackId;
        state.controlPoints = Engine.ENERGY_ARC_PRESETS[fallbackId].controlPoints.slice();
        syncSplineSlidersUI();
        recomputeAndRender();
      });
    }

    if (trackLengthSlider) {
      trackLengthSlider.addEventListener("input", function () {
        state.targetLength = Number(trackLengthSlider.value);
        if (trackLengthValue) {
          trackLengthValue.textContent = state.targetLength + " Tracks";
        }
        Object.keys(state.pinnedTracks).forEach(function (slotKey) {
          if (Number(slotKey) >= state.targetLength) {
            delete state.pinnedTracks[slotKey];
          }
        });
        recomputeAndRender();
      });
    }

    function updateWeightsFromSliders() {
      const pct = function (slider, def) {
        const v = slider ? Number(slider.value) : NaN;
        return Number.isFinite(v) ? v / 100 : def;
      };
      const a = pct(weightAffinitySlider, 0.40);
      const e = pct(weightEnergySlider, 0.34);
      const h = pct(weightHarmonicSlider, 0.26);
      const sum = a + e + h > 0 ? a + e + h : 1;
      state.weights = {
        affinity: Engine.roundTo(a / sum, 2),
        energyFit: Engine.roundTo(e / sum, 2),
        harmonic: Engine.roundTo(h / sum, 2)
      };
      if (weightAffinityValue) {
        weightAffinityValue.textContent = state.weights.affinity.toFixed(2);
      }
      if (weightEnergyValue) {
        weightEnergyValue.textContent = state.weights.energyFit.toFixed(2);
      }
      if (weightHarmonicValue) {
        weightHarmonicValue.textContent = state.weights.harmonic.toFixed(2);
      }
      recomputeAndRender();
    }

    if (weightAffinitySlider) {
      weightAffinitySlider.addEventListener("input", updateWeightsFromSliders);
    }
    if (weightEnergySlider) {
      weightEnergySlider.addEventListener("input", updateWeightsFromSliders);
    }
    if (weightHarmonicSlider) {
      weightHarmonicSlider.addEventListener("input", updateWeightsFromSliders);
    }

    if (clearPinsBtn) {
      clearPinsBtn.addEventListener("click", function () {
        state.pinnedTracks = {};
        recomputeAndRender();
      });
    }

    if (resequenceBtn) {
      resequenceBtn.addEventListener("click", function () {
        recomputeAndRender();
      });
    }

    if (energyArcSvg) {
      energyArcSvg.addEventListener("click", function (ev) {
        const badge = ev.target.closest("[data-transition-idx]");
        if (badge) {
          const idx = Number(badge.getAttribute("data-transition-idx"));
          triggerTransitionAudition(idx);
          return;
        }
        const node = ev.target.closest("[data-slot-idx]");
        if (node && state.currentResult && Array.isArray(state.currentResult.transitions)) {
          const slotIdx = Number(node.getAttribute("data-slot-idx"));
          const nextIdx = Math.min(slotIdx, state.currentResult.transitions.length - 1);
          triggerTransitionAudition(Math.max(0, nextIdx));
        }
      });
    }

    if (setlistTrackContainer) {
      setlistTrackContainer.addEventListener("click", function (ev) {
        const pinBtn = ev.target.closest("[data-pin-slot]");
        if (pinBtn) {
          const slotIdx = Number(pinBtn.getAttribute("data-pin-slot"));
          const currentTrackId = state.currentResult.tracks[slotIdx].track.id;
          if (state.pinnedTracks[slotIdx]) {
            delete state.pinnedTracks[slotIdx];
          } else {
            state.pinnedTracks[slotIdx] = currentTrackId;
          }
          recomputeAndRender();
          return;
        }

        const autoSwapBtn = ev.target.closest("[data-auto-swap]");
        if (autoSwapBtn) {
          const slotIdx = Number(autoSwapBtn.getAttribute("data-auto-swap"));
          try {
            state.currentResult = Engine.swapSetlistTrack(state.currentResult, slotIdx, null);
            state.currentResult.strategyId = "balanced-beam";
            state.currentResult.strategyName = "Balanced Beam Search";
            state.strategyId = "balanced-beam";
            renderCurrentResult();
          } catch (err) {
            if (synthStatusText) {
              synthStatusText.textContent = "Swap failed: " + (err && err.message ? err.message : err);
            }
          }
          return;
        }

        const auditionBtn = ev.target.closest("[data-audition-transition]");
        if (auditionBtn) {
          const trIdx = Number(auditionBtn.getAttribute("data-audition-transition"));
          triggerTransitionAudition(trIdx);
        }
      });

      setlistTrackContainer.addEventListener("change", function (ev) {
        const selectEl = ev.target.closest("[data-swap-select]");
        if (!selectEl) {
          return;
        }
        const slotIdx = Number(selectEl.getAttribute("data-swap-select"));
        const chosenTrackId = selectEl.value;
        try {
          state.currentResult = Engine.swapSetlistTrack(state.currentResult, slotIdx, chosenTrackId);
          state.currentResult.strategyId = "balanced-beam";
          state.currentResult.strategyName = "Balanced Beam Search";
          state.strategyId = "balanced-beam";
          renderCurrentResult();
        } catch (err) {
          if (synthStatusText) {
            synthStatusText.textContent = "Swap failed: " + (err && err.message ? err.message : err);
          }
          renderCurrentResult();
        }
      });
    }

    if (qlooEndpointSelect) {
      qlooEndpointSelect.addEventListener("change", updateDrawerPreviews);
    }
    if (qlooApiKeyInput) {
      qlooApiKeyInput.addEventListener("input", updateDrawerPreviews);
    }

    if (fetchQlooLiveBtn) {
      fetchQlooLiveBtn.addEventListener("click", async function () {
        const apiKey = qlooApiKeyInput ? qlooApiKeyInput.value.trim() : "";
        const endpoint = qlooEndpointSelect ? qlooEndpointSelect.value : "https://hackathon.api.qloo.com";
        const reqSpec = Engine.buildQlooInsightsRequest(state.seedIds, apiKey, endpoint);

        if (!apiKey) {
          if (qlooApiStatus) {
            qlooApiStatus.textContent =
              "No API key entered; using verified 8D cross-domain Qloo entity embeddings (" +
              reqSpec.seedUrns.length + " seeds).";
          }
          return;
        }

        if (qlooApiStatus) {
          qlooApiStatus.textContent = "Querying " + endpoint + "/v2/insights ...";
        }
        try {
          const response = await fetch(reqSpec.url, {
            method: reqSpec.method,
            headers: reqSpec.headers
          });
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          const data = await response.json();
          const entities = data && data.results && Array.isArray(data.results.entities)
            ? data.results.entities
            : [];
          const names = entities.slice(0, 3).map(function (e) { return e && e.name; }).filter(Boolean);
          if (qlooApiStatus) {
            qlooApiStatus.textContent =
              "Live Qloo Insights connected: " + entities.length + " related entities returned" +
              (names.length ? " (top: " + names.join(", ") + ")" : "") +
              ". Local deterministic centroid unchanged.";
          }
        } catch (err) {
          if (qlooApiStatus) {
            qlooApiStatus.textContent =
              "Live fetch fallback (" + err.message + ") -> deterministic 8D Qloo taste graph active.";
          }
        }
      });
    }

    document.querySelectorAll(".export-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.exportFormat = tab.getAttribute("data-format") || "m3u8";
        document.querySelectorAll(".export-tab").forEach(function (t) {
          t.classList.toggle("active", t === tab);
          t.setAttribute("aria-pressed", t === tab ? "true" : "false");
        });
        updateDrawerPreviews();
      });
    });

    if (copyExportBtn && exportPreviewTextarea) {
      copyExportBtn.addEventListener("click", function () {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(exportPreviewTextarea.value).then(function () {
            if (exportFeedbackText) {
              exportFeedbackText.textContent = "Copied " + state.exportFormat + " manifest to clipboard.";
            }
          }).catch(function () {
            if (exportFeedbackText) {
              exportFeedbackText.textContent = "Copy was blocked; select the preview text manually.";
            }
          });
        } else if (exportFeedbackText) {
          exportFeedbackText.textContent = "Clipboard unavailable; select the preview text manually.";
        }
      });
    }

    if (downloadExportBtn && exportPreviewTextarea) {
      downloadExportBtn.addEventListener("click", function () {
        const extMap = { m3u8: "m3u8", json: "json", markdown: "md", csv: "csv" };
        const ext = extMap[state.exportFormat] || "txt";
        const blob = new Blob([exportPreviewTextarea.value], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "setlist-forge-" + state.arcPresetId + "." + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (exportFeedbackText) {
          exportFeedbackText.textContent = "Downloaded setlist-forge-" + state.arcPresetId + "." + ext;
        }
      });
    }

    syncSplineSlidersUI();
    recomputeAndRender();
    if (lab.available) {
      initHarmonicLab();
      labRefreshComparator();
      restoreStateFromHash(window.location.hash);
      setTimeout(runLabSelfTests, 60);
    }
    return {
      state: state,
      recomputeAndRender: recomputeAndRender,
      triggerTransitionAudition: triggerTransitionAudition,
      restoreStateFromHash: restoreStateFromHash,
      runLabSelfTests: runLabSelfTests
    };
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initBrowserApp);
    } else {
      initBrowserApp();
    }
  }

  return {
    SCENARIOS: SCENARIOS,
    formatDuration: formatDuration,
    formatTrackClock: formatTrackClock,
    escapeHtml: escapeHtml,
    buildEnergyArcSvgMarkup: buildEnergyArcSvgMarkup,
    createWebAudioPreviewSynth: createWebAudioPreviewSynth,
    initBrowserApp: initBrowserApp
  };
});
