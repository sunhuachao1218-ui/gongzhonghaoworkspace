import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

export const DEFAULT_PERSONAS = [
  { id: "responsible", name: "放不下责任的家长", lens: "重大选择必须参与，不接受轻飘飘的放手建议。" },
  { id: "hand-off", name: "想放手但总兜底", lens: "希望孩子负责，但需要可执行的逐步交接。" },
  { id: "conflict", name: "冲突循环家长", lens: "想沟通，害怕被指责或再次陷入争吵。" },
  { id: "shanghai", name: "有条件坚决留沪", lens: "能上上海公办优先留沪；上海民办和外地公办会认真比较证据。" },
  { id: "interest", name: "有底线兴趣优先", lens: "尊重知情后的兴趣，也要看现实出路。" },
  { id: "full-time", name: "高投入全职妈妈", lens: "高度投入孩子成长，既需要被理解，也需要具体信息。" },
];

const sharedInstructions = "你是公众号的虚拟读者委员会。分别以六位彼此独立的家长读者视角回应，不要把他们写成同一个人。不要改写文章，不给写作规则，只评估读者反应。输出严格 JSON，不要 Markdown。";
const stageInstructions = {
  topic: "选题会的 JSON 结构为 {\"candidates\":[{\"title\":\"\",\"why\":\"\",\"readers\":[\"\"],\"type\":\"传播型|信任型|转化型|争议型\"}],\"dissent\":[\"\"]}。",
  angle: "评估候选角度的 JSON 结构为 {\"recommendations\":[{\"angle\":\"\",\"support\":[\"\"],\"resistance\":[\"\"],\"coverage\":\"\",\"knowledgeGap\":\"\"}],\"dissent\":[\"\"]}。",
  title: "强制只选一个标题。JSON 结构为 {\"votes\":[{\"reader\":\"\",\"title\":\"\",\"why\":\"\",\"repelledBy\":\"\"}],\"winner\":\"\",\"clickSignals\":[\"\"]}。",
  draft: "模拟完整阅读过程。JSON 结构为 {\"readers\":[{\"reader\":\"\",\"finish\":true,\"exitPoint\":\"\",\"trust\":\"\",\"resistance\":\"\",\"nextAction\":\"\"}],\"knowledgeGaps\":[\"\"],\"dissent\":[\"\"]}。",
};

export function buildReaderCommitteeRequest({ stage = "topic", materials = "", readerContext = "陌生读者 · 知道你", personas = DEFAULT_PERSONAS }) {
  return {
    stage,
    personas,
    messages: [
      { role: "system", content: `${sharedInstructions}${stageInstructions[stage] || stageInstructions.topic}` },
      { role: "user", content: `当前环节：${stage === "topic" ? "选题会" : stage}\n读者位置：${readerContext}\n六位读者：${personas.map((persona) => `${persona.name}（${persona.lens}）`).join("；")}\n可用素材：\n${materials || "暂无素材，请围绕家长真实问题提出候选选题。"}` },
    ],
  };
}

function parseModelResponse(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型未返回委员会结果");
  const trimmed = String(content).replace(/^```json\s*|\s*```$/g, "");
  try { return JSON.parse(trimmed); } catch { throw new Error("委员会结果不是有效 JSON"); }
}

export function createReaderCommitteeService({ vaultRoot, apiUrl, apiKey, model = "GLM-5.3-Flash", fetchImpl = globalThis.fetch } = {}) {
  if (!vaultRoot) throw new Error("vaultRoot is required");
  const root = resolve(vaultRoot);
  const configured = Boolean(apiUrl && apiKey);

  function projectDirectory(project) {
    const directory = resolve(root, project.obsidianPath);
    if (relative(root, directory).startsWith("..")) throw new Error("Project path must remain within the vault");
    return directory;
  }

  async function confirmedDraft(project, sourcePath) {
    if (!sourcePath) throw new Error("请先选择已确认正文文件");
    const directory = projectDirectory(project);
    const target = resolve(directory, sourcePath);
    if (relative(directory, target).startsWith("..")) throw new Error("正文文件必须位于本项目 Obsidian 目录内");
    return { text: await readFile(target, "utf8"), sourcePath: relative(root, target) };
  }

  async function writeReport(project, stage, report) {
    const directory = join(projectDirectory(project), "reader-committee");
    await mkdir(directory, { recursive: true });
    const filename = `${stage}-v${Date.now()}.json`;
    const target = join(directory, filename);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await rename(temporary, target);
    return relative(root, target);
  }

  return {
    configured,
    async listMarkdownFiles(project) {
      const directory = projectDirectory(project);
      try { return (await readdir(directory)).filter((file) => /\.md$/i.test(file)).sort(); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    },
    async run({ project, stage = "topic", materials, readerContext, personas, confirmedSourcePath }) {
      if (!configured) throw new Error("虚拟读者委员会模型 API 尚未配置");
      if (!project?.id || !project?.obsidianPath) throw new Error("项目需要 id 与 Obsidian 路径");
      const source = stage === "draft" ? await confirmedDraft(project, confirmedSourcePath) : null;
      const request = buildReaderCommitteeRequest({ stage, materials: source?.text || materials, readerContext, personas });
      const response = await fetchImpl(apiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: request.messages, response_format: { type: "json_object" } }) });
      if (!response.ok) throw new Error(`委员会模型请求失败（${response.status}）`);
      const summary = parseModelResponse(await response.json());
      const report = { generatedAt: new Date().toISOString(), stage, readerContext: readerContext || "陌生读者 · 知道你", personas: (personas || DEFAULT_PERSONAS).map(({ id, name }) => ({ id, name })), input: source ? { confirmedSourcePath: source.sourcePath } : { materials }, summary };
      return { reportPath: await writeReport(project, stage, report), summary, ...(source ? { sourcePath: source.sourcePath } : {}) };
    },
  };
}
