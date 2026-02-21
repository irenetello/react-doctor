import * as path from "path";
import { Issue, Rule } from "../types";

const IMPORT_RE =
  /import\s+(?:[^'"]+from\s+)?["']([^"']+)["']|require\(["']([^"']+)["']\)/g;

export const circularDepsRule: Rule = {
  id: "circular-deps",
  title: "Circular dependency",
  async run(_ctx, files) {
    const graph = new Map<string, string[]>();

    for (const f of files) {
      const deps: string[] = [];

      const matches = f.content.matchAll(IMPORT_RE);
      for (const m of matches) {
        const raw = m[1] || m[2];
        if (!raw) {continue;}

        if (!raw.startsWith(".")) {continue;}

        const resolved = resolveRelativeToKnownFile(f.relPath, raw, files);
        if (resolved) {deps.push(resolved);}

      }

      graph.set(normalize(f.relPath), deps);
    }

    const issues: Issue[] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    function dfs(node: string, pathStack: string[]) {
      if (stack.has(node)) {
        const cycle = [...pathStack, node];
        const startRel = cycle[0];
        const nextRel = cycle[1];

        const startFile = files.find(
          (f) => normalize(f.relPath) === normalize(startRel)
        );
        let line: number | undefined = undefined;

        if (startFile && nextRel) {
          const idx = findImportLine(startRel, nextRel, startFile.lines);
          if (idx >= 0) {line = idx + 1;}
        }

        issues.push({
          id: `cycle:${cycle.join("->")}`,
          severity: "ERROR",
          message: `Circular dependency: ${cycle.join(" → ")}`,
          filePath: absPathForRel(startRel, files),
          line,
          ruleId: "circular-deps",
        });
        return;
      }

      if (visited.has(node)) {return;}

      visited.add(node);
      stack.add(node);

      const neighbors = graph.get(node) || [];
      for (const n of neighbors) {
        dfs(n, [...pathStack, node]);
      }

      stack.delete(node);
    }

    for (const node of graph.keys()) {
      dfs(node, []);
    }

    return issues;
  },
};

function normalize(p: string) {
  return p.replace(/\\/g, "/");
}

function resolveRelativeToKnownFile(
  fromRel: string,
  raw: string,
  files: { relPath: string }[]
) {
  const fromDir = path.dirname(fromRel);
  const base = normalize(path.join(fromDir, raw));

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    normalize(path.join(base, "index.ts")),
    normalize(path.join(base, "index.tsx")),
    normalize(path.join(base, "index.js")),
    normalize(path.join(base, "index.jsx")),
  ];

  const set = new Set(files.map((f) => normalize(f.relPath)));
  return candidates.find((c) => set.has(c));
}

function absPathForRel(rel: string, files: { relPath: string; path: string }[]) {
  const norm = normalize(rel);
  return files.find((f) => normalize(f.relPath) === norm)?.path ?? rel;
}

function findImportLine(fromRel: string, toRel: string, lines: string[]) {
  const fromDir = normalize(path.dirname(fromRel));
  const toNorm = normalize(toRel);

  const rel = normalize(path.relative(fromDir, toNorm));
  const relWithDot = rel.startsWith(".") ? rel : `./${rel}`;
  const withoutExt = relWithDot.replace(/\.(tsx?|jsx?)$/i, "");

  const specs = [withoutExt, relWithDot];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    for (const spec of specs) {
      const esc = escapeRegExp(spec);

      const reImport = new RegExp(`\\bfrom\\s+['"]${esc}['"]`);
      const reReq = new RegExp(`\\brequire\\(\\s*['"]${esc}['"]\\s*\\)`);

      if (reImport.test(l) || reReq.test(l)) {return i;}
    }
  }

  return -1;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}