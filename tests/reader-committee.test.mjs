import test from "node:test";
import assert from "node:assert/strict";
import { buildReaderCommitteeRequest, createReaderCommitteeService } from "../lib/reader-committee.mjs";

test("builds a topic meeting request from the selected reader profiles", () => {
  const request = buildReaderCommitteeRequest({
    stage: "topic",
    materials: "家长常问：上海民办和外地公办怎么选？",
    readerContext: "陌生读者 · 知道你",
  });

  assert.equal(request.stage, "topic");
  assert.equal(request.personas.length, 6);
  assert.match(request.messages[1].content, /上海民办和外地公办/);
  assert.match(request.messages[0].content, /严格 JSON/);
});

test("uses a forced-choice title brief instead of the topic-meeting schema", () => {
  const request = buildReaderCommitteeRequest({
    stage: "title",
    materials: "候选标题：A｜B｜C",
  });

  assert.match(request.messages[0].content, /强制只选一个标题/);
  assert.match(request.messages[1].content, /候选标题：A｜B｜C/);
  assert.doesNotMatch(request.messages[0].content, /选题会的 JSON 结构/);
});

test("writes a committee report to Obsidian and never adds it to project metadata", async () => {
  const root = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp("/tmp/reader-committee-"));
  const service = createReaderCommitteeService({
    vaultRoot: root,
    apiUrl: "http://127.0.0.1:9999/v1/chat/completions",
    apiKey: "test-key",
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ candidates: [{ title: "上海民办还是外地公办", why: "真实决策冲突", readers: ["有条件留沪型家长"] }] }) } }] }) }),
  });

  const result = await service.run({ project: { id: "article-1", title: "测试", obsidianPath: "04-内容创作/公众号/工作台项目/article-1" }, stage: "topic", materials: "素材" });

  assert.match(result.reportPath, /reader-committee\/topic-v\d+\.json$/);
  assert.equal(result.summary.candidates[0].title, "上海民办还是外地公办");
});
