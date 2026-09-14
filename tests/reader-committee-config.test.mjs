import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createReaderCommitteeConfigStore, DEFAULT_READER_COMMITTEE_CONFIG } from "../lib/reader-committee-config.mjs";

test("creates a reusable committee configuration in the Obsidian workspace", async () => {
  const vaultRoot = await mkdtemp("/tmp/reader-committee-config-");
  const store = createReaderCommitteeConfigStore({ vaultRoot });

  const config = await store.load();

  assert.equal(config.personas.length, 6);
  assert.equal(config.personas.every((persona) => persona.enabled), true);
  assert.equal(config.readerStage, DEFAULT_READER_COMMITTEE_CONFIG.readerStage);
  assert.match(await readFile(store.filePath, "utf8"), /放不下责任的家长/);
});

test("persists only a valid committee configuration", async () => {
  const vaultRoot = await mkdtemp("/tmp/reader-committee-config-");
  const store = createReaderCommitteeConfigStore({ vaultRoot });
  const saved = await store.save({ ...DEFAULT_READER_COMMITTEE_CONFIG, readerStage: "决策临界", personas: DEFAULT_READER_COMMITTEE_CONFIG.personas.map((persona, index) => ({ ...persona, enabled: index === 0 })) });

  assert.equal(saved.readerStage, "决策临界");
  assert.equal(saved.personas.filter((persona) => persona.enabled).length, 1);
});
