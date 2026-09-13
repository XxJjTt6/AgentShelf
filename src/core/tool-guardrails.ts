import { z } from "zod";

export const commerceToolSchema = z.enum([
  "search_products",
  "get_product",
  "quote_shipping",
  "create_cart",
  "checkout",
  "export_listing",
]);

export type CommerceTool = z.infer<typeof commerceToolSchema>;

export interface ToolGuardrailDecision {
  status: "allowed" | "blocked";
  risk: "read" | "state-changing" | "financial";
  reason: string;
}

export function checkToolGuardrail(
  tool: CommerceTool,
  input: { confirmation?: boolean } = {},
): ToolGuardrailDecision {
  if (tool === "checkout" && input.confirmation !== true) {
    return {
      status: "blocked",
      risk: "financial",
      reason: "高风险结账工具必须获得用户显式确认",
    };
  }
  if (tool === "export_listing" && input.confirmation !== true) {
    return {
      status: "blocked",
      risk: "state-changing",
      reason: "发布文件导出必须获得人工确认",
    };
  }
  return {
    status: "allowed",
    risk: tool === "checkout" ? "financial" : tool === "create_cart" ? "state-changing" : "read",
    reason: "工具调用通过能力和确认策略",
  };
}
