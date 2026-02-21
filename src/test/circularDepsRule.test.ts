import * as assert from 'assert';
import * as vscode from 'vscode';
import { circularDepsRule, getIssues } from '../engine/rules/circularDepsRule';
import { Issue, Rule, ScannedFile,  RuleContext} from "../engine/types";

suite('circularDepsRule', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('handles empty file list', async () => {
    const ctx:RuleContext = {
      rootPath: '.',
      maxFileLines: 1000
    };
    const files: ScannedFile[] = [];
    const result:Issue[]  = await circularDepsRule.run(ctx, files);
    assert.deepEqual(result, []);
  });
  test('handles one file, so no circular dependencies', async () => {
    const ctx:RuleContext = {
      rootPath: '.',
      maxFileLines: 1000
    };
    const files: ScannedFile[] = [
      {
        path: './folder/file',
        relPath: '/folder/file',
        content: 'console.log("hello world);',
        lines: [
          'console.log("hello world);',
        ],
      }
    ];
    const result:Issue[]  = await circularDepsRule.run(ctx, files);
    assert.deepEqual(result, []);
  });

  test('detects simple circular dependency (A -> B -> A)', async () => {
    const ctx:RuleContext = {
      rootPath: '.',
      maxFileLines: 1000
    };
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { b } from "./b";',
        lines: ['import { b } from "./b";'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];
    const result:Issue[]  = await circularDepsRule.run(ctx, files);
    assert.strictEqual(result.length > 0, true);
    assert.strictEqual(result[0].ruleId, 'circular-deps');
    assert.strictEqual(result[0].severity, 'ERROR');
  });

  test('detects longer circular dependency (A -> B -> C -> A)', async () => {
    const ctx:RuleContext = {
      rootPath: '.',
      maxFileLines: 1000
    };
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { b } from "./b";',
        lines: ['import { b } from "./b";'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { c } from "./c";',
        lines: ['import { c } from "./c";'],
      },
      {
        path: '/src/c.ts',
        relPath: 'src/c.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];
    const result:Issue[]  = await circularDepsRule.run(ctx, files);
    assert.strictEqual(result.length > 0, true);
    assert.strictEqual(result.some(issue => issue.ruleId === 'circular-deps'), true);
  });

  test('handles self-referencing dependency (A -> A)', async () => {
    const ctx:RuleContext = {
      rootPath: '.',
      maxFileLines: 1000
    };
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];
    const result:Issue[]  = await circularDepsRule.run(ctx, files);
    assert.strictEqual(result.length > 0, true);
    assert.strictEqual(result[0].severity, 'ERROR');
  });

  test('detects correct line numbers for circular dependencies', async () => {
    const ctx:RuleContext = {
      rootPath: '.',
      maxFileLines: 1000
    };
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'console.log("test");\nimport { b } from "./b";\nconst x = 1;',
        lines: ['console.log("test");', 'import { b } from "./b";', 'const x = 1;'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];
    const result:Issue[]  = await circularDepsRule.run(ctx, files);
    assert.strictEqual(result.length > 0, true);
    assert.strictEqual(result[0].line, 2);
  });

  test('ignores external (non-relative) imports', async () => {
    const ctx:RuleContext = {
      rootPath: '.',
      maxFileLines: 1000
    };
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import React from "react"; import { b } from "./b";',
        lines: ['import React from "react"; import { b } from "./b";'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];
    const result:Issue[]  = await circularDepsRule.run(ctx, files);
    assert.strictEqual(result.length > 0, true);
  });
});

suite('getIssues', () => {
  test('detects simple cycle A -> B -> A', () => {
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { b } from "./b";',
        lines: ['import { b } from "./b";'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];

    const graph = {
      'src/a.ts': { 'src/b.ts': true },
      'src/b.ts': { 'src/a.ts': true }
    };

    const issues = getIssues('src/a.ts', [], new Set(), files, graph);
    assert.strictEqual(issues.length > 0, true);
    assert.strictEqual(issues[0].ruleId, 'circular-deps');
    assert.strictEqual(issues[0].severity, 'ERROR');
    assert.strictEqual(issues[0].message.includes('Circular dependency'), true);
  });

  test('detects three-file cycle A -> B -> C -> A', () => {
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { b } from "./b";',
        lines: ['import { b } from "./b";'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { c } from "./c";',
        lines: ['import { c } from "./c";'],
      },
      {
        path: '/src/c.ts',
        relPath: 'src/c.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];

    const graph = {
      'src/a.ts': { 'src/b.ts': true },
      'src/b.ts': { 'src/c.ts': true },
      'src/c.ts': { 'src/a.ts': true }
    };

    const issues = getIssues('src/a.ts', [], new Set(), files, graph);
    assert.strictEqual(issues.length > 0, true);
    assert.strictEqual(issues[0].ruleId, 'circular-deps');
  });

  test('returns empty array when no cycle exists', () => {
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { b } from "./b";',
        lines: ['import { b } from "./b";'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'const x = 1;',
        lines: ['const x = 1;'],
      }
    ];

    const graph = {
      'src/a.ts': { 'src/b.ts': true },
      'src/b.ts': {}
    };

    const issues = getIssues('src/a.ts', [], new Set(), files, graph);
    assert.strictEqual(issues.length, 0);
  });

  test('handles empty graph', () => {
    const files: ScannedFile[] = [];
    const graph = {};

    const issues = getIssues('src/a.ts', [], new Set(), files, graph);
    assert.strictEqual(issues.length, 0);
  });

  test('sets correct issue properties (filePath, line, id, message)', () => {
    const files: ScannedFile[] = [
      {
        path: '/workspace/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { b } from "./b";',
        lines: ['import { b } from "./b";'],
      },
      {
        path: '/workspace/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];

    const graph = {
      'src/a.ts': { 'src/b.ts': true },
      'src/b.ts': { 'src/a.ts': true }
    };

    const issues = getIssues('src/a.ts', [], new Set(), files, graph);
    assert.strictEqual(issues.length > 0, true);
    
    const issue = issues[0];
    assert.strictEqual(issue.filePath, '/workspace/src/a.ts');
    assert.strictEqual(issue.line, 1);
    assert.strictEqual(issue.id.startsWith('cycle:'), true);
    assert.strictEqual(issue.message.includes('→'), true);
  });

  test('respects visited set to avoid redundant processing', () => {
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'import { b } from "./b";',
        lines: ['import { b } from "./b";'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];

    const graph = {
      'src/a.ts': { 'src/b.ts': true },
      'src/b.ts': { 'src/a.ts': true }
    };

    const visited = new Set(['src/b.ts']);
    const issues = getIssues('src/a.ts', [], visited, files, graph);
    
    // Should return empty because src/b.ts is already visited
    assert.strictEqual(issues.length, 0);
  });

  test('finds correct line number for import statement', () => {
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'console.log("test");\nimport { b } from "./b";\nconst x = 1;',
        lines: ['console.log("test");', 'import { b } from "./b";', 'const x = 1;'],
      },
      {
        path: '/src/b.ts',
        relPath: 'src/b.ts',
        content: 'import { a } from "./a";',
        lines: ['import { a } from "./a";'],
      }
    ];

    const graph = {
      'src/a.ts': { 'src/b.ts': true },
      'src/b.ts': { 'src/a.ts': true }
    };

    const issues = getIssues('src/a.ts', [], new Set(), files, graph);
    assert.strictEqual(issues.length > 0, true);
    assert.strictEqual(issues[0].line, 2);
  });

  test('handles nodes with no dependencies', () => {
    const files: ScannedFile[] = [
      {
        path: '/src/a.ts',
        relPath: 'src/a.ts',
        content: 'const x = 1;',
        lines: ['const x = 1;'],
      }
    ];

    const graph = {
      'src/a.ts': {}
    };

    const issues = getIssues('src/a.ts', [], new Set(), files, graph);
    assert.strictEqual(issues.length, 0);
  });
});