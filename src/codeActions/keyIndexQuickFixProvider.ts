import * as vscode from "vscode";
import ts from "typescript";

/**
 * Command-based Quick Fix for replacing index-based React keys:
 *
 * `key={index}` -> `key={item.id}`
 *
 * Goal:
 * - Reduce unstable list keys that can cause state bugs and unnecessary re-renders.
 *
 * Detection strategy (AST-based, no diagnostics dependency):
 * - Locate a JSX `key` attribute near the cursor/line.
 * - Require `key` initializer to be an identifier expression (`{indexName}`).
 * - Find the nearest ancestor `.map(...)` callback.
 * - Require callback params to match `(item, index)` shape where `indexName`
 *   matches the callback's second parameter.
 *
 * Safety model:
 * - Fail-safe by design: if any condition is ambiguous, no code action is offered.
 * - Assumes `item.id` is the preferred stable key when confidence is high.
 */
export class KeyIndexQuickFixProvider implements vscode.CodeActionProvider {
  static readonly kind = vscode.CodeActionKind.QuickFix;

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    if (!/(\.|\/)(t|j)sx$/i.test(document.fileName)) {return [];}

    const src = document.getText();
    const sourceFile = ts.createSourceFile(
      document.fileName,
      src,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const strict = tryAnalyzeAtOffset(document, sourceFile, document.offsetAt(range.start));
    const analysis = strict ?? tryAnalyzeOnLine(document, sourceFile, range.start.line);
    if (!analysis) {return [];}

    const { valueRange, itemName } = analysis;

    const action = new vscode.CodeAction(
      `Replace with key={${itemName}.id}`,
      KeyIndexQuickFixProvider.kind,
    );

    action.command = {
      title: "React Doctor: Fix key",
      command: "reactDoctor.fixKeyIndex",
      arguments: [document.uri, valueRange, itemName],
    };

    return [action];
  }
}

function findSmallestNodeContainingOffset(root: ts.Node, offset: number): ts.Node | undefined {
  let best: ts.Node | undefined;

  const visit = (node: ts.Node) => {
    const start = node.getStart();
    const end = node.getEnd();

    if (offset < start || offset > end) {return;}
    best = node;

    node.forEachChild(visit);
  };

  visit(root);
  return best;
}

function tryAnalyzeAtOffset(
  document: vscode.TextDocument,
  sourceFile: ts.SourceFile,
  offset: number,
): { valueRange: vscode.Range; itemName: string } | null {
  const node = findSmallestNodeContainingOffset(sourceFile, offset);
  if (!node) {return null;}

  const keyAttr = findClosestJsxKeyAttribute(node);
  if (!keyAttr) {return null;}

  return analyzeKeyAttributeForMapIndex(keyAttr, document);
}

function tryAnalyzeOnLine(
  document: vscode.TextDocument,
  sourceFile: ts.SourceFile,
  line: number,
): { valueRange: vscode.Range; itemName: string } | null {
  const lineText = document.lineAt(line).text;
  if (!lineText.includes("key={")) {return null;}

  // Scan all key attributes in file and pick the first one that:
  // - starts on the requested line
  // - matches our map(index) pattern
  let found: { valueRange: vscode.Range; itemName: string } | null = null;

  const visit = (n: ts.Node) => {
    if (found) {return;}

    if (ts.isJsxAttribute(n) && n.name.getText() === "key") {
      const startLine = document.positionAt(n.getStart()).line;
      if (startLine === line) {
        const analysis = analyzeKeyAttributeForMapIndex(n, document);
        if (analysis) {
          found = analysis;
          return;
        }
      }
    }

    n.forEachChild(visit);
  };

  visit(sourceFile);
  return found;
}

function findClosestJsxKeyAttribute(node: ts.Node): ts.JsxAttribute | undefined {
  let cur: ts.Node | undefined = node;

  // 1) If we're already inside the attribute/initializer
  while (cur) {
    if (ts.isJsxAttribute(cur) && cur.name.getText() === "key") {return cur;}
    cur = cur.parent;
  }

  // 2) Otherwise, climb to the JSX opening element and search properties
  cur = node;
  while (cur) {
    if (ts.isJsxOpeningElement(cur) || ts.isJsxSelfClosingElement(cur)) {
      for (const prop of cur.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText() === "key") {return prop;}
      }
      return undefined;
    }
    cur = cur.parent;
  }

  return undefined;
}

function analyzeKeyAttributeForMapIndex(
  attr: ts.JsxAttribute,
  document: vscode.TextDocument,
): { valueRange: vscode.Range; itemName: string } | null {
  const init = attr.initializer;
  if (!init || !ts.isJsxExpression(init) || !init.expression) {return null;}
  if (!ts.isIdentifier(init.expression)) {return null;}

  const indexName = init.expression.text;

  // Find nearest .map callback with (item, index)
  const mapCallback = findClosestMapCallback(attr);
  const params = mapCallback?.parameters ?? [];
  if (params.length < 2) {return null;}

  const itemParam = params[0];
  const indexParam = params[1];

  if (!ts.isIdentifier(indexParam.name)) {return null;}
  if (indexParam.name.text !== indexName) {return null;}

  if (!ts.isIdentifier(itemParam.name)) {return null;}
  const itemName = itemParam.name.text;

  const valueRange = tsNodeToVscodeRange(document, init);
  return { valueRange, itemName };
}

function findClosestMapCallback(node: ts.Node): ts.ArrowFunction | ts.FunctionExpression | undefined {
  let cur: ts.Node | undefined = node;
  while (cur) {
    if (ts.isArrowFunction(cur) || ts.isFunctionExpression(cur)) {
      if (isMapCallback(cur)) {return cur;}
    }
    cur = cur.parent;
  }
  return undefined;
}

function isMapCallback(fn: ts.ArrowFunction | ts.FunctionExpression): boolean {
  const parent = fn.parent;
  if (!parent || !ts.isCallExpression(parent)) {return false;}

  const expr = parent.expression;
  if (!ts.isPropertyAccessExpression(expr)) {return false;}

  return expr.name.getText() === "map";
}

function tsNodeToVscodeRange(document: vscode.TextDocument, node: ts.Node): vscode.Range {
  const start = document.positionAt(node.getStart());
  const end = document.positionAt(node.getEnd());
  return new vscode.Range(start, end);
}
