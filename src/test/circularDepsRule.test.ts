import * as assert from 'assert';
import * as vscode from 'vscode';
import { circularDepsRule } from '../engine/rules/circularDepsRule';
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
