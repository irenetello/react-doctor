import { Issue, Rule } from "../types";

const PROVIDER_VALUE_OBJECT = /<[\w$]+\.(?:Provider)\b[^>]*\bvalue\s*=\s*{\s*{\s*/g;

/**
 * Rule that detects inline object literals passed to a Context Provider `value` prop.
 *
 * In React, creating the provider value inline (for example, `value={{ ... }}`)
 * usually creates a new object on every render, which can re-render all context
 * consumers unnecessarily.
 *
 * Detection strategy:
 * - Only scans `.tsx` and `.jsx` files.
 * - Uses a regex to find `<Something.Provider ... value={{ ... }}` patterns.
 * - Reports one issue per match at the computed line number.
 *
 * Generated issue details:
 * - `id`: combines rule id, file relative path, and line number.
 * - `severity`: `WARN`.
 * - `message`: suggests wrapping the value creation in `useMemo`.
 */
export const contextProviderValueRule: Rule = {
  id: "perf-context-provider-value",
  title: "Context Provider value is an inline object",
  async run(_ctx, files) {
    const issues: Issue[] = [];

    for (const f of files) {
      if (!/\.(t|j)sx$/.test(f.relPath)) {continue;}

      for (const m of f.content.matchAll(PROVIDER_VALUE_OBJECT)) {
        const idx = m.index ?? 0;
        const line = f.content.slice(0, idx).split(/\r?\n/).length;

        issues.push({
          id: `${contextProviderValueRule.id}:${f.relPath}:${line}`,
          severity: "WARN",
          message: "Context Provider value is created inline.review if this provider re-renders frequently (wrap it in useMemo to avoid re-rendering all consumers).",
          filePath: f.path,
          line,
          ruleId: contextProviderValueRule.id,
        });
      }
    }

    return issues;
  },
};