const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../engine.js");
const Lab = require("../harmonic-lab.js");

test("batch5 csv and digest boundary hardening", () => {
  const csv = Engine.csvCell;

const payloads = ["\u200b=cmd", "\u061c+cmd", " \u200b@cmd", "\ufeff=cmd"];
for (const payload of payloads) {
  const cell = csv(payload);
  assert.ok(cell.startsWith("'") || cell.startsWith("\"'"), payload + " stayed live");
}
assert.equal(csv(-12.5), "-12.5");
assert.equal(csv("plain"), "plain");

  const brief = { x: 1 };
  const digest = Lab.sha256Hex(Lab.canonicalStringify(brief));
  const text = JSON.stringify({ brief, integrity: { digest } });
  const evil = text.replace('"brief":{"x":1}', '"brief":{"x":1,"__proto__":{"polluted":true}}');
  assert.equal(Lab.verifyAuditedExport("json", evil).ok, false);
});
