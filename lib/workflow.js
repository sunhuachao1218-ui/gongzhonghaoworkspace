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
  const version = nextVersion(project.steps[stepId].versions);
  const updated = structuredClone(project);
  updated.steps[stepId] = {
    ...updated.steps[stepId], status: "confirmed", confirmedVersion: version,
    versions: [...updated.steps[stepId].versions, version],
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

export function addVersion(project, stepId) {
  const updated = structuredClone(project);
  const version = nextVersion(updated.steps[stepId].versions);
  updated.steps[stepId] = { ...updated.steps[stepId], status: "awaiting_confirmation", versions: [...updated.steps[stepId].versions, version] };
  return updated;
}

export function selectStepValue(project, stepId, value) {
  const updated = structuredClone(project);
  const field = { cases: "mainCase", angle: "angle", title: "lockedTitle" }[stepId];
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

export function createProject(title) {
  const id = `p-${Date.now()}`;
  return {
    id, title, currentStep: "topic", obsidianPath: `04-内容创作/公众号/工作台项目/${id}`, mainCase: "待选择",
    angle: "待选择", lockedTitle: "待锁定", layoutStyle: "未设置", coverStyle: "未设置",
    draftbox: "未接入",
    steps: Object.fromEntries(STEPS.map(([id]) => [id, {
      status: id === "topic" ? "in_progress" : "not_started",
      confirmedVersion: null, versions: [],
    }])),
  };
}
