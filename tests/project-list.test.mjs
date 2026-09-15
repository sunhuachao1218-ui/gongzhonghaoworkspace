import test from "node:test";
import assert from "node:assert/strict";
import { mergeProjects } from "../lib/project-list.js";

test("uses the Obsidian project state when a local card has the same id", () => {
  const result = mergeProjects(
    [{ id: "article-1", title: "旧标题", currentStep: "topic" }, { id: "sample", title: "样例" }],
    [{ id: "article-1", title: "Obsidian 标题", currentStep: "draft" }],
  );

  assert.deepEqual(result, [
    { id: "article-1", title: "Obsidian 标题", currentStep: "draft" },
    { id: "sample", title: "样例" },
  ]);
});

test("adds a newly discovered Obsidian project to the workbench list", () => {
  assert.deepEqual(mergeProjects([{ id: "sample", title: "样例" }], [{ id: "article-2", title: "新增文章" }]), [
    { id: "sample", title: "样例" },
    { id: "article-2", title: "新增文章" },
  ]);
});
