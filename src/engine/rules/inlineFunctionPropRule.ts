import { Issue, Rule } from "../types";
import { getOpeningTagName, isReactComponentTag } from "./jsxTagUtils";

const INLINE_HANDLER = /\bon[A-Z][A-Za-z0-9]*\s*=\s*{\s*(?:\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>|function\b)/g;

/**
 * Rule that detects inline function expressions passed to JSX event props.
 *
 * Inline handlers such as `onClick={() => ...}` or `onChange={function ...}`
 * create a new function on each render. In frequently updated trees, this can
 * increase re-renders in child components and reduce memoization effectiveness.
 *
 * Detection strategy:
 * - Only scans `.tsx` and `.jsx` files.
 * - Uses a regex to find `onXxx={...}` assignments where the value starts with
 *   an arrow function or `function` expression.
 * - Reports only when the prop appears inside a React component tag (starts
 *   with uppercase), ignoring native HTML tags.
 * - Reports one issue per match at the computed line number.
 *
 * Generated issue details:
 * - `id`: combines rule id, file relative path, and line number.
 * - `severity`: `INFO`.
 * - `message`: suggests `useCallback` or moving handlers outside render.
 */
export const inlineFunctionPropRule: Rule = {
  id: "perf-inline-function-prop",
  title: "Inline function passed as JSX prop",
  async run(_ctx, files) {
    const issues: Issue[] = [];

    for (const f of files) {
      if (!/\.(t|j)sx$/.test(f.relPath)) {continue;}

      for (const m of f.content.matchAll(INLINE_HANDLER)) {
        const idx = m.index ?? 0;
        const tagName = getOpeningTagName(f.content, idx);

        if (!isReactComponentTag(tagName)) {
          continue;
        }

        const line = f.content.slice(0, idx).split(/\r?\n/).length;

        issues.push({
          id: `${inlineFunctionPropRule.id}:${f.relPath}:${line}`,
          severity: "INFO",
          message: "Inline function prop may cause avoidable re-renders in memoized children. Review if this is on a hot render path.",
          filePath: f.path,
          line,
          ruleId: inlineFunctionPropRule.id,
        });
      }
    }

    return issues;
  },
};