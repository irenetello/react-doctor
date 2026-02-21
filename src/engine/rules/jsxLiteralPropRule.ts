import { Issue, Rule } from "../types";

const OBJECT_LITERAL_PROP = /=\s*{\s*{\s*[^}]*}\s*}/g; // ={{ ... }}
const ARRAY_LITERAL_PROP = /=\s*{\s*\[\s*[^\]]*\]\s*}/g; // ={[ ... ]}

/**
 * Rule that detects object and array literals passed inline as JSX props.
 *
 * Inline literals (for example, `prop={{...}}` or `prop={[...]}`) create a new
 * reference on every render. This can reduce memoization effectiveness and
 * trigger avoidable re-renders in child components.
 *
 * Detection strategy:
 * - Only scans `.tsx` and `.jsx` files.
 * - Uses separate regex patterns for object-literal and array-literal props.
 * - Reports one issue per match at the computed line number.
 *
 * Generated issue details:
 * - `id`: combines rule id, label, file relative path, and line number.
 * - `severity`: `INFO`.
 * - `message`: recommends `useMemo` or moving constants outside render.
 */
export const jsxLiteralPropRule: Rule = {
  id: "perf-jsx-literal-prop",
  title: "Object/array literal passed as JSX prop",
  async run(_ctx, files) {
    const issues: Issue[] = [];

    for (const f of files) {
      if (!/\.(t|j)sx$/.test(f.relPath)) {continue;}

      const addMatches = (re: RegExp, label: string) => {
        for (const m of f.content.matchAll(re)) {
          const idx = m.index ?? 0;
          const line = f.content.slice(0, idx).split(/\r?\n/).length;

          issues.push({
            id: `${jsxLiteralPropRule.id}:${label}:${f.relPath}:${line}`,
            severity: "INFO",
            message: `${label} created inline can cause re-renders due to new reference each render. Consider useMemo or moving constant outside.`,
            filePath: f.path,
            line,
            ruleId: jsxLiteralPropRule.id,
          });
        }
      };

      addMatches(OBJECT_LITERAL_PROP, "Object literal prop");
      addMatches(ARRAY_LITERAL_PROP, "Array literal prop");
    }

    return issues;
  },
};