# SetlistForge

Cross-domain music, film, literary, and sonic mood arc planner built for the Qloo Agentic Hackathon. Live at [aariv.me/setlist-forge](https://aariv.me/setlist-forge/).

## Overview

SetlistForge pairs Qloo-style cross-domain cultural entity conditioning with a harmonic beam-search setlist sequencer:

1. **Cross-Domain Cultural Seed Conditioning**: Select 1 to 4 cultural seeds across 4 domains (`Films & Directors`, `Books & Essays`, `Sonic Venues & Aesthetics`, and `Music Tracks`) to compute an 8-dimensional taste centroid (`tempo`, `valence`, `acousticness`, `cinematicTension`, `nostalgia`, `lyricalDensity`, `subculturalEdge`, `warmth`) and inspect the explainability bridge showing why each track matches your non-music seeds.
2. **Beam-Search Energy & Harmonic Sequencer**: Sequences 6 to 12 tracks along a selectable 6-stage energy spline (`Slow Burn Crescendo`, `Late-Night Noir Wave`, `Peak-Hour Festival Arc`, `Warm Acoustic Dawn`, or custom faders) while optimizing seed affinity, target energy MSE, and Camelot wheel harmonic transitions (`0` step, `±1` fifth, or relative major/minor `A<->B`).
3. **Web Audio API Harmonic Transition Synth**: Audition any adjacent track transition directly in the browser using dual-chord oscillator synthesis with lowpass filter envelopes.
4. **Harmonic & Beam-Search Lab**: A deterministic audit panel (`harmonic-lab.js`) that evaluates five sequencing strategies (`greedy-affinity`, `energy-spline-only`, `camelot-strict`, `balanced-beam`, `pinned-anchor-beam`) across all four shipped energy arcs, reporting Camelot-compatible transition rate, clash count, energy MSE, mean seed affinity, max BPM jump, and arc score, plus a 24-key SVG Camelot wheel with the setlist path and a target-vs-actual energy telemetry chart.
5. **SHA-256 Audited Exports & Share Links**: The lab stamps one canonical brief digest (pure-JS FIPS 180-4 SHA-256, zero dependencies) into the on-page fingerprint, JSON export, CSV provenance header, and Markdown footer so any byte-level tamper fails verification. `#slf=` URL-hash bookmarks round-trip arc, length, strategy, seeds, and pins.
6. **Live Qloo Insights API Connector & Multi-Format Export**: Optional drawer to query `https://hackathon.api.qloo.com/v2/insights` with a live API key and export playlists as `.m3u8`, `.json`, or Markdown liner notes.

## Honest Disclosures

- The app is fully functional offline: all 36 cultural entities, Camelot key metadata, energy arcs, and sequencer behavior ship as a deterministic curated catalog in `engine.js`. No network requests are made on page load.
- The live Qloo connector is strictly opt-in: it only calls the Insights API after a judge pastes a key and clicks fetch. Live results are displayed as returned; they are never claimed to re-synchronize the local deterministic centroid.
- Web Audio runs only after an explicit user click, consistent with browser autoplay policies.
- The Harmonic Lab comparator evaluates strategies on the shipped 18-track catalog; the comparator numbers are real computed outputs, not marketing copy.

## Running Locally

```bash
git clone https://github.com/draarivpatel-ui/setlist-forge.git
cd setlist-forge
node --test
open index.html
```

The suite currently runs 481 tests across `tests/engine.test.js`, `tests/dom-smoke.test.js`, `tests/hardening.test.js`, `tests/ui-hardening.test.js`, `tests/harmonic-lab.test.js`, `tests/batch5-security.test.js`, and `tests/static-integrity.test.js`. The in-page lab also ships a 16-check deterministic self-test battery (SHA-256 known answers, Camelot wraparound, invariants, strict codec round-trips, canonical payload linkage, immutable export caches, trailing-content rejection, tamper detection) runnable from the Harmonic Lab panel.

## License

MIT
