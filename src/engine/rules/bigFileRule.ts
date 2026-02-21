import { Issue, Rule } from "../types";

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