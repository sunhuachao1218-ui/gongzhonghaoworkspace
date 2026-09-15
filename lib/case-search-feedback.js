export function buildCaseSearchInput(round, feedback) {
  const text = String(feedback || "").trim();
  return round > 1 && text ? `第 ${round} 轮反馈：${text}` : "";
}
