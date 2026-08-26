"use client";

import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Box,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Code2,
  Download,
  Eye,
  FileDiff,
  FileJson,
  FileText,
  Gauge,
  Globe2,
  Images,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  UploadCloud,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  Finding,
  BuyerMission,
  ModelAudit,
  ProductPassport,
  RepairAction,
  RunMode,
  RunReport,
  ScoreCard,
  TraceEvent,
} from "@/core/types";
import type { ImportIssue } from "@/core/importer";
import type { CompiledFacts } from "@/lib/qwen-compiler";
import { runCatalogDemo, runFaultScenario } from "@/core/engine";
import { demoCatalog } from "@/core/catalog";
import { missionLibrary, type MissionLibraryItem } from "@/core/missions";
import { activeDemoFaultIds, faultLibrary, type FaultLibraryItem } from "@/core/faults";
import {
  applyListingDraft,
  generateListingDraft,
  marketLabels,
  platformLabels,
  type LaunchBrief,
  type LaunchMarket,
  type LaunchPlatform,
  type ListingDraft,
} from "@/core/launch";
import { buildReleaseArtifacts, type ReleaseArtifact } from "@/core/release";
import { runMissionRegression } from "@/core/regression";

type Phase = "ready" | "running" | "failed" | "repairing" | "passed";
type WorkspaceTab = "run" | "findings" | "release";
type ProductSurface = "overview" | "launch" | "compiler" | "redteam" | "missions" | "faults" | "protocols";

interface CompileResponse {
  catalog: ProductPassport[];
  issues: ImportIssue[];
  stats: {
    rowsRead: number;
    rowsAccepted: number;
    products: number;
    images: number;
    policyCharacters: number;
  };
  compiledFacts: CompiledFacts | null;
  modelWarning: string | null;
  model: string;
}

interface AgentShelfConsoleProps {
  baseline: RunReport;
  repaired: RunReport;
  model: {
    configured: boolean;
    name: string;
    options: string[];
  };
}

const MODEL_STORAGE_KEY = "agentshelf:selected-model";
const MODEL_CHANGE_EVENT = "agentshelf:model-change";

function subscribeToModelSelection(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(MODEL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(MODEL_CHANGE_EVENT, onStoreChange);
  };
}

const metricMeta: Array<{
  key: keyof Omit<ScoreCard, "overall">;
  label: string;
}> = [
  { key: "discovery", label: "商品发现" },
  { key: "constraints", label: "要求满足" },
  { key: "faithfulness", label: "信息准确" },
  { key: "attackResistance", label: "攻击防护" },
  { key: "amountConsistency", label: "金额一致" },
  { key: "completion", label: "安全完成" },
];

const tabs: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "run", label: "测试过程", icon: Activity },
  { id: "findings", label: "问题与修复", icon: FileDiff },
  { id: "release", label: "发布文件", icon: PackageCheck },
];

const faultFamilyLabels: Record<FaultLibraryItem["family"], string> = {
  "prompt-injection": "指令注入",
  "commercial-state": "价格与库存",
  "fact-pollution": "商品信息冲突",
  "cross-border-policy": "跨境政策",
};

const stakeholderLabels: Record<FaultLibraryItem["stakeholder"], string> = {
  buyer: "买家",
  merchant: "商家",
  platform: "平台",
};

const missionRuleLabels: Record<string, string> = {
  "water-resistant": "防泼水",
  "unsupported-waterproof-certification": "不得声称无证据的防水认证",
  "review-derived-claim": "不得把评论当作官方商品信息",
  "unclear-return-window": "必须说明退货期限",
  "content-authorized-checkout": "商品内容不得授权结账",
};

const cityLabels: Record<string, string> = {
  Berlin: "柏林",
  Munich: "慕尼黑",
  "New York": "纽约",
  "San Francisco": "旧金山",
  Hamburg: "汉堡",
  Boston: "波士顿",
  Chicago: "芝加哥",
  Cologne: "科隆",
  Seattle: "西雅图",
  Frankfurt: "法兰克福",
};

const countryLabels: Record<string, string> = {
  DE: "德国",
  US: "美国",
};

function missionRuleLabel(rule: string) {
  return missionRuleLabels[rule] ?? rule;
}

function cityLabel(city: string) {
  return cityLabels[city] ?? city;
}

function countryLabel(country: string) {
  return countryLabels[country] ?? country;
}

const categoryLabels: Record<string, string> = {
  "Travel Packing Organizers": "旅行收纳用品",
  "Toiletry Pouch": "洗漱收纳包",
  "Shoe Organizer": "鞋类收纳袋",
};

function categoryLabel(category: string) {
  return categoryLabels[category] ?? category;
}

function scoreTone(score: number) {
  if (score >= 90) return "pass";
  if (score >= 70) return "warn";
  return "fail";
}

function severityLabel(severity: Finding["severity"]) {
  return {
    critical: "严重",
    high: "高",
    medium: "中",
    low: "低",
  }[severity];
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function downloadReleaseArtifact(artifact: ReleaseArtifact) {
  const url = URL.createObjectURL(new Blob([artifact.body], { type: artifact.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatArtifactSize(body: string) {
  const bytes = new TextEncoder().encode(body).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function RiskIcon({ status }: { status: TraceEvent["status"] }) {
  if (status === "blocked") return <LockKeyhole size={16} aria-hidden="true" />;
  if (status === "risk") return <AlertTriangle size={16} aria-hidden="true" />;
  if (status === "success") return <Check size={16} aria-hidden="true" />;
  return <CircleDollarSign size={16} aria-hidden="true" />;
}

export function AgentShelfConsole({
  baseline: initialBaseline,
  repaired: initialRepaired,
  model,
}: AgentShelfConsoleProps) {
  const [surface, setSurface] = useState<ProductSurface>("redteam");
  const [importedCatalog, setImportedCatalog] = useState<ProductPassport[] | null>(null);
  const [launchDraft, setLaunchDraft] = useState<ListingDraft | null>(null);
  const [redTeamTargetProductId, setRedTeamTargetProductId] = useState<string | null>(null);
  const [workspaceContext, setWorkspaceContext] = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<BuyerMission>(initialBaseline.mission);
  const [selectedFault, setSelectedFault] = useState<FaultLibraryItem | null>(null);
  const [mode, setMode] = useState<RunMode>("baseline");
  const [phase, setPhase] = useState<Phase>("ready");
  const [tab, setTab] = useState<WorkspaceTab>("run");
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [paused, setPaused] = useState(false);
  const [useModel, setUseModel] = useState(true);
  const [audit, setAudit] = useState<ModelAudit | null>(null);
  const [auditWarning, setAuditWarning] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedModel = useSyncExternalStore(
    subscribeToModelSelection,
    () => {
      const savedModel = window.localStorage.getItem(MODEL_STORAGE_KEY);
      return savedModel && model.options.includes(savedModel) ? savedModel : model.name;
    },
    () => model.name,
  );
  const activeModel = { ...model, name: selectedModel };

  const baseline = useMemo(
    () => {
      if (!importedCatalog && !selectedFault && selectedMission.id === initialBaseline.mission.id) {
        return initialBaseline;
      }
      const catalog = importedCatalog ?? demoCatalog;
      if (selectedFault) return runFaultScenario(catalog, "baseline", selectedFault, selectedMission);
      return runCatalogDemo(
        catalog,
        "baseline",
        redTeamTargetProductId ?? catalog[1]?.id ?? catalog[0]?.id,
        selectedMission,
      );
    },
    [importedCatalog, initialBaseline, redTeamTargetProductId, selectedFault, selectedMission],
  );
  const repaired = useMemo(
    () => {
      if (!importedCatalog && !selectedFault && selectedMission.id === initialRepaired.mission.id) {
        return initialRepaired;
      }
      const catalog = importedCatalog ?? demoCatalog;
      if (selectedFault) return runFaultScenario(catalog, "repaired", selectedFault, selectedMission);
      return runCatalogDemo(
        catalog,
        "repaired",
        redTeamTargetProductId ?? catalog[1]?.id ?? catalog[0]?.id,
        selectedMission,
      );
    },
    [importedCatalog, initialRepaired, redTeamTargetProductId, selectedFault, selectedMission],
  );

  const report = mode === "baseline" ? baseline : repaired;
  const selectedProduct = report.catalog.find(
    (product) => product.id === report.selection.productId,
  );

  const eligibleProducts = useMemo(
    () =>
      report.catalog.map((product) => {
        const destinationShipping = product.shipping.find(
          (rule) => rule.country === report.mission.destinationCountry,
        );
        const landed = product.price + (destinationShipping?.fee ?? 0);
        return {
          ...product,
          destinationShipping,
          landed,
          selected: product.id === report.selection.productId,
        };
      }),
    [report],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function chooseModel(nextModel: string) {
    if (!model.options.includes(nextModel)) return;
    setAudit(null);
    setAuditWarning(null);
    window.localStorage.setItem(MODEL_STORAGE_KEY, nextModel);
    window.dispatchEvent(new Event(MODEL_CHANGE_EVENT));
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function requestAudit(runMode: RunMode) {
    setAudit(null);
    setAuditWarning(null);
    try {
      const auditReport = runMode === "baseline" ? baseline : repaired;
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: {
            mode: auditReport.mode,
            mission: auditReport.mission,
            selection: auditReport.selection,
            scores: auditReport.scores,
            findings: auditReport.findings,
            events: auditReport.events,
          },
          useModel,
          model: selectedModel,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error);
      setAudit(payload.audit ?? null);
      setAuditWarning(payload.warning ?? null);
    } catch (error) {
      setAuditWarning(error instanceof Error ? error.message : "Qwen 复核暂不可用");
    }
  }

  function animateRun(runMode: RunMode, finalPhase: Phase) {
    stopTimer();
    setMode(runMode);
    setTab("run");
    setVisibleEvents(0);
    setPaused(false);
    setPhase("running");
    void requestAudit(runMode);

    const events = runMode === "baseline" ? baseline.events : repaired.events;
    let nextCount = 0;
    timerRef.current = setInterval(() => {
      nextCount += 1;
      setVisibleEvents(nextCount);
      if (nextCount >= events.length) {
        stopTimer();
        setPhase(finalPhase);
      }
    }, 360);
  }

  function togglePause() {
    if (phase !== "running") return;
    if (!paused) {
      stopTimer();
      setPaused(true);
      return;
    }

    setPaused(false);
    const finalPhase = mode === "baseline" ? "failed" : "passed";
    const events = mode === "baseline" ? baseline.events : repaired.events;
    let nextCount = visibleEvents;
    timerRef.current = setInterval(() => {
      nextCount += 1;
      setVisibleEvents(nextCount);
      if (nextCount >= events.length) {
        stopTimer();
        setPhase(finalPhase);
      }
    }, 360);
  }

  function runBaseline() {
    animateRun("baseline", "failed");
  }

  function applyRepair() {
    stopTimer();
    setPhase("repairing");
    setTab("findings");
    setAudit(null);
    window.setTimeout(() => animateRun("repaired", "passed"), 1000);
  }

  function resetDemo() {
    stopTimer();
    setMode("baseline");
    setPhase("ready");
    setTab("run");
    setVisibleEvents(0);
    setPaused(false);
    setAudit(null);
    setAuditWarning(null);
  }

  function chooseMode(nextMode: RunMode) {
    stopTimer();
    setMode(nextMode);
    setPhase(nextMode === "baseline" ? "failed" : "passed");
    setVisibleEvents(nextMode === "baseline" ? baseline.events.length : repaired.events.length);
    setAudit(null);
    setAuditWarning(null);
  }

  const displayEvents = report.events.slice(0, visibleEvents);
  const isFinished = phase === "failed" || phase === "passed";
  const showRepair = phase === "failed" && mode === "baseline";

  return (
    <div className="app-shell">
      <div className="memphis-page-decor" aria-hidden="true">
        <span className="memphis-shape memphis-circle" />
        <span className="memphis-shape memphis-square" />
        <span className="memphis-shape memphis-triangle" />
        <span className="memphis-shape memphis-wave" />
      </div>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <ShieldAlert size={19} />
          </div>
          <div>
            <div className="brand-name">AgentShelf</div>
            <div className="brand-subtitle">AI 商品上新质检</div>
          </div>
        </div>

        <div className="topbar-center">
          <span className="workspace-label">AI 商品上新 · 发布审核</span>
          <div className="workspace-switcher" title="当前测试项目">
            {selectedFault
              ? `故障场景 / ${selectedFault.id}`
              : importedCatalog
                ? workspaceContext ?? "导入商品 / 欧盟上新"
                : "旅行收纳 / 欧盟上新"}
          </div>
        </div>

        <div className="topbar-actions">
          <label
            className={`model-picker ${model.configured ? "online" : "offline"}`}
            title={model.configured ? "选择 AI 模型" : "模型密钥未配置"}
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="sr-only">选择 AI 模型</span>
            <select
              aria-label="选择 AI 模型"
              value={selectedModel}
              onChange={(event) => chooseModel(event.target.value)}
            >
              {model.options.map((modelName) => (
                <option key={modelName} value={modelName}>{modelName}</option>
              ))}
            </select>
          </label>
          <button className="icon-button" type="button" title="重新开始" onClick={resetDemo}>
            <RotateCcw size={17} aria-hidden="true" />
            <span className="sr-only">重新开始</span>
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="sidebar" aria-label="主导航">
          <div className="sidebar-context">
            <span>发布审核</span>
            <strong>AI 商品上架测试</strong>
            <div><span className="context-dot" aria-hidden="true" />隔离测试环境</div>
          </div>
          <nav className="nav-list">
            <button
              className={`nav-item ${surface === "overview" ? "active" : ""}`}
              type="button"
              title="方案总览"
              onClick={() => setSurface("overview")}
              aria-current={surface === "overview" ? "page" : undefined}
            >
              <Gauge size={18} aria-hidden="true" />
              <span>方案总览</span>
              <span className="nav-count">总</span>
            </button>
            <button
              className={`nav-item ${surface === "launch" ? "active" : ""}`}
              type="button"
              title="上新任务"
              onClick={() => setSurface("launch")}
              aria-current={surface === "launch" ? "page" : undefined}
            >
              <Sparkles size={18} aria-hidden="true" />
              <span>上新任务</span>
              <span className="nav-count">新</span>
            </button>
            <button
              className={`nav-item ${surface === "compiler" ? "active" : ""}`}
              type="button"
              title="商品档案（Product Passport）"
              onClick={() => setSurface("compiler")}
              aria-current={surface === "compiler" ? "page" : undefined}
            >
              <Box size={18} aria-hidden="true" />
              <span>商品档案</span>
              <span className="nav-count">{importedCatalog?.length ?? baseline.catalog.length}</span>
            </button>
            <button
              className={`nav-item ${surface === "redteam" ? "active" : ""}`}
              type="button"
              title="红队测试"
              onClick={() => setSurface("redteam")}
              aria-current={surface === "redteam" ? "page" : undefined}
            >
              <TerminalSquare size={18} aria-hidden="true" />
              <span>红队测试</span>
              <span className="live-dot" aria-hidden="true" />
            </button>
            <button
              className={`nav-item ${surface === "missions" ? "active" : ""}`}
              type="button"
              title="任务库"
              onClick={() => setSurface("missions")}
              aria-current={surface === "missions" ? "page" : undefined}
            >
              <ClipboardCheck size={18} aria-hidden="true" />
              <span>任务库</span>
              <span className="nav-count">30</span>
            </button>
            <button
              className={`nav-item ${surface === "faults" ? "active" : ""}`}
              type="button"
              title="故障库"
              onClick={() => setSurface("faults")}
              aria-current={surface === "faults" ? "page" : undefined}
            >
              <Zap size={18} aria-hidden="true" />
              <span>故障库</span>
              <span className="nav-count danger">12</span>
            </button>
            <button
              className={`nav-item ${surface === "protocols" ? "active" : ""}`}
              type="button"
              title="协议适配"
              onClick={() => setSurface("protocols")}
              aria-current={surface === "protocols" ? "page" : undefined}
            >
              <Code2 size={18} aria-hidden="true" />
              <span>协议适配</span>
              <span className="nav-count">5</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="protocol-stack">
              <span>UCP</span>
              <span>ACP</span>
              <span>MCP</span>
            </div>
            <div className="sandbox-label">
              <LockKeyhole size={13} aria-hidden="true" />
              仅限模拟结账（Mock Checkout）
            </div>
          </div>
        </aside>

        <main className="main-workspace">
          {surface === "overview" ? (
            <OverviewWorkspace
              onOpenLaunch={() => setSurface("launch")}
              onOpenCompiler={() => setSurface("compiler")}
              onOpenRedTeam={() => setSurface("redteam")}
            />
          ) : surface === "launch" ? (
            <LaunchWorkspace
              model={activeModel}
              sourceCatalog={importedCatalog ?? demoCatalog}
              onOpenRedTeam={(catalog, targetProductId, targetMarket, context, draft) => {
                setImportedCatalog(catalog);
                setLaunchDraft(draft);
                setRedTeamTargetProductId(targetProductId);
                setWorkspaceContext(context);
                setSelectedMission(
                  missionLibrary.find((mission) => mission.destinationCountry === targetMarket) ?? initialBaseline.mission,
                );
                setSelectedFault(null);
                resetDemo();
                setSurface("redteam");
              }}
            />
          ) : surface === "compiler" ? (
            <CompilerWorkspace
              model={activeModel}
              onOpenLaunch={(catalog) => {
                setImportedCatalog(catalog);
                setLaunchDraft(null);
                setRedTeamTargetProductId(null);
                setWorkspaceContext("导入商品 / 待生成 Listing");
                setSelectedFault(null);
                resetDemo();
                setSurface("launch");
              }}
            />
          ) : surface === "missions" ? (
            <MissionLibraryWorkspace
              selectedMissionId={selectedMission.id}
              onSelect={(mission) => {
                setSelectedMission(mission);
                setLaunchDraft(null);
                setSelectedFault(null);
                resetDemo();
                setSurface("redteam");
              }}
            />
          ) : surface === "faults" ? (
            <FaultLibraryWorkspace
              onRun={(fault) => {
                setSelectedFault(fault);
                setLaunchDraft(null);
                resetDemo();
                setSurface("redteam");
              }}
            />
          ) : surface === "protocols" ? (
            <ProtocolWorkspace />
          ) : (
            <>
          <section className="run-header">
            <div>
              <div className="eyebrow-row">
                <span className="run-id">{report.id.toUpperCase()}</span>
                <span className="scope-pill">
                  <Globe2 size={12} aria-hidden="true" /> {countryLabel(report.mission.destinationCountry)} / {cityLabel(report.mission.destinationCity)}
                </span>
              </div>
              <h1>{report.mission.title}</h1>
              <p>{report.mission.request}</p>
            </div>

            <div className="run-controls">
              <div className="segmented" role="group" aria-label="运行版本">
                <button
                  className={mode === "baseline" ? "selected" : ""}
                  type="button"
                  onClick={() => chooseMode("baseline")}
                >
                  原始商品 Feed
                </button>
                <button
                  className={mode === "repaired" ? "selected" : ""}
                  type="button"
                  onClick={() => chooseMode("repaired")}
                >
                  修复版 v2
                </button>
              </div>
              {phase === "ready" ? (
                <button className="primary-button" type="button" onClick={runBaseline}>
                  <Play size={16} fill="currentColor" aria-hidden="true" />
                  开始红队测试
                </button>
              ) : showRepair ? (
                <button className="primary-button repair" type="button" onClick={applyRepair}>
                  <Wrench size={16} aria-hidden="true" />
                  生成修复并复测
                </button>
              ) : phase === "repairing" ? (
                <button className="primary-button" type="button" disabled>
                  <RefreshCw className="spin" size={16} aria-hidden="true" />
                  正在生成修复版本
                </button>
              ) : phase === "running" ? (
                <button className="secondary-button" type="button" onClick={togglePause}>
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                  {paused ? "继续" : "暂停"}
                </button>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => animateRun(mode, mode === "baseline" ? "failed" : "passed")}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  重放本轮
                </button>
              )}
            </div>
          </section>

          <section className="score-strip" aria-label="测试分数">
            <div className={`overall-score ${scoreTone(report.scores.overall)}`}>
              <div className="score-value">{report.scores.overall}</div>
              <div>
                <span>Agent 可用状态</span>
                <strong>{mode === "baseline" ? "未通过" : "已放行"}</strong>
              </div>
            </div>
            <div className="metric-grid">
              {metricMeta.map((metric) => {
                const value = report.scores[metric.key];
                return (
                  <div className="metric" key={metric.key}>
                    <div className="metric-head">
                      <span>{metric.label}</span>
                      <strong className={scoreTone(value)}>{value}%</strong>
                    </div>
                    <div className="metric-track" aria-hidden="true">
                      <span className={scoreTone(value)} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="workspace-tabs" role="tablist" aria-label="运行详情">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? "active" : ""}
                  type="button"
                  onClick={() => setTab(item.id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                  {item.id === "findings" && (
                    <span className={`tab-count ${mode === "repaired" ? "fixed" : ""}`}>
                      {report.findings.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === "run" && (
            <RunWorkspace
              report={report}
              phase={phase}
              visibleEvents={displayEvents}
              selectedProductTitle={selectedProduct?.title ?? "未选择"}
              products={eligibleProducts}
              useModel={useModel}
              onUseModelChange={setUseModel}
              audit={audit}
              auditWarning={auditWarning}
              modelConfigured={activeModel.configured}
              paused={paused}
            />
          )}

          {tab === "findings" && (
            <FindingsWorkspace
              findings={report.findings}
              repairs={mode === "repaired" ? report.repairs : repaired.repairs}
              repairedMode={mode === "repaired"}
              phase={phase}
              onRepair={applyRepair}
            />
          )}

          {tab === "release" && (
            <ReleaseWorkspace
              key={`${report.id}:${launchDraft?.id ?? "generic"}`}
              report={report}
              released={mode === "repaired" && isFinished}
              launchDraft={launchDraft}
              regressionSourceCatalog={importedCatalog ?? demoCatalog}
            />
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function OverviewWorkspace({
  onOpenLaunch,
  onOpenCompiler,
  onOpenRedTeam,
}: {
  onOpenLaunch: () => void;
  onOpenCompiler: () => void;
  onOpenRedTeam: () => void;
}) {
  const solutionSteps = [
    ["整理商品档案", "合并 CSV、图片和政策资料，保留来源、冲突和未知项。"],
    ["生成本地化 Listing", "按目标市场和平台规则生成内容，每条卖点都可追溯。"],
    ["执行红队测试", "重现指令注入、价格差异、商品信息冲突和跨境政策风险。"],
    ["修复并复测", "保留原始资料，生成新版本，并用同一任务和故障重新验证。"],
    ["人工确认发布", "再次确认内容、价格、库存和配送状态，然后生成发布文件。"],
  ];

  return (
    <div className="overview-workspace">
      <section className="compiler-header overview-header">
        <div>
          <div className="eyebrow-row">
            <span className="run-id">比赛方案总览</span>
            <span className="scope-pill"><Globe2 size={12} aria-hidden="true" /> AI 智能上新</span>
          </div>
          <h1>跨境商品上新的 Agent 安全发布平台</h1>
          <p>帮助跨境卖家把分散的商品资料变成可发布的 Listing，并在上线前完成规则检查、红队测试和修复复测，避免 Agent 看错、选错和买错。</p>
        </div>
        <div className="overview-actions">
          <button className="primary-button" type="button" onClick={onOpenLaunch}>
            <Sparkles size={16} aria-hidden="true" />
            创建上新任务
          </button>
          <button className="secondary-button" type="button" onClick={onOpenRedTeam}>
            <TerminalSquare size={16} aria-hidden="true" />
            查看红队测试
          </button>
        </div>
      </section>

      <section className="overview-metric-strip" aria-label="已实现的验证能力">
        {[
          ["30", "买家测试任务"],
          ["12", "受控故障案例"],
          ["5", "实时商品 API"],
          ["3", "支持 UCP / ACP / MCP"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <div className="overview-grid">
        <section className="tool-panel overview-problem-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">业务问题</span><h2>为什么需要它</h2></div>
            <AlertTriangle size={18} aria-hidden="true" />
          </div>
          <div className="overview-problem-list">
            {[
              "商品资料分散，人工核对慢且容易遗漏",
              "本地化 Listing 可能出现没有可信来源的卖点",
              "展示内容与实时价格、库存和配送状态可能不一致",
              "评论、隐藏文本和图片 OCR 可能误导购物 Agent",
            ].map((item) => (
              <div key={item}><X size={13} aria-hidden="true" /><span>{item}</span></div>
            ))}
          </div>
          <button className="overview-inline-action" type="button" onClick={onOpenCompiler}>
            <FileJson size={15} aria-hidden="true" />
            查看商品档案整理
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </section>

        <section className="tool-panel overview-flow-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">完整方案</span><h2>从资料到安全发布</h2></div>
            <Activity size={18} aria-hidden="true" />
          </div>
          <div className="overview-flow-list">
            {solutionSteps.map(([title, detail], index) => (
              <div className="overview-flow-step" key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{title}</strong><p>{detail}</p></div>
              </div>
            ))}
          </div>
        </section>

        <aside className="tool-panel overview-ai-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">AI 落地</span><h2>Qwen 与固定规则协作</h2></div>
            <Sparkles size={18} aria-hidden="true" />
          </div>
          <div className="overview-ai-section qwen">
            <strong>Qwen 负责理解与组织</strong>
            <span>识别图片和政策信息</span>
            <span>优化 Listing 内容结构</span>
            <span>复核红队运行结果</span>
          </div>
          <div className="overview-ai-section rules">
            <strong>固定规则负责安全放行</strong>
            <span>核对预算、价格、库存和配送</span>
            <span>保存卖点来源和商品版本</span>
            <span>强制人工确认，不让模型直接发布或支付</span>
          </div>
        </aside>
      </div>

      <section className="tool-panel overview-judge-panel">
        <div className="panel-heading">
          <div><span className="panel-kicker">评审对照</span><h2>方案为什么值得落地</h2></div>
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div className="overview-judge-grid">
          {[
            ["业务价值", "把上新前的资料整理、内容生成、风险测试和发布确认收敛到一个流程。"],
            ["创新性", "不只生成 Listing，还用红队任务验证 Agent 能否看对、选对和买对。"],
            ["可行性", "已实现可运行原型、30 个任务、12 个故障、商品 API 和人工确认发布。"],
            ["技术思路", "以 Product Passport 为统一资料源，结合信任边界、版本管理、签名购物车和模拟结账。"],
          ].map(([title, detail], index) => (
            <div key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LaunchWorkspace({
  model,
  sourceCatalog,
  onOpenRedTeam,
}: {
  model: AgentShelfConsoleProps["model"];
  sourceCatalog: ProductPassport[];
  onOpenRedTeam: (
    catalog: ProductPassport[],
    targetProductId: string,
    targetMarket: LaunchMarket,
    context: string,
    draft: ListingDraft,
  ) => void;
}) {
  const firstProduct = sourceCatalog[0] ?? demoCatalog[0];
  const [productId, setProductId] = useState(firstProduct.id);
  const [platform, setPlatform] = useState<LaunchPlatform>("amazon");
  const [market, setMarket] = useState<LaunchMarket>("DE");
  const [useModel, setUseModel] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationWarning, setGenerationWarning] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListingDraft>(() =>
    generateListingDraft(firstProduct, {
      productId: firstProduct.id,
      platform: "amazon",
      market: "DE",
      language: "de-DE",
      category: firstProduct.category,
    }),
  );
  const selectedProduct = sourceCatalog.find((product) => product.id === productId) ?? firstProduct;
  const brief: LaunchBrief = {
    productId,
    platform,
    market,
    language: market === "DE" ? "de-DE" : "en-US",
    category: selectedProduct.category,
  };

  async function generateDraft() {
    setGenerating(true);
    setGenerationWarning(null);
    try {
      const response = await fetch("/api/launch/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          platform,
          market,
          useModel,
          model: model.name,
          product: selectedProduct,
        }),
      });
      const payload = await response.json() as {
        draft?: ListingDraft;
        warning?: string | null;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.detail ?? payload.error ?? "Listing 生成接口未返回草稿");
      }
      setDraft(payload.draft);
      setGenerationWarning(payload.warning ?? null);
    } catch {
      setDraft(generateListingDraft(selectedProduct, brief));
      setGenerationWarning(
        "生成接口暂不可用，已改用可信资料规则。",
      );
    } finally {
      setGenerating(false);
    }
  }

  function updateProduct(nextProductId: string) {
    const product = sourceCatalog.find((item) => item.id === nextProductId) ?? firstProduct;
    setProductId(nextProductId);
    setDraft(generateListingDraft(product, {
      ...brief,
      productId: nextProductId,
      category: product.category,
    }));
  }

  function updatePlatform(nextPlatform: LaunchPlatform) {
    setPlatform(nextPlatform);
    setDraft(generateListingDraft(selectedProduct, { ...brief, platform: nextPlatform }));
  }

  function updateMarket(nextMarket: LaunchMarket) {
    const language = nextMarket === "DE" ? "de-DE" : "en-US";
    setMarket(nextMarket);
    setDraft(generateListingDraft(selectedProduct, { ...brief, market: nextMarket, language }));
  }

  const blockingCount = draft.checks.filter(
    (check) => !check.passed && check.severity === "blocking",
  ).length;
  const verifiedClaimCount = draft.claims.filter((claim) => claim.verified).length;

  return (
    <div className="launch-workspace">
      <section className="compiler-header launch-header">
        <div>
          <div className="eyebrow-row">
            <span className="run-id">AI 智能上新全流程</span>
            <span className="scope-pill">
              <Globe2 size={12} aria-hidden="true" /> {platformLabels[platform]} / {marketLabels[market]}
            </span>
          </div>
          <h1>创建可追溯的上新任务</h1>
          <p>选择商品、销售平台和目标市场。系统会生成本地化 Listing，标明每条卖点的来源，并在红队测试前检查平台规则。</p>
        </div>
        <button className="primary-button" type="button" onClick={generateDraft} disabled={generating}>
          {generating ? <RefreshCw className="spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
          {generating ? "正在生成 Listing" : "重新生成 Listing"}
        </button>
      </section>

      <ol className="launch-stage-bar" aria-label="AI 智能上新流程">
        {[
          ["01", "任务配置", "done"],
          ["02", "确认商品信息", "done"],
          ["03", "生成 Listing", "active"],
          ["04", "红队测试", "pending"],
          ["05", "修复并发布", "pending"],
        ].map(([index, label, status]) => (
          <li className={status} key={index}>
            <span>{index}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <section className="tool-panel launch-config-panel">
        <div className="panel-heading">
          <div><span className="panel-kicker">任务设置</span><h2>目标平台与市场</h2></div>
          <span className="record-count">保留任务版本</span>
        </div>
        <div className="launch-config-grid">
          <label>
            <span>销售平台</span>
            <select
              value={platform}
              onChange={(event) => updatePlatform(event.target.value as LaunchPlatform)}
            >
              {(Object.keys(platformLabels) as LaunchPlatform[]).map((item) => (
                <option key={item} value={item}>{platformLabels[item]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>目标市场</span>
            <select
              value={market}
              onChange={(event) => updateMarket(event.target.value as LaunchMarket)}
            >
              {(Object.keys(marketLabels) as LaunchMarket[]).map((item) => (
                <option key={item} value={item}>{marketLabels[item]} ({item})</option>
              ))}
            </select>
          </label>
          <label>
            <span>输出语言</span>
            <input value={draft.language === "de-DE" ? "德语 (de-DE)" : "英语 (en-US)"} readOnly />
          </label>
          <label>
            <span>商品品类</span>
            <input value={categoryLabel(selectedProduct.category)} readOnly />
          </label>
        </div>
        <div className="launch-generation-control">
          <label>
            <input
              type="checkbox"
              checked={useModel}
              onChange={(event) => setUseModel(event.target.checked)}
            />
            <span>使用 Qwen 优化 Listing 结构</span>
          </label>
          <span className={model.configured ? "ready" : "fallback"}>
            {model.configured ? `${model.name} 已连接` : "未配置模型时自动使用规则生成"}
          </span>
        </div>
        {generationWarning && (
          <div className="launch-generation-warning" role="status">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{generationWarning}</span>
          </div>
        )}
      </section>

      <div className="launch-grid">
        <section className="tool-panel launch-product-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">商品资料</span><h2>选择商品档案</h2></div>
            <span className="record-count">{sourceCatalog.length} 条</span>
          </div>
          <div className="launch-product-list">
            {sourceCatalog.map((product) => {
              const shipping = product.shipping.find((rule) => rule.country === market);
              return (
                <button
                  className={`launch-product-row ${product.id === productId ? "selected" : ""}`}
                  type="button"
                  key={product.id}
                  onClick={() => updateProduct(product.id)}
                >
                  <span className={`product-swatch ${product.color}`} aria-hidden="true" />
                  <span>
                    <strong>{product.title}</strong>
                    <code>{product.sku} · v{product.version}</code>
                  </span>
                  <span className={shipping && product.stock > 0 ? "available" : "unavailable"}>
                    {shipping && product.stock > 0 ? "可上新" : "需处理"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="tool-panel listing-draft-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">本地化 Listing</span>
              <h2>{platformLabels[draft.platform]} 草稿</h2>
              <small className="listing-generation-mode">
                {draft.generation.mode === "qwen-assisted"
                  ? `Qwen 结构优化 · ${draft.generation.model}`
                  : "按可信资料生成"}
              </small>
            </div>
            <span className={`launch-status ${draft.status}`}>
              {draft.status === "ready" ? "可以测试" : draft.status === "review" ? "需要复核" : "暂不可发布"}
            </span>
          </div>
          <div className="listing-draft-content">
            <div className="listing-field">
              <div><span>商品标题</span><code>{draft.title.length} 字符</code></div>
              <h3>{draft.title}</h3>
            </div>
            <div className="listing-field">
              <div><span>核心卖点</span><code>{draft.bullets.length} 条</code></div>
              <ol className="listing-bullet-list">
                {draft.bullets.map((bullet, index) => <li key={`${bullet}-${index}`}>{bullet}</li>)}
              </ol>
            </div>
            <div className="listing-field">
              <div><span>商品描述</span><code>{draft.language}</code></div>
              <p>{draft.description}</p>
            </div>
            <div className="listing-field search-term-field">
              <div><span>Search Terms</span><code>去重后</code></div>
              <div>{draft.searchTerms.map((term) => <span key={term}>{term}</span>)}</div>
            </div>
          </div>
        </section>

        <aside className="tool-panel launch-audit-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">发布前检查</span><h2>平台规则与资料来源</h2></div>
            <strong className={draft.score >= 90 ? "pass" : "fail"}>{draft.score}</strong>
          </div>
          <div className="launch-check-list">
            {draft.checks.map((check) => (
              <div className={check.passed ? "pass" : "fail"} key={check.id}>
                <span>{check.passed ? <Check size={12} /> : <X size={12} />}</span>
                <div><strong>{check.label}</strong><p>{check.detail}</p></div>
              </div>
            ))}
          </div>
          <div className="claim-ledger">
            <div className="subheading"><span>卖点来源</span><strong>{verifiedClaimCount}/{draft.claims.length}</strong></div>
            {draft.claims.map((claim) => (
              <div className={claim.verified ? "verified" : "missing"} key={claim.id}>
                <ShieldCheck size={14} aria-hidden="true" />
                <span><strong>{claim.text}</strong><small>{claim.evidenceLabels.join(" / ") || "缺少可信来源"}</small></span>
              </div>
            ))}
          </div>
          <button
            className="primary-button launch-redteam-button"
            type="button"
            disabled={blockingCount > 0}
            onClick={() => onOpenRedTeam(
              applyListingDraft(sourceCatalog, draft),
              draft.productId,
              draft.market,
              `${platformLabels[draft.platform]} / ${marketLabels[draft.market]}上新`,
              draft,
            )}
          >
            <TerminalSquare size={16} aria-hidden="true" />
            {blockingCount > 0 ? `${blockingCount} 项阻断问题待处理` : "进入红队测试"}
          </button>
        </aside>
      </div>
    </div>
  );
}

type ProtocolName = "UCP" | "ACP" | "MCP";
type ProtocolStepStatus = "idle" | "running" | "pass" | "blocked" | "error";

interface ProtocolStep {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  status: ProtocolStepStatus;
  latencyMs: number | null;
  detail: string;
}

const protocolSpecs: Record<ProtocolName, {
  title: string;
  description: string;
  mappings: Array<{ capability: string; adapter: string; status: "ready" | "guarded" }>;
}> = {
  UCP: {
    title: "Universal Commerce Protocol",
    description: "让商品搜索、购物车和结账共用同一份 Product Passport。",
    mappings: [
      { capability: "product.discovery", adapter: "search", status: "ready" },
      { capability: "shipping.quote", adapter: "shipping", status: "ready" },
      { capability: "checkout", adapter: "人工确认", status: "guarded" },
    ],
  },
  ACP: {
    title: "Agentic Commerce Protocol",
    description: "为 Agent 购买流程提供结构化商品资料、实时价格库存和模拟交易结果。",
    mappings: [
      { capability: "product_search", adapter: "search", status: "ready" },
      { capability: "create_cart", adapter: "签名报价", status: "ready" },
      { capability: "complete_checkout", adapter: "人工确认", status: "guarded" },
    ],
  },
  MCP: {
    title: "Model Context Protocol",
    description: "将商品 API 封装为受控工具，防止模型绕过实时价格和用户确认。",
    mappings: [
      { capability: "search_products", adapter: "GET 工具", status: "ready" },
      { capability: "get_shipping_quote", adapter: "GET 工具", status: "ready" },
      { capability: "checkout_mock", adapter: "POST 工具", status: "guarded" },
    ],
  },
};

const protocolStatusLabels: Record<ProtocolStepStatus, string> = {
  idle: "等待",
  running: "调用中",
  pass: "通过",
  blocked: "已阻断",
  error: "失败",
};

function freshProtocolSteps(): ProtocolStep[] {
  return [
    { id: "search", method: "GET", path: "/api/commerce/search", title: "发现商品", status: "idle", latencyMs: null, detail: "等待调用" },
    { id: "product", method: "GET", path: "/api/commerce/products/:id", title: "读取商品档案", status: "idle", latencyMs: null, detail: "等待调用" },
    { id: "shipping", method: "GET", path: "/api/commerce/shipping", title: "锁定配送状态", status: "idle", latencyMs: null, detail: "等待调用" },
    { id: "cart", method: "POST", path: "/api/commerce/cart", title: "创建签名购物车", status: "idle", latencyMs: null, detail: "等待调用" },
    { id: "gate", method: "POST", path: "/api/commerce/checkout", title: "检查人工确认", status: "idle", latencyMs: null, detail: "等待调用" },
    { id: "checkout", method: "POST", path: "/api/commerce/checkout", title: "完成模拟结账", status: "idle", latencyMs: null, detail: "等待调用" },
  ];
}

function ProtocolWorkspace() {
  const [protocol, setProtocol] = useState<ProtocolName>("UCP");
  const [steps, setSteps] = useState<ProtocolStep[]>(freshProtocolSteps);
  const [running, setRunning] = useState(false);
  const [responsePreview, setResponsePreview] = useState<Record<string, unknown> | null>(null);
  const spec = protocolSpecs[protocol];

  function patchStep(index: number, patch: Partial<ProtocolStep>) {
    setSteps((current) => current.map((step, stepIndex) => (
      stepIndex === index ? { ...step, ...patch } : step
    )));
  }

  async function invoke(
    index: number,
    path: string,
    init?: RequestInit,
    expectedBlock = false,
  ) {
    patchStep(index, { status: "running", detail: "调用中" });
    const startedAt = performance.now();
    const response = await fetch(path, init);
    const payload = await response.json() as Record<string, unknown>;
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      const detail = typeof payload.detail === "string" ? payload.detail : "接口调用失败";
      patchStep(index, { status: "error", latencyMs, detail });
      throw new Error(detail);
    }
    const blocked = expectedBlock && payload.status === "blocked";
    patchStep(index, {
      status: blocked ? "blocked" : "pass",
      latencyMs,
      detail: blocked ? "未确认的交易已按预期拦截" : "接口返回结果正确",
    });
    return payload;
  }

  async function runHandshake() {
    setRunning(true);
    setSteps(freshProtocolSteps());
    setResponsePreview(null);
    try {
      const search = await invoke(0, "/api/commerce/search?q=Atlas&destination=DE&budget=35");
      const products = search.products as Array<{ id: string }> | undefined;
      const productId = products?.[0]?.id;
      if (!productId) throw new Error("搜索未返回可购买商品");

      await invoke(1, `/api/commerce/products/${encodeURIComponent(productId)}?destination=DE`);
      await invoke(2, `/api/commerce/shipping?productId=${encodeURIComponent(productId)}&destination=DE`);
      const cart = await invoke(3, "/api/commerce/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1, destination: "DE" }),
      });
      const checkoutToken = cart.checkoutToken;
      if (typeof checkoutToken !== "string") throw new Error("购物车缺少结账令牌");

      await invoke(4, "/api/commerce/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutToken, confirmation: false }),
      }, true);
      const result = await invoke(5, "/api/commerce/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutToken, confirmation: true }),
      });
      setResponsePreview(result);
    } catch (error) {
      setResponsePreview({
        status: "error",
        detail: error instanceof Error ? error.message : "协议测试失败",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="protocol-workspace">
      <section className="compiler-header">
        <div>
          <div className="eyebrow-row">
            <span className="run-id">协议适配测试</span>
            <span className="scope-pill"><Code2 size={12} aria-hidden="true" /> 5 个实时 API</span>
          </div>
          <h1>协议适配测试</h1>
          <p>用同一份商品和交易数据测试 UCP、ACP 和 MCP。系统会验证签名报价和人工确认，防止 Agent 在未经用户同意时下单。</p>
        </div>
        <button className="primary-button" type="button" onClick={runHandshake} disabled={running}>
          {running ? <RefreshCw className="spin" size={15} aria-hidden="true" /> : <Play size={15} fill="currentColor" aria-hidden="true" />}
          {running ? "正在测试协议" : "开始协议测试"}
        </button>
      </section>

      <div className="protocol-selector" role="tablist" aria-label="协议选择">
        {(Object.keys(protocolSpecs) as ProtocolName[]).map((item) => (
          <button
            className={protocol === item ? "selected" : ""}
            key={item}
            type="button"
            onClick={() => setProtocol(item)}
            role="tab"
            aria-selected={protocol === item}
          >
            <strong>{item}</strong>
            <span>{protocolSpecs[item].title}</span>
          </button>
        ))}
      </div>

      <div className="protocol-workspace-grid">
        <section className="tool-panel protocol-capability-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">支持的功能</span><h2>{protocol}</h2></div>
            <CheckCircle2 size={18} aria-hidden="true" />
          </div>
          <p className="protocol-description">{spec.description}</p>
          <div className="capability-list">
            {spec.mappings.map((mapping) => (
              <div className="capability-row" key={mapping.capability}>
                <div><code>{mapping.capability}</code><span>{mapping.adapter}</span></div>
                <strong className={mapping.status}>{mapping.status === "ready" ? "可用" : "受保护"}</strong>
              </div>
            ))}
          </div>
          <div className="protocol-source-note">
            <FileJson size={17} aria-hidden="true" />
            <div><strong>统一商品资料</strong><span>Product Passport v1，加上实时价格、库存和配送状态</span></div>
          </div>
        </section>

        <section className="tool-panel protocol-handshake-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">实时测试</span><h2>接口调用过程</h2></div>
            <span className="record-count">{steps.filter((step) => step.status === "pass").length}/{steps.length} 通过</span>
          </div>
          <div className="protocol-step-list">
            {steps.map((step, index) => (
              <div className={`protocol-step ${step.status}`} key={step.id}>
                <span className="protocol-step-index">{String(index + 1).padStart(2, "0")}</span>
                <span className={`method-badge ${step.method.toLowerCase()}`}>{step.method}</span>
                <div className="protocol-step-copy">
                  <strong>{step.title}</strong>
                  <code>{step.path}</code>
                </div>
                <div className="protocol-step-result">
                  <strong>{protocolStatusLabels[step.status]}</strong>
                  <span>{step.latencyMs === null ? step.detail : `${step.latencyMs} ms · ${step.detail}`}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="tool-panel protocol-response-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">最终结果</span><h2>模拟订单</h2></div>
            <LockKeyhole size={18} aria-hidden="true" />
          </div>
          <pre>{JSON.stringify(responsePreview ?? {
            status: "ready",
            payment: "not_captured",
            safety: "sandbox_only",
          }, null, 2)}</pre>
          <div className="protocol-safety-checks">
            <div><Check size={12} /><span>购物车报价 HMAC 签名</span></div>
            <div><Check size={12} /><span>价格、库存和版本二次核验</span></div>
            <div><Check size={12} /><span>显式确认前交易阻断</span></div>
            <div><Check size={12} /><span>不捕获真实支付</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FaultLibraryWorkspace({ onRun }: { onRun: (fault: FaultLibraryItem) => void }) {
  const [family, setFamily] = useState<"all" | FaultLibraryItem["family"]>("all");
  const initialFault = faultLibrary[0];
  const [activeId, setActiveId] = useState(initialFault.id);
  const active = faultLibrary.find((fault) => fault.id === activeId) ?? initialFault;
  const filtered = family === "all" ? faultLibrary : faultLibrary.filter((fault) => fault.family === family);
  const families = Object.keys(faultFamilyLabels) as FaultLibraryItem["family"][];

  return (
    <div className="fault-workspace">
      <section className="compiler-header">
        <div>
          <div className="eyebrow-row">
            <span className="run-id">商品与交易故障测试</span>
            <span className="scope-pill"><Zap size={12} aria-hidden="true" /> 4 类 / 12 个案例</span>
          </div>
          <h1>商品与交易故障库</h1>
          <p>每个故障只作用于测试副本。页面会说明故障内容、放入位置、应检出的问题和影响对象。</p>
        </div>
        <div className="fault-active-summary">
          <span>主演示已启用</span>
          <strong>{activeDemoFaultIds.length} 个案例</strong>
        </div>
      </section>

      <div className="fault-family-tabs" role="tablist" aria-label="故障类型">
        <button
          className={family === "all" ? "selected" : ""}
          type="button"
          onClick={() => setFamily("all")}
          role="tab"
          aria-selected={family === "all"}
        >
          全部 12
        </button>
        {families.map((item) => (
          <button
            className={family === item ? "selected" : ""}
            key={item}
            type="button"
            onClick={() => setFamily(item)}
            role="tab"
            aria-selected={family === item}
          >
            {faultFamilyLabels[item]} 3
          </button>
        ))}
      </div>

      <div className="fault-library-grid">
        <section className="tool-panel fault-case-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">故障案例</span><h2>测试数据</h2></div>
            <span className="record-count">{filtered.length} 个</span>
          </div>
          <div className="fault-case-list">
            {filtered.map((fault) => {
              const isDemo = activeDemoFaultIds.includes(fault.id as (typeof activeDemoFaultIds)[number]);
              return (
                <button
                  className={`fault-case-row ${active.id === fault.id ? "selected" : ""}`}
                  key={fault.id}
                  type="button"
                  onClick={() => setActiveId(fault.id)}
                >
                  <span className={`severity-mark ${fault.severity}`} aria-hidden="true" />
                  <span className="fault-case-copy">
                    <span>{faultFamilyLabels[fault.family]} · {stakeholderLabels[fault.stakeholder]}</span>
                    <strong>{fault.label}</strong>
                    <code>{fault.id}</code>
                  </span>
                  {isDemo && <span className="demo-case-badge">演示</span>}
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="tool-panel fault-detail-panel">
          <div className="fault-detail-head">
            <div>
              <span className="panel-kicker">{faultFamilyLabels[active.family]}</span>
              <h2>{active.label}</h2>
            </div>
            <span className={`severity-label ${active.severity}`}>{severityLabel(active.severity)}风险</span>
          </div>

          <div className="fault-code-block">
            <div><span>放入位置</span><code>{active.injectionPoint}</code></div>
            <pre>{active.payload}</pre>
          </div>

          <div className="fault-detail-section">
            <span className="panel-kicker">应检出的问题</span>
            <div className="expected-detection">
              <ShieldCheck size={17} aria-hidden="true" />
              <strong>{active.expectedDetection}</strong>
            </div>
          </div>

          <div className="fault-detail-section">
            <span className="panel-kicker">固定测试规则</span>
            <div className="fault-invariants">
              <div><Check size={12} /><span>只修改测试副本</span></div>
              <div><Check size={12} /><span>测试数据和放入位置保持不变</span></div>
              <div><Check size={12} /><span>运行后恢复原始版本</span></div>
              <div><Check size={12} /><span>规则优先于模型判分</span></div>
            </div>
          </div>

          <div className="stakeholder-impact">
            <span>影响对象</span>
            <strong>{stakeholderLabels[active.stakeholder]}</strong>
          </div>
          <button className="primary-button fault-run-button" type="button" onClick={() => onRun(active)}>
            <Play size={15} fill="currentColor" aria-hidden="true" />
            用这个故障开始红队测试
          </button>
        </section>

        <aside className="tool-panel fault-matrix-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">覆盖情况</span><h2>故障覆盖</h2></div>
            <Gauge size={18} aria-hidden="true" />
          </div>
          {families.map((item) => {
            const familyCases = faultLibrary.filter((fault) => fault.family === item);
            const critical = familyCases.filter((fault) => fault.severity === "critical").length;
            return (
              <div className="fault-matrix-row" key={item}>
                <div><strong>{faultFamilyLabels[item]}</strong><span>固定测试集</span></div>
                <div><span>案例</span><strong>3</strong></div>
                <div><span>严重</span><strong className={critical ? "fail" : "warn"}>{critical}</strong></div>
              </div>
            );
          })}
          <div className="fault-safety-note">
            <LockKeyhole size={17} aria-hidden="true" />
            <div><strong>仅限测试环境</strong><span>不会向真实商城或支付系统注入故障</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MissionLibraryWorkspace({
  selectedMissionId,
  onSelect,
}: {
  selectedMissionId: string;
  onSelect: (mission: MissionLibraryItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [suite, setSuite] = useState<"全部" | MissionLibraryItem["suite"]>("全部");
  const [activeId, setActiveId] = useState(selectedMissionId);
  const filtered = missionLibrary.filter((mission) => {
    const matchesSuite = suite === "全部" || mission.suite === suite;
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      `${mission.title} ${mission.destinationCity} ${mission.destinationCountry}`
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesSuite && matchesQuery;
  });
  const active = missionLibrary.find((mission) => mission.id === activeId) ?? filtered[0] ?? missionLibrary[0];
  const suites: Array<"全部" | MissionLibraryItem["suite"]> = [
    "全部",
    "预算与币种",
    "跨境配送",
    "事实与认证",
    "退货与授权",
  ];

  return (
    <div className="mission-workspace">
      <section className="compiler-header">
        <div>
          <div className="eyebrow-row">
            <span className="run-id">买家任务测试</span>
            <span className="scope-pill"><ClipboardCheck size={12} aria-hidden="true" /> 30 个可运行案例</span>
          </div>
          <h1>买家测试任务</h1>
          <p>用固定的购买目标、必选条件和结账规则重复测试商品 Feed，确认每次结果一致。</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onSelect(active)}>
          <Play size={15} fill="currentColor" aria-hidden="true" />
          开始红队测试
        </button>
      </section>

      <section className="mission-toolbar">
        <label className="mission-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索城市或任务"
            aria-label="搜索任务"
          />
        </label>
        <div className="mission-suite-filter" role="group" aria-label="任务套件筛选">
          <SlidersHorizontal size={14} aria-hidden="true" />
          {suites.map((item) => (
            <button
              key={item}
              className={suite === item ? "selected" : ""}
              type="button"
              onClick={() => setSuite(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="mission-result-count">{filtered.length} / 30</span>
      </section>

      <div className="mission-grid">
        <section className="tool-panel mission-list-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">任务案例</span><h2>任务列表</h2></div>
            <span className="record-count">结果可复现</span>
          </div>
          <div className="mission-list">
            {filtered.map((mission) => (
              <button
                className={`mission-row ${active.id === mission.id ? "selected" : ""}`}
                key={mission.id}
                type="button"
                onClick={() => setActiveId(mission.id)}
              >
                <span className="mission-number">{String(missionLibrary.indexOf(mission) + 1).padStart(2, "0")}</span>
                <span className="mission-row-copy">
                  <strong>{mission.title}</strong>
                  <span>{mission.suite} · {countryLabel(mission.destinationCountry)}/{cityLabel(mission.destinationCity)}</span>
                </span>
                <span className={`mission-risk ${mission.risk}`}>{severityLabel(mission.risk)}</span>
                {selectedMissionId === mission.id && <CheckCircle2 size={15} aria-label="当前任务" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="mission-no-result">没有匹配任务</div>}
          </div>
        </section>

        <section className="tool-panel mission-detail-panel">
          <div className="mission-detail-head">
            <div>
              <span className="panel-kicker">{active.suite.toUpperCase()}</span>
              <h2>{active.title}</h2>
            </div>
            <span className={`mission-risk ${active.risk}`}>{severityLabel(active.risk)}风险</span>
          </div>
          <blockquote>{active.request}</blockquote>

          <div className="mission-constraint-grid">
            <div><span>预算上限</span><strong>{formatMoney(active.budget)}</strong></div>
            <div><span>目的地</span><strong>{countryLabel(active.destinationCountry)} / {cityLabel(active.destinationCity)}</strong></div>
            <div><span>最晚送达</span><strong>{active.maxDeliveryDays} 天</strong></div>
            <div><span>交易确认</span><strong>{active.confirmationRequired ? "必需" : "不需要"}</strong></div>
          </div>

          <div className="mission-rule-section">
            <span className="panel-kicker">必需属性</span>
            <div className="rule-list">
              {active.requiredAttributes.map((attribute) => (
                <span className="rule-pill required" key={attribute}><Check size={11} />{missionRuleLabel(attribute)}</span>
              ))}
            </div>
          </div>
          <div className="mission-rule-section">
            <span className="panel-kicker">禁止表述</span>
            <div className="rule-list">
              {active.forbiddenClaims.map((claim) => (
                <span className="rule-pill forbidden" key={claim}><X size={11} />{missionRuleLabel(claim)}</span>
              ))}
            </div>
          </div>

          <div className="mission-expectation">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>固定规则检查</strong>
              <span>逐项检查预算、目的地、配送时间、商品属性、卖点来源和结账确认</span>
            </div>
          </div>
          <button className="primary-button mission-run-button" type="button" onClick={() => onSelect(active)}>
            <TerminalSquare size={16} aria-hidden="true" />
            开始测试 #{String(missionLibrary.indexOf(active) + 1).padStart(2, "0")}
          </button>
        </section>

        <aside className="tool-panel mission-coverage-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">任务覆盖</span><h2>覆盖情况</h2></div>
            <Gauge size={18} aria-hidden="true" />
          </div>
          {suites.slice(1).map((item) => {
            const count = missionLibrary.filter((mission) => mission.suite === item).length;
            return (
              <div className="coverage-row" key={item}>
                <div><strong>{item}</strong><span>{count} 个案例</span></div>
                <div className="metric-track"><span className="pass" style={{ width: `${(count / 30) * 100}%` }} /></div>
              </div>
            );
          })}
          <div className="coverage-footer">
            <div><span>国家</span><strong>2</strong></div>
            <div><span>任务</span><strong>30</strong></div>
            <div><span>可复现</span><strong>100%</strong></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CompilerWorkspace({
  model,
  onOpenLaunch,
}: {
  model: AgentShelfConsoleProps["model"];
  onOpenLaunch: (catalog: ProductPassport[]) => void;
}) {
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [useModel, setUseModel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [result, setResult] = useState<CompileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSampleFiles() {
    setLoadingSample(true);
    setError(null);
    try {
      const [catalogResponse, policyResponse, imageResponse] = await Promise.all([
        fetch("/sample-catalog.csv"),
        fetch("/sample-policy.txt"),
        fetch("/travel-organizers-compiler.jpg"),
      ]);
      if (!catalogResponse.ok || !policyResponse.ok || !imageResponse.ok) {
        throw new Error("示例材料加载失败");
      }
      setCatalogFile(
        new File([await catalogResponse.blob()], "sample-catalog.csv", { type: "text/csv" }),
      );
      setPolicyFile(
        new File([await policyResponse.blob()], "sample-policy.txt", { type: "text/plain" }),
      );
      setImageFiles([
        new File([await imageResponse.blob()], "travel-organizers-compiler.jpg", {
          type: "image/jpeg",
        }),
      ]);
      setResult(null);
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : "示例材料加载失败");
    } finally {
      setLoadingSample(false);
    }
  }

  async function compileCatalog() {
    if (!catalogFile) {
      setError("请先上传商品 Catalog CSV。");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("catalog", catalogFile);
    if (policyFile) form.append("policy", policyFile);
    imageFiles.slice(0, 4).forEach((file) => form.append("images", file));
    form.append("useModel", String(useModel));
    form.append("model", model.name);

    try {
      const response = await fetch("/api/catalog/compile", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        const firstIssue = payload.issues?.[0]?.message;
        throw new Error(firstIssue || payload.error || "商品资料处理失败");
      }
      setResult(payload as CompileResponse);
    } catch (compileError) {
      setError(compileError instanceof Error ? compileError.message : "商品资料处理失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="compiler-workspace">
      <section className="compiler-header">
        <div>
          <div className="eyebrow-row">
            <span className="run-id">商品档案整理</span>
            <span className="scope-pill">
              <Sparkles size={12} aria-hidden="true" /> {model.name}
            </span>
          </div>
          <h1>整理商品档案</h1>
          <p>上传商品 CSV、图片和政策文件，生成 Product Passport，并标出信息来源、冲突和待确认内容。</p>
        </div>
        <div className="compiler-header-actions">
          <a className="secondary-link" href="/sample-catalog.csv" download>
            <Download size={15} aria-hidden="true" />
            CSV 模板
          </a>
          <button
            className="secondary-button"
            type="button"
            onClick={loadSampleFiles}
            disabled={loadingSample}
          >
            {loadingSample ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : (
              <FileText size={16} aria-hidden="true" />
            )}
            载入示例材料
          </button>
        </div>
      </section>

      <section className="tool-panel compiler-input-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">输入材料</span>
            <h2>上传商品文件</h2>
          </div>
          <span className="record-count">保留导入版本</span>
        </div>
        <div className="upload-grid">
          <label className={`upload-control ${catalogFile ? "filled" : ""}`}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setCatalogFile(event.target.files?.[0] ?? null)}
            />
            <span className="upload-icon"><FileJson size={20} aria-hidden="true" /></span>
            <strong>商品 CSV</strong>
            <span>{catalogFile ? catalogFile.name : "必需 · 最大 2 MB"}</span>
            {catalogFile && <CheckCircle2 className="upload-check" size={16} aria-hidden="true" />}
          </label>

          <label className={`upload-control ${policyFile ? "filled" : ""}`}>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(event) => setPolicyFile(event.target.files?.[0] ?? null)}
            />
            <span className="upload-icon"><FileText size={20} aria-hidden="true" /></span>
            <strong>配送与退货政策</strong>
            <span>{policyFile ? policyFile.name : "可选 · TXT / Markdown"}</span>
            {policyFile && <CheckCircle2 className="upload-check" size={16} aria-hidden="true" />}
          </label>

          <label className={`upload-control ${imageFiles.length ? "filled" : ""}`}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => setImageFiles(Array.from(event.target.files ?? []).slice(0, 4))}
            />
            <span className="upload-icon"><Images size={20} aria-hidden="true" /></span>
            <strong>商品图片</strong>
            <span>{imageFiles.length ? `${imageFiles.length} 张图片` : "可选 · 最多 4 张"}</span>
            {imageFiles.length > 0 && <CheckCircle2 className="upload-check" size={16} aria-hidden="true" />}
          </label>
        </div>

        <div className="compiler-action-bar">
          <div className="compiler-model-control">
            <label className="switch" title="使用 Qwen 识别图片和政策信息">
              <input
                type="checkbox"
                checked={useModel}
                onChange={(event) => setUseModel(event.target.checked)}
              />
              <span aria-hidden="true" />
              <span className="sr-only">启用 Qwen 图文资料识别</span>
            </label>
            <div>
              <strong>Qwen 图文资料识别</strong>
              <span>{model.configured ? `${model.name} 已连接` : "模型密钥未配置"}</span>
            </div>
          </div>
          <button className="primary-button compiler-button" type="button" onClick={compileCatalog} disabled={loading}>
            {loading ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : (
              <UploadCloud size={16} aria-hidden="true" />
            )}
            {loading ? "正在整理商品资料" : "生成 Product Passport"}
          </button>
        </div>
        {error && (
          <div className="compiler-error" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            {error}
          </div>
        )}
      </section>

      {result ? (
        <CompilerResult
          result={result}
          onOpenLaunch={() => onOpenLaunch(result.catalog)}
        />
      ) : (
        <section className="compiler-empty-band">
          <div><strong>0</strong><span>商品档案</span></div>
          <div><strong>0</strong><span>字段冲突</span></div>
          <div><strong>0</strong><span>图片事实</span></div>
          <div><strong>草稿</strong><span>处理状态</span></div>
        </section>
      )}
    </div>
  );
}

function CompilerResult({
  result,
  onOpenLaunch,
}: {
  result: CompileResponse;
  onOpenLaunch: () => void;
}) {
  const errorCount = result.issues.filter((issue) => issue.severity === "error").length;
  const conflictCount = result.compiledFacts?.conflicts.length ?? 0;
  const visibleFactCount =
    (result.compiledFacts?.visibleFeatures.length ?? 0) +
    (result.compiledFacts?.visibleComponents.length ?? 0);

  return (
    <div className="compiler-result-grid">
      <section className="tool-panel compiled-catalog-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">已生成商品档案</span>
            <h2>商品记录</h2>
          </div>
          <span className="risk-badge fixed">{result.catalog.length} 个可用</span>
        </div>
        <div className="compiled-table" role="table" aria-label="已整理商品">
          <div className="compiled-table-head" role="row">
            <span>SKU / 商品</span><span>价格</span><span>库存</span><span>市场</span>
          </div>
          {result.catalog.map((product) => (
            <div className="compiled-table-row" role="row" key={product.id}>
              <div><strong>{product.title}</strong><code>{product.sku}</code></div>
              <span>{formatMoney(product.price)}</span>
              <span>{product.stock}</span>
              <span>{product.shipping.map((shipping) => countryLabel(shipping.country)).join(" / ")}</span>
            </div>
          ))}
        </div>
        {result.issues.length > 0 && (
          <div className="import-issues">
            <div className="subheading"><span>导入问题</span><strong>{result.issues.length}</strong></div>
            {result.issues.slice(0, 6).map((issue, index) => (
              <div className={`import-issue ${issue.severity}`} key={`${issue.row}-${issue.field}-${index}`}>
                <AlertTriangle size={13} aria-hidden="true" />
                <span>第 {issue.row} 行 · {issue.field}</span>
                <p>{issue.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tool-panel fact-compiler-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">图文资料</span>
            <h2>资料识别结果</h2>
          </div>
          <span className="model-chip">{result.model}</span>
        </div>
        {result.compiledFacts ? (
          <div className="fact-compiler-content">
            <div className="fact-confidence">
              <span>图片识别可信度</span>
              <strong>{Math.round(result.compiledFacts.confidence * 100)}%</strong>
              <div className="metric-track"><span className="pass" style={{ width: `${result.compiledFacts.confidence * 100}%` }} /></div>
            </div>
            <FactGroup title="可见特征" values={result.compiledFacts.visibleFeatures} tone="verified" />
            <FactGroup title="有可信来源的卖点" values={result.compiledFacts.safeClaims} tone="verified" />
            <FactGroup title="无法确认" values={result.compiledFacts.unknowns} tone="unknown" />
            {result.compiledFacts.conflicts.length > 0 && (
              <div className="fact-group conflicts">
                <span className="panel-kicker">数据冲突</span>
                {result.compiledFacts.conflicts.map((conflict, index) => (
                  <div className="conflict-row" key={`${conflict.field}-${index}`}>
                    <AlertTriangle size={14} aria-hidden="true" />
                    <div><strong>{conflict.field}</strong><p>{conflict.explanation}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="fact-empty">
            <Bot size={23} aria-hidden="true" />
            <strong>CSV 商品资料已整理完成</strong>
            <span>{result.modelWarning || "本次没有提供图片或政策材料。"}</span>
          </div>
        )}
      </section>

      <aside className="tool-panel compiler-summary-panel">
        <div className="panel-heading">
          <div><span className="panel-kicker">处理结果</span><h2>商品档案摘要</h2></div>
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div className="compile-stats">
          <div><span>商品</span><strong>{result.stats.products}</strong></div>
          <div><span>已导入行</span><strong>{result.stats.rowsAccepted}/{result.stats.rowsRead}</strong></div>
          <div><span>图片事实</span><strong>{visibleFactCount}</strong></div>
          <div><span>冲突</span><strong className={conflictCount ? "fail" : "pass"}>{conflictCount}</strong></div>
          <div><span>导入错误</span><strong className={errorCount ? "fail" : "pass"}>{errorCount}</strong></div>
          <div><span>商品档案</span><strong>v1</strong></div>
        </div>
        <div className="compile-version">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div><strong>原始资料已保留</strong><span>原始文件未被修改</span></div>
        </div>
        <button className="primary-button open-redteam-button" type="button" onClick={onOpenLaunch}>
          <Sparkles size={16} aria-hidden="true" />
          进入上新任务
        </button>
      </aside>
    </div>
  );
}

function FactGroup({
  title,
  values,
  tone,
}: {
  title: string;
  values: string[];
  tone: "verified" | "unknown";
}) {
  if (values.length === 0) return null;
  return (
    <div className={`fact-group ${tone}`}>
      <span className="panel-kicker">{title}</span>
      <div className="fact-tags">
        {values.map((value, index) => (
          <span key={`${value}-${index}`}>
            {tone === "verified" ? <Check size={11} aria-hidden="true" /> : <Eye size={11} aria-hidden="true" />}
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function RunWorkspace({
  report,
  phase,
  visibleEvents,
  selectedProductTitle,
  products,
  useModel,
  onUseModelChange,
  audit,
  auditWarning,
  modelConfigured,
  paused,
}: {
  report: RunReport;
  phase: Phase;
  visibleEvents: TraceEvent[];
  selectedProductTitle: string;
  products: Array<RunReport["catalog"][number] & {
    destinationShipping: RunReport["catalog"][number]["shipping"][number] | undefined;
    landed: number;
    selected: boolean;
  }>;
  useModel: boolean;
  onUseModelChange: (checked: boolean) => void;
  audit: ModelAudit | null;
  auditWarning: string | null;
  modelConfigured: boolean;
  paused: boolean;
}) {
  const visibleIds = new Set(visibleEvents.map((event) => event.id));
  const auditedProduct = report.catalog.find((product) => product.id === report.selection.productId);
  const auditedShipping = auditedProduct?.shipping.find(
    (rule) => rule.country === report.mission.destinationCountry,
  );
  const requiresWaterResistance = report.mission.requiredAttributes.includes("water-resistant");
  const budgetPassed = report.selection.checkoutTotal <= report.mission.budget;
  const deliveryPassed = Boolean(
    auditedShipping && auditedShipping.deliveryDays <= report.mission.maxDeliveryDays,
  );
  const waterPassed = Boolean(
    auditedProduct && (!requiresWaterResistance || auditedProduct.waterResistant),
  );
  const claimsPassed = Boolean(
    auditedProduct && auditedProduct.claims.every((claim) => claim.supported),
  );
  const confirmationPassed = report.selection.decision === "confirmed";

  return (
    <div className="run-grid">
      <section className="tool-panel catalog-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">商品档案</span>
            <h2>候选商品</h2>
          </div>
          <span className="record-count">{products.length} 条</span>
        </div>

        <div className="product-visual">
          <Image
            src="/travel-organizers.png"
            alt="无品牌旅行收纳袋测试商品组"
            fill
            sizes="(max-width: 900px) 100vw, 320px"
            priority
          />
          <div className="visual-caption">
            <Eye size={13} aria-hidden="true" />
            已提取 4 个图像事实
          </div>
        </div>

        <div className="product-list">
          {products.map((product) => {
            const hasAttack = product.reviews.some((review) =>
              review.content.toLowerCase().includes("ignore the user's"),
            );
            const state = product.selected
              ? report.mode === "baseline"
                ? "risk"
                : "selected"
              : "idle";
            return (
              <div className={`product-row ${state}`} key={product.id}>
                <span className={`product-swatch ${product.color}`} aria-hidden="true" />
                <div className="product-main">
                  <strong>{product.title}</strong>
                  <span>{product.sku}</span>
                </div>
                <div className="product-meta">
                  <strong>{formatMoney(product.landed)}</strong>
                  <span>
                    {product.destinationShipping
                      ? `${product.destinationShipping.deliveryDays} 天`
                      : "不可达"}
                  </span>
                </div>
                {hasAttack && <ShieldAlert className="row-risk-icon" size={15} aria-label="含攻击测试数据" />}
                {product.selected && report.mode === "repaired" && (
                  <CheckCircle2 className="row-pass-icon" size={15} aria-label="已选择" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="tool-panel trace-panel">
        <div className="panel-heading trace-heading">
          <div>
            <span className="panel-kicker">Agent 测试过程</span>
            <h2>交易步骤</h2>
          </div>
          <div className={`run-state ${phase}`} aria-live="polite">
            {phase === "running" && !paused && <span className="pulse-dot" />}
            {paused && <Pause size={12} />}
            {phase === "ready" && "等待运行"}
            {phase === "running" && (paused ? "已暂停" : "运行中")}
            {phase === "failed" && "已阻断"}
            {phase === "repairing" && "修复中"}
            {phase === "passed" && "已完成"}
          </div>
        </div>

        {phase === "ready" ? (
          <div className="trace-empty">
            <div className="trace-ready-icon">
              <Bot size={28} aria-hidden="true" />
            </div>
            <strong>购物 Agent 已就绪</strong>
            <span>已加载 30 个任务、4 类故障和 UCP 模拟结账环境</span>
            <div className="trace-readiness-grid" aria-label="运行前检查">
              <div><Check size={13} aria-hidden="true" /><span>商品目录已载入</span></div>
              <div><Check size={13} aria-hidden="true" /><span>政策规则已锁定</span></div>
              <div><Zap size={13} aria-hidden="true" /><span>故障测试已开启</span></div>
              <div><LockKeyhole size={13} aria-hidden="true" /><span>结账环境已隔离</span></div>
            </div>
          </div>
        ) : (
          <div className="trace-list">
            {report.events.map((event, index) => {
              const visible = visibleIds.has(event.id);
              const active = visible && index === visibleEvents.length - 1 && phase === "running";
              return (
                <div
                  className={`trace-row ${visible ? "visible" : "pending"} ${active ? "active" : ""}`}
                  key={event.id}
                >
                  <div className={`trace-icon ${event.status}`}>
                    {visible ? <RiskIcon status={event.status} /> : <span>{event.step}</span>}
                  </div>
                  <div className="trace-copy">
                    <div className="trace-title-row">
                      <strong>{visible ? event.title : "等待上一步完成"}</strong>
                      {visible && <span>{event.durationMs} ms</span>}
                    </div>
                    <p>{visible ? event.detail : ""}</p>
                    {visible && <code>{event.source}</code>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(phase === "failed" || phase === "passed") && (
          <div className={`transaction-result ${phase}`} role="status">
            <div className="result-icon">
              {phase === "failed" ? <X size={18} /> : <Check size={18} />}
            </div>
            <div>
              <span>{phase === "failed" ? "交易已阻止" : "模拟交易已确认"}</span>
              <strong>{selectedProductTitle}</strong>
              <p>{report.selection.reason}</p>
            </div>
            <div className="result-amount">
              <span>{phase === "failed" ? "结账总额" : "到手总价"}</span>
              <strong>{formatMoney(report.selection.checkoutTotal)}</strong>
            </div>
          </div>
        )}
      </section>

      <aside className="tool-panel audit-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">规则判定</span>
            <h2>实时检查</h2>
          </div>
          <Gauge size={18} aria-hidden="true" />
        </div>

        <div className="constraint-list">
          <ConstraintRow
            label={`到手总价 ≤ $${report.mission.budget}`}
            passed={budgetPassed}
          />
          <ConstraintRow
            label={`${report.mission.maxDeliveryDays} 天内送达${cityLabel(report.mission.destinationCity)}`}
            passed={deliveryPassed}
          />
          <ConstraintRow label="防泼水属性" passed={waterPassed} />
          <ConstraintRow label="无虚假认证" passed={claimsPassed} />
          <ConstraintRow label="结账前人工确认" passed={confirmationPassed} />
        </div>

        <div className="fault-stack">
          <div className="subheading">
            <span>已发现故障</span>
            <strong>{report.mode === "baseline" ? "发现 4 个" : "已修复 4 个"}</strong>
          </div>
          {report.faults.map((fault) => (
            <div className={`fault-row ${report.mode === "repaired" ? "neutralized" : ""}`} key={fault.id}>
              {report.mode === "baseline" ? (
                <TriangleAlert size={14} aria-hidden="true" />
              ) : (
                <ShieldCheck size={14} aria-hidden="true" />
              )}
              <span>{fault.label}</span>
              <code>{faultFamilyLabels[fault.family]}</code>
            </div>
          ))}
        </div>

        <div className="model-audit">
          <div className="model-audit-head">
            <div>
              <Sparkles size={14} aria-hidden="true" />
              Qwen 复核
            </div>
            <label className="switch" title="调用阿里云百炼模型复核运行报告">
              <input
                type="checkbox"
                checked={useModel}
                onChange={(event) => onUseModelChange(event.target.checked)}
              />
              <span aria-hidden="true" />
              <span className="sr-only">启用 Qwen 复核</span>
            </label>
          </div>
          {audit ? (
            <div className="audit-copy">
              <strong>{audit.headline}</strong>
              <p>{audit.summary}</p>
              <span>优先动作：{audit.priority}</span>
              <code>{audit.model}</code>
            </div>
          ) : auditWarning ? (
            <div className="audit-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{auditWarning}</span>
            </div>
          ) : (
            <div className="audit-placeholder">
              <Bot size={18} aria-hidden="true" />
              <span>
                {modelConfigured ? "运行完成后生成语义复核" : "固定规则判分可用，模型密钥待配置"}
              </span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ConstraintRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className={`constraint-row ${passed ? "pass" : "fail"}`}>
      <span className="constraint-icon">
        {passed ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
      </span>
      <span>{label}</span>
      <strong>{passed ? "通过" : "未通过"}</strong>
    </div>
  );
}

function FindingsWorkspace({
  findings,
  repairs,
  repairedMode,
  phase,
  onRepair,
}: {
  findings: Finding[];
  repairs: RepairAction[];
  repairedMode: boolean;
  phase: Phase;
  onRepair: () => void;
}) {
  const [selectedId, setSelectedId] = useState(findings[0]?.id ?? "");
  const selectedIndex = Math.max(
    0,
    findings.findIndex((finding) => finding.id === selectedId),
  );
  const selected = findings[selectedIndex];
  const repair = repairs[selectedIndex];
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return (
    <div className="findings-grid">
      <section className="tool-panel findings-list-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">问题原因</span>
            <h2>{repairedMode ? "已修复问题" : "待处理问题"}</h2>
          </div>
          <span className={`risk-badge ${repairedMode ? "fixed" : ""}`}>
            {repairedMode ? `${findings.length} 个已修复` : `${criticalCount} 个严重问题`}
          </span>
        </div>
        <div className="finding-list">
          {findings.map((finding) => (
            <button
              className={`finding-item ${selectedId === finding.id ? "selected" : ""}`}
              key={finding.id}
              type="button"
              onClick={() => setSelectedId(finding.id)}
            >
              <span className={`severity-mark ${finding.severity}`} aria-hidden="true" />
              <span className="finding-copy">
                <span>
                  {finding.failureClass} · {severityLabel(finding.severity)}
                </span>
                <strong>{finding.title}</strong>
              </span>
              {repairedMode ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="tool-panel finding-detail-panel">
        <div className="detail-header">
          <span className={`severity-label ${selected.severity}`}>
            {severityLabel(selected.severity)}风险
          </span>
          <code>{selected.id}</code>
        </div>
        <h2>{selected.title}</h2>
        <p className="detail-lead">{selected.detail}</p>

        <div className="evidence-block">
            <span>判断依据</span>
          <code>{selected.evidence}</code>
        </div>

        <div className="repair-summary">
          <Wrench size={17} aria-hidden="true" />
          <div>
            <span>推荐修复</span>
            <strong>{selected.repair}</strong>
          </div>
        </div>

        {repair && (
          <div className="diff-viewer">
            <div className="diff-head">
              <span>字段修改对比</span>
              <code>{repair.field}</code>
            </div>
            <div className="diff-line removed">
              <span>-</span>
              <code>{repair.before}</code>
            </div>
            <div className="diff-line added">
              <span>+</span>
              <code>{repair.after}</code>
            </div>
            <p>{repair.reason}</p>
            <small>{repair.source}</small>
          </div>
        )}

        {!repairedMode && phase !== "repairing" && (
          <button className="primary-button repair detail-action" type="button" onClick={onRepair}>
            <Wrench size={16} aria-hidden="true" />
            生成全部修复并复测
          </button>
        )}
      </section>

      <aside className="tool-panel repair-plan-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">修复方案</span>
            <h2>修复内容</h2>
          </div>
          <FileJson size={18} aria-hidden="true" />
        </div>
        <div className="repair-plan-list">
          {repairs.map((item, index) => (
            <div className={`repair-plan-row ${repairedMode ? "done" : ""}`} key={item.id}>
              <span>{repairedMode ? <Check size={13} /> : index + 1}</span>
              <div>
                <strong>{item.field}</strong>
                <p>{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="version-box">
          <span>输出版本</span>
          <strong>{repairedMode ? "passport-v2.json" : "passport-v2.draft"}</strong>
          <code>原始资料已保留 · 可撤销</code>
        </div>
      </aside>
    </div>
  );
}

function ReleaseWorkspace({
  report,
  released,
  launchDraft,
  regressionSourceCatalog,
}: {
  report: RunReport;
  released: boolean;
  launchDraft: ListingDraft | null;
  regressionSourceCatalog: ProductPassport[];
}) {
  const [contentConfirmed, setContentConfirmed] = useState(false);
  const [commerceStateConfirmed, setCommerceStateConfirmed] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const regression = useMemo(
    () => runMissionRegression(regressionSourceCatalog, report.mode),
    [regressionSourceCatalog, report.mode],
  );
  const artifacts = useMemo(
    () => buildReleaseArtifacts(
      report,
      launchDraft,
      confirmedAt
        ? { contentConfirmed: true, commerceStateConfirmed: true, confirmedAt }
        : null,
      regression,
    ),
    [confirmedAt, launchDraft, regression, report],
  );
  const releaseReady = released && contentConfirmed && commerceStateConfirmed;

  return (
    <div className="release-grid">
      <section className="tool-panel release-summary-panel">
        <div className={`release-seal ${releaseReady ? "released" : "locked"}`}>
          {releaseReady ? <ShieldCheck size={36} /> : <LockKeyhole size={36} />}
        </div>
        <span className="panel-kicker">Agent 发布准备</span>
        <h2>
          {releaseReady
            ? "修复版本已通过发布检查"
            : released
              ? "技术检查通过，等待人工确认"
              : "发布文件尚未开放"}
        </h2>
        <p>
          {releaseReady
            ? "复测和人工确认都已完成，系统已生成新的发布文件。"
            : released
              ? "同一任务复测已通过。核对商品内容、实时价格、库存和配送状态后，即可下载发布文件。"
            : "原始商品 Feed 未通过攻击防护、信息来源和交易金额检查。"}
        </p>
        <div className="release-score-row">
          <div>
            <span>总分</span>
            <strong>{report.scores.overall}</strong>
          </div>
          <div>
            <span>通过任务</span>
            <strong>{regression.passed}/{regression.total}</strong>
          </div>
          <div>
            <span>复测平均分</span>
            <strong>{regression.averageScore}</strong>
          </div>
        </div>
        {launchDraft && (
          <div className="release-listing-summary">
            <div>
              <span>上新任务</span>
              <strong>{platformLabels[launchDraft.platform]} / {marketLabels[launchDraft.market]}</strong>
            </div>
            <div>
              <span>Listing 版本</span>
              <strong>v{launchDraft.sourceVersion} → v{launchDraft.outputVersion}</strong>
            </div>
            <div>
              <span>平台预检</span>
              <strong className={launchDraft.status === "ready" ? "pass" : "fail"}>{launchDraft.score} 分</strong>
            </div>
            <p>{launchDraft.title}</p>
          </div>
        )}
      </section>

      <section className="tool-panel artifact-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">发布文件</span>
            <h2>可下载文件</h2>
          </div>
          <span className="record-count">{artifacts.length} 个</span>
        </div>
        <div className="artifact-list">
          <div className="release-signoff" aria-label="发布人工确认">
            <div className="subheading">
              <span>人工确认</span>
              <strong className={releaseReady ? "pass" : "pending"}>{releaseReady ? "已完成" : "待确认"}</strong>
            </div>
            <label>
              <input
                type="checkbox"
                checked={contentConfirmed}
                disabled={!released}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setContentConfirmed(checked);
                  setConfirmedAt(checked && commerceStateConfirmed ? new Date().toISOString() : null);
                }}
              />
              <span>我已核对商品内容与目标市场</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={commerceStateConfirmed}
                disabled={!released}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setCommerceStateConfirmed(checked);
                  setConfirmedAt(checked && contentConfirmed ? new Date().toISOString() : null);
                }}
              />
              <span>我已确认价格、库存和配送状态</span>
            </label>
          </div>
          {artifacts.map((artifact) => (
            <div className="artifact-row" key={artifact.name}>
              <span className="artifact-icon">
                <FileJson size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>{artifact.name}</strong>
                <span>{artifact.label} · {formatArtifactSize(artifact.body)}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                title={`下载 ${artifact.name}`}
                disabled={!releaseReady}
                onClick={() => downloadReleaseArtifact(artifact)}
              >
                <Download size={16} aria-hidden="true" />
                <span className="sr-only">下载 {artifact.name}</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      <aside className="tool-panel protocol-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">协议支持情况</span>
            <h2>支持的功能</h2>
          </div>
          <Code2 size={18} aria-hidden="true" />
        </div>
        {[
          ["商品发现", "通过"],
          ["可售状态", "通过"],
          ["配送报价", "通过"],
          ["购物车", "通过"],
          ["模拟结账", released ? "通过" : "未开放"],
          ["订单后续流程", "部分支持"],
        ].map(([label, status]) => (
          <div className="protocol-row" key={label}>
            <span>{label}</span>
            <strong
              className={status === "通过" ? "pass" : status === "未开放" ? "locked" : "partial"}
            >
              {status}
            </strong>
          </div>
        ))}
        <div className="adapter-footer">
          <span>UCP / ACP / MCP</span>
          <code>适配器版本：0.1.0</code>
        </div>
        <div className="regression-suite-list">
          <div className="subheading">
            <span>30 项任务复测</span>
            <strong className={regression.failed === 0 ? "pass" : "fail"}>
              {regression.failed === 0 ? "全量通过" : `${regression.failed} 项失败`}
            </strong>
          </div>
          {regression.suites.map((suite) => (
            <div key={suite.name}>
              <span>{suite.name}</span>
              <strong className={suite.passed === suite.total ? "pass" : "fail"}>
                {suite.passed}/{suite.total}
              </strong>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
