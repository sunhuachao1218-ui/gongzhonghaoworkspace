export const STEPS = [
  ["topic", "选主题"], ["cases", "找案例"], ["angle", "选角度"],
  ["title", "定标题"], ["outline", "写大纲"], ["draft", "写正文"],
  ["layout", "排版"], ["cover", "封面"], ["wechat", "进入微信草稿箱"],
];

const nextStep = (stepId) => STEPS[STEPS.findIndex(([id]) => id === stepId) + 1]?.[0];
const nextVersion = (versions) => `v${versions.length + 1}`;

export function canOpenStep(project, stepId) {
  const index = STEPS.findIndex(([id]) => id === stepId);
  if (index === 0) return true;
  const previous = project.steps[STEPS[index - 1][0]];
  return previous?.status === "confirmed";
}

export function confirmStep(project, stepId) {
  const updated = structuredClone(project);
  const existingVersions = updated.steps[stepId].versions;
  const version = existingVersions.at(-1) || nextVersion(existingVersions);
  updated.steps[stepId] = {
    ...updated.steps[stepId], status: "confirmed", confirmedVersion: version,
    versions: existingVersions.length ? existingVersions : [...existingVersions, version],
  };
  const following = nextStep(stepId);
  if (following && updated.steps[following].status === "not_started") {
    updated.steps[following].status = "in_progress";
    updated.currentStep = following;
  }
  return updated;
}

export function requestRevision(project, stepId) {
  const updated = structuredClone(project);
  const index = STEPS.findIndex(([id]) => id === stepId);
  updated.steps[stepId] = { ...updated.steps[stepId], status: "needs_revision", confirmedVersion: null };
  STEPS.slice(index + 1).forEach(([id]) => {
    updated.steps[id] = { ...updated.steps[id], status: "not_started", confirmedVersion: null };
  });
  updated.currentStep = stepId;
  return updated;
}

export function addVersion(project, stepId, artifactPath) {
  const updated = structuredClone(project);
  const version = nextVersion(updated.steps[stepId].versions);
  const artifactPaths = { ...(updated.steps[stepId].artifactPaths || {}) };
  if (artifactPath) artifactPaths[version] = artifactPath;
  updated.steps[stepId] = {
    ...updated.steps[stepId],
    status: "awaiting_confirmation",
    versions: [...updated.steps[stepId].versions, version],
    artifactPaths,
  };
  return updated;
}

export function selectStepValue(project, stepId, value) {
  const updated = structuredClone(project);
  const field = { topic: "title", cases: "mainCase", angle: "angle", title: "lockedTitle", draft: "confirmedDraftPath" }[stepId];
  if (!field) return updated;
  updated[field] = value;
  updated.steps[stepId] = { ...updated.steps[stepId], selectedValue: value };
  return updated;
}

export function selectDefaultStyle(project, stepId, value) {
  const updated = structuredClone(project);
  const field = { layout: "layoutStyle", cover: "coverStyle" }[stepId];
  if (!field) return updated;
  updated[field] = value;
  updated.steps[stepId] = { ...updated.steps[stepId], selectedValue: value };
  return updated;
}

export function selectCoverOption(project, dimension, value) {
  const updated = structuredClone(project);
  if (!["type", "palette", "rendering"].includes(dimension)) return updated;
  updated.coverPreferences = { type: null, palette: null, rendering: null, ...(updated.coverPreferences || {}), [dimension]: value };
  const selected = Object.values(updated.coverPreferences).filter(Boolean);
  updated.steps.cover = { ...updated.steps.cover, selectedValue: selected.join(" · ") || "未设置" };
  return updated;
}

export function createProject(title) {
  const id = `p-${Date.now()}`;
  return {
    id, title, currentStep: "topic", obsidianPath: `04-内容创作/公众号/工作台项目/${id}`, mainCase: "待选择",
    angle: "待选择", lockedTitle: "待锁定", layoutStyle: "未设置", coverStyle: "未设置",
    coverPreferences: { type: null, palette: null, rendering: null },
    draftbox: "未接入",
    steps: Object.fromEntries(STEPS.map(([id]) => [id, {
      status: id === "topic" ? "in_progress" : "not_started",
      confirmedVersion: null, versions: [],
    }])),
  };
}

export function createCoverTestProject() {
  const completed = new Set(["topic", "cases", "angle", "title", "outline", "draft", "layout"]);
  return {
    id: "cover-sample-test", title: "封面样图测试（可直接点选）", currentStep: "cover", vaultManaged: false,
    obsidianPath: "不写入 Obsidian", mainCase: "测试案例", angle: "测试角度", lockedTitle: "封面样图测试",
    layoutStyle: "测试排版", coverStyle: "未设置", coverPreferences: { type: null, palette: null, rendering: null }, draftbox: "不接入",
    steps: Object.fromEntries(STEPS.map(([id]) => [id, {
      status: completed.has(id) ? "confirmed" : id === "cover" ? "in_progress" : "not_started",
      confirmedVersion: completed.has(id) ? "v1" : null,
      versions: completed.has(id) ? ["v1"] : [],
    }])),
  };
}

export function ensureCoverTestProject(projects) {
  return projects.some((project) => project.id === "cover-sample-test") ? projects : [createCoverTestProject(), ...projects];
}
