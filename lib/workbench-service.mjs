import { createVaultStore } from "./vault-store.mjs";

const DEFAULT_HERMES_URL = "http://127.0.0.1:8642";

function normalizeUrl(url) {
  return String(url || DEFAULT_HERMES_URL).replace(/\/$/, "");
}

export function createWorkbenchService({
  vaultRoot,
  hermesUrl = process.env.HERMES_API_URL,
  hermesApiKey = process.env.HERMES_API_KEY,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!vaultRoot) throw new Error("vaultRoot is required");
  const vault = createVaultStore({ vaultRoot });
  const configured = Boolean(hermesUrl && hermesApiKey);

  return {
    async status() {
      return {
        vault: { connected: true, workspacePath: vault.workspacePath },
        hermes: { configured, endpoint: configured ? normalizeUrl(hermesUrl) : null },
      };
    },
    async saveProject(project) {
      return vault.saveProject(project);
    },
    async listProjects() {
      return vault.listProjects();
    },
    async listArtifacts(project) {
      return vault.listMarkdownArtifacts(project);
    },
    async readCandidates(project, stepId) {
      return vault.readCandidates(project, stepId);
    },
    async getRunStatus(runId) {
      if (!configured) throw new Error("Hermes API 尚未配置");
      if (!runId) throw new Error("runId is required");
      const response = await fetchImpl(`${normalizeUrl(hermesUrl)}/v1/runs/${encodeURIComponent(runId)}`, {
        headers: { Authorization: `Bearer ${hermesApiKey}` },
      });
      if (!response.ok) throw new Error(`Hermes 状态查询失败（${response.status}）`);
      const result = await response.json();
      return { runId: result.run_id || runId, status: result.status, ...(result.error ? { error: result.error } : {}) };
    },
    async runStep({ project, step, skill, input }) {
      if (!configured) throw new Error("Hermes API 尚未配置");
      if (!project?.id || !step?.id || !skill?.name) throw new Error("Project, step and skill are required");
      const candidateManifest = ["cases", "angle", "title"].includes(step.id)
        ? `完成后额外把供工作台展示的候选清单写入 ${project.obsidianPath}/.workbench/${step.id}.json，格式为 {"candidates":[{"id":"","title":"","summary":"","fit":"","source":"","credibility":"","evidenceRisk":"","context":""}]}。这是展示协议，不改变或替代 Skill 的业务规则；未适用字段可省略。`
        : "";
      const response = await fetchImpl(`${normalizeUrl(hermesUrl)}/v1/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hermesApiKey}`,
          "Idempotency-Key": `${project.id}-${step.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          model: skill.model || undefined,
          input: `使用 Hermes Skill ${skill.name}${skill.version ? ` ${skill.version}` : ""} 执行“${step.label}”。Skill 是本步骤业务规则的唯一来源。项目元数据：${JSON.stringify({ id: project.id, title: project.title, obsidianPath: project.obsidianPath })}。仅将内容和来源写入该 Obsidian 项目目录；工作台只接收版本、状态与文件路径。${candidateManifest}用户输入：${input || "无"}`,
        }),
      });
      if (!response.ok) throw new Error(`Hermes API 请求失败（${response.status}）`);
      return response.json();
    },
  };
}
