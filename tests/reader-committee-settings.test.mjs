import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createReaderCommitteeSettingsStore } from "../lib/reader-committee-settings.mjs";

test("saves an OpenRouter selection locally without returning the API key", async () => {
  const directory = await mkdtemp("/tmp/reader-settings-");
  const store = createReaderCommitteeSettingsStore({ envPath: `${directory}/.env` });

  const publicSettings = await store.save({ apiKey: "sk-or-v1-test-secret", model: "openai/gpt-5.4-mini" });

  assert.deepEqual(publicSettings, { configured: true, provider: "OpenRouter", model: "openai/gpt-5.4-mini" });
  assert.match(await readFile(`${directory}/.env`, "utf8"), /READER_COMMITTEE_API_KEY=sk-or-v1-test-secret/);
  assert.equal("apiKey" in publicSettings, false);
});

test("lists only usable OpenRouter chat models", async () => {
  const store = createReaderCommitteeSettingsStore({ envPath: "/tmp/unused-reader-settings" });
  const models = await store.listModels(async () => ({ ok: true, json: async () => ({ data: [{ id: "openai/gpt-5.4-mini", name: "GPT mini" }, { id: "not-a-chat-model" }] }) }));

  assert.deepEqual(models, [{ id: "openai/gpt-5.4-mini", name: "GPT mini" }, { id: "not-a-chat-model", name: "not-a-chat-model" }]);
});
