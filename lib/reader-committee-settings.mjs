import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

function clean(value) { return String(value || "").trim(); }
function publicSettings(entries) {
  const apiKey = clean(entries.READER_COMMITTEE_API_KEY);
  return { configured: Boolean(apiKey), provider: "OpenRouter", model: clean(entries.READER_COMMITTEE_MODEL) || "openai/gpt-5.4-mini" };
}

export function createReaderCommitteeSettingsStore({ envPath }) {
  async function entries() {
    try {
      const text = await readFile(envPath, "utf8");
      return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
        const match = line.match(/^\s*(READER_COMMITTEE_(?:API_URL|API_KEY|MODEL))=(.*)\s*$/);
        return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
      }));
    } catch { return {}; }
  }
  return {
    async status() { return publicSettings(await entries()); },
    async save({ apiKey, model }) {
      const key = clean(apiKey); const selectedModel = clean(model);
      if (!key) throw new Error("请粘贴 OpenRouter API Key");
      if (!selectedModel) throw new Error("请选择模型");
      await mkdir(dirname(envPath), { recursive: true });
      const text = `READER_COMMITTEE_API_URL=${OPENROUTER_API_URL}\nREADER_COMMITTEE_API_KEY=${key}\nREADER_COMMITTEE_MODEL=${selectedModel}\n`;
      await writeFile(`${envPath}.tmp`, text, { mode: 0o600 });
      await rename(`${envPath}.tmp`, envPath);
      return publicSettings({ READER_COMMITTEE_API_KEY: key, READER_COMMITTEE_MODEL: selectedModel });
    },
    async listModels(fetchImpl = globalThis.fetch) {
      const response = await fetchImpl(OPENROUTER_MODELS_URL);
      if (!response.ok) throw new Error(`OpenRouter 模型列表获取失败（${response.status}）`);
      const data = await response.json();
      return (Array.isArray(data.data) ? data.data : []).filter((item) => clean(item.id)).map((item) => ({ id: clean(item.id), name: clean(item.name) || clean(item.id) })).sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}
