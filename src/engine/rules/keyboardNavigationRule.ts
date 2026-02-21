import * as ts from "typescript";
import { Issue, Rule } from "../types";
import { getJsxElements, getAttribute } from "./jsxTagUtils";

/**
 * Rule to detect interactive elements that are not keyboard accessible.
 *
 * This rule checks for two types of interactive elements:
 * 1. Naturally interactive elements (e.g., <button>, <a>, <input>, etc.).
 * 2. Custom interactive elements (e.g., elements with an `onClick` handler).
 *
 * For custom interactive elements, the rule ensures that they have either:
 * - A `tabindex` attribute.
 * - A `role` attribute.
 *
 * Issues are reported for elements that lack the necessary attributes for keyboard accessibility.
 */
export const keyboardNavigationRule: Rule = {
  id: "keyboard-navigation",
  title: "Keyboard navigation missing",
  async run(_ctx, files) {
    const issues: Issue[] = [];

    const NATURAL_INTERACTIVES = [
      "a",
      "button",
      "input",
      "select",
      "textarea",
    ]; // Naturally interactive elements

    for (const f of files) {
      if (!f.relPath.endsWith(".tsx") && !f.relPath.endsWith(".jsx")) {;};

      const elements = getJsxElements(f.content, "*"); // Get all JSX elements

      for (const element of elements) {
        const opening = element.openingElement ?? element;
        const tagName = ts.isIdentifier(opening.tagName)
          ? opening.tagName.escapedText
          : undefined;

        if (!tagName) {
          continue; // Skip if tagName is not an Identifier
        }

        // Check if the element is naturally interactive
        const isNaturallyInteractive = NATURAL_INTERACTIVES.includes(tagName);

        // Check for custom interactive elements
        const hasOnClick = getAttribute(opening, "onClick") !== undefined;
        const hasTabIndex = getAttribute(opening, "tabindex") !== undefined;
        const hasRole = getAttribute(opening, "role") !== undefined;

        // If it's not naturally interactive and lacks keyboard accessibility
        if (!isNaturallyInteractive && hasOnClick && !hasTabIndex && !hasRole) {
          const pos = opening.pos ?? 0;
          const line = f.content.slice(0, pos).split(/\r?\n/).length;

          issues.push({
            id: `${keyboardNavigationRule.id}:${f.relPath}:${line}`,
            severity: "WARN",
            message: `Custom interactive element <${tagName}> missing keyboard accessibility (tabindex or role).`,
            filePath: f.path,
            line,
            ruleId: keyboardNavigationRule.id,
          });
        }
      }
    }

    return issues;
  },
};
