# Engineering & Transparency Notes

## How SetlistForge Was Built

- **Architecture & Audio Synthesis**: SetlistForge combines deterministic beam-search taste graph sequencing with Web Audio API harmonic previews, and demo narration was synthesized using local Chatterbox TTS.
- **Harmonic & Beam-Search Lab**: `harmonic-lab.js` is a pure-JS UMD module that adds a five-strategy x four-arc comparator, a 24-key Camelot wheel/energy telemetry model, a FIPS 180-4 SHA-256 audited brief exporter (JSON, formula-safe CSV, Markdown, all bound to one canonical digest), a strict `#slf=` bookmark codec, and a 16-check deterministic in-page self-test battery. It reuses `Engine.sequenceSetlist` so pin, uniqueness, and determinism invariants stay identical across strategies.
- **Offline & Live Qloo Modes**: By default, SetlistForge runs completely in the browser with a curated 36-entity cross-domain catalog (`engine.js`) so judges can test seed conditioning, beam-search sequencing, and Web Audio harmonic previews with zero setup. Entering a Qloo API key in the connector drawer queries `/v2/insights` directly. Live responses are shown verbatim and are not merged into the deterministic local centroid.
- **Verification**: Run `node --test` to execute the 475 tests across `tests/engine.test.js`, `tests/dom-smoke.test.js`, `tests/hardening.test.js`, `tests/ui-hardening.test.js`, and `tests/harmonic-lab.test.js`.
