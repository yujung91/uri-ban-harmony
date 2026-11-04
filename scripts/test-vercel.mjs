import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

// Exercise a real production server; no DB credentials or existing student data.
const server = spawn(process.execPath, ['scripts/run-vercel.mjs', 'start', '--hostname', '127.0.0.1', '--port', '4180'], { stdio: 'pipe', env: { ...process.env, SUPABASE_DATABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_ANON_KEY: '' } });
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
  assert.match(html, /Supabase 연결 후/);
  assert.equal((await fetch(`${base}/signin-with-chatgpt`)).status, 503);
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
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
}
