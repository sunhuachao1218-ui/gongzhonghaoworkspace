"use client";

import { useEffect, useState } from "react";
import { INITIAL_PROJECTS, SKILL_MAP, CASES, ANGLES, TITLES, COVER_OPTIONS } from "../lib/data.js";
import { adjacentCoverSample } from "../lib/cover-carousel.js";
import { STEPS, addVersion, canOpenStep, confirmStep, createProject, ensureCoverTestProject, requestRevision, selectCoverOption, selectDefaultStyle, selectStepValue } from "../lib/workflow.js";

const statusText = { not_started: "未开始", in_progress: "进行中", awaiting_confirmation: "待确认", confirmed: "已确认", needs_revision: "待修改" };

export default function Home() {
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [hasLoadedLocalProjects, setHasLoadedLocalProjects] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [activeStep, setActiveStep] = useState(null);
  const [choice, setChoice] = useState("");
  const [caseRound, setCaseRound] = useState(1);
  const [integration, setIntegration] = useState({ vault: false, hermes: false, committee: false });
  const [committeeMaterials, setCommitteeMaterials] = useState("");
  const [committeeResult, setCommitteeResult] = useState(null);
  const [draftFiles, setDraftFiles] = useState([]);
  const [committeeConfig, setCommitteeConfig] = useState(null);
  const [showCommitteeSettings, setShowCommitteeSettings] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [modelSettings, setModelSettings] = useState({ model: "", configured: false });
  const [committeeKey, setCommitteeKey] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [runMessage, setRunMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [samplePreview, setSamplePreview] = useState(null);
  const project = projects.find((item) => item.id === projectId);
  const open = (id) => { const item = projects.find((p) => p.id === id); setProjectId(id); setActiveStep(item.currentStep); setChoice(""); };
  const syncProject = (nextProject) => {
    if (!nextProject.vaultManaged) return;
    void fetch("http://127.0.0.1:4174/api/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextProject) }).catch(() => undefined);
  };
  const mutate = (fn) => setProjects((items) => items.map((p) => {
    if (p.id !== projectId) return p;
    const nextProject = fn(p);
    syncProject(nextProject);
    return nextProject;
  }));
  const step = activeStep && project?.steps[activeStep];
  const previewSamples = samplePreview ? COVER_OPTIONS[samplePreview.dimension] || [] : [];
  const moveSamplePreview = (direction) => {
    if (!samplePreview) return;
    const adjacent = adjacentCoverSample(previewSamples, samplePreview.id, direction);
    if (adjacent) setSamplePreview({ ...adjacent, heading: samplePreview.heading, dimension: samplePreview.dimension });
  };
  useEffect(() => {
    const saved = localStorage.getItem("gongzhonghao-workbench-projects");
    setProjects(ensureCoverTestProject(saved ? JSON.parse(saved) : INITIAL_PROJECTS));
    setHasLoadedLocalProjects(true);
  }, []);
  useEffect(() => { void fetch("http://127.0.0.1:4174/api/reader-committee/config").then((response) => response.ok ? response.json() : Promise.reject()).then(setCommitteeConfig).catch(() => undefined); }, []);
  useEffect(() => { if (hasLoadedLocalProjects) localStorage.setItem("gongzhonghao-workbench-projects", JSON.stringify(projects)); }, [hasLoadedLocalProjects, projects]);
  useEffect(() => { setChoice(project?.steps[activeStep]?.selectedValue ?? ""); }, [activeStep, projectId]);
  useEffect(() => {
    void fetch("http://127.0.0.1:4174/api/status").then((response) => response.ok ? response.json() : Promise.reject()).then((status) => { setIntegration({ vault: Boolean(status.vault?.connected), hermes: Boolean(status.hermes?.configured), committee: Boolean(status.committee?.configured) }); setModelSettings(status.committee?.configured ? status.committee : { model: "", configured: false }); }).catch(() => setIntegration({ vault: false, hermes: false, committee: false }));
  }, []);
  const createNewProject = () => {
    const title = window.prompt("输入文章主题");
    if (!title?.trim()) return;
    const created = { ...createProject(title.trim()), vaultManaged: true };
    setProjects((items) => [created, ...items]);
    syncProject(created);
    setProjectId(created.id); setActiveStep("topic"); setChoice("");
  };
  const requestHermesRun = async () => {
    if (!project || !activeStep || !integration.hermes) return;
    setRunMessage("正在交给 Hermes…");
    try {
      const response = await fetch("http://127.0.0.1:4174/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, step: { id: activeStep, label: STEPS.find(([id]) => id === activeStep)?.[1] }, skill: SKILL_MAP[activeStep] }) });
      if (!response.ok) throw new Error((await response.json()).error || "请求失败");
      const started = await response.json();
      setIsRunning(true);
      setRunMessage("Hermes 正在处理，内容将直接写入 Obsidian…");
      const poll = async () => {
        const statusResponse = await fetch(`http://127.0.0.1:4174/api/runs/${started.run_id}`);
        const status = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(status.error || "状态查询失败");
        if (["completed", "succeeded"].includes(status.status)) {
          mutate((item) => addVersion(item, activeStep));
          setIsRunning(false);
          setRunMessage("Hermes 已完成。内容在 Obsidian 中；请核对后确认本版本。");
          return;
        }
        if (["failed", "cancelled"].includes(status.status)) throw new Error(status.error || "Hermes 未完成本次任务");
        window.setTimeout(() => void poll().catch((error) => { setIsRunning(false); setRunMessage(error instanceof Error ? error.message : "Hermes 状态查询失败"); }), 2000);
      };
      void poll().catch((error) => { setIsRunning(false); setRunMessage(error instanceof Error ? error.message : "Hermes 状态查询失败"); });
    } catch (error) {
      setRunMessage(error instanceof Error ? error.message : "Hermes 请求失败");
    }
  };
  const chooseDefaultStyle = () => {
    if (!activeStep || !["layout", "cover"].includes(activeStep)) return;
    const current = activeStep === "layout" ? project.layoutStyle : project.coverStyle;
    const value = window.prompt(`输入默认${activeStep === "layout" ? "排版" : "封面"}风格名称`, current === "未设置" ? "" : current);
    if (!value?.trim()) return;
    mutate((item) => selectDefaultStyle(item, activeStep, value.trim()));
  };
  const runCommittee = async (stage = "topic", materials = committeeMaterials, confirmedSourcePath) => {
    if (!project || !integration.committee) return;
    const actionName = { topic: "选题会", angle: "角度评审", title: "标题投票", draft: "正文阅读" }[stage] || "评审";
    setIsRunning(true); setRunMessage(`虚拟读者委员会正在进行${actionName}…`);
    try {
      const response = await fetch("http://127.0.0.1:4174/api/reader-committee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, stage, materials, confirmedSourcePath, readerContext: committeeConfig ? `${committeeConfig.readerStage} · ${committeeConfig.trustStage}` : "陌生浏览 · 知道你", personas: committeeConfig?.personas.filter((persona) => persona.enabled) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "委员会请求失败");
      setCommitteeResult({ ...result, stage }); setRunMessage(`${actionName}已完成，报告已写入 Obsidian：${result.reportPath}`);
    } catch (error) { setRunMessage(error instanceof Error ? error.message : "委员会请求失败"); }
    finally { setIsRunning(false); }
  };
  const loadDraftFiles = async () => { if (!project) return; setRunMessage("正在读取本项目 Obsidian 正文文件…"); try { const response = await fetch("http://127.0.0.1:4174/api/reader-committee/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project }) }); const files = await response.json(); if (!response.ok) throw new Error(files.error || "读取正文文件失败"); setDraftFiles(files); setRunMessage(files.length ? "请选择需要评审的已确认正文版本。" : "本项目目录中还没有 Markdown 正文文件。"); } catch (error) { setRunMessage(error instanceof Error ? error.message : "读取正文文件失败"); } };
  const saveCommitteeConfig = async () => { if (!committeeConfig) return; try { const response = await fetch("http://127.0.0.1:4174/api/reader-committee/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(committeeConfig) }); const config = await response.json(); if (!response.ok) throw new Error(config.error || "保存失败"); setCommitteeConfig(config); setShowCommitteeSettings(false); } catch (error) { setRunMessage(error instanceof Error ? error.message : "委员会设置保存失败"); } };
  const loadModels = async () => { setSettingsMessage("正在读取 OpenRouter 近半年上线模型…"); try { const response = await fetch("http://127.0.0.1:4174/api/reader-committee/models"); const models = await response.json(); if (!response.ok) throw new Error(models.error || "读取失败"); setAvailableModels(models); setSettingsMessage(`已读取 ${models.length} 个近半年模型；可搜索或直接粘贴模型 ID。`); } catch (error) { setSettingsMessage(error instanceof Error ? error.message : "模型列表读取失败"); } };
  const saveModelSettings = async () => { setSettingsMessage("正在安全保存到本机…"); try { const response = await fetch("http://127.0.0.1:4174/api/reader-committee/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: committeeKey, model: modelSettings.model }) }); const settings = await response.json(); if (!response.ok) throw new Error(settings.error || "保存失败"); setModelSettings(settings); setIntegration((value) => ({ ...value, committee: true })); setCommitteeKey(""); setSettingsMessage("已保存。密钥只存在这台 Mac，已可调用委员会。"); } catch (error) { setSettingsMessage(error instanceof Error ? error.message : "保存失败"); } };

  if (project) return <main className="min-h-screen bg-[#f5f2ec] p-4 text-[#20211e] sm:p-8">
    <header className="mb-7 flex items-center justify-between"><button onClick={() => setProjectId(null)} className="text-sm text-[#556b5d]">← 返回看板</button><span className="rounded-full bg-white px-3 py-1 text-xs">{integration.vault ? "Obsidian 已连接" : "本地 MVP"} · {integration.hermes ? "Hermes 已就绪" : "Hermes 待接入"}</span></header>
    <div className="mx-auto max-w-7xl"><p className="text-xs font-semibold tracking-[.18em] text-[#7b8579]">文章项目</p><h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">{project.title}</h1>
      <section className="my-7 grid gap-2 rounded-2xl border border-[#dfdad0] bg-white p-4 shadow-sm lg:grid-cols-9">{STEPS.map(([id, label], i) => <button key={id} disabled={!canOpenStep(project, id)} onClick={() => setActiveStep(id)} className={`flex min-w-0 min-h-32 items-center justify-center rounded-xl p-3 text-center ${activeStep === id ? "bg-[#1f4733] text-white" : "bg-[#f6f4ef]"} disabled:opacity-45`}><span className={`flex items-center justify-center gap-2 text-lg font-semibold ${id === "wechat" ? "flex-wrap leading-6" : "whitespace-nowrap"}`}><span className="text-sm font-medium opacity-70">{i + 1}.</span><span>{label}</span><span className="text-base leading-none opacity-75">{project.steps[id].status === "confirmed" ? "✓" : "○"}</span></span></button>)}</section>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><section className="rounded-2xl border border-[#dfdad0] bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-[#687269]">第 {STEPS.findIndex(([id]) => id === activeStep) + 1} 步</p><h2 className="text-2xl font-semibold">{STEPS.find(([id]) => id === activeStep)?.[1]}</h2></div><span className="rounded-full bg-[#e9efe9] px-3 py-1 text-sm text-[#315841]">{statusText[step.status]}</span></div>
        <div className="mt-6 rounded-xl bg-[#f7f6f2] p-4"><p className="text-xs text-[#758078]">本步骤规则来源（只读配置）</p><p className="mt-1 font-medium">{SKILL_MAP[activeStep].name} <span className="text-[#758078]">{SKILL_MAP[activeStep].version}</span></p>{SKILL_MAP[activeStep].model && <p className="mt-1 text-sm text-[#59635a]">默认模型：{SKILL_MAP[activeStep].model}</p>}</div>
        {activeStep === "topic" && <div className="mt-6 rounded-xl border border-[#c8d8ca] bg-[#f2f7f1] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">虚拟读者委员会 · 选题会</p><p className="mt-1 text-sm text-[#59635a]">6 类家长以“陌生读者 · 知道你”的固定截面独立提问；不会积累对你的好感。</p></div><span className="rounded-full bg-white px-3 py-1 text-xs text-[#315841]">{integration.committee ? "模型已就绪" : "等待本机模型配置"}</span></div><textarea value={committeeMaterials} onChange={(event) => setCommitteeMaterials(event.target.value)} placeholder="粘贴近期素材、家长问题或案例线索。留空则直接问：最近你们最想问我什么？" className="mt-4 min-h-28 w-full rounded-lg border border-[#d4ddd3] bg-white p-3 text-sm outline-none focus:border-[#527760]" /><button disabled={!integration.committee || isRunning} onClick={runCommittee} className="mt-3 rounded-lg bg-[#315841] px-4 py-2 text-sm text-white disabled:opacity-45">召开选题会</button>{committeeResult?.summary?.candidates?.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{committeeResult.summary.candidates.map((candidate, index) => <button key={`${candidate.title}-${index}`} onClick={() => setChoice(candidate.title)} className={`rounded-lg border bg-white p-3 text-left ${choice === candidate.title ? "border-[#315841]" : "border-[#d4ddd3]"}`}><p className="font-medium">{candidate.title}</p><p className="mt-1 text-sm text-[#59635a]">{candidate.why}</p><p className="mt-2 text-xs text-[#617263]">{candidate.type} · {candidate.readers?.join("、")}</p></button>)}</div> : null}</div>}
        {["cases", "angle", "title"].includes(activeStep) && <div className="mt-6"><p className="font-medium">{activeStep === "cases" ? `候选池 · 第 ${caseRound} 轮 · 勾选后收集一个主案例` : activeStep === "angle" ? "同一案例的候选角度 · 只选一个" : "候选标题 · 选一个锁定"}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(activeStep === "cases" ? CASES : activeStep === "angle" ? ANGLES : TITLES).map((item) => <label key={item} className={`cursor-pointer rounded-xl border p-4 ${choice === item ? "border-[#386448] bg-[#f0f6ef]" : "border-[#e2ded6]"}`}><input className="mr-2" type="radio" name="choice" checked={choice === item} onChange={() => setChoice(item)} /><span className="font-medium">{item}</span>{activeStep === "cases" && <span className="mt-3 block border-t border-[#dfe5df] pt-3 text-xs leading-5 text-[#5d6a60]">匹配点、可支持方向、原始来源、来源可信度与证据风险，将由 Hermes 检索后写入 Obsidian；工作台只展示引用路径和确认状态。</span>}</label>)}</div>{activeStep === "cases" && <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => { setChoice(""); setCaseRound((round) => round + 1); }} className="rounded-lg border border-[#b9c7bb] px-3 py-2 text-sm">重新搜索候选</button><button disabled={!choice} onClick={() => mutate((p) => selectStepValue(p, "cases", choice))} className="rounded-lg bg-[#e6f0e8] px-3 py-2 text-sm font-medium text-[#315841] disabled:opacity-40">收集已选案例</button></div>}</div>}
        {["angle", "title"].includes(activeStep) && <div className="mt-6 rounded-xl border border-[#c8d8ca] bg-[#f2f7f1] p-4"><p className="font-medium">虚拟读者委员会 · {activeStep === "angle" ? "角度评审" : "标题投票"}</p><p className="mt-1 text-sm text-[#59635a]">{activeStep === "angle" ? "查看不同家长会支持、抵触或遗漏什么。" : "每位读者只选一个标题，模拟点击时的真实取舍。"}</p><button disabled={!integration.committee || isRunning} onClick={() => runCommittee(activeStep, activeStep === "angle" ? `主题：${project.title}\n主案例：${project.mainCase}\n候选角度：${ANGLES.join("｜")}` : `主题：${project.title}\n已选角度：${project.angle}\n候选标题：${TITLES.join("｜")}`)} className="mt-3 rounded-lg bg-[#315841] px-4 py-2 text-sm text-white disabled:opacity-45">{activeStep === "angle" ? "请委员会评审角度" : "请委员会强制投票"}</button>{committeeResult?.stage === "angle" && committeeResult.summary?.recommendations?.length ? <div className="mt-4 space-y-2">{committeeResult.summary.recommendations.map((item, index) => <div key={`${item.angle}-${index}`} className="rounded-lg bg-white p-3 text-sm"><p className="font-medium">{item.angle}</p><p className="mt-1 text-[#59635a]">支持：{item.support?.join("；") || "—"}</p><p className="mt-1 text-[#8b5a45]">抵触：{item.resistance?.join("；") || "—"}</p></div>)}</div> : null}{committeeResult?.stage === "title" && committeeResult.summary?.votes?.length ? <div className="mt-4 space-y-2">{committeeResult.summary.votes.map((vote, index) => <div key={`${vote.reader}-${index}`} className="rounded-lg bg-white p-3 text-sm"><p><b>{vote.reader}</b> 选：{vote.title}</p><p className="mt-1 text-[#59635a]">{vote.why}</p></div>)}<p className="pt-1 text-sm font-medium text-[#315841]">委员会票选：{committeeResult.summary.winner}</p></div> : null}</div>}
        {["outline", "draft"].includes(activeStep) && <div className="mt-6 rounded-xl border border-dashed border-[#c8d1c9] p-4"><p className="font-medium">完整版本</p><p className="mt-1 text-sm text-[#687269]">界面只记录版本与 Obsidian 路径；内容由 Hermes 生成后写入 Obsidian。</p>{activeStep === "draft" && <><div className="mt-4 rounded-lg bg-[#fff7e5] p-3 text-sm"><b>事实审计区</b><br/>接口预留：审计状态、证据链接、待处理项。</div><div className="mt-4 rounded-lg border border-[#c8d8ca] bg-[#f2f7f1] p-4"><p className="font-medium">虚拟读者委员会 · 正文阅读</p><p className="mt-1 text-sm text-[#59635a]">从当前 Obsidian 项目目录选择已确认正文。工作台不会读取或保存正文内容。</p><div className="mt-3 flex flex-wrap gap-3"><button onClick={loadDraftFiles} className="rounded-lg border px-3 py-2 text-sm">刷新正文文件</button>{draftFiles.length ? <select value={project.confirmedDraftPath || ""} onChange={(event) => mutate((item) => selectStepValue(item, "draft", event.target.value))} className="min-w-52 rounded-lg border border-[#b9c7bb] bg-white px-3 py-2 text-sm"><option value="">选择已确认正文版本</option>{draftFiles.map((file) => <option key={file} value={file}>{file}</option>)}</select> : null}<button disabled={!integration.committee || !project.confirmedDraftPath || isRunning} onClick={() => runCommittee("draft", "", project.confirmedDraftPath)} className="rounded-lg bg-[#315841] px-3 py-2 text-sm text-white disabled:opacity-45">模拟完整阅读</button></div>{committeeResult?.stage === "draft" && committeeResult.summary?.readers?.length ? <div className="mt-4 space-y-2">{committeeResult.summary.readers.map((reader, index) => <div key={`${reader.reader}-${index}`} className="rounded-lg bg-white p-3 text-sm"><p><b>{reader.reader}</b> · {reader.finish ? "读完" : `退出：${reader.exitPoint || "未说明"}`}</p><p className="mt-1 text-[#59635a]">信任：{reader.trust || "—"}</p><p className="mt-1 text-[#8b5a45]">抵触：{reader.resistance || "—"}</p><p className="mt-1 text-[#315841]">下一步：{reader.nextAction || "—"}</p></div>)}</div> : null}</div></>}</div>}
        {activeStep === "layout" && <div className="mt-6 rounded-xl border border-dashed border-[#c8d1c9] p-4"><p className="font-medium">默认风格</p><p className="mt-1 text-sm text-[#687269]">首次选择后复用；第一阶段只保存偏好，不进行真实渲染或生成。</p><p className="mt-2 text-sm font-medium text-[#315841]">当前：{project.layoutStyle}</p><button onClick={chooseDefaultStyle} className="mt-3 rounded-lg border px-3 py-2 text-sm">选择默认风格</button></div>}
        {activeStep === "cover" && <div className="mt-6 rounded-xl border border-dashed border-[#c8d1c9] p-4"><p className="font-medium">封面样图</p><p className="mt-1 text-sm text-[#687269]">样图来自本机 Hermes 封面 Skill 的现有样板。点击任意样图可放大查看；此处只保存你的选择，实际生成仍由 Hermes Skill 执行。</p><div className="mt-5 space-y-6">{[["type", "类型"], ["palette", "色调"], ["rendering", "渲染"]].map(([dimension, heading]) => <div key={dimension}><div className="flex items-baseline justify-between gap-3"><h3 className="font-medium">{heading}</h3><span className="text-xs text-[#687269]">已选：{project.coverPreferences?.[dimension] ? COVER_OPTIONS[dimension].find((option) => option.id === project.coverPreferences[dimension])?.label : "未选择"}</span></div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{COVER_OPTIONS[dimension].map((option) => <button key={option.id} type="button" onClick={() => { mutate((item) => selectCoverOption(item, dimension, option.id)); setSamplePreview({ ...option, heading, dimension }); }} className={`overflow-hidden rounded-xl border text-left transition ${project.coverPreferences?.[dimension] === option.id ? "border-[#315841] ring-2 ring-[#dceadd]" : "border-[#e2ded6] hover:border-[#aab9ad]"}`}><div className="aspect-[16/10] bg-[#f4f1ea]">{option.image ? <img src={option.image} alt={`${heading}样图：${option.label}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-3 text-center text-sm text-[#687269]">暂无样图</div>}</div><div className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span className="font-medium">{option.label}</span><span className="text-[#315841]">{project.coverPreferences?.[dimension] === option.id ? "✓" : ""}</span></div></button>)}</div></div>)}</div></div>}
        {activeStep === "wechat" && <div className="mt-6 rounded-xl bg-[#eef6ef] p-4"><p className="font-medium">微信草稿箱接口占位</p><p className="mt-1 text-sm text-[#687269]">仅在接口成功返回后标记为“已完成”；不会自动发布。</p><button onClick={() => mutate((p) => confirmStep(p, "wechat"))} className="mt-3 rounded-lg bg-[#1f4733] px-3 py-2 text-sm text-white">模拟接口成功</button></div>}
        <div className="mt-7 flex flex-wrap gap-3"><button disabled={!integration.hermes || isRunning} onClick={requestHermesRun} className="rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45">{isRunning ? "Hermes 处理中…" : ["outline", "draft"].includes(activeStep) ? "调用 Hermes 重写" : "调用 Hermes 生成"}</button><button onClick={() => mutate((p) => confirmStep(["cases", "angle", "title"].includes(activeStep) && choice ? selectStepValue(p, activeStep, choice) : p, activeStep))} className="rounded-lg bg-[#1f4733] px-4 py-2 text-sm text-white">确认当前版本</button><button onClick={() => mutate((p) => requestRevision(p, activeStep))} className="rounded-lg px-4 py-2 text-sm text-[#8b3b31]">返回修改</button></div>{runMessage && <p className="mt-3 text-sm text-[#556b5d]">{runMessage}</p>}
      </section><aside className="space-y-4"><div className="rounded-2xl border border-[#dfdad0] bg-white p-5"><h3 className="font-semibold">文章总控</h3>{[["主题", project.title],["当前案例", project.mainCase],["已选角度", project.angle],["当前标题", project.lockedTitle],["当前步骤", STEPS.find(([id]) => id === project.currentStep)?.[1]],["Obsidian", project.obsidianPath]].map(([k,v]) => <div className="mt-4" key={k}><p className="text-xs text-[#758078]">{k}</p><p className="mt-1 text-sm">{v}</p></div>)}</div><div className="rounded-2xl border border-[#dfdad0] bg-white p-5"><h3 className="font-semibold">版本记录</h3>{step.versions.length ? step.versions.map((v) => <p key={v} className="mt-3 rounded-lg bg-[#f6f4ef] px-3 py-2 text-sm">{v}{step.confirmedVersion === v ? " · 已确认" : " · 待确认"}</p>) : <p className="mt-3 text-sm text-[#758078]">尚无版本</p>}</div></aside></div></div>{samplePreview && <div role="dialog" aria-modal="true" aria-label={`${samplePreview.heading}样图大图`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setSamplePreview(null)}><div className="group relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>{samplePreview.image ? <img src={samplePreview.image} alt={`${samplePreview.heading}样图：${samplePreview.label}`} className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl" /> : <div className="flex h-72 items-center justify-center rounded-2xl bg-[#f4f1ea] text-[#687269]">暂无样图</div>}<div className="absolute left-5 top-5 text-sm text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><p className="font-semibold">{samplePreview.heading} · {samplePreview.label}</p><p className="mt-0.5 text-white/80">{previewSamples.findIndex((option) => option.id === samplePreview.id) + 1} / {previewSamples.length}</p></div><button type="button" aria-label="关闭预览" onClick={() => setSamplePreview(null)} className="absolute right-3 top-3 p-3 text-4xl leading-none text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100 focus:opacity-100">×</button><button type="button" aria-label="上一张样图" onClick={() => moveSamplePreview(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 p-6 text-6xl leading-none text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100 focus:opacity-100">←</button><button type="button" aria-label="下一张样图" onClick={() => moveSamplePreview(1)} className="absolute right-1 top-1/2 -translate-y-1/2 p-6 text-6xl leading-none text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100 focus:opacity-100">→</button></div></div>}</main>;

  const groups = { "刚开始": projects.filter((p) => p.steps.wechat.status !== "confirmed" && ["topic", "cases", "angle"].includes(p.currentStep)), "进行中": projects.filter((p) => p.steps.wechat.status !== "confirmed" && !["topic", "cases", "angle", "wechat"].includes(p.currentStep)), "已完成": projects.filter((p) => p.steps.wechat.status === "confirmed") };
  return <><main className="min-h-screen bg-[#f5f2ec] px-4 py-8 text-[#20211e] sm:px-8"><div className="mx-auto max-w-7xl"><header className="flex items-end justify-between"><div><p className="text-xs font-semibold tracking-[.18em] text-[#6d796e]">本地工作台</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">公众号内容生产</h1><p className="mt-2 text-[#687269]">流程与状态在这里，业务规则只来自 Hermes Skills。</p><p className="mt-2 text-sm text-[#556b5d]">{integration.vault ? "Obsidian 已连接" : "Obsidian 本地服务未启动"} · {integration.hermes ? "Hermes 已就绪" : "Hermes 等待本机 API 配置"}</p></div><div className="flex gap-2"><button onClick={() => setShowCommitteeSettings(true)} className="rounded-lg border border-[#b9c7bb] bg-white px-4 py-2 text-sm text-[#315841]">委员会设置</button><button onClick={() => { setShowModelSettings(true); void loadModels(); }} className="rounded-lg border border-[#b9c7bb] bg-white px-4 py-2 text-sm text-[#315841]">模型设置</button><button onClick={createNewProject} className="rounded-lg bg-[#1f4733] px-4 py-2 text-sm text-white">+ 新建文章</button></div></header><div className="mt-8 grid gap-6 xl:grid-cols-3">{Object.entries(groups).map(([name, items]) => <section key={name}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{name}</h2><span className="text-sm text-[#758078]">{items.length}</span></div><div className="space-y-4">{items.length ? items.map((p) => <button key={p.id} onClick={() => open(p.id)} className="w-full rounded-2xl border border-[#dfdad0] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5"><p className="font-semibold">{p.title}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="rounded-lg bg-[#e6f0e8] px-2.5 py-1 text-sm font-semibold text-[#315841]">当前：{STEPS.find(([id]) => id === p.currentStep)?.[1]}</span><span className="text-sm font-medium text-[#59635a]">进度 {Object.values(p.steps).filter((s) => s.status === "confirmed").length} / 9</span></div><div className="mt-4 flex gap-1">{STEPS.map(([id]) => <span key={id} className={`h-2 flex-1 rounded-full ${p.steps[id].status === "confirmed" ? "bg-[#3f7450]" : id === p.currentStep ? "bg-[#d2a65e]" : "bg-[#e8e5de]"}`} />)}</div><p className="mt-4 text-sm font-medium text-[#315841]">继续 →</p></button>) : <div className="rounded-2xl border border-dashed border-[#d7d2ca] p-5 text-sm text-[#758078]">成功进入微信草稿箱的文章会出现在这里。</div>}</div></section>)}</div></div></main>{showModelSettings && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setShowModelSettings(false)}><section role="dialog" aria-modal="true" aria-label="委员会模型设置" onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">虚拟读者委员会模型</h2><p className="mt-1 text-sm text-[#687269]">仅支持 OpenRouter；仅显示近半年上线模型，密钥只保存至本机私有文件。</p></div><button onClick={() => setShowModelSettings(false)} className="p-1 text-2xl leading-none text-[#687269]">×</button></div><label className="mt-5 block text-sm font-medium">OpenRouter API Key<input value={committeeKey} onChange={(event) => setCommitteeKey(event.target.value)} type="password" autoComplete="off" placeholder={modelSettings.configured ? "已保存；粘贴新 Key 可更新" : "粘贴 sk-or-v1-…"} className="mt-2 w-full rounded-lg border border-[#d4ddd3] p-3 font-mono text-sm" /></label><label className="mt-4 block text-sm font-medium">搜索或粘贴模型 ID<input list="recent-openrouter-models" value={modelSettings.model} onChange={(event) => setModelSettings((value) => ({ ...value, model: event.target.value }))} placeholder="例如：anthropic/claude-sonnet-4.5" className="mt-2 w-full rounded-lg border border-[#d4ddd3] p-3 text-sm" /><datalist id="recent-openrouter-models">{availableModels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist><p className="mt-1 text-xs text-[#687269]">输入名称会即时筛选候选；也可直接完整粘贴模型 ID。</p></label><div className="mt-4 flex flex-wrap gap-3"><button onClick={loadModels} className="rounded-lg border px-3 py-2 text-sm">刷新近半年模型</button><button onClick={saveModelSettings} className="rounded-lg bg-[#1f4733] px-3 py-2 text-sm text-white">安全保存并启用</button></div>{settingsMessage && <p className="mt-4 text-sm text-[#556b5d]">{settingsMessage}</p>}</section></div>}{showCommitteeSettings && committeeConfig && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setShowCommitteeSettings(false)}><section role="dialog" aria-modal="true" aria-label="委员会设置" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">虚拟读者委员会</h2><p className="mt-1 text-sm text-[#687269]">每次评审从所选位置重新模拟，不会累积对你的好感。</p></div><button onClick={() => setShowCommitteeSettings(false)} className="p-1 text-2xl leading-none text-[#687269]">×</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">读者所处情境<select value={committeeConfig.readerStage} onChange={(event) => setCommitteeConfig((config) => ({ ...config, readerStage: event.target.value }))} className="mt-2 w-full rounded-lg border p-3">{["陌生浏览", "认可专业", "已有具体问题", "决策临界"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-medium">与你的关系<select value={committeeConfig.trustStage} onChange={(event) => setCommitteeConfig((config) => ({ ...config, trustStage: event.target.value }))} className="mt-2 w-full rounded-lg border p-3">{["知道你", "认可专业性", "视为可信赖的人", "愿意让你参与决策", "愿意购买服务", "事后验证型信任"].map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="mt-6 space-y-3">{committeeConfig.personas.map((persona, index) => <div key={persona.id} className="rounded-xl border border-[#dfdad0] p-4"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={persona.enabled} onChange={(event) => setCommitteeConfig((config) => ({ ...config, personas: config.personas.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item) }))} />参与评审</label><input value={persona.name} onChange={(event) => setCommitteeConfig((config) => ({ ...config, personas: config.personas.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} className="mt-3 w-full rounded-lg border p-2 font-medium" /><textarea value={persona.lens} onChange={(event) => setCommitteeConfig((config) => ({ ...config, personas: config.personas.map((item, itemIndex) => itemIndex === index ? { ...item, lens: event.target.value } : item) }))} className="mt-2 min-h-20 w-full rounded-lg border p-2 text-sm" /></div>)}</div><button onClick={saveCommitteeConfig} className="mt-5 rounded-lg bg-[#1f4733] px-4 py-2 text-sm text-white">保存委员会设置</button></section></div>}</>;
}
/* Legacy starter placeholder retained only as a comment.
      <header
        aria-hidden="true"
        className="grid h-[76px] grid-cols-[1fr_auto_1fr] items-center border-b border-stone-200 bg-white/95 px-6 sm:px-14"
      >
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-stone-100" />
          <span className="h-3.5 w-28 rounded-full bg-stone-100" />
        </div>
        <span className="hidden h-9 w-[min(30vw,420px)] rounded-xl bg-stone-100 sm:block" />
        <div className="flex items-center justify-end gap-3">
          <span className="hidden h-9 w-9 rounded-full bg-stone-100 sm:block" />
          <span className="h-9 w-24 rounded-xl bg-stone-100" />
        </div>
      </header>

      <div
        aria-hidden="true"
        className="grid h-[calc(100%-76px)] grid-cols-[180px_minmax(0,1fr)_260px] gap-10 px-6 pb-24 pt-10 opacity-55 max-lg:grid-cols-[150px_minmax(0,1fr)] max-sm:grid-cols-1 sm:px-14"
      >
        <aside className="hidden border-r border-stone-200 pr-7 sm:block">
          <div className="mb-6 h-2.5 w-16 rounded-full bg-stone-200" />
          <div className="space-y-4">
            {sidebarWidths.map((width) => (
              <div key={width} className="flex items-center gap-3">
                <span className="h-4 w-4 rounded bg-stone-200" />
                <span
                  className="h-2.5 rounded-full bg-stone-200"
                  style={{ width: `${width}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mb-6 mt-9 h-2.5 w-24 rounded-full bg-stone-200" />
          <div className="space-y-4">
            {sidebarWidths.slice(0, 3).map((width) => (
              <span
                key={width}
                className="block h-2.5 rounded-full bg-stone-200"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </aside>

        <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="space-y-3">
            <div className="h-2.5 w-28 rounded-full bg-stone-200" />
            <div className="h-7 w-4/5 rounded-lg bg-stone-200" />
            <div className="h-7 w-3/5 rounded-lg bg-stone-200" />
          </div>
          <div className="min-h-[240px] flex-1 rounded-2xl bg-stone-200" />
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-stone-200" />
            <span className="h-2.5 w-28 rounded-full bg-stone-200" />
          </div>
          <div className="space-y-2">
            {articleWidths.map((width) => (
              <span
                key={width}
                className="block h-2.5 rounded-full bg-stone-200"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </article>

        <aside className="space-y-5 max-lg:hidden">
          {[0, 1].map((card) => (
            <div
              key={card}
              className="space-y-4 rounded-2xl border border-stone-200 bg-white/70 p-6"
            >
              <span className="block h-10 w-10 rounded-full bg-stone-200" />
              <span className="block h-3 w-3/5 rounded-full bg-stone-200" />
              <span className="block h-2.5 w-full rounded-full bg-stone-200" />
              <span className="block h-2.5 w-4/5 rounded-full bg-stone-200" />
              <span className="block h-8 w-24 rounded-lg bg-stone-200" />
            </div>
          ))}
        </aside>
      </div>

      <output
        aria-live="polite"
        aria-atomic="true"
        className="absolute left-1/2 top-[clamp(96px,13vh,122px)] w-[min(620px,calc(100%-40px))] -translate-x-1/2 rounded-[18px] border border-stone-200 bg-white/95 px-5 py-5 shadow-[0_18px_50px_rgb(24_24_27/9%)] backdrop-blur-sm"
      >
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-stone-500">
          Building your site
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Your site is taking shape
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Your first version will appear here automatically when it’s ready.
        </p>
      </output>
    </main>
  );
}
*/
