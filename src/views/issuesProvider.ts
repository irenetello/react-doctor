import * as vscode from "vscode";
import type { Issue } from "../engine/types";

export class IssuesProvider implements vscode.TreeDataProvider<IssueItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<IssueItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: IssueItem[] = [];

  setIssues(issues: Issue[]) {
    this.items = issues.map((i) => new IssueItem(i));
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: IssueItem): vscode.TreeItem {
    return element;
  }

  getChildren(): IssueItem[] {
    return this.items;
  }
}

class IssueItem extends vscode.TreeItem {
  constructor(public readonly issue: Issue) {
    super(issue.message, vscode.TreeItemCollapsibleState.None);

    this.description = `${shortPath(issue.filePath)}${issue.line ? `:${issue.line}` : ""}`;
    this.tooltip = `${issue.ruleId}\n${issue.filePath}${issue.line ? `:${issue.line}` : ""}`;

    this.contextValue = issue.ruleId; // <- clave para el menú
    this.command = { command: "reactDoctor.openIssue", title: "Open issue", arguments: [this] };
  }
}

function shortPath(p: string) {
  const parts = p.split(/[/\\]/);
  return parts.slice(-2).join("/");
}