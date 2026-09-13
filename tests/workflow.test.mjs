import test from "node:test";
import assert from "node:assert/strict";
import { canOpenStep, confirmStep, requestRevision } from "../lib/workflow.js";

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
