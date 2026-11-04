// Small compatibility boundary for the existing, parameterized D1 queries.
// SQL always comes from server source, never from request input.
export function postgresQuery(source) {
  let index = 0;
  const ignore = /^INSERT OR IGNORE\b/i.test(source);
  const sql = source.replace(/^INSERT OR IGNORE\b/i, 'INSERT').replace(
    /'(?:''|[^'])*'|"(?:""|[^"])*"|\?|\b[A-Za-z_][A-Za-z_0-9]*\b/g,
    token => token === '?' ? `$${++index}` : /^[A-Za-z_]/.test(token) && /[A-Z]/.test(token) && /[a-z]/.test(token) ? `"${token}"` : token,
  ).replace(/\) WHERE "authorId"/g, ') AS participants WHERE "authorId"');
  const tables = new Set(['classes', 'members', 'rules', 'works', 'votes', 'selected', 'scenes', 'media', 'limits', 'versions', 'revisions', 'creation_students', 'creation_sessions', 'creation_drafts', 'creation_submissions', 'creation_choices', 'creation_files', 'creation_history']);
  // Qualify table references, leaving identically named columns (e.g. media) alone.
  let qualified = sql.replace(/\b(FROM|JOIN|UPDATE|INTO)\s+([a-z_]+)/g,
    (match, keyword, table) => tables.has(table) ? `${keyword} harmony."${table}"` : match);
  if (/^INSERT INTO harmony\."limits"/.test(qualified) && qualified.includes('DO UPDATE SET')) {
    const split = qualified.indexOf('DO UPDATE SET');
    qualified = qualified.slice(0, split) + qualified.slice(split).replace(/(?<![.\w])(hits|reset)\b(?!\s*=)/g, 'limits.$1');
  }
  return qualified + (ignore ? ' ON CONFLICT DO NOTHING' : '');
}

const numeric = new Set(['created', 'updated', 'deletedAt', 'submitted', 'expires', 'reset', 'n', 'bytes']);
function normalise(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (numeric.has(key) && value !== null) {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw Error('Unsafe database integer');
      return [key, number];
    }
    return [key, value];
  }));
}

export function createDatabase(driver) {
  function prepare(source, parameters = []) {
    const sql = postgresQuery(source);
    const execute = async connection => {
      const result = await connection.query(sql, parameters);
      return { results: result.rows.map(normalise), success: true, meta: { changes: result.rowCount ?? result.affectedRows ?? 0 } };
    };
    return {
      bind: (...values) => prepare(source, values),
      all: () => execute(driver),
      run: () => execute(driver),
      first: async () => (await execute(driver)).results[0] ?? null,
      execute,
    };
  }
  return {
    prepare,
    // Submissions and version changes keep the original all-or-nothing semantics.
    batch: statements => driver.transaction(async connection => {
      const results = [];
      for (const statement of statements) results.push(await statement.execute(connection));
      return results;
    }),
  };
}
