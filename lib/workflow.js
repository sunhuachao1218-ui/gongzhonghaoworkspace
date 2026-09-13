export const STEPS = [
  ["topic", "选主题"], ["cases", "找案例"], ["angle", "选角度"],
  ["title", "定标题"], ["outline", "写大纲"], ["draft", "写正文"],
  ["layout", "排版"], ["cover", "封面"], ["wechat", "入微信草稿箱"],
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
