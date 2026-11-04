import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

// Exercise a real production server; no DB credentials or existing student data.
const authOnly = process.argv.includes('--configured-auth');
const server = spawn(process.execPath, ['scripts/run-vercel.mjs', 'start', '--hostname', '127.0.0.1', '--port', '4180'], { stdio: 'pipe', env: { ...process.env, SUPABASE_URL: authOnly ? 'invalid-project-url' : '', SUPABASE_DATABASE_URL: authOnly ? 'invalid-database-url' : '', SUPABASE_SERVICE_ROLE_KEY: authOnly ? 'local-test-only' : '', SUPABASE_ANON_KEY: authOnly ? 'local-test-only' : '' } });
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
const base = 'http://127.0.0.1:4180';
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(logs);
    try { ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await setTimeout(100);
  }
  assert.ok(ready, logs);
  const html = await (await fetch(base)).text();
  assert.match(html, /우리 반 하모니/);
  assert.match(html, /name="harmony-runtime" content="vercel"/);
  for (const path of ['/api/auth/login', '/signin-with-chatgpt?return_to=%2F']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const form = await response.text();
    assert.match(form, /type="email"/);assert.match(form, /type="password"/);
    assert.match(form, /action="\/api\/auth\/login/);
  }
  if (authOnly) {
    const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=local%40example.test&password=local-test-only' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'AUTH_CONFIG_INVALID');
    console.log('PASS: login HTML renders with invalid service configuration; POST returns a safe specific error without network/database access.');
  } else {
  assert.match(html, /Supabase 연결 후/);
  for (const asset of ['app.js', 'online.js', 'music.js', 'studio.js', 'movie.js', 'creation.js', 'qrcode.js', 'classroom-updates.js', 'style.css', 'creation.css', 'assets/rule-atlas.png']) {
    const response = await fetch(`${base}/${asset}`);
    assert.equal(response.status, 200, asset);
    assert.ok((await response.arrayBuffer()).byteLength > 0, asset);
  }
  const me = await fetch(`${base}/api/me`, { headers: { 'oai-authenticated-user-id': 'forged', 'oai-authenticated-user-email': 'forged@example.test' } });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { teacher: false, siteOwner: false, reviewer: false, account: null, classes: [], setupRequired: true });
  for (const route of ['classes', 'creation/login', 'reviewer/login']) {
    const response = await fetch(`${base}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 503, route);
    assert.equal((await response.json()).code, 'BACKEND_NOT_CONFIGURED');
  }
  console.log('PASS: Next.js production HTML, existing assets, anonymous identity despite spoofed headers, and explicit unavailable backend responses.');
  }
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
}
