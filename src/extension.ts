import * as vscode from "vscode";

import { scanWorkspace } from "./engine/scanWorkspace";
import type { Issue, RuleContext } from "./engine/types";
import { bigFileRule } from "./engine/rules/bigFileRule";
import { imgAltRule } from "./engine/rules/imgAltRule";
import { IssuesProvider } from "./views/issuesProvider";
import { circularDepsRule } from "./engine/rules/circularDepsRule";
import { calculateHealthScore } from "./engine/healthScore";

let lastIssues: Issue[] = [];

export function activate(context: vscode.ExtensionContext) {
  const provider = new IssuesProvider();
  vscode.window.registerTreeDataProvider("reactDoctorIssues", provider);

  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.scan", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage("Open a folder/workspace first.");
        return;
      }

      const cfg = vscode.workspace.getConfiguration("reactDoctor");
      const ctx: RuleContext = {
        rootPath: root,
        maxFileLines: cfg.get("maxFileLines", 300),
      };

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "React Doctor scanning..." },
        async () => {
          const issues = await scanWorkspace([bigFileRule, imgAltRule, circularDepsRule], ctx);
          const health = calculateHealthScore(issues);

          provider.setIssues(issues, health);
          lastIssues = issues;

          vscode.window.showInformationMessage(
            `React Doctor: ${health.score}/100 — ${health.label} (${issues.length} issues)`
          );
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.exportReport", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage("Open a folder/workspace first.");
        return;
      }

      if (!lastIssues.length) {
        vscode.window.showInformationMessage("No issues to export. Run a scan first.");
        return;
      }

      const lines: string[] = [];
      lines.push(`# React Doctor Report`);
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push("");

      const bySeverity = ["ERROR", "WARN", "INFO"] as const;
      for (const s of bySeverity) {
        const items = lastIssues.filter((i) => i.severity === s);
        lines.push(`## ${s} (${items.length})`);

        if (!items.length) {
          lines.push(`- None`);
        } else {
          for (const it of items) {
            const loc = it.line ? `:${it.line}` : "";
            lines.push(`- **${it.ruleId}** — ${it.message} \`${it.filePath}${loc}\``);
          }
        }

        lines.push("");
      }

      const uri = vscode.Uri.joinPath(vscode.Uri.file(root), "react-doctor-report.md");

      await vscode.workspace.fs.writeFile(uri, Buffer.from(lines.join("\n"), "utf8"));

      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.openIssue", async (node: any) => {
      const issue = node?.issue ?? node;

      if (!issue?.filePath) {
        vscode.window.showErrorMessage("React Doctor: invalid issue payload.");
        return;
      }

      const uri = vscode.Uri.file(issue.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, { preview: true });

      const lineNum = Number(issue.line);
      if (Number.isFinite(lineNum) && lineNum > 0) {
        const pos = new vscode.Position(lineNum - 1, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.fixImgAlt", async (node: any) => {
      const issue: Issue | undefined = node?.issue ?? node;

      if (!issue?.filePath) {
        vscode.window.showErrorMessage("React Doctor: could not resolve issue payload.");
        return;
      }

      const uri = vscode.Uri.file(issue.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });

      const lineIndex = Math.max(0, (issue.line ?? 1) - 1);
      if (lineIndex >= doc.lineCount) {
        vscode.window.showErrorMessage("React Doctor: issue line is out of range.");
        return;
      }

      const line = doc.lineAt(lineIndex);
      const lineText = line.text;

      if (!lineText.includes("<img")) {
        vscode.window.showInformationMessage("React Doctor: no <img> found on that line.");
        return;
      }
      if (/\balt\s*=/.test(lineText)) {
        vscode.window.showInformationMessage("React Doctor: alt already present.");
        return;
      }

      const newLine = lineText.replace(/<img\b/, '<img alt=""');

      await editor.edit((editBuilder) => {
        editBuilder.replace(line.range, newLine);
      });
    })
  );
}

export function deactivate() {}