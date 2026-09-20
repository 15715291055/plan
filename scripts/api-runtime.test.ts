import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

test('emitted API modules load in plain Node and reject unauthenticated requests as JSON', () => {
  const directory = mkdtempSync(join(process.cwd(), '.api-runtime-test-'))
  try {
    // Plain Node is intentional: tsx resolves extensionless imports that production rejects.
    for (const file of readdirSync('api').filter(name => name.endsWith('.ts'))) {
      const source = readFileSync(join('api', file), 'utf8')
      const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
      writeFileSync(join(directory, file.replace(/\.ts$/, '.js')), output)
    }
    const entrypoints = ['deepseek-key', 'analyze-schedule-text', 'analyze-schedule-image', 'analyze-material', 'analyze-weekly-content']
    const urls = entrypoints.map(name => pathToFileURL(join(directory, name + '.js')).href)
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      for (const url of ${JSON.stringify(urls)}) {
        const { default: handler } = await import(url);
        let status, payload;
        const response = {
          status(value) { status = value; return this; },
          json(value) { payload = value; return this; }
        };
        await handler({ method: 'POST', headers: {}, body: {} }, response);
        assert.equal(status, 401);
        assert.equal(typeof payload.error, 'string');
      }
    `], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
