import test from "node:test";
import assert from "node:assert/strict";
import { candidatesForDisplay } from "../lib/candidates.js";

test("shows no selectable candidates before Hermes writes a candidate manifest", () => {
  assert.deepEqual(candidatesForDisplay({}, "cases"), []);
});

test("shows only candidates supplied from the requested Hermes manifest", () => {
  const candidates = [{ id: "case-1", title: "真实案例" }];
  assert.equal(candidatesForDisplay({ cases: candidates, title: [{ id: "title-1" }] }, "cases"), candidates);
});
