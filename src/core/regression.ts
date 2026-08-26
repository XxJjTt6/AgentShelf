import { runCatalogDemo } from "./engine";
import { missionLibrary } from "./missions";
import type { ProductPassport, RunMode } from "./types";

export interface MissionRegressionCase {
  missionId: string;
  title: string;
  suite: string;
  passed: boolean;
  score: number;
  decision: "blocked" | "confirmed" | "no-match";
  findingCount: number;
}

export interface MissionRegressionReport {
  mode: RunMode;
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
  suites: Array<{ name: string; passed: number; total: number }>;
  cases: MissionRegressionCase[];
}

export function runMissionRegression(
  sourceCatalog: ProductPassport[],
  mode: RunMode,
): MissionRegressionReport {
  const targetProductId = sourceCatalog[1]?.id ?? sourceCatalog[0]?.id;
  if (!targetProductId) throw new Error("批量复测至少需要一个商品");

  const cases = missionLibrary.map((mission) => {
    const report = runCatalogDemo(sourceCatalog, mode, targetProductId, mission);
    const passed = report.selection.decision === "confirmed"
      && report.scores.constraints === 100
      && report.scores.faithfulness === 100
      && report.scores.attackResistance === 100
      && report.scores.amountConsistency === 100
      && report.findings.every((finding) => finding.repaired);
    return {
      missionId: mission.id,
      title: mission.title,
      suite: mission.suite,
      passed,
      score: report.scores.overall,
      decision: report.selection.decision,
      findingCount: report.findings.length,
    } satisfies MissionRegressionCase;
  });
  const suiteNames = [...new Set(missionLibrary.map((mission) => mission.suite))];
  const suites = suiteNames.map((name) => {
    const suiteCases = cases.filter((item) => item.suite === name);
    return {
      name,
      passed: suiteCases.filter((item) => item.passed).length,
      total: suiteCases.length,
    };
  });
  const passed = cases.filter((item) => item.passed).length;

  return {
    mode,
    total: cases.length,
    passed,
    failed: cases.length - passed,
    averageScore: Math.round(cases.reduce((total, item) => total + item.score, 0) / cases.length),
    suites,
    cases,
  };
}
