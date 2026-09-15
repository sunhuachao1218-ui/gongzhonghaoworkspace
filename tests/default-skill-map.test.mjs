import test from "node:test";
import assert from "node:assert/strict";
import { SKILL_MAP } from "../lib/data.js";

test("uses the installed gzh-layout Skill for the layout step", () => {
  assert.deepEqual(SKILL_MAP.layout, { name: "gzh-layout", version: "未标注版本" });
});
