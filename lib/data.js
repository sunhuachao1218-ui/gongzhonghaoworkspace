import { STEPS } from "./workflow.js";

export const SKILL_MAP = {
  topic: { name: "待配置", version: "—" }, cases: { name: "待配置", version: "—" },
  angle: { name: "待配置", version: "—" }, title: { name: "待配置", version: "—" },
  outline: { name: "article-outline-writing", version: "v1.2.0" },
  draft: { name: "article-draft-writing", version: "v1.1.1", model: "GLM-5.3-Flash" },
  layout: { name: "待配置", version: "—" }, cover: { name: "待配置", version: "—" },
  wechat: { name: "微信草稿箱接口", version: "占位" },
};

const stage = (confirmed = [], current = "topic") => Object.fromEntries(STEPS.map(([id]) => [id, {
  status: confirmed.includes(id) ? "confirmed" : id === current ? "awaiting_confirmation" : "not_started",
  confirmedVersion: confirmed.includes(id) ? "v1" : null,
  versions: confirmed.includes(id) || id === current ? ["v1"] : [],
}]));

export const INITIAL_PROJECTS = [
  { id: "p1", title: "985 值不值得接受自己不了解的专业？", currentStep: "cases", steps: stage(["topic"], "cases"), obsidianPath: "公众号/进行中/985专业选择", mainCase: "待选择", angle: "待选择", lockedTitle: "待锁定", layoutStyle: "未设置", coverStyle: "未设置", draftbox: "未接入" },
  { id: "p2", title: "进了川大之后，他花了十几年换掉最初那条路", currentStep: "draft", steps: stage(["topic", "cases", "angle", "title", "outline"], "draft"), obsidianPath: "公众号/进行中/川大十年", mainCase: "川大转轨案例", angle: "第一份选择并非终局", lockedTitle: "进了川大之后，他花了十几年换掉最初那条路", layoutStyle: "长文·清晰", coverStyle: "未设置", draftbox: "未接入" },
  { id: "p3", title: "新高考选科：先看什么，再做什么", currentStep: "wechat", steps: stage(["topic", "cases", "angle", "title", "outline", "draft", "layout", "cover"], "wechat"), obsidianPath: "公众号/进行中/新高考选科", mainCase: "选科回溯案例", angle: "选择前先识别代价", lockedTitle: "新高考选科：先看什么，再做什么", layoutStyle: "长文·清晰", coverStyle: "蓝灰信息卡", draftbox: "待接入" },
];

export const CASES = ["路径发生转向的高校毕业生", "专业与职业出现错配的工作者", "志愿选择后的回溯案例", "制度变化下的家长决策案例"];
export const ANGLES = ["选择不是一次定终身", "看见机会成本再决定", "名校与专业的真实取舍"];
export const TITLES = ["985 值不值得接受自己不了解的专业？", "选大学之前，先问清这一件事", "当学校和专业不能兼得时，家长该怎么看？"];
