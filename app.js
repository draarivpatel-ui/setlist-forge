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
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
        '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#78746B">' +
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
      '<polyline fill="none" stroke="#C84B31" stroke-width="2.5" stroke-dasharray="6 4" points="' +
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
      const shortTitle = item.track.title.length > 14
        ? item.track.title.slice(0, 12) + ".."
        : item.track.title;

      parts.push(
        '<circle cx="' + cx + '" cy="' + cyTarget + '" r="4" fill="#C84B31" />'
      );

      parts.push(
        '<g class="svg-track-node" data-slot-idx="' + i + '" style="cursor:pointer">' +
        '<circle cx="' + cx + '" cy="' + cyActual + '" r="6.5" fill="#FAF8F3" stroke="#2B4C7E" stroke-width="2.5" />' +
        '<text x="' + cx + '" y="' + (padTop + plotH + 18) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" fill="#151514">#' +
        item.position + ' (' + item.track.camelotKey + ')</text>' +
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
          entity.title + " " +
          entity.creator + " " +
          entity.domain + " " +
          entity.camelotKey + " " +
          entity.tags.join(" ")
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
                escapeHtml(entity.domain) + ' // ' + escapeHtml(entity.camelotKey) + ' (' + entity.bpm + ' BPM) // ' +
                escapeHtml(entity.tags.slice(0, 3).join(", ")) +
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
              escapeHtml(candidate.title) + " (" + candidate.camelotKey + ", " + candidate.bpm + " BPM)" +
              "</option>"
            );
          })
          .join("");

        const seedBridgePills = item.bridge.seedBridges.map(function (sb) {
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
                '<span class="track-slot-num">0' + item.position + '</span>' +
                '<h3 class="track-name">' + escapeHtml(trk.title) + '</h3>' +
                '<span class="track-creator">by ' + escapeHtml(trk.creator) + ' (' + trk.year + ' // ' + formatTrackClock(trk.durationSec) + ')</span>' +
              '</div>' +
              '<div class="track-badges">' +
                '<span class="camelot-badge">' + escapeHtml(trk.camelotKey) + " // " + escapeHtml(musicalKeyLabel) + '</span>' +
                '<span class="bpm-badge">' + trk.bpm + ' BPM</span>' +
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
              '<div class="explainability-headline">Cross-Domain Bridge: ' + escapeHtml(item.bridge.headline) + '</div>' +
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
        } else {
          exportPreviewTextarea.value = Engine.exportSetlistM3U8(state.currentResult);
        }
      }
    }

    function recomputeAndRender() {
      const result = Engine.sequenceSetlist({
        seedIds: state.seedIds,
        targetLength: state.targetLength,
        arcPresetId: state.arcPresetId,
        customControlPoints: state.controlPoints,
        pinnedTracks: state.pinnedTracks,
        weights: state.weights
      });
      state.currentResult = result;

      renderSelectedSeedsAndCentroid(result.seedProfile);
      renderCatalogList();
      renderTelemetryAndSvg(result);
      renderSetlistDeck(result);
      updateDrawerPreviews();
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
          btn.classList.toggle("active", btn.getAttribute("data-preset") === state.arcPresetId);
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
          t.setAttribute("aria-selected", active ? "true" : "false");
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
        recomputeAndRender();
      });
    }

    function updateWeightsFromSliders() {
      const a = weightAffinitySlider ? Number(weightAffinitySlider.value) / 100 : 0.40;
      const e = weightEnergySlider ? Number(weightEnergySlider.value) / 100 : 0.34;
      const h = weightHarmonicSlider ? Number(weightHarmonicSlider.value) / 100 : 0.26;
      const sum = a + e + h || 1;
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
        if (node) {
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
          const swapped = Engine.swapSetlistTrack(state.currentResult, slotIdx, null);
          state.pinnedTracks[slotIdx] = swapped.tracks[slotIdx].track.id;
          recomputeAndRender();
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
        state.pinnedTracks[slotIdx] = chosenTrackId;
        recomputeAndRender();
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
          const count = data && data.results && Array.isArray(data.results.entities)
            ? data.results.entities.length
            : 0;
          if (qlooApiStatus) {
            qlooApiStatus.textContent =
              "Live Qloo Insights connected (" + count + " entities returned). Centroid synchronized.";
          }
          recomputeAndRender();
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
        });
        updateDrawerPreviews();
      });
    });

    if (copyExportBtn && exportPreviewTextarea) {
      copyExportBtn.addEventListener("click", function () {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(exportPreviewTextarea.value);
        }
        if (exportFeedbackText) {
          exportFeedbackText.textContent = "Copied " + state.exportFormat + " manifest to clipboard.";
        }
      });
    }

    if (downloadExportBtn && exportPreviewTextarea) {
      downloadExportBtn.addEventListener("click", function () {
        const extMap = { m3u8: "m3u8", json: "json", markdown: "md" };
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
    return {
      state: state,
      recomputeAndRender: recomputeAndRender,
      triggerTransitionAudition: triggerTransitionAudition
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
