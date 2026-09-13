/**
 * A small, deterministic harness for the demo's cooperating agents.
 * It keeps untrusted catalog content separate from tool authority and makes
 * every stage auditable without claiming a general-purpose autonomous agent.
 */
export type AgentRole = "catalog" | "listing" | "risk" | "release";
export type HarnessCapability = "read-catalog" | "draft-listing" | "audit" | "export";

export interface HarnessStage {
  id: string;
  role: AgentRole;
  capability: HarnessCapability;
  detail: string;
}

export interface HarnessPolicy {
  maxStages: number;
  allowExport: boolean;
}

export interface HarnessTrace {
  status: "passed" | "blocked";
  stages: HarnessStage[];
  blockedReason: string | null;
}

const roleCapabilities: Record<AgentRole, HarnessCapability[]> = {
  catalog: ["read-catalog"],
  listing: ["draft-listing"],
  risk: ["audit"],
  release: ["export"],
};

const defaultPolicy: HarnessPolicy = { maxStages: 6, allowExport: true };

export function runAgentHarness(
  stages: HarnessStage[],
  policy: Partial<HarnessPolicy> = {},
): HarnessTrace {
  const resolved = { ...defaultPolicy, ...policy };
  if (stages.length > resolved.maxStages) {
    return {
      status: "blocked",
      stages: [],
      blockedReason: `Harness stage budget exceeded: ${stages.length}/${resolved.maxStages}`,
    };
  }

  for (const stage of stages) {
    if (!roleCapabilities[stage.role].includes(stage.capability)) {
      return {
        status: "blocked",
        stages: stages.slice(0, stages.indexOf(stage)),
        blockedReason: `${stage.role} agent is not authorized for ${stage.capability}`,
      };
    }
    if (stage.capability === "export" && !resolved.allowExport) {
      return {
        status: "blocked",
        stages: stages.slice(0, stages.indexOf(stage)),
        blockedReason: "Release export requires explicit harness approval",
      };
    }
  }

  return { status: "passed", stages, blockedReason: null };
}

export const catalogListingHarness = runAgentHarness([
  { id: "catalog-read", role: "catalog", capability: "read-catalog", detail: "读取商品事实和来源" },
  { id: "listing-draft", role: "listing", capability: "draft-listing", detail: "生成带证据的上架草稿" },
  { id: "risk-audit", role: "risk", capability: "audit", detail: "检查注入、事实和商业状态" },
  { id: "release-gate", role: "release", capability: "export", detail: "通过人工确认后导出" },
]);
