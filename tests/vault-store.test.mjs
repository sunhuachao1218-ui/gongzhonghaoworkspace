import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("rejects a project path that escapes the vault", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "vault-store-"));
  const store = createVaultStore({ vaultRoot });
  await assert.rejects(() => store.saveProject({ id: "article-1", title: "测试", obsidianPath: "../../outside" }), /within the vault/);
});

test("keeps an existing article project inside its declared Obsidian directory", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "vault-store-"));
  const store = createVaultStore({ vaultRoot });

  const saved = await store.saveProject({ id: "article-1", title: "测试", obsidianPath: "公众号/进行中/已有文章" });

  assert.equal(saved.obsidianPath, "公众号/进行中/已有文章");
  assert.equal(await readFile(join(vaultRoot, "公众号/进行中/已有文章/project.json"), "utf8").then(Boolean), true);
});

test("lists only markdown artifact paths in the current project directory", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "vault-store-"));
  const store = createVaultStore({ vaultRoot });
  const project = { id: "article-1", title: "测试", obsidianPath: "04-内容创作/公众号/工作台项目/article-1" };
  const directory = join(vaultRoot, project.obsidianPath);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "draft-v1.md"), "正文留在 Obsidian", "utf8");
  await writeFile(join(directory, "project.json"), "{}", "utf8");

  const files = await store.listMarkdownArtifacts(project);

  assert.deepEqual(files.map((file) => file.path), ["draft-v1.md"]);
  assert.equal(typeof files[0].modifiedAt, "number");
  assert.equal("content" in files[0], false);
});

test("reads a Hermes candidate manifest without copying it into project metadata", async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), "vault-store-"));
  const store = createVaultStore({ vaultRoot });
  const project = { id: "article-1", title: "测试", obsidianPath: "04-内容创作/公众号/工作台项目/article-1" };
  const directory = join(vaultRoot, project.obsidianPath, ".workbench");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "cases.json"), JSON.stringify({ candidates: [{ id: "case-1", title: "案例 A", summary: "一句话概述" }] }), "utf8");

  const result = await store.readCandidates(project, "cases");

  assert.equal(result.sourcePath, ".workbench/cases.json");
  assert.deepEqual(result.candidates, [{ id: "case-1", title: "案例 A", summary: "一句话概述" }]);
});
