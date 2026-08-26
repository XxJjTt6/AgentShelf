import { afterEach, describe, expect, it, vi } from "vitest";
import { qwenConfig, qwenModelOptions, resolveQwenModel } from "./qwen";

describe("Qwen 模型选择", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("优先使用环境变量中配置的模型白名单", () => {
    vi.stubEnv("DASHSCOPE_MODEL", "qwen3.8-max");
    vi.stubEnv("DASHSCOPE_MODEL_OPTIONS", "qwen3.8-max, qwen-plus, qwen-flash");

    expect(qwenModelOptions()).toEqual(["qwen3.8-max", "qwen-plus", "qwen-flash"]);
    expect(qwenConfig("qwen-plus").model).toBe("qwen-plus");
  });

  it("拒绝白名单以外的模型", () => {
    vi.stubEnv("DASHSCOPE_MODEL_OPTIONS", "qwen3.8-max,qwen-plus");

    expect(() => resolveQwenModel("unknown-model")).toThrow("不支持所选的 Qwen 模型");
  });
});
