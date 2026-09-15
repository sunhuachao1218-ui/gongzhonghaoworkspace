export function candidatesForDisplay(results, stepId) {
  return Array.isArray(results[stepId]) ? results[stepId] : [];
}
