import test from "node:test";
import assert from "node:assert/strict";
import { restoreView } from "../lib/view-state.js";

const projects = [{
  id: "p1",
  currentStep: "cases",
  steps: { topic: {}, cases: {} },
}];

test("restores the saved project and its open step", () => {
  assert.deepEqual(restoreView(projects, { projectId: "p1", activeStep: "topic" }), {
    projectId: "p1",
    activeStep: "topic",
  });
});

test("returns to the project current step when the saved step no longer exists", () => {
  assert.deepEqual(restoreView(projects, { projectId: "p1", activeStep: "removed-step" }), {
    projectId: "p1",
    activeStep: "cases",
  });
});

test("returns home when the saved project no longer exists", () => {
  assert.deepEqual(restoreView(projects, { projectId: "removed-project", activeStep: "cases" }), {
    projectId: null,
    activeStep: null,
  });
});
