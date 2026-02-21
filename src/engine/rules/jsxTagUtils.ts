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