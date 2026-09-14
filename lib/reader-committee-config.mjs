import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEFAULT_PERSONAS } from "./reader-committee.mjs";

const CONFIG_PATH = "04-内容创作/公众号/工作台项目/reader-committee-config.json";
const READER_STAGES = ["陌生浏览", "认可专业", "已有具体问题", "决策临界"];
const TRUST_STAGES = ["知道你", "认可专业性", "视为可信赖的人", "愿意让你参与决策", "愿意购买服务", "事后验证型信任"];

export const DEFAULT_READER_COMMITTEE_CONFIG = {
  readerStage: "陌生浏览",
  trustStage: "知道你",
  personas: DEFAULT_PERSONAS.map((persona) => ({ ...persona, enabled: true })),
};
export { READER_STAGES, TRUST_STAGES };

function normalize(config = {}) {
  const source = new Map((Array.isArray(config.personas) ? config.personas : []).map((persona) => [persona.id, persona]));
  return {
    readerStage: READER_STAGES.includes(config.readerStage) ? config.readerStage : DEFAULT_READER_COMMITTEE_CONFIG.readerStage,
    trustStage: TRUST_STAGES.includes(config.trustStage) ? config.trustStage : DEFAULT_READER_COMMITTEE_CONFIG.trustStage,
    personas: DEFAULT_PERSONAS.map((defaultPersona) => {
      const value = source.get(defaultPersona.id) || {};
      return { id: defaultPersona.id, name: String(value.name || defaultPersona.name).slice(0, 80), lens: String(value.lens || defaultPersona.lens).slice(0, 400), enabled: value.enabled !== false };
    }),
  };
}

export function createReaderCommitteeConfigStore({ vaultRoot }) {
  const filePath = join(vaultRoot, CONFIG_PATH);
  return {
    filePath,
    async load() {
      try { return normalize(JSON.parse(await readFile(filePath, "utf8"))); }
      catch (error) { if (error.code !== "ENOENT") throw error; const config = normalize(); await this.save(config); return config; }
    },
    async save(config) {
      const normalized = normalize(config);
      await mkdir(dirname(filePath), { recursive: true });
      const temporary = `${filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
      await rename(temporary, filePath);
      return normalized;
    },
  };
}
