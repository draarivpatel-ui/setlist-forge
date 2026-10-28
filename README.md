# SetlistForge

Cross-domain music, film, literary, and sonic mood arc planner built for the Qloo Agentic Hackathon. Live at [aariv.me/setlist-forge](https://aariv.me/setlist-forge/).

## Overview

SetlistForge pairs Qloo-style cross-domain cultural entity conditioning with a harmonic beam-search setlist sequencer:

1. **Cross-Domain Cultural Seed Conditioning**: Select 1 to 4 cultural seeds across 4 domains (`Films & Directors`, `Books & Essays`, `Sonic Venues & Aesthetics`, and `Music Tracks`) to compute an 8-dimensional taste centroid (`tempo`, `valence`, `acousticness`, `cinematicTension`, `nostalgia`, `lyricalDensity`, `subculturalEdge`, `warmth`) and inspect the explainability bridge showing why each track matches your non-music seeds.
2. **Beam-Search Energy & Harmonic Sequencer**: Sequences 6 to 12 tracks along a selectable 6-stage energy spline (`Slow Burn Crescendo`, `Late-Night Noir Wave`, `Peak-Hour Festival Arc`, `Warm Acoustic Dawn`, or custom faders) while optimizing seed affinity, target energy MSE, and Camelot wheel harmonic transitions (`0` step, `±1` fifth, or relative major/minor `A<->B`).
3. **Web Audio API Harmonic Transition Synth**: Audition any adjacent track transition directly in the browser using dual-chord oscillator synthesis with lowpass filter envelopes.
4. **Live Qloo Insights API Connector & Multi-Format Export**: Optional drawer to query `https://hackathon.api.qloo.com/v2/insights` with a live API key and export playlists as `.m3u8`, `.json`, or Markdown liner notes.

## Running Locally

```bash
git clone https://github.com/draarivpatel-ui/setlist-forge.git
cd setlist-forge
node --test
open index.html
```

## License

MIT
