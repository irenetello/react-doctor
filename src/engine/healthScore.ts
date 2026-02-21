import { Issue } from "./types";

export function calculateHealthScore(issues: Issue[]) {
  let score = 100;

  for (const i of issues) {
    if (i.severity === "ERROR") {score -= 10; }
    else if (i.severity === "WARN") {score -= 5; }
    else {score -= 1; }
  }

  score = Math.max(0, score);

  let label = "Excellent";
  if (score < 90) {label = "Good"; }
  if (score < 70) {label = "Risky"; }
  if (score < 40) {label = "Critical"; }

  return { score, label };
}