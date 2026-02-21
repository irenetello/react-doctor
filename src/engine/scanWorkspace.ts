import * as vscode from "vscode";
import * as path from "path";
import { Issue, Rule, RuleContext, ScannedFile } from "./types";

const EXCLUDES = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**"];

export async function scanWorkspace(rules: Rule[], ctx: RuleContext): Promise<Issue[]> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {return []; }

  const files = await vscode.workspace.findFiles(
    "{src,app,components}/**/*.{ts,tsx,js,jsx}",
    `{${EXCLUDES.join(",")}}`
  );

  const scanned: ScannedFile[] = [];
  for (const uri of files) {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(bytes).toString("utf8");
    scanned.push({
      path: uri.fsPath,
      relPath: path.relative(root, uri.fsPath),
      content,
      lines: content.split(/\r?\n/),
    });
  }

  const issues: Issue[] = [];
  for (const rule of rules) {
    issues.push(...(await rule.run(ctx, scanned)));
  }

  const order = { ERROR: 2, WARN: 1, INFO: 0 } as const;
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.filePath.localeCompare(b.filePath));
  return issues;
}