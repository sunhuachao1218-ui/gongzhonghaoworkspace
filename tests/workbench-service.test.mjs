import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkbenchService } from "../lib/workbench-service.mjs";

test("reports the local bridge and Hermes configuration without exposing secrets", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "workbench-service-"));
  const service = createWorkbenchService({ vaultRoot });

  const status = await service.status();

  assert.equal(status.vault.connected, true);
  assert.equal(status.hermes.configured, false);
  assert.equal("apiKey" in status.hermes, false);
});

test("saves lightweight project state through the bridge", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "workbench-service-"));
  const service = createWorkbenchService({ vaultRoot });

  const saved = await service.saveProject({ id: "article-1", title: "测试项目", body: "正文不能进入状态文件" });

  assert.equal(saved.id, "article-1");
  assert.equal("body" in saved, false);
});

test("dispatches a selected step by Skill name without embedding writing rules", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "workbench-service-"));
  let request;
  const service = createWorkbenchService({
    vaultRoot,
    hermesUrl: "http://127.0.0.1:8642",
    hermesApiKey: "local-test-key-that-is-long-enough",
    fetchImpl: async (_url, options) => {
      request = options;
      return { ok: true, json: async () => ({ id: "run_test" }) };
    },
  });

  const result = await service.runStep({
    project: { id: "article-1", title: "测试项目", obsidianPath: "04-内容创作/公众号/工作台项目/article-1" },
    step: { id: "draft", label: "写正文" },
    skill: { name: "article-draft-writing", version: "v1.1.1", model: "GLM-5.3-Flash" },
  });

  assert.equal(result.id, "run_test");
  assert.match(JSON.parse(request.body).input, /article-draft-writing v1\.1\.1/);
  assert.doesNotMatch(JSON.parse(request.body).input, /1000|1500|规则细节/);
});
