import test from "node:test";
import assert from "node:assert/strict";
import { canOpenStep, confirmStep, requestRevision, createCoverTestProject, createProject, ensureCoverTestProject, selectCoverOption, selectStepValue, selectDefaultStyle } from "../lib/workflow.js";

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

test("selecting a confirmed draft stores only its Obsidian file path", () => {
  const project = createProject("测试文章");
  const updated = selectStepValue(project, "draft", "draft-v2.md");

  assert.equal(updated.confirmedDraftPath, "draft-v2.md");
  assert.equal(updated.steps.draft.selectedValue, "draft-v2.md");
});

test("selecting a committee topic updates the project theme before confirmation", () => {
  const project = createProject("原始主题");
  const updated = selectStepValue(project, "topic", "上海民办还是外地公办");

  assert.equal(updated.title, "上海民办还是外地公办");
  assert.equal(updated.steps.topic.selectedValue, "上海民办还是外地公办");
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

test("cover test project opens directly at the cover step without article content", () => {
  const testProject = createCoverTestProject();

  assert.equal(testProject.currentStep, "cover");
  assert.equal(testProject.steps.layout.status, "confirmed");
  assert.equal(testProject.steps.cover.status, "in_progress");
  assert.equal(testProject.vaultManaged, false);
  assert.equal("content" in testProject, false);
});

test("test-project migration preserves existing projects and adds the cover tester once", () => {
  const initial = [{ id: "existing" }];
  const migrated = ensureCoverTestProject(initial);

  assert.equal(migrated[0].id, "cover-sample-test");
  assert.equal(migrated[1].id, "existing");
  assert.equal(ensureCoverTestProject(migrated), migrated);
});
