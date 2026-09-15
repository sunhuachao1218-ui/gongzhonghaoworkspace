import test from "node:test";
import assert from "node:assert/strict";
import { buildCaseSearchInput } from "../lib/case-search-feedback.js";

test("keeps the first case-search run free of invented feedback", () => {
  assert.equal(buildCaseSearchInput(1, ""), "");
});

test("passes a later-round user feedback verbatim to Hermes", () => {
  assert.equal(buildCaseSearchInput(2, "不要职业转行案例，补充上海家长相关的真实来源"), "第 2 轮反馈：不要职业转行案例，补充上海家长相关的真实来源");
});
