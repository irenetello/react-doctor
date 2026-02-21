import { Issue, Rule } from "../types";

/**
 * Rule that detects files with too many lines.
 *
 * Compares `f.lines.length` against `ctx.maxFileLines` and, when the limit is
 * exceeded, creates a `WARN` issue to encourage splitting the file into
 * smaller pieces (for example, components or hooks).
 *
 * Generated issue details:
 * - `id`: combines the rule id with the file relative path.
 * - `filePath`: absolute path of the analyzed file.
 * - `line`: reported as line 1 as a general file-level reference.
 * - `ruleId`: reference to this rule (`big-file`).
 */
export const bigFileRule: Rule = {
  id: "big-file",
  title: "File too large",
  async run(ctx, files) {
    const issues: Issue[] = [];
    for (const f of files) {
      if (f.lines.length > ctx.maxFileLines) {
        issues.push({
          id: `${bigFileRule.id}:${f.relPath}`,
          severity: "WARN",
          message: `File has ${f.lines.length} lines (limit ${ctx.maxFileLines}). Consider splitting components/hooks.`,
          filePath: f.path,
          line: 1,
          ruleId: bigFileRule.id,
        });
      }
    }
    return issues;
  },
};