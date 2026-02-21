import * as path from "path";
import { Issue, Rule } from "../types";

const IMPORT_RE =
  /import\s+(?:[^'"]+from\s+)?["']([^"']+)["']|require\(["']([^"']+)["']\)/g;

type Graph = {[dependantFile: string]: {[dependencyFile: string]: boolean}}

export const circularDepsRule: Rule = {
  id: "circular-deps",
  title: "Circular dependency",
  async run(_ctx, files) {
    const graph: Graph = {};

    for (const f of files) {
      const deps: {[dependencyFile: string]: boolean} = {};

      const matches = f.content.matchAll(IMPORT_RE);
      for (const m of matches) {
        const raw = m[1] || m[2];
        if (!raw) {continue;}

        if (!raw.startsWith(".")) {continue;}

        const resolved = resolveRelativeToKnownFile(f.relPath, raw, files);
        if (resolved) {
          deps[resolved] = true;
        }
      }

      graph[normalize(f.relPath)] = deps;
    }

    const graphAll = { ...graph };
    let hasChanges = true;
    while (hasChanges) {
      hasChanges = false;
      for (const dependant in graphAll) {
        let initialLength = Object.keys(graphAll[dependant]).length;
        let dependenciesOfDependencies = {
          ...graphAll[dependant],
        };
        for (const dependantOfDependant in graphAll[dependant]) {
          dependenciesOfDependencies = {
            ...dependenciesOfDependencies,
            ...graphAll[dependantOfDependant] || {},
          };
        }
        if (Object.keys(dependenciesOfDependencies).length !== initialLength) {
          hasChanges = true;
          graphAll[dependant] = dependenciesOfDependencies;
        }
      }
    }
    
    const getIssues = (dependency: string, path: string[], visited: Set<string>): Issue[] => {
      const issues: Issue[] = [];

      // If we've returned to the starting dependency, we found a cycle
      if (path.length > 0 && dependency === path[0]) {
        const cycle = [...path, dependency];
        const startFile = files.find(
          (f) => normalize(f.relPath) === normalize(cycle[0])
        );
        let line: number | undefined = undefined;

        if (startFile && cycle[1]) {
          const idx = findImportLine(cycle[0], cycle[1], startFile.lines);
          if (idx >= 0) {
            line = idx + 1;
          }
        }

        return [{
          id: `cycle:${cycle.join("->")}`,
          severity: "ERROR",
          message: `Circular dependency: ${cycle.join(" → ")}`,
          filePath: absPathForRel(cycle[0], files),
          line,
          ruleId: "circular-deps",
        }];
      }

      // Avoid infinite recursion
      if (visited.has(dependency)) {
        return [];
      }

      visited.add(dependency);

      // Recursively explore all dependencies
      for (const dep in graph[dependency] || {}) {
        issues.push(...getIssues(dep, [...path, dependency], new Set(visited)));
      }

      return issues;
    };

    console.log({graphAll, graph, files: `${files}`});


    let issues: Issue[] = [];
    for (const dependant in graphAll) {
      if (graphAll[dependant][dependant]) {
        const newIssues = getIssues(dependant, [], new Set());
        issues = [...issues, ...newIssues];
      }
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