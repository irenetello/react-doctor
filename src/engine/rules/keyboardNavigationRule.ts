import { Issue, Rule } from "../types";

export const keyboardNavigationRule: Rule = {
  id: "keyboard-navigation",
  title: "Keyboard navigation missing",
  async run(_ctx, files) {
    const issues: Issue[] = [];
    const INTERACTABLE_TAG = /<(a|button|[A-Z][A-Za-z0-9]*)\b[^>]*>/gi;
    const ROLE_ATTR = /role\s*=\s*['"](button|link)['"]/i;
    const TABINDEX_ATTR = /tabindex\s*=\s*["'{]/i;
    const KEYHANDLER = /(onKeyDown|onKeyUp|onKeyPress)\s*=\s*\{/i;
    for (const f of files) {
      if (!f.relPath.endsWith(".tsx") && !f.relPath.endsWith(".jsx")) continue;
      const matches = f.content.matchAll(INTERACTABLE_TAG);
      for (const m of matches) {
        const tag = m[0];
        const tagName = m[1];
        const idx = m.index ?? 0;
        // Check for role/button/link or tabindex
        const isRole = ROLE_ATTR.test(tag);
        const hasTabIndex = TABINDEX_ATTR.test(tag);
        const hasKeyHandler = KEYHANDLER.test(tag);
        if (!hasTabIndex && !hasKeyHandler && !isRole) {
          const line = f.content.slice(0, idx).split(/\r?\n/).length;
          issues.push({
            id: `${keyboardNavigationRule.id}:${f.relPath}:${line}`,
            severity: "WARN",
            message: `Interactable element <${tagName}> missing keyboard accessibility (tabindex or key handler).`,
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
