import * as vscode from "vscode";

import { scanWorkspace } from "./engine/scanWorkspace";
import type { Issue, RuleContext } from "./engine/types";
import { bigFileRule } from "./engine/rules/bigFileRule";
import { imgAltRule } from "./engine/rules/imgAltRule";
import { IssuesProvider } from "./views/issuesProvider";
import { circularDepsRule } from "./engine/rules/circularDepsRule";
import { calculateHealthScore } from "./engine/healthScore";
import { inlineFunctionPropRule } from "./engine/rules/inlineFunctionPropRule";
import { jsxLiteralPropRule } from "./engine/rules/jsxLiteralPropRule";
import { indexAsKeyRule } from "./engine/rules/indexAsKeyRule";
import { contextProviderValueRule } from "./engine/rules/contextProviderValueRule";
import { missingAnchorHrefRule } from "./engine/rules/missingAnchorHrefRule";
import { buttonAccessibleNameRule } from "./engine/rules/buttonAccessibleNameRule";
import { keyboardNavigationRule } from "./engine/rules/keyboardNavigationRule";

let lastIssues: Issue[] = [];

type Snapshot = {
  score: number;
  label: string;
  issueCount: number;
};

let baseline: Snapshot | null = null;
let statusBar: vscode.StatusBarItem | null = null;

function makeSnapshot(issues: Issue[]): Snapshot {
  const health = calculateHealthScore(issues);
  return {
    score: health.score,
    label: health.label,
    issueCount: issues.length,
  };
}

function formatDelta(before: Snapshot, after: Snapshot) {
  const deltaScore = after.score - before.score;
  const base = Math.max(1, before.score);
  const pct = Math.round((deltaScore / base) * 100);
  const deltaIssues = after.issueCount - before.issueCount;

  return { deltaScore, pct, deltaIssues };
}

function getRules() {
  return [
    bigFileRule,
    imgAltRule,
    circularDepsRule,
    inlineFunctionPropRule,
    jsxLiteralPropRule,
    indexAsKeyRule,
    contextProviderValueRule,
  ];
}

async function runScanAndUpdateUI(
  provider: IssuesProvider,
  ctx: RuleContext,
  opts?: { showToast?: boolean; updateBaseline?: boolean }
) {
  const issues = await scanWorkspace(getRules(), ctx);
  const snap = makeSnapshot(issues);

  // baseline solo la primera vez (o si te interesa resetearla)
  if (!baseline || opts?.updateBaseline) {
    baseline = snap;
  }

  provider.setIssues(issues, { score: snap.score, label: snap.label });
  lastIssues = issues;

  if (statusBar) {
    statusBar.text = `React Doctor: ${snap.score}/100 — ${snap.label}`;
  }

  if (opts?.showToast) {
    const b = baseline ?? snap;
    const { pct } = formatDelta(b, snap);

    // Si baseline == snap, pct será 0: bien.
    vscode.window.showInformationMessage(
      `React Doctor: ${snap.score}/100 — ${snap.label} (${issues.length} issues) · Δ ${pct >= 0 ? "+" : ""}${pct}%`
    );
  }

  return { issues, snap };
}

function isSameFile(issue: Issue, doc: vscode.TextDocument) {
  return issue.filePath === doc.uri.fsPath;
}

/**
 * Safe fix: img-alt
 * Inserta alt="" en el primer <img ...> de la línea si no existe ya alt=.
 */
function buildImgAltEditForLine(
  doc: vscode.TextDocument,
  oneBasedLine: number
): { range: vscode.Range; newText: string } | null {
  const lineIndex = Math.max(0, oneBasedLine - 1);
  if (lineIndex >= doc.lineCount) {return null;}

  const line = doc.lineAt(lineIndex);
  const text = line.text;

  if (!text.includes("<img")) {return null;}
  if (/\balt\s*=/.test(text)) {return null;}

  const newLine = text.replace(/<img\b/, '<img alt=""');
  return { range: line.range, newText: newLine };
}

/**
 * Safe-ish fix: perf-index-as-key
 * Reemplaza key={index|i|idx} por key={item.id} SOLO si detecta un .map((item, index) => cerca.
 * Si no puede inferir el itemName, no toca nada (para no romper).
 */
function buildIndexAsKeyEditForLine(
  doc: vscode.TextDocument,
  oneBasedLine: number
): { range: vscode.Range; newText: string } | null {
  const lineIndex = Math.max(0, oneBasedLine - 1);
  if (lineIndex >= doc.lineCount) {return null;}

  // Línea donde está el key
  const keyLine = doc.lineAt(lineIndex);
  const keyText = keyLine.text;

  const keyMatch = keyText.match(/\bkey\s*=\s*{\s*(index|i|idx)\s*}/);
  if (!keyMatch) {return null;}

  const indexVar = keyMatch[1];

  // Busca hacia arriba 3 líneas una firma tipo: .map((item, index) =>
  // (hackathon-grade, pero robusto y no rompe si no lo encuentra)
  const lookback = 3;
  let itemName: string | null = null;

  for (let i = lineIndex; i >= 0 && i >= lineIndex - lookback; i--) {
    const t = doc.lineAt(i).text;

    // .map((item, index) =>
    const m =
      t.match(
        /\.map\s*\(\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*=>/
      ) ||
      // .map(function(item, index) {
      t.match(
        /\.map\s*\(\s*function\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*/
      );

    if (m) {
      const candidateItem = m[1];
      const candidateIndex = m[2];

      if (candidateIndex === indexVar) {
        itemName = candidateItem;
        break;
      }
    }
  }

  if (!itemName) {return null;}

  const newLine = keyText.replace(
    /\bkey\s*=\s*{\s*(index|i|idx)\s*}/,
    `key={${itemName}.id}`
  );

  if (newLine === keyText) {return null;}
  return { range: keyLine.range, newText: newLine };
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new IssuesProvider();
  vscode.window.registerTreeDataProvider("reactDoctorIssues", provider);

  // Status bar (wow instantáneo)
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBar.text = "React Doctor: --";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Toggle info
  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.toggleInfo", () => {
      provider.toggleShowAllInfo();
    })
  );

  // Scan workspace
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
        {
          location: vscode.ProgressLocation.Notification,
          title: "React Doctor scanning...",
        },
        async () => {

          const prev = baseline;
          const { issues, snap } = await runScanAndUpdateUI(provider, ctx);

          // Si ya había baseline, mostramos delta vs baseline
          if (prev) {
            const { pct } = formatDelta(prev, snap);
            vscode.window.showInformationMessage(
              `React Doctor: ${snap.score}/100 — ${snap.label} (${issues.length} issues) · Δ ${pct >= 0 ? "+" : ""}${pct}%`
            );
          } else {
            vscode.window.showInformationMessage(
              `React Doctor: ${snap.score}/100 — ${snap.label} (${issues.length} issues)`
            );
          }
        }
      );
    })
  );

  // Export report (igual que antes)
  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.exportReport", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage("Open a folder/workspace first.");
        return;
      }

      if (!lastIssues.length) {
        vscode.window.showInformationMessage(
          "No issues to export. Run a scan first."
        );
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
            lines.push(
              `- **${it.ruleId}** — ${it.message} \`${it.filePath}${loc}\``
            );
          }
        }

        lines.push("");
      }

      const uri = vscode.Uri.joinPath(
        vscode.Uri.file(root),
        "react-doctor-report.md"
      );

      await vscode.workspace.fs.writeFile(
        uri,
        Buffer.from(lines.join("\n"), "utf8")
      );

      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    })
  );

  // Open issue
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "reactDoctor.openIssue",
      async (node: any) => {
        const issue = node?.issue ?? node;

        if (!issue?.filePath) {
          vscode.window.showErrorMessage(
            "React Doctor: invalid issue payload."
          );
          return;
        }

        const uri = vscode.Uri.file(issue.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, {
          preview: true,
        });

        const lineNum = Number(issue.line);
        if (Number.isFinite(lineNum) && lineNum > 0) {
          const pos = new vscode.Position(lineNum - 1, 0);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenter
          );
        }
      }
    )
  );

  // Fix: img-alt (single issue) - mantiene tu comportamiento original
  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.fixImgAlt", async (node: any) => {
      const issue: Issue | undefined = node?.issue ?? node;

      if (!issue?.filePath) {
        vscode.window.showErrorMessage(
          "React Doctor: could not resolve issue payload."
        );
        return;
      }

      const uri = vscode.Uri.file(issue.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, {
        preview: false,
      });

      const lineIndex = Math.max(0, (issue.line ?? 1) - 1);
      if (lineIndex >= doc.lineCount) {
        vscode.window.showErrorMessage(
          "React Doctor: issue line is out of range."
        );
        return;
      }

      const edit = buildImgAltEditForLine(doc, issue.line ?? 1);
      if (!edit) {
        vscode.window.showInformationMessage(
          "React Doctor: nothing to fix (alt present or no <img> on that line)."
        );
        return;
      }

      await editor.edit((editBuilder) => {
        editBuilder.replace(edit.range, edit.newText);
      });
    })
  );

  /**
   * NEW: Fix all safe issues in CURRENT FILE
   * - img-alt
   * - perf-index-as-key (solo cuando se puede inferir itemName)
   *
   * Después re-escanea y muestra % de mejora.
   */
  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.fixAllSafe", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const editor = vscode.window.activeTextEditor;

      if (!root) {
        vscode.window.showWarningMessage("Open a folder/workspace first.");
        return;
      }
      if (!editor) {
        vscode.window.showWarningMessage("Open a file first.");
        return;
      }

      const cfg = vscode.workspace.getConfiguration("reactDoctor");
      const ctx: RuleContext = {
        rootPath: root,
        maxFileLines: cfg.get("maxFileLines", 300),
      };

      const beforeSnap = baseline ?? makeSnapshot(lastIssues);
      if (!baseline) {baseline = beforeSnap;}

      const { issues: freshIssues } = await runScanAndUpdateUI(provider, ctx);
      const currentIssues = freshIssues.filter((i) => isSameFile(i, editor.document));
      const edits: { range: vscode.Range; newText: string }[] = [];

      for (const issue of currentIssues) {
        const line = issue.line ?? 1;

        if (issue.ruleId === "img-alt") {
          const e = buildImgAltEditForLine(editor.document, line);
          if (e) {edits.push(e);}
        }

        if (issue.ruleId === "perf-index-as-key") {
          const e = buildIndexAsKeyEditForLine(editor.document, line);
          if (e) {edits.push(e);}
        }
      }

      if (!edits.length) {
        vscode.window.showInformationMessage(
          "React Doctor: no safe fixes found in this file."
        );
        return;
      }

      edits.sort((a, b) => b.range.start.line - a.range.start.line);

      await editor.edit((eb) => {
        for (const e of edits) {eb.replace(e.range, e.newText);}
      });

      const { snap: afterSnap } = await runScanAndUpdateUI(provider, ctx);
      const { pct } = formatDelta(beforeSnap, afterSnap);

      if (statusBar) {
        statusBar.text = `React Doctor: ${afterSnap.score}/100 — ${afterSnap.label} (${pct >= 0 ? "+" : ""}${pct}%)`;
      }

      vscode.window.showInformationMessage(
        `React Doctor improved ${pct >= 0 ? "+" : ""}${pct}% · Score ${beforeSnap.score} → ${afterSnap.score} · Issues ${beforeSnap.issueCount} → ${afterSnap.issueCount}`
      );

      baseline = afterSnap;
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("reactDoctor.resetBaseline", async () => {
      baseline = null;
      vscode.window.showInformationMessage("React Doctor: baseline reset.");
    })
  );
}

export function deactivate() {}