import postgres from 'postgres';
import { createDatabase } from './supabase/database.mjs';
import { createStorage } from './supabase/storage.mjs';
import { createAuth } from './supabase/auth.mjs';

// Substituted only in Next.js, never in the Sites/Vite runtime.
let database: ReturnType<typeof createDatabase> | undefined;
function configured() {
  return ['SUPABASE_URL', 'SUPABASE_DATABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].every(name => !!process.env[name]);
}
function db() {
  if (!configured()) return undefined;
  if (!database) {
    const sql = postgres(process.env.SUPABASE_DATABASE_URL!, {
      ssl: { rejectUnauthorized: true, ...(process.env.SUPABASE_DB_CA ? { ca: process.env.SUPABASE_DB_CA } : {}) },
      prepare: false, max: 3, connect_timeout: 10, idle_timeout: 20,
      connection: { statement_timeout: 15000 },
    });
    const wrap = (connection: typeof sql) => ({
      async query(text: string, parameters: unknown[]) {
        const rows = await connection.unsafe(text, parameters as postgres.ParameterOrJSON<never>[]);
        return { rows: [...rows], rowCount: rows.count };
      },
    });
    database = createDatabase({ ...wrap(sql), transaction: (fn: (client: ReturnType<typeof wrap>) => Promise<unknown>) => sql.begin(tx => fn(wrap(tx as unknown as typeof sql))) });
  }
  return database;
}
function config() {
  const url = process.env.SUPABASE_URL!;
  if (new URL(url).protocol !== 'https:') throw Error('Supabase HTTPS URL required');
  return { url: url.replace(/\/$/, ''), anonKey: process.env.SUPABASE_ANON_KEY! };
}
function auth() {
  // Rendering the login form must not parse URLs or contact Auth/PostgreSQL.
  return createAuth({ url: process.env.SUPABASE_URL || '', anonKey: process.env.SUPABASE_ANON_KEY || '', rateLimit: async (request: Request) => {
    const key = 'teacher-login:' + (process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local');
    const now = Date.now();
    const row = await db()!.prepare('INSERT INTO limits (id,hits,reset) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=CASE WHEN reset<? THEN 1 ELSE hits+1 END,reset=CASE WHEN reset<? THEN ? ELSE reset END RETURNING hits').bind(key, now + 900000, now, now, now + 900000).first();
    return row.hits <= 10;
  } });
}
export const env = {
  HARMONY_RUNTIME: 'vercel',
  get HARMONY_READY() { return configured(); },
  get DB() { return db(); },
  get BUCKET() { return configured() ? createStorage({ url: config().url, secretKey: process.env.SUPABASE_SERVICE_ROLE_KEY!, bucket: process.env.SUPABASE_STORAGE_BUCKET || 'harmony-media' }) : undefined; },
  get TEACHER_EMAIL() { return process.env.TEACHER_EMAIL; },
  get REVIEW_USERNAME() { return process.env.REVIEW_USERNAME; },
  get REVIEW_PASSWORD_HASH() { return process.env.REVIEW_PASSWORD_HASH; },
  get REVIEW_SESSION_SECRET() { return process.env.REVIEW_SESSION_SECRET; },
  prepareRequest: (request: Request) => auth().prepareRequest(request),
  handleAuth: (request: Request) => auth().handle(request),
};
