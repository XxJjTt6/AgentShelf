import type { RunReport } from "./types";

export interface AgentSpan {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  agentName: string;
  operation: "invoke_workflow" | "invoke_agent" | "execute_tool" | "guardrail";
  toolName?: string;
  model?: string;
  status: "ok" | "blocked" | "error";
  attributes: Record<string, string | number | boolean>;
}

export interface AgentTrace {
  traceId: string;
  workflowName: string;
  schemaUrl: "https://opentelemetry.io/schemas/gen-ai/1.42.0";
  spans: AgentSpan[];
}

export function buildAgentTrace(report: RunReport): AgentTrace {
  const traceId = `trace_${report.id.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 40);
  const workflowSpan = `span_${report.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const spans: AgentSpan[] = [{
    spanId: workflowSpan,
    traceId,
    parentSpanId: null,
    agentName: "agentshelf-orchestrator",
    operation: "invoke_workflow",
    model: report.model,
    status: report.mode === "baseline" ? "blocked" : "ok",
    attributes: {
      "gen_ai.workflow.name": "cross_border_listing_preflight",
      "gen_ai.request.model": report.model,
      "agentshelf.run.mode": report.mode,
    },
  }];

  for (const stage of report.harness?.stages ?? []) {
    const spanId = `span_${stage.id}`;
    spans.push({
      spanId,
      traceId,
      parentSpanId: workflowSpan,
      agentName: `${stage.role}-agent`,
      operation: stage.capability === "audit" ? "guardrail" : "invoke_agent",
      status: "ok",
      attributes: {
        "gen_ai.agent.name": `${stage.role}-agent`,
        "agentshelf.capability": stage.capability,
        "agentshelf.stage.detail": stage.detail,
      },
    });
  }

  for (const event of report.events) {
    spans.push({
      spanId: `span_${event.id}`,
      traceId,
      parentSpanId: workflowSpan,
      agentName: event.source,
      operation: event.status === "risk" || event.status === "blocked" ? "guardrail" : "execute_tool",
      toolName: event.source,
      status: event.status === "blocked" ? "blocked" : event.status === "risk" ? "error" : "ok",
      attributes: {
        "gen_ai.tool.name": event.source,
        "agentshelf.step": event.step,
        "agentshelf.duration_ms": event.durationMs,
      },
    });
  }

  return { traceId, workflowName: "cross_border_listing_preflight", schemaUrl: "https://opentelemetry.io/schemas/gen-ai/1.42.0", spans };
}
