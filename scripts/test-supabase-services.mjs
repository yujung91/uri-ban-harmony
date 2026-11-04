import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createAuth } from '../lib/supabase/auth.mjs';
import { createStorage } from '../lib/supabase/storage.mjs';
import { createTestDatabase } from './supabase-test-db.mjs';
import { transform } from 'esbuild';

// Auth/Storage contracts are stubbed: never contact the user's Supabase project.
const origin = 'https://harmony.test';
const supabase = 'https://supabase.test';
const user = { id: randomUUID(), email: 'teacher@example.test', email_confirmed_at: new Date().toISOString() };
const session = { access_token: randomUUID(), refresh_token: randomUUID(), expires_in: 3600 };
const auth = createAuth({ url: supabase, anonKey: 'local-test-only', request: async (url, options) => {
  if (url.endsWith('/user')) return options.headers.Authorization === `Bearer ${session.access_token}` ? Response.json(user) : Response.json({}, { status: 401 });
  const input = JSON.parse(options.body);
  return (input.email === user.email || input.refresh_token === session.refresh_token) ? Response.json(session) : Response.json({}, { status: 400 });
} });
const forged = new Request(origin + '/api/me', { headers: { 'oai-authenticated-user-id': 'forged', 'oai-authenticated-user-email': user.email, 'CF-Connecting-IP': 'forged' } });
assert.equal((await auth.prepareRequest(forged)).request.headers.get('oai-authenticated-user-id'), null);
const login = new Request(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin }, body: new URLSearchParams({ email: user.email, password: randomUUID() }) });
const response = await auth.handle(login);
assert.equal(response.status, 303);
const setCookies = response.headers.getSetCookie();
assert.equal(setCookies.length, 2);
assert.ok(setCookies.every(cookie => cookie.includes('HttpOnly') && cookie.includes('Secure') && cookie.includes('SameSite=Lax')));
const cookie = setCookies.map(value => value.split(';')[0]).join('; ');
const prepared = await auth.prepareRequest(new Request(origin + '/api/me', { headers: { Cookie: cookie, 'oai-authenticated-user-id': 'forged' } }));
assert.equal(prepared.request.headers.get('oai-authenticated-user-id'), `supabase:${user.id}`);
const refreshed = await auth.prepareRequest(new Request(origin + '/api/me', { headers: { Cookie: `harmony-teacher-refresh=${session.refresh_token}` } }));
assert.equal(refreshed.cookies.length, 2);
assert.equal(refreshed.request.headers.get('oai-authenticated-user-id'), `supabase:${user.id}`);
const badSession = await auth.prepareRequest(new Request(origin + '/api/me', { headers: { Cookie: 'harmony-teacher-access=invalid; harmony-teacher-refresh=invalid' } }));
assert.equal(badSession.request.headers.get('oai-authenticated-user-id'), null);
assert.ok(badSession.cookies.every(value => value.includes('Max-Age=0')));
assert.equal((await auth.handle(new Request(origin + '/api/auth/login', { method: 'POST', headers: { Origin: 'https://other.test' } }))).status, 403);
assert.equal((await auth.handle(new Request(origin + '/api/auth/logout', { method: 'GET' }))).headers.getSetCookie().length, 0);
const logout = await auth.handle(new Request(origin + '/api/auth/logout', { method: 'POST', headers: { Origin: origin } }));
assert.ok(logout.headers.getSetCookie().every(value => value.includes('Max-Age=0')));
const limited = createAuth({ url: supabase, anonKey: 'local-test-only', request: () => { throw Error('Must not reach auth'); }, rateLimit: async () => false });
assert.equal((await limited.handle(new Request(login, { body: new URLSearchParams({ email: user.email, password: randomUUID() }) }))).status, 429);

const objects = new Map();
const storage = createStorage({ url: supabase, secretKey: 'local-test-only', request: async (url, options) => {
  assert.equal(new URL(url).origin, supabase);
  assert.ok(options.headers.apikey);
  if (options.method === 'POST') { assert.equal(options.headers['x-upsert'], 'false'); objects.set(url, options.body); return new Response(null, { status: 200 }); }
  if (options.method === 'DELETE') { for (const key of JSON.parse(options.body).prefixes) objects.delete(`${supabase}/storage/v1/object/harmony-media/${key}`); return Response.json({}); }
  assert.ok(url.includes('/authenticated/'));
  const value = objects.get(url.replace('/authenticated/', '/'));
  return value ? new Response(value) : new Response(null, { status: 404 });
} });
await storage.put('test-class/test-file.png', new Uint8Array([137,80]), { httpMetadata: { contentType: 'image/png' } });
assert.deepEqual([...new Uint8Array(await new Response((await storage.get('test-class/test-file.png')).body).arrayBuffer())], [137,80]);
await storage.delete('test-class/test-file.png');
assert.equal(await storage.get('test-class/test-file.png'), null);
await assert.rejects(() => storage.get('../escape'));

const { db, pg } = await createTestDatabase();
try {
  // Exercise the actual Next API entry boundary, with local PG and fake Auth only.
  globalThis.__supabaseApiTest = { HARMONY_RUNTIME: 'vercel', HARMONY_READY: true, DB: db, BUCKET: storage, prepareRequest: req => auth.prepareRequest(req), handleAuth: req => auth.handle(req) };
  const moduleUrl = async source => 'data:text/javascript;base64,' + Buffer.from((await transform(source, { loader: 'ts', format: 'esm' })).code).toString('base64');
  const reviewer = await moduleUrl(await readFile('app/lib/reviewer.ts', 'utf8'));
  const load = async file => moduleUrl((await readFile(file, 'utf8')).replace("import {env as bindings} from 'cloudflare:workers';", 'const bindings=globalThis.__supabaseApiTest;').replace("from './reviewer'", `from '${reviewer}'`));
  const classroom = await load('app/lib/classroom.ts');
  const creation = await load('app/lib/creation.ts');
  const routeSource = (await readFile('app/api/[...path]/route.ts', 'utf8'))
    .replace("import {env} from 'cloudflare:workers';", 'const env=globalThis.__supabaseApiTest;')
    .replace("from '../../lib/reviewer'", `from '${reviewer}'`).replace("from '../../lib/classroom'", `from '${classroom}'`).replace("from '../../lib/creation'", `from '${creation}'`);
  const api = await import(await moduleUrl(routeSource));
  const anonymous = await api.GET(forged);
  assert.equal((await anonymous.json()).teacher, false);
  const teacher = await api.GET(new Request(origin + '/api/me', { headers: { Cookie: cookie } }));
  assert.equal((await teacher.json()).teacher, true);
  const project = { name: '로컬 연동 검사', className: '가상 반', total: 2, end: '2099-12-31', modes: ['text', 'draw', 'melody'] };
  const make = cookieValue => new Request(origin + '/api/classes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookieValue, 'oai-authenticated-user-id': 'forged', 'oai-authenticated-user-email': user.email }, body: JSON.stringify({ project }) });
  assert.equal((await api.POST(make(''))).status, 403);
  const created = await api.POST(make(cookie));
  assert.equal(created.status, 200);
  const classId = (await created.json()).classId;
  assert.equal((await db.prepare('SELECT owner FROM classes WHERE id=?').bind(classId).first()).owner, `supabase:${user.id}`);
  const denied = await api.POST(new Request(origin + '/api/creation/credentials?classId=' + classId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
  assert.equal(denied.status, 403);
  // Model only the bucket catalogue for local migration validation.
  await pg.exec('CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);');
  const sql = await readFile('supabase/migrations/0002_private_storage.sql', 'utf8');
  await pg.exec(sql); await pg.exec(sql);
  assert.equal((await pg.query('SELECT public FROM storage.buckets')).rows[0].public, false);
  await pg.exec("UPDATE storage.buckets SET public=true WHERE id='harmony-media'");
  await assert.rejects(() => pg.exec(sql), /must be a new private bucket/);
  await pg.exec('ROLLBACK');
} finally { await pg.close(); }
console.log('PASS: verified teacher sessions, real API boundary, spoof rejection, refresh, CSRF, logout, rate limit, private Storage contracts and bucket migration. Remote Supabase not contacted.');
