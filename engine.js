(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SetlistForgeEngine = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TASTE_DIMENSIONS = [
    {
      key: "tempo",
      label: "Pulse & Tempo Drive",
      shortLabel: "Tempo",
      description: "Forward rhythmic momentum and percussive propulsion"
    },
    {
      key: "valence",
      label: "Luminous Valence",
      shortLabel: "Valence",
      description: "Emotional brightness from shadow-drenched melancholy to radiant euphoria"
    },
    {
      key: "acousticness",
      label: "Organic Acoustic Grain",
      shortLabel: "Acoustic",
      description: "Presence of wood, brass, piano felt, room air, and unquantized human touch"
    },
    {
      key: "cinematicTension",
      label: "Cinematic Tension",
      shortLabel: "Tension",
      description: "Suspense, widescreen harmonic drama, and unresolved narrative anticipation"
    },
    {
      key: "nostalgia",
      label: "Analog Nostalgia",
      shortLabel: "Nostalgia",
      description: "Tape saturation, memory-laden motifs, and temporal longing"
    },
    {
      key: "lyricalDensity",
      label: "Narrative & Lyrical Density",
      shortLabel: "Narrative",
      description: "Poetic specificity, literary texture, and conversational intimacy"
    },
    {
      key: "subculturalEdge",
      label: "Subcultural Edge",
      shortLabel: "Edge",
      description: "Underground club experimentation, left-field production, and nocturnal grit"
    },
    {
      key: "warmth",
      label: "Tube & Vinyl Warmth",
      shortLabel: "Warmth",
      description: "Low-mid harmonic richness, enveloping bass, and intimate room resonance"
    }
  ];

  const CAMELOT_WHEEL = {
    "1A": { code: "1A", number: 1, mode: "A", musicalKey: "Ab Minor", rootHz: 207.65, chordHz: [207.65, 246.94, 311.13] },
    "1B": { code: "1B", number: 1, mode: "B", musicalKey: "B Major", rootHz: 246.94, chordHz: [246.94, 311.13, 369.99] },
    "2A": { code: "2A", number: 2, mode: "A", musicalKey: "Eb Minor", rootHz: 155.56, chordHz: [155.56, 185.00, 233.08] },
    "2B": { code: "2B", number: 2, mode: "B", musicalKey: "F# Major", rootHz: 185.00, chordHz: [185.00, 233.08, 277.18] },
    "3A": { code: "3A", number: 3, mode: "A", musicalKey: "Bb Minor", rootHz: 233.08, chordHz: [233.08, 277.18, 349.23] },
    "3B": { code: "3B", number: 3, mode: "B", musicalKey: "Db Major", rootHz: 277.18, chordHz: [277.18, 349.23, 415.30] },
    "4A": { code: "4A", number: 4, mode: "A", musicalKey: "F Minor", rootHz: 174.61, chordHz: [174.61, 207.65, 261.63] },
    "4B": { code: "4B", number: 4, mode: "B", musicalKey: "Ab Major", rootHz: 207.65, chordHz: [207.65, 261.63, 311.13] },
    "5A": { code: "5A", number: 5, mode: "A", musicalKey: "C Minor", rootHz: 261.63, chordHz: [261.63, 311.13, 392.00] },
    "5B": { code: "5B", number: 5, mode: "B", musicalKey: "Eb Major", rootHz: 155.56, chordHz: [155.56, 196.00, 233.08] },
    "6A": { code: "6A", number: 6, mode: "A", musicalKey: "G Minor", rootHz: 196.00, chordHz: [196.00, 233.08, 293.66] },
    "6B": { code: "6B", number: 6, mode: "B", musicalKey: "Bb Major", rootHz: 233.08, chordHz: [233.08, 293.66, 349.23] },
    "7A": { code: "7A", number: 7, mode: "A", musicalKey: "D Minor", rootHz: 146.83, chordHz: [146.83, 174.61, 220.00] },
    "7B": { code: "7B", number: 7, mode: "B", musicalKey: "F Major", rootHz: 174.61, chordHz: [174.61, 220.00, 261.63] },
    "8A": { code: "8A", number: 8, mode: "A", musicalKey: "A Minor", rootHz: 220.00, chordHz: [220.00, 261.63, 329.63] },
    "8B": { code: "8B", number: 8, mode: "B", musicalKey: "C Major", rootHz: 261.63, chordHz: [261.63, 329.63, 392.00] },
    "9A": { code: "9A", number: 9, mode: "A", musicalKey: "E Minor", rootHz: 164.81, chordHz: [164.81, 196.00, 246.94] },
    "9B": { code: "9B", number: 9, mode: "B", musicalKey: "G Major", rootHz: 196.00, chordHz: [196.00, 246.94, 293.66] },
    "10A": { code: "10A", number: 10, mode: "A", musicalKey: "B Minor", rootHz: 246.94, chordHz: [246.94, 293.66, 369.99] },
    "10B": { code: "10B", number: 10, mode: "B", musicalKey: "D Major", rootHz: 146.83, chordHz: [146.83, 185.00, 220.00] },
    "11A": { code: "11A", number: 11, mode: "A", musicalKey: "F# Minor", rootHz: 185.00, chordHz: [185.00, 220.00, 277.18] },
    "11B": { code: "11B", number: 11, mode: "B", musicalKey: "A Major", rootHz: 220.00, chordHz: [220.00, 277.18, 329.63] },
    "12A": { code: "12A", number: 12, mode: "A", musicalKey: "Db Minor", rootHz: 277.18, chordHz: [277.18, 329.63, 415.30] },
    "12B": { code: "12B", number: 12, mode: "B", musicalKey: "E Major", rootHz: 164.81, chordHz: [164.81, 207.65, 246.94] }
  };

  const ENERGY_ARC_PRESETS = {
    slow_burn: {
      id: "slow_burn",
      name: "Slow Burn Crescendo",
      subtitle: "Intimate opening into a patient late-set horizon peak and warm resolution",
      controlPoints: [0.28, 0.38, 0.50, 0.64, 0.80, 0.68]
    },
    late_night_noir: {
      id: "late_night_noir",
      name: "Late-Night Noir Wave",
      subtitle: "Undulating neon tension with dual midnight swells and a smoky exit",
      controlPoints: [0.34, 0.56, 0.44, 0.68, 0.54, 0.30]
    },
    peak_hour_festival: {
      id: "peak_hour_festival",
      name: "Peak-Hour Festival Arc",
      subtitle: "High-propulsion climb engineered for kinetic rooms and euphoric release",
      controlPoints: [0.46, 0.64, 0.78, 0.88, 0.80, 0.58]
    },
    warm_acoustic_dawn: {
      id: "warm_acoustic_dawn",
      name: "Warm Acoustic Dawn",
      subtitle: "Gentle chamber and analog textures that bloom softly without harsh transients",
      controlPoints: [0.22, 0.32, 0.44, 0.50, 0.40, 0.26]
    },
    custom: {
      id: "custom",
      name: "Custom Mastering Spline",
      subtitle: "User-sculpted 6-stage energy envelope for bespoke narrative pacing",
      controlPoints: [0.35, 0.48, 0.60, 0.72, 0.62, 0.42]
    }
  };

  const CULTURAL_CATALOG = [
    // =========================================================================
    // DOMAIN 1: MUSIC TRACKS (18 Curated Tracks across keys, BPMs, and moods)
    // =========================================================================
    {
      id: "trk-midnight-train-kyoto",
      title: "Midnight Train to Kyoto",
      creator: "Kenji Takahashi Trio",
      year: 2021,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:midnight-train-to-kyoto",
      camelotKey: "8A",
      bpm: 88,
      durationSec: 254,
      tags: ["modal-jazz", "upright-bass", "nocturnal", "kissaten", "rain-window"],
      tagline: "Brushed snare and smoky Rhodes chords drifting through late-night station platforms.",
      vector: {
        tempo: 0.36,
        valence: 0.38,
        acousticness: 0.86,
        cinematicTension: 0.58,
        nostalgia: 0.88,
        lyricalDensity: 0.22,
        subculturalEdge: 0.48,
        warmth: 0.94
      }
    },
    {
      id: "trk-roygbiv-tape-hiss",
      title: "Turquoise Hexagon Sunbeams",
      creator: "Boards of Horizon",
      year: 1998,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:turquoise-hexagon-sunbeams",
      camelotKey: "9A",
      bpm: 92,
      durationSec: 212,
      tags: ["analog-synth", "warped-tape", "hauntology", "downtempo", "memory"],
      tagline: "Detuned Roland SH-101 vignettes bathed in 16mm educational film grain.",
      vector: {
        tempo: 0.40,
        valence: 0.46,
        acousticness: 0.42,
        cinematicTension: 0.52,
        nostalgia: 0.96,
        lyricalDensity: 0.15,
        subculturalEdge: 0.76,
        warmth: 0.90
      }
    },
    {
      id: "trk-velvet-harbor-theme",
      title: "Cheungas Alley Waltz",
      creator: "Shigeru & The String Chamber",
      year: 2000,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:cheungas-alley-waltz",
      camelotKey: "7A",
      bpm: 82,
      durationSec: 198,
      tags: ["chamber-strings", "waltz", "wong-kar-wai-mood", "velvet", "romance"],
      tagline: "Solo cello and muted violin trading aching phrases beneath stairwell tungsten bulbs.",
      vector: {
        tempo: 0.26,
        valence: 0.30,
        acousticness: 0.92,
        cinematicTension: 0.78,
        nostalgia: 0.94,
        lyricalDensity: 0.18,
        subculturalEdge: 0.42,
        warmth: 0.88
      }
    },
    {
      id: "trk-shibuya-rain-echo",
      title: "Shibuya Scramble After Hours",
      creator: "Haruka Sato",
      year: 2023,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:shibuya-scramble-after-hours",
      camelotKey: "8B",
      bpm: 98,
      durationSec: 236,
      tags: ["city-pop-noir", "fender-rhodes", "urban-solitude", "tokyo", "late-night"],
      tagline: "Silky electric piano arpeggios and whispered vocals reflecting wet asphalt crossings.",
      vector: {
        tempo: 0.48,
        valence: 0.54,
        acousticness: 0.64,
        cinematicTension: 0.52,
        nostalgia: 0.84,
        lyricalDensity: 0.68,
        subculturalEdge: 0.56,
        warmth: 0.86
      }
    },
    {
      id: "trk-subzero-concrete-pulse",
      title: "Köpenick Vault Dub",
      creator: "Marek Vance",
      year: 2019,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:kopenick-vault-dub",
      camelotKey: "5A",
      bpm: 124,
      durationSec: 342,
      tags: ["dub-techno", "berlin-basement", "chord-echo", "industrial", "hypnotic"],
      tagline: "Submerged minor-chord stabs echoing through a concrete turbine hall at 4 AM.",
      vector: {
        tempo: 0.82,
        valence: 0.28,
        acousticness: 0.10,
        cinematicTension: 0.86,
        nostalgia: 0.48,
        lyricalDensity: 0.08,
        subculturalEdge: 0.96,
        warmth: 0.64
      }
    },
    {
      id: "trk-neon-overpass-drive",
      title: "Sepulveda Pass 2:15 AM",
      creator: "Chromatics Circuit",
      year: 2017,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:sepulveda-pass-215am",
      camelotKey: "6A",
      bpm: 112,
      durationSec: 268,
      tags: ["synth-noir", "highway", "arpeggiator", "cinematic-drive", "los-angeles"],
      tagline: "Analog Juno pulse and reverb-drenched guitar built for empty sodium-lit freeways.",
      vector: {
        tempo: 0.68,
        valence: 0.40,
        acousticness: 0.24,
        cinematicTension: 0.84,
        nostalgia: 0.80,
        lyricalDensity: 0.54,
        subculturalEdge: 0.78,
        warmth: 0.72
      }
    },
    {
      id: "trk-mojave-slide-guitar",
      title: "Terlingua Mirage",
      creator: "Calexico Dust Ensemble",
      year: 2015,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:terlingua-mirage",
      camelotKey: "9B",
      bpm: 84,
      durationSec: 224,
      tags: ["desert-americana", "slide-guitar", "widescreen", "sun-bleached", "acoustic"],
      tagline: "Baritone slide guitar and dusty harmonium shimmering across open desert flats.",
      vector: {
        tempo: 0.30,
        valence: 0.52,
        acousticness: 0.90,
        cinematicTension: 0.60,
        nostalgia: 0.86,
        lyricalDensity: 0.34,
        subculturalEdge: 0.44,
        warmth: 0.92
      }
    },
    {
      id: "trk-south-london-2step",
      title: "Archway Nightbus Ghosts",
      creator: "Eliza Burials",
      year: 2020,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:archway-nightbus-ghosts",
      camelotKey: "4A",
      bpm: 118,
      durationSec: 245,
      tags: ["uk-garage", "hauntology", "pirate-radio", "vinyl-crackle", "nocturnal"],
      tagline: "Shuffling 2-step percussion and pitched vocal fragments recorded off rainy FM static.",
      vector: {
        tempo: 0.72,
        valence: 0.32,
        acousticness: 0.22,
        cinematicTension: 0.76,
        nostalgia: 0.90,
        lyricalDensity: 0.46,
        subculturalEdge: 0.94,
        warmth: 0.74
      }
    },
    {
      id: "trk-reykjavik-glacier-piano",
      title: "Vatnajokull Thaw",
      creator: "Einar Lindqvist",
      year: 2022,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:vatnajokull-thaw",
      camelotKey: "10A",
      bpm: 76,
      durationSec: 260,
      tags: ["neo-classical", "felt-piano", "nordic-ambient", "intimate", "modular"],
      tagline: "Close-miked felt upright piano joined by blooming tape loops and warm sub-bass.",
      vector: {
        tempo: 0.20,
        valence: 0.44,
        acousticness: 0.94,
        cinematicTension: 0.56,
        nostalgia: 0.82,
        lyricalDensity: 0.12,
        subculturalEdge: 0.46,
        warmth: 0.96
      }
    },
    {
      id: "trk-amber-warehouse-break",
      title: "Hallesches Tor Horizon",
      creator: "Klangwerk 09",
      year: 2024,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:hallesches-tor-horizon",
      camelotKey: "5B",
      bpm: 126,
      durationSec: 318,
      tags: ["melodic-techno", "euphoric-break", "warehouse", "modular-arp", "peak-hour"],
      tagline: "Propulsive kick drum and soaring polyphonic brass leads opening the roof at sunrise.",
      vector: {
        tempo: 0.88,
        valence: 0.74,
        acousticness: 0.14,
        cinematicTension: 0.80,
        nostalgia: 0.52,
        lyricalDensity: 0.10,
        subculturalEdge: 0.88,
        warmth: 0.68
      }
    },
    {
      id: "trk-chelsea-hotel-ballad",
      title: "23rd Street Typewriter Blues",
      creator: "Clara Vance",
      year: 2018,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:23rd-street-typewriter-blues",
      camelotKey: "8B",
      bpm: 94,
      durationSec: 230,
      tags: ["literary-folk", "fingerpicked", "poetic", "greenwich-village", "analog"],
      tagline: "Intimate nylon-string guitar and razor-sharp observational lyrics in a single room take.",
      vector: {
        tempo: 0.42,
        valence: 0.50,
        acousticness: 0.92,
        cinematicTension: 0.44,
        nostalgia: 0.86,
        lyricalDensity: 0.96,
        subculturalEdge: 0.52,
        warmth: 0.90
      }
    },
    {
      id: "trk-astral-koto-drift",
      title: "Lanterns Over River Kamo",
      creator: "Midori & Soren",
      year: 2021,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:lanterns-over-river-kamo",
      camelotKey: "7B",
      bpm: 90,
      durationSec: 248,
      tags: ["ambient-folk", "koto", "spiritual-jazz", "pastoral", "warm-breeze"],
      tagline: "Plucked koto harmonics weaving around breathy flute and upright bass pedal tones.",
      vector: {
        tempo: 0.34,
        valence: 0.68,
        acousticness: 0.88,
        cinematicTension: 0.38,
        nostalgia: 0.80,
        lyricalDensity: 0.24,
        subculturalEdge: 0.50,
        warmth: 0.94
      }
    },
    {
      id: "trk-blade-vangelis-pulse",
      title: "Tyrell Skylight Rain",
      creator: "Nexus CS-80 Collective",
      year: 2020,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:tyrell-skylight-rain",
      camelotKey: "6A",
      bpm: 104,
      durationSec: 290,
      tags: ["cyberpunk-ambient", "cs-80", "widescreen-synth", "dystopian", "noir"],
      tagline: "Ribbon-controlled polyphonic brass swells and distant thunder chimes in a megacity atrium.",
      vector: {
        tempo: 0.54,
        valence: 0.26,
        acousticness: 0.18,
        cinematicTension: 0.96,
        nostalgia: 0.78,
        lyricalDensity: 0.14,
        subculturalEdge: 0.82,
        warmth: 0.76
      }
    },
    {
      id: "trk-cosmic-balearic-sunset",
      title: "Es Vedra Salt Air",
      creator: "Solstice Marimba",
      year: 2022,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:es-vedra-salt-air",
      camelotKey: "9B",
      bpm: 108,
      durationSec: 274,
      tags: ["balearic", "percussive", "horizon", "sunset-groove", "warm-house"],
      tagline: "Conga polyrhythms, twelve-string acoustic guitar, and sunlit Oberheim pads.",
      vector: {
        tempo: 0.62,
        valence: 0.84,
        acousticness: 0.72,
        cinematicTension: 0.34,
        nostalgia: 0.74,
        lyricalDensity: 0.28,
        subculturalEdge: 0.58,
        warmth: 0.92
      }
    },
    {
      id: "trk-velvet-shoegaze-wall",
      title: "Park Hyatt Window Gazer",
      creator: "Faded Transistor",
      year: 2016,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:park-hyatt-window-gazer",
      camelotKey: "11B",
      bpm: 106,
      durationSec: 242,
      tags: ["dream-pop", "shoegaze", "tokyo-skyline", "fuzz-melancholy", "jetlag"],
      tagline: "Tremolo-drenched Fender Jaguar chords floating forty floors above neon hotel traffic.",
      vector: {
        tempo: 0.58,
        valence: 0.48,
        acousticness: 0.46,
        cinematicTension: 0.64,
        nostalgia: 0.92,
        lyricalDensity: 0.62,
        subculturalEdge: 0.74,
        warmth: 0.84
      }
    },
    {
      id: "trk-post-rock-crescendo",
      title: "Signal Tower Over Monolith",
      creator: "Ghosts of Montreal",
      year: 2019,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:signal-tower-over-monolith",
      camelotKey: "7A",
      bpm: 116,
      durationSec: 356,
      tags: ["post-rock", "crescendo", "orchestral-build", "catharsis", "widescreen"],
      tagline: "Interlocking twin guitars and bowed glockenspiel building to a seismic brass climax.",
      vector: {
        tempo: 0.70,
        valence: 0.42,
        acousticness: 0.58,
        cinematicTension: 0.94,
        nostalgia: 0.72,
        lyricalDensity: 0.16,
        subculturalEdge: 0.76,
        warmth: 0.78
      }
    },
    {
      id: "trk-acid-jazz-espresso",
      title: "Dogenzaka Vinyl Booth",
      creator: "Tatsuya Groove Syndicate",
      year: 2023,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:dogenzaka-vinyl-booth",
      camelotKey: "10B",
      bpm: 114,
      durationSec: 252,
      tags: ["jazz-funk", "broken-beat", "turntablism", "listening-bar", "brass"],
      tagline: "Crisp rimshots, muted trumpet solos, and warm rotary-mixer basslines.",
      vector: {
        tempo: 0.70,
        valence: 0.72,
        acousticness: 0.68,
        cinematicTension: 0.50,
        nostalgia: 0.76,
        lyricalDensity: 0.30,
        subculturalEdge: 0.80,
        warmth: 0.88
      }
    },
    {
      id: "trk-euphoric-breakbeat-anthem",
      title: "Orbital Over Docklands",
      creator: "Bicep & The Northern Line",
      year: 2024,
      domain: "Music Tracks",
      qlooUrn: "urn:entity:music:orbital-over-docklands",
      camelotKey: "4B",
      bpm: 130,
      durationSec: 304,
      tags: ["breakbeat", "rave-euphoria", "chopped-choir", "festival-peak", "laser"],
      tagline: "Rolling breakbeats and luminescent vocal pads engineered for peak-hour catharsis.",
      vector: {
        tempo: 0.94,
        valence: 0.80,
        acousticness: 0.16,
        cinematicTension: 0.78,
        nostalgia: 0.68,
        lyricalDensity: 0.20,
        subculturalEdge: 0.90,
        warmth: 0.72
      }
    },

    // =========================================================================
    // DOMAIN 2: FILMS & DIRECTORS (6 Cross-Domain Cultural Seeds)
    // =========================================================================
    {
      id: "flm-in-the-mood-for-love",
      title: "In the Mood for Love",
      creator: "Wong Kar-wai",
      year: 2000,
      domain: "Films & Directors",
      qlooUrn: "urn:entity:movie:in-the-mood-for-love",
      camelotKey: "7A",
      bpm: 84,
      durationSec: 5880,
      tags: ["hong-kong-1962", "unspoken-longing", "saturated-crimson", "waltz", "rain"],
      tagline: "Slow-motion corridors, emerald cheongsams, and the ache of restraint under streetlamps.",
      vector: {
        tempo: 0.28,
        valence: 0.32,
        acousticness: 0.88,
        cinematicTension: 0.82,
        nostalgia: 0.98,
        lyricalDensity: 0.48,
        subculturalEdge: 0.54,
        warmth: 0.92
      }
    },
    {
      id: "flm-blade-runner-2049",
      title: "Blade Runner 2049",
      creator: "Denis Villeneuve",
      year: 2017,
      domain: "Films & Directors",
      qlooUrn: "urn:entity:movie:blade-runner-2049",
      camelotKey: "6A",
      bpm: 108,
      durationSec: 9840,
      tags: ["neo-noir", "brutalist-scale", "cs-80-drone", "amber-fog", "existential"],
      tagline: "Monolithic architecture, sodium-vapor dust storms, and cavernous synthesizer brass.",
      vector: {
        tempo: 0.60,
        valence: 0.24,
        acousticness: 0.16,
        cinematicTension: 0.98,
        nostalgia: 0.74,
        lyricalDensity: 0.32,
        subculturalEdge: 0.86,
        warmth: 0.66
      }
    },
    {
      id: "flm-lost-in-translation",
      title: "Lost in Translation",
      creator: "Sofia Coppola",
      year: 2003,
      domain: "Films & Directors",
      qlooUrn: "urn:entity:movie:lost-in-translation",
      camelotKey: "11B",
      bpm: 102,
      durationSec: 6120,
      tags: ["tokyo-jetlag", "shoegaze", "karaoke-booth", "hotel-bar", "tender"],
      tagline: "Jetlagged intimacy across Tokyo hotel glass accompanied by dreamy fuzz guitars.",
      vector: {
        tempo: 0.48,
        valence: 0.52,
        acousticness: 0.56,
        cinematicTension: 0.54,
        nostalgia: 0.92,
        lyricalDensity: 0.64,
        subculturalEdge: 0.72,
        warmth: 0.86
      }
    },
    {
      id: "flm-heat-1995",
      title: "Heat",
      creator: "Michael Mann",
      year: 1995,
      domain: "Films & Directors",
      qlooUrn: "urn:entity:movie:heat-1995",
      camelotKey: "5A",
      bpm: 116,
      durationSec: 10200,
      tags: ["los-angeles-nocturne", "cobalt-blue", "precision", "highway-pulse", "tension"],
      tagline: "Steel-blue Pacific vistas and relentless nocturnal momentum across Los Angeles.",
      vector: {
        tempo: 0.74,
        valence: 0.34,
        acousticness: 0.28,
        cinematicTension: 0.94,
        nostalgia: 0.68,
        lyricalDensity: 0.52,
        subculturalEdge: 0.80,
        warmth: 0.64
      }
    },
    {
      id: "flm-spirited-away",
      title: "Spirited Away",
      creator: "Hayao Miyazaki",
      year: 2001,
      domain: "Films & Directors",
      qlooUrn: "urn:entity:movie:spirited-away",
      camelotKey: "7B",
      bpm: 90,
      durationSec: 7500,
      tags: ["joe-hisaishi-piano", "lantern-bathhouse", "sea-train", "folklore", "wonder"],
      tagline: "Lush sixth-chord piano voicings and twilight train tracks skimming across still water.",
      vector: {
        tempo: 0.38,
        valence: 0.72,
        acousticness: 0.90,
        cinematicTension: 0.48,
        nostalgia: 0.94,
        lyricalDensity: 0.44,
        subculturalEdge: 0.42,
        warmth: 0.96
      }
    },
    {
      id: "flm-paris-texas",
      title: "Paris, Texas",
      creator: "Wim Wenders",
      year: 1984,
      domain: "Films & Directors",
      qlooUrn: "urn:entity:movie:paris-texas",
      camelotKey: "9B",
      bpm: 84,
      durationSec: 8700,
      tags: ["ry-cooder-slide", "desert-highway", "emerald-neon", "solitude", "americana"],
      tagline: "Resonator slide guitar echoing through West Texas motels and green-lit peep-show booths.",
      vector: {
        tempo: 0.30,
        valence: 0.42,
        acousticness: 0.92,
        cinematicTension: 0.66,
        nostalgia: 0.92,
        lyricalDensity: 0.58,
        subculturalEdge: 0.50,
        warmth: 0.90
      }
    },

    // =========================================================================
    // DOMAIN 3: BOOKS & ESSAYS (6 Cross-Domain Literary Seeds)
    // =========================================================================
    {
      id: "bok-after-dark-murakami",
      title: "After Dark",
      creator: "Haruki Murakami",
      year: 2004,
      domain: "Books & Essays",
      qlooUrn: "urn:entity:book:after-dark-murakami",
      camelotKey: "8A",
      bpm: 92,
      durationSec: 0,
      tags: ["dennys-3am", "jazz-trombone", "tokyo-insomnia", "surreal-night", "solitude"],
      tagline: "Between midnight and dawn in Tokyo where a student and a jazz trombonist cross paths.",
      vector: {
        tempo: 0.42,
        valence: 0.44,
        acousticness: 0.76,
        cinematicTension: 0.68,
        nostalgia: 0.86,
        lyricalDensity: 0.84,
        subculturalEdge: 0.66,
        warmth: 0.86
      }
    },
    {
      id: "bok-ghosts-of-my-life",
      title: "Ghosts of My Life",
      creator: "Mark Fisher",
      year: 2014,
      domain: "Books & Essays",
      qlooUrn: "urn:entity:book:ghosts-of-my-life",
      camelotKey: "4A",
      bpm: 118,
      durationSec: 0,
      tags: ["hauntology", "lost-futures", "burial", "vinyl-crackle", "cultural-theory"],
      tagline: "Essays on depression, hauntology, UK bass culture, and the specter of lost futures.",
      vector: {
        tempo: 0.64,
        valence: 0.28,
        acousticness: 0.26,
        cinematicTension: 0.82,
        nostalgia: 0.96,
        lyricalDensity: 0.88,
        subculturalEdge: 0.96,
        warmth: 0.70
      }
    },
    {
      id: "bok-the-white-album-didion",
      title: "The White Album",
      creator: "Joan Didion",
      year: 1979,
      domain: "Books & Essays",
      qlooUrn: "urn:entity:book:the-white-album-didion",
      camelotKey: "8B",
      bpm: 94,
      durationSec: 0,
      tags: ["laurel-canyon", "california-noir", "literary-journalism", "sunlit-dread", "prose"],
      tagline: "Cool, crystalline reportage from late-sixties California studios and Santa Ana winds.",
      vector: {
        tempo: 0.44,
        valence: 0.48,
        acousticness: 0.82,
        cinematicTension: 0.64,
        nostalgia: 0.84,
        lyricalDensity: 0.98,
        subculturalEdge: 0.60,
        warmth: 0.80
      }
    },
    {
      id: "bok-invisible-cities-calvino",
      title: "Invisible Cities",
      creator: "Italo Calvino",
      year: 1972,
      domain: "Books & Essays",
      qlooUrn: "urn:entity:book:invisible-cities-calvino",
      camelotKey: "10A",
      bpm: 84,
      durationSec: 0,
      tags: ["poetic-architecture", "memory-palace", "chamber-fable", "luminous", "minimal"],
      tagline: "Fifty-five crystalline prose poems mapping imaginary cities of memory, desire, and signs.",
      vector: {
        tempo: 0.30,
        valence: 0.60,
        acousticness: 0.86,
        cinematicTension: 0.52,
        nostalgia: 0.88,
        lyricalDensity: 0.92,
        subculturalEdge: 0.54,
        warmth: 0.90
      }
    },
    {
      id: "bok-pattern-recognition-gibson",
      title: "Pattern Recognition",
      creator: "William Gibson",
      year: 2003,
      domain: "Books & Essays",
      qlooUrn: "urn:entity:book:pattern-recognition-gibson",
      camelotKey: "5A",
      bpm: 120,
      durationSec: 0,
      tags: ["coolhunting", "mystery-footage", "global-nocturne", "cyber-minimal", "subculture"],
      tagline: "Jet-lagged semiotic obsession chasing anonymous film fragments from London to Tokyo.",
      vector: {
        tempo: 0.72,
        valence: 0.38,
        acousticness: 0.22,
        cinematicTension: 0.88,
        nostalgia: 0.66,
        lyricalDensity: 0.82,
        subculturalEdge: 0.92,
        warmth: 0.62
      }
    },
    {
      id: "bok-just-kids-patti-smith",
      title: "Just Kids",
      creator: "Patti Smith",
      year: 2010,
      domain: "Books & Essays",
      qlooUrn: "urn:entity:book:just-kids-patti-smith",
      camelotKey: "8B",
      bpm: 96,
      durationSec: 0,
      tags: ["chelsea-hotel", "bohemian-nyc", "analog-polaroid", "poetry", "devotion"],
      tagline: "Black coffee, secondhand raincoats, and bohemian devotion in late-sixties New York.",
      vector: {
        tempo: 0.46,
        valence: 0.56,
        acousticness: 0.88,
        cinematicTension: 0.50,
        nostalgia: 0.92,
        lyricalDensity: 0.96,
        subculturalEdge: 0.68,
        warmth: 0.92
      }
    },

    // =========================================================================
    // DOMAIN 4: SONIC VENUES & AESTHETICS (6 Architectural/Atmospheric Seeds)
    // =========================================================================
    {
      id: "ven-kyoto-jazz-kissa",
      title: "Kyoto Jazz Kissa (Kissaten)",
      creator: "Altec Valencia Tube Horn Room",
      year: 1974,
      domain: "Sonic Venues & Aesthetics",
      qlooUrn: "urn:entity:place:kyoto-jazz-kissa",
      camelotKey: "8A",
      bpm: 88,
      durationSec: 0,
      tags: ["mcintosh-tubes", "garrard-301", "mahogany-paneling", "deep-listening", "coffee"],
      tagline: "Cedar-paneled Kyoto sanctuary where heavyweight Blue Note pressings play through horn speakers.",
      vector: {
        tempo: 0.34,
        valence: 0.46,
        acousticness: 0.90,
        cinematicTension: 0.54,
        nostalgia: 0.94,
        lyricalDensity: 0.26,
        subculturalEdge: 0.62,
        warmth: 0.98
      }
    },
    {
      id: "ven-berlin-kraftwerk-vault",
      title: "Berlin Kraftwerk Concrete Vault",
      creator: "Köpenicker Strasse Power Plant",
      year: 1991,
      domain: "Sonic Venues & Aesthetics",
      qlooUrn: "urn:entity:place:berlin-kraftwerk-vault",
      camelotKey: "5A",
      bpm: 126,
      durationSec: 0,
      tags: ["8-second-reverb", "strobe-fog", "sub-bass", "brutalist-club", "industrial"],
      tagline: "Cavernous former turbine hall with eight-second natural decay and chest-rattling sub-bass.",
      vector: {
        tempo: 0.88,
        valence: 0.42,
        acousticness: 0.12,
        cinematicTension: 0.90,
        nostalgia: 0.50,
        lyricalDensity: 0.10,
        subculturalEdge: 0.98,
        warmth: 0.66
      }
    },
    {
      id: "ven-joshua-tree-desert-studio",
      title: "Joshua Tree High-Desert Studio",
      creator: "Mojave Adobe Tracking Room",
      year: 1993,
      domain: "Sonic Venues & Aesthetics",
      qlooUrn: "urn:entity:place:joshua-tree-desert-studio",
      camelotKey: "9B",
      bpm: 96,
      durationSec: 0,
      tags: ["spring-reverb", "open-sky", "desert-twilight", "analog-console", "warm-sand"],
      tagline: "Open-door tracking studio facing Mojave boulders, tube spring reverb, and twilight coyotes.",
      vector: {
        tempo: 0.46,
        valence: 0.68,
        acousticness: 0.86,
        cinematicTension: 0.44,
        nostalgia: 0.84,
        lyricalDensity: 0.38,
        subculturalEdge: 0.52,
        warmth: 0.94
      }
    },
    {
      id: "ven-london-pirate-rooftop",
      title: "London Pirate Radio Rooftop",
      creator: "Bow Tower Block 89.4 FM",
      year: 2002,
      domain: "Sonic Venues & Aesthetics",
      qlooUrn: "urn:entity:place:london-pirate-rooftop",
      camelotKey: "4A",
      bpm: 122,
      durationSec: 0,
      tags: ["fm-transmitter", "dubplate-acetates", "east-london-rain", "bassweight", "subculture"],
      tagline: "Sodium-lit council tower roof broadcasting dubplates across rain-slick East London.",
      vector: {
        tempo: 0.80,
        valence: 0.44,
        acousticness: 0.18,
        cinematicTension: 0.78,
        nostalgia: 0.86,
        lyricalDensity: 0.40,
        subculturalEdge: 0.96,
        warmth: 0.72
      }
    },
    {
      id: "ven-reykjavik-greenhouse-loft",
      title: "Reykjavik Greenhouse Recording Loft",
      creator: "Mosfellsbaer Geothermal Studio",
      year: 2006,
      domain: "Sonic Venues & Aesthetics",
      qlooUrn: "urn:entity:place:reykjavik-greenhouse-loft",
      camelotKey: "10A",
      bpm: 80,
      durationSec: 0,
      tags: ["geothermal-warmth", "string-quartet", "tape-machines", "northern-lights", "felt-piano"],
      tagline: "Timber recording loft beside a mossy glacial stream heated by geothermal steam.",
      vector: {
        tempo: 0.24,
        valence: 0.50,
        acousticness: 0.94,
        cinematicTension: 0.58,
        nostalgia: 0.86,
        lyricalDensity: 0.20,
        subculturalEdge: 0.54,
        warmth: 0.96
      }
    },
    {
      id: "ven-shibuya-vinyl-bar",
      title: "Shibuya Vinyl Listening Bar",
      creator: "Bozak Rotary Mixer Lounge",
      year: 2018,
      domain: "Sonic Venues & Aesthetics",
      qlooUrn: "urn:entity:place:shibuya-vinyl-bar",
      camelotKey: "10B",
      bpm: 110,
      durationSec: 0,
      tags: ["rotary-mixer", "klipschorn", "whisky-highball", "rare-groove", "tokyo-night"],
      tagline: "Twelve-seat subterranean counter with a discrete Bozak rotary mixer and walls of 12-inch wax.",
      vector: {
        tempo: 0.62,
        valence: 0.66,
        acousticness: 0.70,
        cinematicTension: 0.52,
        nostalgia: 0.82,
        lyricalDensity: 0.36,
        subculturalEdge: 0.76,
        warmth: 0.92
      }
    }
  ];

  function clamp01(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0;
    }
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  }

  function roundTo(value, decimals) {
    const factor = Math.pow(10, typeof decimals === "number" ? decimals : 4);
    return Math.round(value * factor) / factor;
  }

  function getCatalog(customCatalog) {
    return Array.isArray(customCatalog) && customCatalog.length > 0
      ? customCatalog
      : CULTURAL_CATALOG;
  }

  function getEntityById(id, customCatalog) {
    const catalog = getCatalog(customCatalog);
    for (let i = 0; i < catalog.length; i += 1) {
      if (catalog[i].id === id) {
        return catalog[i];
      }
    }
    return null;
  }

  function getMusicTracks(customCatalog) {
    const catalog = getCatalog(customCatalog);
    return catalog.filter(function (item) {
      return item.domain === "Music Tracks";
    });
  }

  function getSeedsByDomain(customCatalog) {
    const catalog = getCatalog(customCatalog);
    const grouped = {
      "Films & Directors": [],
      "Books & Essays": [],
      "Sonic Venues & Aesthetics": [],
      "Music Tracks": []
    };
    for (let i = 0; i < catalog.length; i += 1) {
      const entity = catalog[i];
      if (!grouped[entity.domain]) {
        grouped[entity.domain] = [];
      }
      grouped[entity.domain].push(entity);
    }
    return grouped;
  }

  function computeTrackEnergy(entity) {
    if (!entity || !entity.vector) {
      return 0;
    }
    const v = entity.vector;
    const rawEnergy =
      0.38 * clamp01(v.tempo) +
      0.22 * clamp01(v.cinematicTension) +
      0.16 * clamp01(v.subculturalEdge) +
      0.14 * (1 - clamp01(v.acousticness)) +
      0.10 * clamp01(v.valence);
    return roundTo(clamp01(rawEnergy), 4);
  }

  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) {
      return 0;
    }
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < TASTE_DIMENSIONS.length; i += 1) {
      const key = TASTE_DIMENSIONS[i].key;
      const a = typeof vecA[key] === "number" ? vecA[key] : 0;
      const b = typeof vecB[key] === "number" ? vecB[key] : 0;
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }
    if (magA === 0 || magB === 0) {
      return 0;
    }
    return roundTo(clamp01(dot / (Math.sqrt(magA) * Math.sqrt(magB))), 4);
  }

  function computeSeedCentroid(seedIds, customCatalog) {
    const catalog = getCatalog(customCatalog);
    const validIds = Array.isArray(seedIds) ? seedIds.slice(0, 4) : [];
    const seeds = [];
    for (let i = 0; i < validIds.length; i += 1) {
      const entity = getEntityById(validIds[i], catalog);
      if (entity && !seeds.some(function (s) { return s.id === entity.id; })) {
        seeds.push(entity);
      }
    }

    if (seeds.length === 0) {
      throw new Error("At least 1 valid cultural seed is required to compute a taste centroid.");
    }

    const centroid = {};
    for (let d = 0; d < TASTE_DIMENSIONS.length; d += 1) {
      const dimKey = TASTE_DIMENSIONS[d].key;
      let sum = 0;
      for (let s = 0; s < seeds.length; s += 1) {
        sum += clamp01(seeds[s].vector[dimKey]);
      }
      centroid[dimKey] = roundTo(sum / seeds.length, 4);
    }

    const rankedDimensions = TASTE_DIMENSIONS.map(function (dim) {
      return {
        key: dim.key,
        label: dim.label,
        shortLabel: dim.shortLabel,
        value: centroid[dim.key]
      };
    }).sort(function (a, b) {
      return b.value - a.value;
    });

    const domainsRepresented = [];
    for (let i = 0; i < seeds.length; i += 1) {
      if (domainsRepresented.indexOf(seeds[i].domain) === -1) {
        domainsRepresented.push(seeds[i].domain);
      }
    }

    return {
      seeds: seeds,
      seedIds: seeds.map(function (s) { return s.id; }),
      centroid: centroid,
      dominantDimensions: rankedDimensions.slice(0, 3),
      rankedDimensions: rankedDimensions,
      domainsRepresented: domainsRepresented,
      crossDomainCount: seeds.filter(function (s) { return s.domain !== "Music Tracks"; }).length
    };
  }

  function parseCamelotKey(code) {
    if (typeof code !== "string") {
      return null;
    }
    const normalized = code.trim().toUpperCase();
    return CAMELOT_WHEEL[normalized] || null;
  }

  function computeCamelotDistance(keyA, keyB) {
    const parsedA = parseCamelotKey(keyA);
    const parsedB = parseCamelotKey(keyB);
    if (!parsedA || !parsedB) {
      return {
        wheelSteps: 6,
        sameMode: false,
        relationType: "Unmapped Key",
        compatibilityScore: 0.35
      };
    }

    const rawDiff = Math.abs(parsedA.number - parsedB.number);
    const wheelSteps = Math.min(rawDiff, 12 - rawDiff);
    const sameMode = parsedA.mode === parsedB.mode;

    if (wheelSteps === 0 && sameMode) {
      return {
        wheelSteps: 0,
        sameMode: true,
        relationType: "Exact Key Lock (0 step)",
        compatibilityScore: 1.0
      };
    }
    if (wheelSteps === 0 && !sameMode) {
      return {
        wheelSteps: 0,
        sameMode: false,
        relationType: "Relative Major/Minor Bridge (0A/B)",
        compatibilityScore: 0.94
      };
    }
    if (wheelSteps === 1 && sameMode) {
      return {
        wheelSteps: 1,
        sameMode: true,
        relationType: "Adjacent Fifth Step (+/-1)",
        compatibilityScore: 0.90
      };
    }
    if (wheelSteps === 1 && !sameMode) {
      return {
        wheelSteps: 1,
        sameMode: false,
        relationType: "Diagonal Modal Shift (+/-1 A/B)",
        compatibilityScore: 0.74
      };
    }
    if (wheelSteps === 2 && sameMode) {
      return {
        wheelSteps: 2,
        sameMode: true,
        relationType: "Whole-Tone Energy Boost (+/-2)",
        compatibilityScore: 0.66
      };
    }
    if (wheelSteps === 2 && !sameMode) {
      return {
        wheelSteps: 2,
        sameMode: false,
        relationType: "Two-Step Modal Modulation",
        compatibilityScore: 0.52
      };
    }
    if (wheelSteps === 3) {
      return {
        wheelSteps: 3,
        sameMode: sameMode,
        relationType: "Minor Third Dramatic Shift (+/-3)",
        compatibilityScore: sameMode ? 0.46 : 0.38
      };
    }

    const fallbackScore = roundTo(Math.max(0.20, 0.42 - (wheelSteps - 3) * 0.06), 4);
    return {
      wheelSteps: wheelSteps,
      sameMode: sameMode,
      relationType: "High-Contrast Key Jump (" + wheelSteps + " steps)",
      compatibilityScore: fallbackScore
    };
  }

  function computeTransitionScore(trackA, trackB) {
    if (!trackA || !trackB) {
      return {
        totalScore: 0,
        harmonicScore: 0,
        bpmScore: 0,
        vectorContinuity: 0,
        bpmDelta: 0,
        camelotInfo: computeCamelotDistance("", ""),
        transitionLabel: "Invalid Transition"
      };
    }

    const camelotInfo = computeCamelotDistance(trackA.camelotKey, trackB.camelotKey);
    const harmonicScore = camelotInfo.compatibilityScore;

    const bpmA = typeof trackA.bpm === "number" && trackA.bpm > 0 ? trackA.bpm : 100;
    const bpmB = typeof trackB.bpm === "number" && trackB.bpm > 0 ? trackB.bpm : 100;
    const bpmDelta = Math.abs(bpmA - bpmB);
    const bpmScore = roundTo(clamp01(Math.exp(-Math.pow(bpmDelta / 22, 2))), 4);

    const vectorContinuity = cosineSimilarity(trackA.vector, trackB.vector);

    const totalScore = roundTo(
      clamp01(0.58 * harmonicScore + 0.24 * bpmScore + 0.18 * vectorContinuity),
      4
    );

    let qualityTier = "Creative Contrast";
    if (totalScore >= 0.85) {
      qualityTier = "Seamless Harmonic Lock";
    } else if (totalScore >= 0.72) {
      qualityTier = "Smooth Console Blend";
    } else if (totalScore >= 0.58) {
      qualityTier = "Dynamic Tension Shift";
    }

    return {
      totalScore: totalScore,
      harmonicScore: harmonicScore,
      bpmScore: bpmScore,
      vectorContinuity: vectorContinuity,
      bpmDelta: bpmDelta,
      camelotInfo: camelotInfo,
      transitionLabel: qualityTier + " (" + trackA.camelotKey + " -> " + trackB.camelotKey + ", dBPM " + bpmDelta + ")"
    };
  }

  function interpolateEnergyCurve(controlPoints, numTracks) {
    const count = Math.max(6, Math.min(12, Math.round(numTracks || 8)));
    const points = Array.isArray(controlPoints) && controlPoints.length >= 2
      ? controlPoints.map(clamp01)
      : ENERGY_ARC_PRESETS.slow_burn.controlPoints.slice();

    const segments = points.length - 1;
    const result = [];
    for (let i = 0; i < count; i += 1) {
      const normalizedPos = count === 1 ? 0 : i / (count - 1);
      const exactIdx = normalizedPos * segments;
      const lowerIdx = Math.min(segments - 1, Math.floor(exactIdx));
      const upperIdx = Math.min(segments, lowerIdx + 1);
      const frac = exactIdx - lowerIdx;
      // Cosine-smoothed interpolation between control points
      const smoothFrac = (1 - Math.cos(frac * Math.PI)) / 2;
      const value = points[lowerIdx] * (1 - smoothFrac) + points[upperIdx] * smoothFrac;
      result.push(roundTo(clamp01(value), 4));
    }
    return result;
  }

  function explainCrossDomainBridge(track, seeds, centroid) {
    if (!track || !Array.isArray(seeds) || seeds.length === 0) {
      return {
        headline: "Direct sonic match",
        affinityScore: 0,
        sharedDimensions: [],
        seedBridges: []
      };
    }

    const effectiveCentroid = centroid || computeSeedCentroid(
      seeds.map(function (s) { return s.id; })
    ).centroid;

    const affinityScore = cosineSimilarity(track.vector, effectiveCentroid);

    const dimContributions = TASTE_DIMENSIONS.map(function (dim) {
      const trackVal = clamp01(track.vector[dim.key]);
      const seedVal = clamp01(effectiveCentroid[dim.key]);
      const closeness = 1 - Math.abs(trackVal - seedVal);
      const strength = roundTo(trackVal * seedVal * closeness, 4);
      return {
        key: dim.key,
        label: dim.label,
        shortLabel: dim.shortLabel,
        trackValue: trackVal,
        seedValue: seedVal,
        strength: strength
      };
    }).sort(function (a, b) {
      return b.strength - a.strength;
    });

    const topDims = dimContributions.slice(0, 3);

    const seedBridges = seeds.map(function (seed) {
      const seedSim = cosineSimilarity(track.vector, seed.vector);
      const bestShared = TASTE_DIMENSIONS.map(function (dim) {
        return {
          key: dim.key,
          shortLabel: dim.shortLabel,
          label: dim.label,
          score: roundTo(clamp01(track.vector[dim.key]) * clamp01(seed.vector[dim.key]), 4)
        };
      }).sort(function (a, b) {
        return b.score - a.score;
      }).slice(0, 2);

      const dimPhrase = bestShared.map(function (d) { return d.shortLabel.toLowerCase(); }).join(" and ");
      return {
        seedId: seed.id,
        seedTitle: seed.title,
        seedCreator: seed.creator,
        seedDomain: seed.domain,
        similarity: seedSim,
        sharedTraits: bestShared.map(function (d) { return d.shortLabel; }),
        explanation:
          "Bridges " + seed.domain.replace(/s$/, "") + " \"" + seed.title + "\" (" + seed.creator + ") via shared " +
          dimPhrase + " (" + Math.round(seedSim * 100) + "% resonance)."
      };
    }).sort(function (a, b) {
      return b.similarity - a.similarity;
    });

    const primaryBridge = seedBridges[0];
    const headline = primaryBridge
      ? primaryBridge.explanation
      : "Aligned with seed taste centroid across " + topDims[0].shortLabel + ".";

    return {
      headline: headline,
      affinityScore: affinityScore,
      sharedDimensions: topDims,
      seedBridges: seedBridges
    };
  }

  function sequenceSetlist(options) {
    const opts = options || {};
    const catalog = getCatalog(opts.catalog);
    const allTracks = getMusicTracks(catalog);
    const seedIds = Array.isArray(opts.seedIds) && opts.seedIds.length > 0
      ? opts.seedIds
      : ["flm-in-the-mood-for-love", "bok-after-dark-murakami", "ven-kyoto-jazz-kissa"];

    const seedProfile = computeSeedCentroid(seedIds, catalog);
    const targetLength = Math.max(6, Math.min(12, Math.round(opts.targetLength || 8)));

    const preset = ENERGY_ARC_PRESETS[opts.arcPresetId] || ENERGY_ARC_PRESETS.slow_burn;
    const controlPoints = opts.arcPresetId === "custom" && Array.isArray(opts.customControlPoints)
      ? opts.customControlPoints
      : (Array.isArray(opts.customControlPoints) && !opts.arcPresetId
          ? opts.customControlPoints
          : preset.controlPoints);

    const targetEnergies = interpolateEnergyCurve(controlPoints, targetLength);

    const weights = Object.assign(
      { affinity: 0.40, energyFit: 0.34, harmonic: 0.26 },
      opts.weights || {}
    );

    const excludedSet = new Set(Array.isArray(opts.excludedTrackIds) ? opts.excludedTrackIds : []);
    const pinnedTracks = opts.pinnedTracks || {};
    const pinnedIdSet = new Set();
    Object.keys(pinnedTracks).forEach(function (slotKey) {
      const slotIdx = Number(slotKey);
      const trackId = pinnedTracks[slotKey];
      if (slotIdx >= 0 && slotIdx < targetLength && typeof trackId === "string") {
        pinnedIdSet.add(trackId);
      }
    });

    const candidateTracks = allTracks.filter(function (trk) {
      return !excludedSet.has(trk.id) || pinnedIdSet.has(trk.id);
    });

    if (candidateTracks.length < targetLength) {
      throw new Error("Not enough candidate music tracks to build a setlist of length " + targetLength + ".");
    }

    // Precompute track energy and seed affinity for each track
    const trackMetaById = {};
    for (let i = 0; i < candidateTracks.length; i += 1) {
      const trk = candidateTracks[i];
      trackMetaById[trk.id] = {
        track: trk,
        energy: computeTrackEnergy(trk),
        affinity: cosineSimilarity(trk.vector, seedProfile.centroid)
      };
    }

    const beamWidth = 24;
    let beam = [
      {
        trackIds: [],
        usedSet: new Set(),
        scoreSum: 0
      }
    ];

    for (let slot = 0; slot < targetLength; slot += 1) {
      const targetE = targetEnergies[slot];
      const pinnedId = pinnedTracks[slot];
      const nextBeam = [];

      for (let b = 0; b < beam.length; b += 1) {
        const state = beam[b];
        const prevTrackId = slot > 0 ? state.trackIds[slot - 1] : null;
        const prevTrack = prevTrackId ? trackMetaById[prevTrackId].track : null;

        for (let c = 0; c < candidateTracks.length; c += 1) {
          const candidate = candidateTracks[c];
          if (pinnedId) {
            if (candidate.id !== pinnedId) {
              continue;
            }
          } else {
            if (state.usedSet.has(candidate.id) || pinnedIdSet.has(candidate.id)) {
              continue;
            }
          }

          const meta = trackMetaById[candidate.id];
          const sqErr = Math.pow(meta.energy - targetE, 2);
          const energyScore = 1 - Math.min(1, sqErr * 4);
          const transScore = prevTrack
            ? computeTransitionScore(prevTrack, candidate).totalScore
            : 0.88;

          const stepScore =
            weights.affinity * meta.affinity +
            weights.energyFit * energyScore +
            weights.harmonic * transScore;

          const nextUsed = new Set(state.usedSet);
          nextUsed.add(candidate.id);
          nextBeam.push({
            trackIds: state.trackIds.concat([candidate.id]),
            usedSet: nextUsed,
            scoreSum: state.scoreSum + stepScore
          });
        }
      }

      nextBeam.sort(function (a, b) {
        return b.scoreSum - a.scoreSum;
      });
      beam = nextBeam.slice(0, beamWidth);
    }

    const winner = beam[0];
    if (!winner || winner.trackIds.length !== targetLength) {
      throw new Error("Unable to sequence a valid setlist under the provided constraints.");
    }

    const sequencedTracks = [];
    const transitions = [];
    let affinitySum = 0;
    let sqErrSum = 0;
    let harmonicSum = 0;

    for (let i = 0; i < winner.trackIds.length; i += 1) {
      const id = winner.trackIds[i];
      const meta = trackMetaById[id];
      const targetE = targetEnergies[i];
      const energyDelta = roundTo(meta.energy - targetE, 4);
      const sqErr = Math.pow(energyDelta, 2);
      const energyFit = roundTo(clamp01(1 - sqErr * 4), 4);
      const bridge = explainCrossDomainBridge(meta.track, seedProfile.seeds, seedProfile.centroid);

      affinitySum += meta.affinity;
      sqErrSum += sqErr;

      let transitionFromPrev = null;
      if (i > 0) {
        const prevTrack = sequencedTracks[i - 1].track;
        transitionFromPrev = computeTransitionScore(prevTrack, meta.track);
        transitions.push(
          Object.assign(
            {
              fromIndex: i - 1,
              toIndex: i,
              fromTrackId: prevTrack.id,
              toTrackId: meta.track.id,
              fromTitle: prevTrack.title,
              toTitle: meta.track.title
            },
            transitionFromPrev
          )
        );
        harmonicSum += transitionFromPrev.totalScore;
      }

      sequencedTracks.push({
        slotIndex: i,
        position: i + 1,
        normalizedPosition: roundTo(targetLength === 1 ? 0 : i / (targetLength - 1), 4),
        isPinned: Boolean(pinnedTracks[i] === id),
        track: meta.track,
        actualEnergy: meta.energy,
        targetEnergy: targetE,
        energyDelta: energyDelta,
        energyFitScore: energyFit,
        seedAffinity: meta.affinity,
        bridge: bridge,
        transitionFromPrev: transitionFromPrev
      });
    }

    const meanAffinity = roundTo(affinitySum / targetLength, 4);
    const energyMse = roundTo(sqErrSum / targetLength, 4);
    const energyFitScore = roundTo(clamp01(1 - energyMse * 4), 4);
    const meanHarmonicSmoothness = transitions.length > 0
      ? roundTo(harmonicSum / transitions.length, 4)
      : 1;

    const overallSetlistScore = roundTo(
      clamp01(
        weights.affinity * meanAffinity +
        weights.energyFit * energyFitScore +
        weights.harmonic * meanHarmonicSmoothness
      ),
      4
    );

    const totalDurationSec = sequencedTracks.reduce(function (acc, item) {
      return acc + (item.track.durationSec || 240);
    }, 0);

    return {
      arcPresetId: preset.id,
      arcPresetName: preset.name,
      controlPoints: controlPoints.slice(),
      targetLength: targetLength,
      targetEnergies: targetEnergies,
      seedProfile: seedProfile,
      tracks: sequencedTracks,
      transitions: transitions,
      summary: {
        overallSetlistScore: overallSetlistScore,
        meanAffinity: meanAffinity,
        energyMse: energyMse,
        energyFitScore: energyFitScore,
        meanHarmonicSmoothness: meanHarmonicSmoothness,
        totalDurationSec: totalDurationSec,
        camelotPath: sequencedTracks.map(function (t) { return t.track.camelotKey; }).join(" -> ")
      }
    };
  }

  function swapSetlistTrack(currentResult, slotIndex, replacementTrackId, options) {
    if (!currentResult || !Array.isArray(currentResult.tracks)) {
      throw new Error("A valid current setlist result is required to swap a track.");
    }
    if (slotIndex < 0 || slotIndex >= currentResult.tracks.length) {
      throw new Error("slotIndex out of bounds for setlist.");
    }

    const catalog = getCatalog(options && options.catalog);
    const allTracks = getMusicTracks(catalog);
    const currentIds = new Set(currentResult.tracks.map(function (t) { return t.track.id; }));
    const outgoingTrackId = currentResult.tracks[slotIndex].track.id;

    let chosenId = replacementTrackId;
    if (!chosenId) {
      // Pick highest-scoring unused track for this slot
      const targetE = currentResult.targetEnergies[slotIndex];
      const prevTrack = slotIndex > 0 ? currentResult.tracks[slotIndex - 1].track : null;
      const nextTrack = slotIndex < currentResult.tracks.length - 1
        ? currentResult.tracks[slotIndex + 1].track
        : null;

      let bestCandidate = null;
      let bestScore = -Infinity;
      for (let i = 0; i < allTracks.length; i += 1) {
        const candidate = allTracks[i];
        if (currentIds.has(candidate.id) || candidate.id === outgoingTrackId) {
          continue;
        }
        const affinity = cosineSimilarity(candidate.vector, currentResult.seedProfile.centroid);
        const energy = computeTrackEnergy(candidate);
        const eScore = 1 - Math.min(1, Math.pow(energy - targetE, 2) * 4);
        const prevScore = prevTrack ? computeTransitionScore(prevTrack, candidate).totalScore : 0.85;
        const nextScore = nextTrack ? computeTransitionScore(candidate, nextTrack).totalScore : 0.85;
        const combined = 0.40 * affinity + 0.34 * eScore + 0.26 * ((prevScore + nextScore) / 2);
        if (combined > bestScore) {
          bestScore = combined;
          bestCandidate = candidate;
        }
      }
      if (!bestCandidate) {
        throw new Error("No alternative tracks available for swap.");
      }
      chosenId = bestCandidate.id;
    }

    const nextPinned = {};
    for (let i = 0; i < currentResult.tracks.length; i += 1) {
      nextPinned[i] = i === slotIndex ? chosenId : currentResult.tracks[i].track.id;
    }

    return sequenceSetlist(
      Object.assign({}, options || {}, {
        seedIds: currentResult.seedProfile.seedIds,
        targetLength: currentResult.targetLength,
        arcPresetId: currentResult.arcPresetId,
        customControlPoints: currentResult.controlPoints,
        pinnedTracks: nextPinned,
        catalog: catalog
      })
    );
  }

  function buildChordPreviewSpec(trackA, trackB) {
    if (!trackA || !trackB) {
      throw new Error("Both trackA and trackB are required to build a harmonic chord preview.");
    }
    const keyInfoA = parseCamelotKey(trackA.camelotKey) || CAMELOT_WHEEL["8A"];
    const keyInfoB = parseCamelotKey(trackB.camelotKey) || CAMELOT_WHEEL["8A"];
    const transition = computeTransitionScore(trackA, trackB);

    const warmthMean = ((trackA.vector.warmth || 0.7) + (trackB.vector.warmth || 0.7)) / 2;
    const tensionMean = ((trackA.vector.cinematicTension || 0.5) + (trackB.vector.cinematicTension || 0.5)) / 2;

    const filterCutoffHz = Math.round(900 + (1 - warmthMean * 0.4) * 1400 + tensionMean * 600);
    const waveform = trackA.vector.acousticness >= 0.65 ? "triangle" : "sawtooth";

    return {
      fromTrackId: trackA.id,
      toTrackId: trackB.id,
      fromTitle: trackA.title,
      toTitle: trackB.title,
      camelotA: keyInfoA.code,
      camelotB: keyInfoB.code,
      musicalKeyA: keyInfoA.musicalKey,
      musicalKeyB: keyInfoB.musicalKey,
      chordAHz: keyInfoA.chordHz.slice(),
      chordBHz: keyInfoB.chordHz.slice(),
      bpmA: trackA.bpm,
      bpmB: trackB.bpm,
      waveform: waveform,
      filterCutoffHz: filterCutoffHz,
      chordDurationSec: 1.15,
      crossfadeOverlapSec: 0.35,
      totalDurationSec: 1.95,
      transitionScore: transition.totalScore,
      camelotRelation: transition.camelotInfo.relationType
    };
  }

  function exportSetlistM3U8(setlistResult) {
    if (!setlistResult || !Array.isArray(setlistResult.tracks)) {
      throw new Error("Valid setlistResult is required for M3U8 export.");
    }
    const lines = [
      "#EXTM3U",
      "#PLAYLIST:SetlistForge - " + setlistResult.arcPresetName,
      "#EXT-X-QLOO-SEEDS:" + setlistResult.seedProfile.seeds.map(function (s) {
        return s.title + " (" + s.domain + ")";
      }).join("; "),
      "#EXT-X-SETLIST-SCORE:" + Math.round(setlistResult.summary.overallSetlistScore * 100) + "%"
    ];

    for (let i = 0; i < setlistResult.tracks.length; i += 1) {
      const item = setlistResult.tracks[i];
      const trk = item.track;
      const dur = trk.durationSec || 240;
      lines.push(
        "#EXTINF:" + dur + "," + trk.creator + " - " + trk.title +
        " [" + trk.camelotKey + " | " + trk.bpm + " BPM | Energy " + Math.round(item.actualEnergy * 100) + "%]"
      );
      lines.push("qloo://" + trk.qlooUrn.replace(/^urn:entity:/, "") + ".flac");
    }

    return lines.join("\n") + "\n";
  }

  function exportSetlistJSON(setlistResult) {
    if (!setlistResult || !Array.isArray(setlistResult.tracks)) {
      throw new Error("Valid setlistResult is required for JSON export.");
    }
    const payload = {
      generator: "SetlistForge Cross-Domain Sonic Arc Planner",
      version: "1.0.0",
      arcPresetId: setlistResult.arcPresetId,
      arcPresetName: setlistResult.arcPresetName,
      controlPoints: setlistResult.controlPoints,
      seeds: setlistResult.seedProfile.seeds.map(function (s) {
        return {
          id: s.id,
          title: s.title,
          creator: s.creator,
          domain: s.domain,
          qlooUrn: s.qlooUrn
        };
      }),
      centroid: setlistResult.seedProfile.centroid,
      summary: setlistResult.summary,
      tracks: setlistResult.tracks.map(function (item) {
        return {
          position: item.position,
          id: item.track.id,
          title: item.track.title,
          creator: item.track.creator,
          camelotKey: item.track.camelotKey,
          bpm: item.track.bpm,
          targetEnergy: item.targetEnergy,
          actualEnergy: item.actualEnergy,
          seedAffinity: item.seedAffinity,
          crossDomainBridge: item.bridge.headline
        };
      }),
      transitions: setlistResult.transitions
    };
    return JSON.stringify(payload, null, 2);
  }

  function exportSetlistMarkdown(setlistResult) {
    if (!setlistResult || !Array.isArray(setlistResult.tracks)) {
      throw new Error("Valid setlistResult is required for Markdown liner notes export.");
    }
    const lines = [
      "# SetlistForge Liner Notes: " + setlistResult.arcPresetName,
      "",
      "## Cultural Seed Conditioning",
      ""
    ];

    for (let i = 0; i < setlistResult.seedProfile.seeds.length; i += 1) {
      const s = setlistResult.seedProfile.seeds[i];
      lines.push("- **" + s.title + "** by " + s.creator + " (*" + s.domain + "*, `" + s.qlooUrn + "`)");
    }

    lines.push("");
    lines.push("## Setlist Performance Telemetry");
    lines.push("");
    lines.push("- **Overall Arc Score**: " + Math.round(setlistResult.summary.overallSetlistScore * 100) + "%");
    lines.push("- **Mean Seed Taste Affinity**: " + Math.round(setlistResult.summary.meanAffinity * 100) + "%");
    lines.push("- **Energy Curve Fit**: " + Math.round(setlistResult.summary.energyFitScore * 100) + "% (MSE " + setlistResult.summary.energyMse + ")");
    lines.push("- **Harmonic Transition Smoothness**: " + Math.round(setlistResult.summary.meanHarmonicSmoothness * 100) + "%");
    lines.push("- **Camelot Harmonic Path**: `" + setlistResult.summary.camelotPath + "`");
    lines.push("");
    lines.push("## Sequenced Tracklist & Cross-Domain Bridges");
    lines.push("");

    for (let i = 0; i < setlistResult.tracks.length; i += 1) {
      const item = setlistResult.tracks[i];
      const trk = item.track;
      lines.push(
        "### " + item.position + ". " + trk.title + " - " + trk.creator +
        " (`" + trk.camelotKey + "`, " + trk.bpm + " BPM)"
      );
      lines.push(
        "- **Energy**: " + Math.round(item.actualEnergy * 100) +
        "% (Target " + Math.round(item.targetEnergy * 100) + "%) | **Affinity**: " +
        Math.round(item.seedAffinity * 100) + "%"
      );
      lines.push("- **Why It Fits**: " + item.bridge.headline);
      if (item.transitionFromPrev) {
        lines.push("- **Transition In**: " + item.transitionFromPrev.transitionLabel);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  function buildQlooInsightsRequest(seedIds, apiKey, endpointBase) {
    const catalog = getCatalog();
    const seeds = [];
    const ids = Array.isArray(seedIds) ? seedIds : [];
    for (let i = 0; i < ids.length; i += 1) {
      const entity = getEntityById(ids[i], catalog);
      if (entity) {
        seeds.push(entity);
      }
    }

    const baseUrl = (typeof endpointBase === "string" && endpointBase.trim())
      ? endpointBase.trim().replace(/\/+$/, "")
      : "https://hackathon.api.qloo.com";

    const urnList = seeds.map(function (s) { return s.qlooUrn; }).join(",");
    const query =
      "filter.type=urn:entity:music" +
      "&signal.interests.entities=" + encodeURIComponent(urnList) +
      "&take=12";

    const url = baseUrl + "/v2/insights?" + query;
    const maskedKey = typeof apiKey === "string" && apiKey.trim().length > 4
      ? apiKey.trim().slice(0, 4) + "..."
      : "YOUR_QLOO_API_KEY";

    return {
      url: url,
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Api-Key": typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : ""
      },
      curlPreview:
        "curl -s -H \"X-Api-Key: " + maskedKey + "\" \"" + url + "\"",
      seedUrns: seeds.map(function (s) { return s.qlooUrn; })
    };
  }

  return {
    TASTE_DIMENSIONS: TASTE_DIMENSIONS,
    CAMELOT_WHEEL: CAMELOT_WHEEL,
    ENERGY_ARC_PRESETS: ENERGY_ARC_PRESETS,
    CULTURAL_CATALOG: CULTURAL_CATALOG,
    clamp01: clamp01,
    roundTo: roundTo,
    getCatalog: getCatalog,
    getEntityById: getEntityById,
    getMusicTracks: getMusicTracks,
    getSeedsByDomain: getSeedsByDomain,
    computeTrackEnergy: computeTrackEnergy,
    cosineSimilarity: cosineSimilarity,
    computeSeedCentroid: computeSeedCentroid,
    parseCamelotKey: parseCamelotKey,
    computeCamelotDistance: computeCamelotDistance,
    computeTransitionScore: computeTransitionScore,
    interpolateEnergyCurve: interpolateEnergyCurve,
    explainCrossDomainBridge: explainCrossDomainBridge,
    sequenceSetlist: sequenceSetlist,
    swapSetlistTrack: swapSetlistTrack,
    buildChordPreviewSpec: buildChordPreviewSpec,
    exportSetlistM3U8: exportSetlistM3U8,
    exportSetlistJSON: exportSetlistJSON,
    exportSetlistMarkdown: exportSetlistMarkdown,
    buildQlooInsightsRequest: buildQlooInsightsRequest
  };
});
