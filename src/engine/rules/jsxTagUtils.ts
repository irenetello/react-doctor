import * as ts from "typescript";

/**
 * Utility functions for parsing and analyzing JSX elements using TypeScript AST.
 */

/**
 * Extracts all JSX elements with a specific tag name from the source code.
 * @param source The source code to parse.
 * @param tagName The tag name to filter by (use "*" for all tags).
 * @returns An array of JSX elements matching the tag name.
 */
export function getJsxElements(source: string, tagName: string) {
  const sourceFile = ts.createSourceFile("temp.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.JsxElement[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement;
      if (
        tagName === "*" ||
        (ts.isIdentifier(opening.tagName) && opening.tagName.escapedText === tagName)
      ) {
        nodes.push(node);
      }
    } else if (ts.isJsxSelfClosingElement(node)) {
      if (
        tagName === "*" ||
        (ts.isIdentifier(node.tagName) && node.tagName.escapedText === tagName)
      ) {
        nodes.push(node as any);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return nodes;
}

/**
 * Retrieves the value of a specific attribute from a JSX opening element.
 * @param node The JSX opening element to inspect.
 * @param attr The attribute name to look for.
 * @returns The value of the attribute, or undefined if not found.
 */
export function getAttribute(node: ts.JsxOpeningLikeElement, attr: string): string | undefined {
  for (const prop of node.attributes.properties) {
    if (
      ts.isJsxAttribute(prop) &&
      ts.isIdentifier(prop.name) && // Ensure prop.name is an Identifier
      prop.name.escapedText === attr &&
      prop.initializer &&
      ts.isStringLiteral(prop.initializer)
    ) {
      return prop.initializer.text;
    }
  }
  return undefined;
}
  
export function getOpeningTagName(content: string, idx: number): string | null {
  const lastLt = content.lastIndexOf("<", idx);
  const lastGt = content.lastIndexOf(">", idx);

  if (lastLt === -1 || lastLt < lastGt) {
    return null;
  }

  const afterLt = content.slice(lastLt + 1);
  const match = afterLt.match(/^([A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)*)/);
  return match?.[1] ?? null;
}

export function isReactComponentTag(tagName: string | null): boolean {
  if (!tagName) {
    return false;
  }

  const root = tagName.split(".")[0];
  return /^[A-Z]/.test(root);

}