import { Issue, Rule } from "../types";

/**
 * Rule: tabIndex misuse (positive values)
 *
 * This rule scans JSX/TSX files for `tabIndex` props with literal positive numbers.
 * It uses a regex (`TAB_INDEX`) to find `tabIndex={...}` or `tabIndex="..."` assignments.
 * The helper `extractNumericValue` converts matched values to numbers and ignores variables/expressions.
 * If a positive number (>0) is found, an issue is recorded with file path and line number.
 * Purpose: ensure accessible keyboard navigation by recommending 0 or -1 instead of positive tabIndex.
 */

const TAB_INDEX = /\btabIndex\s*=\s*(\{[^}]+\}|["'][^"']+["'])/gi;

function extractNumericValue(raw: string): number | null {
    // Remove wrapping { } or quotes
    const cleaned = raw
        .replace(/^\{|\}$/g, "")
        .replace(/^["']|["']$/g, "")
        .trim();

    // Only flag literal numbers
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : null;
}

export const tabIndexMisuseRule: Rule = {
    id: "tabindex-misuse",
    title: "tabIndex misuse (positive values)",

    async run(_ctx, files) {
        const issues: Issue[] = [];

        for (const f of files) {
            if (!f.relPath.endsWith(".tsx") && !f.relPath.endsWith(".jsx")) {
                continue;
            }

            const matches = f.content.matchAll(TAB_INDEX);

            for (const m of matches) {
                const rawValue = m[1];
                const value = extractNumericValue(rawValue);

                // Ignore non-literals (variables, expressions)
                if (value === null) continue;

                // Only flag positive tabindex
                if (value > 0) {
                    const idx = m.index ?? 0;
                    const line =
                        f.content.slice(0, idx).split(/\r?\n/).length;

                    issues.push({
                        id: `${tabIndexMisuseRule.id}:${f.relPath}:${line}`,
                        severity: "WARN",
                        message: `Avoid positive tabIndex (${value}). Use 0 or -1 instead.`,
                        filePath: f.path,
                        line,
                        ruleId: tabIndexMisuseRule.id,
                    });
                }
            }
        }

        return issues;
    },
};