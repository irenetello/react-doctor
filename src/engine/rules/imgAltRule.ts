import { Issue, Rule } from "../types";

const IMG_TAG = /<img\b[^>]*>/gi;

/**
 * Rule that detects `<img>` tags missing an `alt` attribute.
 *
 * Missing alt text reduces accessibility for users relying on screen readers.
 * This rule flags image tags that do not appear to provide any `alt` value.
 *
 * Detection strategy:
 * - Only scans `.tsx` and `.jsx` files.
 * - Finds all `<img ...>` tags with a regex.
 * - For each tag, checks whether an `alt=` attribute is present.
 * - Reports one issue per missing-`alt` match at the computed line number.
 *
 * Generated issue details:
 * - `id`: combines rule id, file relative path, and line number.
 * - `severity`: `WARN`.
 * - `message`: indicates that an `<img>` is missing `alt`.
 */
export const imgAltRule: Rule = {
  id: "img-alt",
  title: "img tag missing alt",
  async run(_ctx, files) {
    const issues: Issue[] = [];

    for (const f of files) {
      if (!f.relPath.endsWith(".tsx") && !f.relPath.endsWith(".jsx")) {continue;}

      const matches = f.content.matchAll(IMG_TAG);
      for (const m of matches) {
        const tag = m[0];
        const hasAlt = /\balt\s*=\s*["'{]/i.test(tag);
        if (!hasAlt) {
          const idx = m.index ?? 0;
          const line = f.content.slice(0, idx).split(/\r?\n/).length;

          issues.push({
            id: `${imgAltRule.id}:${f.relPath}:${line}`,
            severity: "WARN",
            message: `<img> without alt.`,
            filePath: f.path,
            line,
            ruleId: imgAltRule.id,
          });
        }
      }
    }

    return issues;
  },
};