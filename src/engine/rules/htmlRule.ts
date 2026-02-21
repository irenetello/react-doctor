import { Issue, Rule } from "../types";

const LABEL_TAG = /<label\b[^>]*>/gi;
const CONTROL_INSIDE_LABEL = /<(input|select|textarea)\b/i;

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

                // Case 1: has htmlFor attribute
                const hasHtmlFor = /\bhtmlFor\s*=\s*["'{]/i.test(tag);
                if (hasHtmlFor) {
                    continue;
                }


                // Try to see if the label wraps a form control
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


                // Calculate line number
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