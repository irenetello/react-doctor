import { Severity } from "../engine/types";

export interface IssueLike {
  severity: Severity;
}

export interface Snapshot {
  score: number;
  penalty: number;
  issueCount: number;
}

const weights: Record<Severity, number> = {
  ERROR: 10,
  WARN: 5,
  INFO: 1,
};

export function computeSnapshot(issues: IssueLike[]): Snapshot {
  const penalty = issues.reduce(
    (acc, i) => acc + (weights[i.severity] ?? 0),
    0
  );

  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    penalty,
    issueCount: issues.length,
  };
}

export function computeImprovement(before: Snapshot, after: Snapshot) {
  const deltaScore = after.score - before.score;
  const base = Math.max(1, before.score);
  const pct = Math.round((deltaScore / base) * 100);

  return {
    deltaScore,
    pct,
    deltaIssues: after.issueCount - before.issueCount,
  };
}