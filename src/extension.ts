import * as vscode from "vscode";

import { scanWorkspace } from "./engine/scanWorkspace";
import type { Issue, RuleContext } from "./engine/types";
import { IssuesProvider } from "./views/issuesProvider";

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
          const issues = await scanWorkspace([], ctx); // baseline: sin reglas
          provider.setIssues(issues);
          vscode.window.showInformationMessage(`React Doctor: ${issues.length} issues found.`);
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.openIssue", async (node: any) => {
      const issue: Issue | undefined = node?.issue ?? node;

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
}

export function deactivate() {}