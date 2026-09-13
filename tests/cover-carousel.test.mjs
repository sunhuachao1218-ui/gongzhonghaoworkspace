import test from "node:test";
import assert from "node:assert/strict";
import { adjacentCoverSample } from "../lib/cover-carousel.js";

const samples = [{ id: "first" }, { id: "second" }, { id: "third" }];

test("cover preview arrows wrap within their own sample category", () => {
  assert.equal(adjacentCoverSample(samples, "first", -1).id, "third");
  assert.equal(adjacentCoverSample(samples, "third", 1).id, "first");
  assert.equal(adjacentCoverSample(samples, "second", 1).id, "third");
});

test("cover preview safely ignores a stale sample category", () => {
  assert.equal(adjacentCoverSample(undefined, "first", 1), null);
});
