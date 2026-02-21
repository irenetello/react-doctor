import { Issue, Rule } from "../types";

export const buttonAccessibleNameRule: Rule = {
  id: "button-accessible-name",
  title: "Button without accessible name",
  async run(_ctx, files) {
    const issues: Issue[] = [];
    for (const f of files) {

      if (!f.relPath.endsWith(".tsx") && !f.relPath.endsWith(".jsx")) {continue};

      const BUTTON_TAG = /<button\b[^>]*>/gi;
      const matches = f.content.matchAll(BUTTON_TAG);

      for (const m of matches) {
        const tag = m[0];
        const hasLabel = /aria-label\s*=\s*["'{]/i.test(tag);
        const hasLabelledBy = /aria-labelledby\s*=\s*["'{]/i.test(tag);
        const hasTitle = /title\s*=\s*["'{]/i.test(tag);
        const tagEndIdx = m.index ?? 0;
        const closeIdx = f.content.indexOf("</button>", tagEndIdx);
        const inner = closeIdx > tagEndIdx ? f.content.slice(tagEndIdx + tag.length, closeIdx).trim() : "";

        if (!hasLabel && !hasLabelledBy && !hasTitle && !inner) {
          const line = f.content.slice(0, tagEndIdx).split(/\r?\n/).length;
          issues.push({
            id: `${buttonAccessibleNameRule.id}:${f.relPath}:${line}`,
            severity: "ERROR",
            message: "<button> without accessible name (aria-label, aria-labelledby, title, or text).",
            filePath: f.path,
            line,
            ruleId: buttonAccessibleNameRule.id,
          });
        }
      }
    }
    return issues;
  },
};
