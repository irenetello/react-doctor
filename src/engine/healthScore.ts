import { Issue } from "./types";

function logPenalty(count: number, weight: number) {
  if (count === 0) {return 0;}
  return weight * Math.log2(count + 1);
}

export function calculateHealthScore(issues: Issue[]) {
  let score = 100;

  const errors = issues.filter((i) => i.severity === "ERROR").length;
  const warns = issues.filter((i) => i.severity === "WARN").length;

  const infoByRule = new Map<string, number>();
  for (const i of issues) {
    if (i.severity === "INFO") {
      infoByRule.set(i.ruleId, (infoByRule.get(i.ruleId) ?? 0) + 1);
    }
  }

  const errorPenalty = Math.min(60, errors * 20);
  const warnPenalty = Math.min(25, warns * 5);

  let infoPenalty = 0;
  for (const count of infoByRule.values()) {
    infoPenalty += logPenalty(count, 2);
  }
  infoPenalty = Math.min(15, infoPenalty);

  score -= errorPenalty + warnPenalty + infoPenalty;
  score = Math.max(0, Math.round(score));

  let label = "Excellent";
  if (score < 85) {label = "Good"; }
  if (score < 65) {label = "Risky"; }
  if (score < 40) {label = "Critical"; }

  return { score, label };
}