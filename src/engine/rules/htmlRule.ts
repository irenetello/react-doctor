import { Issue, Rule } from "../types";

const LABEL_TAG = /<label\b[^>]*>/gi;
const CONTROL_INSIDE_LABEL = /<(input|select|textarea)\b/i;

/**
 * Rule that detects `<label>` elements that are not properly associated with a form control.
 *
 * A label is considered valid when either:
 * - it has an explicit `htmlFor` attribute, or
 * - it wraps a native form control (`input`, `select`, or `textarea`).
 *
 * Labels missing both patterns can hurt accessibility because assistive technologies
 * may not correctly map the label text to an input control.
 *
 * Detection strategy:
 * - Only scans `.tsx` and `.jsx` files.
 * - Finds opening `<label ...>` tags.
 * - Skips matches with `htmlFor=...`.
 * - Otherwise inspects content until `</label>` and checks for wrapped controls.
 * - Reports one issue per invalid label at the computed line number.
 *
 * Generated issue details:
 * - `id`: combines rule id, file relative path, and line number.
 * - `severity`: `WARN`.
 * - `message`: explains that the label has no `htmlFor` and wraps no control.
 */
export const labelHtmlForRule: Rule = {
    id: "label-htmlfor",
    title: "label missing htmlFor",

    async run(_ctx, files) {
        const issues: Issue[] = [];

        for (const f of files) {
            if (!f.relPath.endsWith(".tsx") && !f.relPath.endsWith(".jsx")) {
                continue;
            }

            const matches = f.content.matchAll(LABEL_TAG);

            for (const m of matches) {
                const tag = m[0];

                const hasHtmlFor = /\bhtmlFor\s*=\s*["'{]/i.test(tag);
                if (hasHtmlFor) {
                    continue;
                }

                const startIdx = m.index ?? 0;
                const after = f.content.slice(startIdx);
                const labelCloseIdx = after.search(/<\/label>/i);

                let wrapsControl = false;
                if (labelCloseIdx !== -1) {
                    const labelBlock = after.slice(0, labelCloseIdx);
                    wrapsControl = CONTROL_INSIDE_LABEL.test(labelBlock);
                }

                if (wrapsControl) {
                    continue;
                }

                const line =
                    f.content.slice(0, startIdx).split(/\r?\n/).length;

                issues.push({
                    id: `${labelHtmlForRule.id}:${f.relPath}:${line}`,
                    severity: "WARN",
                    message: "<label> missing htmlFor and not wrapping a form control.",
                    filePath: f.path,
                    line,
                    ruleId: labelHtmlForRule.id,
                });
            }
        }

        return issues;
    },
};