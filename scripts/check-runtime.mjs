// Exercise native Node ESM, not the bundler that can hide invalid runtime imports.
import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const output = mkdtempSync(path.join(tmpdir(), 'servicepilot-runtime-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', 'false', '--outDir', output], { stdio: 'pipe' });
  writeFileSync(path.join(output, 'package.json'), '{"type":"module"}');
  symlinkSync(path.resolve('node_modules'), path.join(output, 'node_modules'), 'dir');
  const entry = pathToFileURL(path.join(output, 'src/server/public-demo.js')).href;
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    const {dispatchDemo} = await import(${JSON.stringify(entry)});
    const result = await dispatchDemo({path:'/api/session',body:{customerId:'c-nora'}});
    if (!result.state || !result.data) throw new Error('Missing session state');
  `], { env: { ...process.env, DEMO_SESSION_SECRET: 'native-runtime-test-fixture-not-a-real-secret' }, stdio: 'pipe' });
  console.log('Native Node ESM: public entry import and in-memory SQLite session passed.');
} finally { rmSync(output, {recursive:true, force:true}); }
