import test from "node:test";
import assert from "node:assert/strict";
import { mergeSkillMap } from "../lib/skill-map.js";

test("overrides only one configured Skill without changing other step defaults", () => {
  const defaults = { cases: { name: "case-search", version: "v1" }, angle: { name: "待配置", version: "—" } };

  const result = mergeSkillMap(defaults, { angle: { name: "article-angle-selection", version: "v2" } });

  assert.deepEqual(result.cases, { name: "case-search", version: "v1" });
  assert.deepEqual(result.angle, { name: "article-angle-selection", version: "v2" });
});
