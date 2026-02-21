# React Doctor

VS Code extension that scans React/TypeScript projects for architectural and accessibility issues.

## Run locally
- npm install
- npm run compile
- Press F5 (Run Extension)

## Commands
- React Doctor: Scan workspace

# React Doctor

A VS Code extension that scans React/TypeScript projects for architectural and accessibility issues and produces actionable insights.

## Features
- Circular dependency detection (direct cycles)
- Accessibility check: `<img>` missing `alt` (with quick fix)
- Maintainability: large files detection (line threshold)
- Health score (0–100)
- Exportable Markdown report

## Run locally
1. `npm install`
2. `npm run compile`
3. Press `F5` (Run Extension)
4. In the Extension Development Host:
   - `React Doctor: Scan workspace`
   - `React Doctor: Export report (Markdown)`

## Notes / Limitations
- Dependency detection currently focuses on relative imports (no tsconfig path aliases yet).
- Rules are heuristic-based for speed during a hackathon.

## Team
Built during a hackathon as a DX tooling prototype.

