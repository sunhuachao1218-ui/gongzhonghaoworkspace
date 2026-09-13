import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVaultStore } from "../lib/vault-store.mjs";

test("saves only lightweight project metadata in a project.json file", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "vault-store-"));
  const store = createVaultStore({ vaultRoot });
  await store.saveProject({ id: "article-1", title: "测试主题", obsidianPath: "04-内容创作/公众号/工作台项目/article-1", body: "must not persist" });

  const saved = JSON.parse(await readFile(join(vaultRoot, "04-内容创作/公众号/工作台项目/article-1/project.json"), "utf8"));
  assert.equal(saved.id, "article-1");
  assert.equal("body" in saved, false);
});

test("rejects a project path that escapes the workspace", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "vault-store-"));
  const store = createVaultStore({ vaultRoot });
  await assert.rejects(() => store.saveProject({ id: "article-1", title: "测试", obsidianPath: "../../outside" }), /within the workspace/);
});
