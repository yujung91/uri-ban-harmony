import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createDatabase } from '../lib/supabase/database.mjs';

export async function createTestDatabase() {
  const pg = new PGlite();
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await pg.exec(await readFile('supabase/migrations/0001_harmony.sql', 'utf8'));
  const wrap = client => ({ async query(sql, parameters) {
    try { return await client.query(sql, parameters); }
    catch (error) { console.error('Local PostgreSQL:', error.message, sql); throw error; }
  } });
  return { db: createDatabase({ ...wrap(pg), transaction: fn => pg.transaction(tx => fn(wrap(tx))) }), pg };
}
