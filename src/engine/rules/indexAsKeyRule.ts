import { Issue, Rule } from "../types";

const INDEX_KEY = /\bkey\s*=\s*{\s*(?:index|i|idx)\s*}/g;

/**
 * Rule that detects usage of array indexes as React `key` values.
 *
 * Using positional indexes (for example, `key={index}`) can make list identity
 * unstable when items are inserted, removed, or reordered, which may lead to
 * incorrect state preservation and unnecessary re-renders.
 *
 * Detection strategy:
 * - Only scans `.tsx` and `.jsx` files.
 * - Uses a regex to find `key={index}`, `key={i}`, or `key={idx}` patterns.
 * - Reports one issue per match at the computed line number.
 *
 * Generated issue details:
 * - `id`: combines rule id, file relative path, and line number.
 * - `severity`: `WARN`.
 * - `message`: recommends using a stable identifier instead.
 */
export const indexAsKeyRule: Rule = {
  id: "perf-index-as-key",
  title: "Array index used as key",
  async run(_ctx, files) {
    const issues: Issue[] = [];

    for (const f of files) {
      if (!/\.(t|j)sx$/.test(f.relPath)) {continue;}

      for (const m of f.content.matchAll(INDEX_KEY)) {
        const idx = m.index ?? 0;
        const line = f.content.slice(0, idx).split(/\r?\n/).length;

        issues.push({
          id: `${indexAsKeyRule.id}:${f.relPath}:${line}`,
          severity: "WARN",
          message: "Using array index as key can cause unstable renders and state bugs. Prefer a stable id.",
          filePath: f.path,
          line,
          ruleId: indexAsKeyRule.id,
        });
      }
    }

    return issues;
  },
};