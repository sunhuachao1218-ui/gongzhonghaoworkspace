export function mergeSkillMap(defaults, overrides = {}) {
  return Object.fromEntries(Object.entries(defaults).map(([stepId, skill]) => {
    const override = overrides[stepId];
    if (!override || typeof override.name !== "string" || !override.name.trim()) return [stepId, { ...skill }];
    return [stepId, {
      ...skill,
      name: override.name.trim(),
      version: typeof override.version === "string" && override.version.trim() ? override.version.trim() : skill.version,
      ...(typeof override.model === "string" && override.model.trim() ? { model: override.model.trim() } : {}),
    }];
  }));
}
