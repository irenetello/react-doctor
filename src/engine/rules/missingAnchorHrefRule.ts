import { Issue, Rule } from "../types";

export const missingAnchorHrefRule: Rule = {
  id: "missing-anchor-href",
  title: "Anchor tag missing href",
  async run(_ctx, files) {
    const issues: Issue[] = [];
console.log('first test');
    for (const f of files) {
        
      if (!f.relPath.endsWith(".tsx") && !f.relPath.endsWith(".jsx")) continue;

      const ANCHOR_TAG = /<a\b[^>]*>/gi;
      const matches = f.content.matchAll(ANCHOR_TAG);

      for (const m of matches) {
        const tag = m[0];
        const hasHref = /href\s*=\s*["'{]/i.test(tag);
        const tagEndIdx = m.index ?? 0;
        const closeIdx = f.content.indexOf("</a>", tagEndIdx);
        const inner = closeIdx > tagEndIdx ? f.content.slice(tagEndIdx + tag.length, closeIdx).trim() : "";

        if (!hasHref && inner) {
          const line = f.content.slice(0, tagEndIdx).split(/\r?\n/).length;

          issues.push({
            id: `${missingAnchorHrefRule.id}:${f.relPath}:${line}`,
            severity: "ERROR",
            message: "<a> tag missing href attribute and contains content.",
            filePath: f.path,
            line,
            ruleId: missingAnchorHrefRule.id,
          });
        }
      }
    }
    return issues;
  },
};
