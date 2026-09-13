import { describe, expect, it } from "vitest";
import { buildAgentTrace } from "./agent-trace";
import { runDemo } from "./engine";

describe("agent trace", () => {
  it("emits workflow, agent and guardrail spans with stable IDs", () => {
    const trace = buildAgentTrace(runDemo("baseline"));
    expect(trace.schemaUrl).toContain("opentelemetry.io/schemas/gen-ai");
    expect(trace.spans.some((span) => span.operation === "invoke_workflow")).toBe(true);
    expect(trace.spans.some((span) => span.operation === "guardrail")).toBe(true);
    expect(new Set(trace.spans.map((span) => span.spanId)).size).toBe(trace.spans.length);
  });
});
