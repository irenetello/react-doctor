import * as vscode from "vscode";
import { Issue, Severity } from "../engine/types";

type Health = { score: number; label: string } | null;

type Node = GroupItem | IssueItem | HealthItem | ToggleInfoItem;

export class IssuesProvider implements vscode.TreeDataProvider<Node> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private issues: Issue[] = [];
  private health: Health = null;

  private showAllInfo = false;

  toggleShowAllInfo() {
    this.showAllInfo = !this.showAllInfo;
    this._onDidChangeTreeData.fire(undefined);
  }

  setIssues(issues: Issue[], health?: Health) {
    const seen = new Set<string>();
    this.issues = issues.filter((i) => {
      const k = `${i.severity}|${i.ruleId}|${i.filePath}|${i.line ?? ""}|${i.message}`;
      if (seen.has(k)) {return false;}
      seen.add(k);
      return true;
    });

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
      if (element.severity === "INFO") {
        const total = element.issues.length;
        const limit = 20;

        const visible = this.showAllInfo ? element.issues : element.issues.slice(0, limit);

        const nodes: Node[] = visible.map((i) => new IssueItem(i));

        if (total > limit) {
          nodes.unshift(
            new ToggleInfoItem(
              this.showAllInfo ? `Show less (top ${limit})` : `Show all INFO (${total})`,
              this.showAllInfo ? "collapse" : "expand"
            )
          );
        }

        return nodes;
      }
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

class ToggleInfoItem extends vscode.TreeItem {
  constructor(label: string, mode: "expand" | "collapse") {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: "reactDoctor.toggleInfo",
      title: "Toggle INFO",
    };
    this.contextValue = "toggleInfo";
    this.iconPath =
      mode === "expand"
        ? new vscode.ThemeIcon("chevron-down")
        : new vscode.ThemeIcon("chevron-up");
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
    this.tooltip = "Weighted score by severity. Low-severity issues use logarithmic decay to prevent noise dominating the metric.";
    this.description = "Weighted severity + log decay";
  }
}