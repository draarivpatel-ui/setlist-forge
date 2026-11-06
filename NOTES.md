# Engineering & Transparency Notes

## How SetlistForge Was Built

- **Architecture & Audio Synthesis**: SetlistForge combines deterministic beam-search taste graph sequencing with Web Audio API harmonic previews, and demo narration was synthesized using local Chatterbox TTS.
- **Offline & Live Qloo Modes**: By default, SetlistForge runs completely in the browser with a curated 36-entity cross-domain catalog (`engine.js`) so judges can test seed conditioning, beam-search sequencing, and Web Audio harmonic previews with zero setup. Entering a Qloo API key in the connector drawer queries `/v2/insights` directly.
- **Verification**: Run `node --test` to execute the 30 unit and DOM smoke tests across `tests/engine.test.js` and `tests/dom-smoke.test.js`.
