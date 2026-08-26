import { runDemo } from "@/core/engine";
import { qwenConfig } from "@/lib/qwen";
import { AgentShelfConsole } from "@/components/AgentShelfConsole";

export default function Home() {
  const model = qwenConfig();
  return (
    <AgentShelfConsole
      baseline={runDemo("baseline")}
      repaired={runDemo("repaired")}
      model={{ configured: model.configured, name: model.model, options: model.models }}
    />
  );
}
