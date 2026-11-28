# Security policy

## Reporting a vulnerability

Use the private GitHub Security Advisory form at [Report a vulnerability](https://github.com/draarivpatel-ui/setlist-forge/security/advisories/new). Do not open a public issue, pull request or discussion with exploit details.

Never include a live secret, token, cookie, private key, victim hostname or proprietary payload in a report. Use synthetic values and redacted transcripts.

## Supported versions

| Version | Status |
| --- | --- |
| latest `main` | Supported |

Security fixes are applied to the latest state of the default branch.

## Scope

This policy covers the static SetlistForge browser application, including the cross-domain taste centroid conditioning, beam-search sequencer, harmonic transition synth, audit lab, exports, share links and the opt-in live insights connector.

In scope:

- A cross-site scripting or HTML injection path through catalog data, seed or track names, share links, or connector responses rendered in the page.
- A connector defect that sends the user-supplied key anywhere other than the documented insights endpoint, or persists it beyond the session.
- An export escaping flaw that makes generated playlist, JSON, CSV or Markdown output execute a formula or script when opened.
- A share-link codec flaw that bypasses validation or restores attacker-controlled state outside documented bounds.
- A digest or verification bypass that lets tampered export output pass as genuine.

Out of scope:

- Browser vulnerabilities, operating system compromise or physical access to the machine.
- Damage caused by modified copies of the static application that do not come from this repository.
- The third-party insights service itself, including its availability, responses or data accuracy.

## Coordinated disclosure

- Acknowledgment: within 3 business days.
- Initial triage: within 14 calendar days.
- Fix or mitigation target: within 90 calendar days for confirmed reports.
- Coordinated public disclosure: up to 90 days by default, adjusted by mutual agreement when exploitation or user risk requires a different date.
