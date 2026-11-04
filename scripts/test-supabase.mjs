// Reuse every existing business assertion against real, local PostgreSQL (WASM).
// No project URL, DB password, remote service or real student data is used.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { createTestDatabase } from './supabase-test-db.mjs';

const helper = new URL('./supabase-test-db.mjs', import.meta.url).href;
await mkdir('.sites-runtime/supabase-tests', { recursive: true });
for (const suite of ['classroom', 'creation', 'reviewer']) {
  let source = await readFile(`scripts/test-${suite}.mjs`, 'utf8');
  source = source.split('\n').filter(line => !line.startsWith("import {DatabaseSync}") && !line.startsWith('const db=new DatabaseSync') && !line.startsWith('const sql=new DatabaseSync') && !line.startsWith('for(const f') && !line.startsWith('const wrap=')).map(line => {
    if (line.includes('DB:') && (line.includes(',BUCKET:') || line.includes(',TEACHER_EMAIL:'))) {
      const start = line.indexOf('DB:');
      const end = line.includes(',BUCKET:') ? line.indexOf(',BUCKET:') : line.indexOf(',TEACHER_EMAIL:');
      return line.slice(0, start) + 'DB:db' + line.slice(end);
    }
    return line;
  }).join('\n');
  const transformed = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    transformers: { before: [context => root => {
      const f = context.factory;
      const visit = node => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['get', 'run'].includes(node.expression.name.text)) {
          const prepared = node.expression.expression;
          if (ts.isCallExpression(prepared) && ts.isPropertyAccessExpression(prepared.expression) && prepared.expression.name.text === 'prepare' && ['db', 'sql'].includes(prepared.expression.expression.getText())) {
            const bound = f.createCallExpression(f.createPropertyAccessExpression(prepared, 'bind'), undefined, node.arguments);
            return f.createParenthesizedExpression(f.createAwaitExpression(f.createCallExpression(f.createPropertyAccessExpression(bound, node.expression.name.text === 'get' ? 'first' : 'run'), undefined, [])));
          }
        }
        return ts.visitEachChild(node, visit, context);
      };
      return ts.visitNode(root, visit);
    }] },
  }).outputText;
  const filename = path.resolve(`.sites-runtime/supabase-tests/${suite}.mjs`);
  await writeFile(filename, `import { createTestDatabase } from ${JSON.stringify(helper)};\nconst {db,pg}=await createTestDatabase();const sql=db;\n` + transformed + '\nawait pg.close();\n');
  console.log(`PostgreSQL regression suite: ${suite}`);
  await import(pathToFileURL(filename).href + `?run=${Date.now()}`);
}

const { db, pg } = await createTestDatabase();
try {
  // Repeated migration leaves the schema intact and imports no data.
  await pg.exec(await readFile('supabase/migrations/0001_harmony.sql', 'utf8'));
  const tables = (await pg.query("SELECT tablename FROM pg_tables WHERE schemaname='harmony'")).rows;
  assert.equal(tables.length, 18);
  assert.equal((await pg.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='harmony' AND c.relkind='r' AND c.relrowsecurity")).rows[0].n, 18);
  for (const role of ['anon', 'authenticated']) {
    await pg.exec(`SET ROLE ${role}`);
    await assert.rejects(() => pg.query('SELECT * FROM harmony.creation_students'), /permission denied/);
    await pg.exec('RESET ROLE');
  }
  await assert.rejects(() => db.batch([
    db.prepare('INSERT INTO limits (id,hits,reset) VALUES (?,1,1)').bind('rollback'),
    db.prepare('INSERT INTO limits (id,hits,reset) VALUES (?,1,1)').bind('rollback'),
  ]));
  assert.equal(await db.prepare('SELECT * FROM limits WHERE id=?').bind('rollback').first(), null);
  const literal = "literal? classId ' text";
  await db.prepare('INSERT INTO limits (id,hits,reset) VALUES (?,1,?)').bind(literal, Date.now()).run();
  assert.equal((await db.prepare('SELECT * FROM limits WHERE id=?').bind(literal).first()).id, literal);
  console.log('PASS: 18 RLS-enabled tables, repeatable migration, anon/authenticated denial, bound parameters and transactional rollback.');
} finally { await pg.close(); }
