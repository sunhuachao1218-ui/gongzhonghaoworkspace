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
