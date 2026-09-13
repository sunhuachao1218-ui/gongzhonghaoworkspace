import test from "node:test";
import assert from "node:assert/strict";
import { canOpenStep, confirmStep, requestRevision, createProject, selectCoverOption, selectStepValue, selectDefaultStyle } from "../lib/workflow.js";

const project = {
  currentStep: "topic",
  steps: {
    topic: { status: "awaiting_confirmation", confirmedVersion: null, versions: [] },
    cases: { status: "not_started", confirmedVersion: null, versions: [] },
    angle: { status: "not_started", confirmedVersion: null, versions: [] },
  },
};

test("confirming a step unlocks only the immediately following step", () => {
  const confirmed = confirmStep(project, "topic");
  assert.equal(confirmed.steps.topic.status, "confirmed");
  assert.equal(confirmed.steps.topic.confirmedVersion, "v1");
  assert.equal(confirmed.steps.cases.status, "in_progress");
  assert.equal(canOpenStep(confirmed, "angle"), false);
});

test("requesting a revision locks all later steps", () => {
  const progressed = confirmStep(project, "topic");
  const revised = requestRevision(progressed, "topic");
  assert.equal(revised.steps.topic.status, "needs_revision");
  assert.equal(revised.steps.cases.status, "not_started");
  assert.equal(canOpenStep(revised, "cases"), false);
});

test("selecting a case stores only the chosen lightweight project value", () => {
  const selected = selectStepValue(project, "cases", "转轨案例");
  assert.equal(selected.mainCase, "转轨案例");
  assert.equal(selected.steps.cases.selectedValue, "转轨案例");
});

test("a new project starts at topic with no copied article content", () => {
  const created = createProject("新文章主题");
  assert.equal(created.title, "新文章主题");
  assert.equal(created.currentStep, "topic");
  assert.equal(created.steps.topic.status, "in_progress");
  assert.deepEqual(created.steps.topic.versions, []);
});

test("layout and cover styles are stored as lightweight reusable preferences", () => {
  const created = createProject("新文章主题");
  const styled = selectDefaultStyle(created, "layout", "石墨极简");

  assert.equal(styled.layoutStyle, "石墨极简");
  assert.equal(styled.steps.layout.selectedValue, "石墨极简");
  assert.equal(styled.coverStyle, "未设置");
});

test("cover choices retain only the selected type, palette, and rendering", () => {
  const created = createProject("新文章主题");
  const typed = selectCoverOption(created, "type", "conceptual");
  const selected = selectCoverOption(typed, "palette", "warm");

  assert.deepEqual(selected.coverPreferences, { type: "conceptual", palette: "warm", rendering: null });
  assert.equal(selected.steps.cover.selectedValue, "conceptual · warm");
  assert.equal("content" in selected, false);
});
