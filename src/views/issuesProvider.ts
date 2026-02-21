import * as vscode from "vscode";
import { Issue, Severity } from "../engine/types";

type Node = GroupItem | IssueItem | HealthItem;
type Health = { score: number; label: string } | null;

export class IssuesProvider implements vscode.TreeDataProvider<Node> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private issues: Issue[] = [];
  private health: Health = null;

  setIssues(issues: Issue[], health?: Health) {
    this.issues = issues;
    this.health = health ?? null;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Node): Node[] {
    if (!element) {
      const nodes: Node[] = [];

      if (this.health) {
        nodes.push(new HealthItem(this.health));
      }

      const groups: Severity[] = ["ERROR", "WARN", "INFO"];
      nodes.push(
        ...groups.map((s) => new GroupItem(s, this.issues.filter((i) => i.severity === s)))
      );

      return nodes;
    }

    if (element instanceof GroupItem) {
      return element.issues.map((i) => new IssueItem(i));
    }

    return [];
  }
}

class GroupItem extends vscode.TreeItem {
  constructor(public readonly severity: Severity, public readonly issues: Issue[]) {
    super(`${severity} (${issues.length})`, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(
      severity === "ERROR" ? "error" : severity === "WARN" ? "warning" : "info"
    );
  }
}

class IssueItem extends vscode.TreeItem {
  constructor(public readonly issue: Issue) {
    super(issue.message, vscode.TreeItemCollapsibleState.None);

    this.description = `${shortPath(issue.filePath)}${issue.line ? `:${issue.line}` : ""}`;
    this.tooltip = `${issue.ruleId}\n${issue.filePath}${issue.line ? `:${issue.line}` : ""}`;
    this.contextValue = issue.ruleId;
    this.command = { command: "reactDoctor.openIssue", title: "Open issue", arguments: [this] };
  }
}

function shortPath(p: string) {
  const parts = p.split(/[/\\]/);
  return parts.slice(-2).join("/");
}

class HealthItem extends vscode.TreeItem {
  constructor(health: { score: number; label: string }) {
    super(`Health Score: ${health.score}/100 — ${health.label}`, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("heart");
  }
}