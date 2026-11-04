import assert from 'node:assert/strict';
import postgres from 'postgres';
import { connectionSettings, databaseDiagnostic } from '../lib/supabase/connection.mjs';

// Driver parsing only: no socket, network, or actual credentials.
const password = 'local-only@:/?#%+value';
const uri = `postgresql://postgres.localtest:${encodeURIComponent(password)}@test.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require`;
const settings = connectionSettings(uri);
const sql = postgres(settings.url, settings.options);
try {
  assert.equal(sql.options.pass, password, 'password is decoded exactly once by the driver');
  assert.equal(sql.options.port[0], 6543);
  assert.equal(sql.options.prepare, false);
  assert.equal(sql.options.ssl.rejectUnauthorized, true);
  assert.deepEqual(Object.keys(sql.options.connection), ['application_name']);
  assert.equal(sql.options.connection.statement_timeout, undefined);
  assert.equal(new URL(settings.url).search, '');
  assert.equal(connectionSettings(uri, 'line1\\nline2').options.ssl.ca, 'line1\nline2');
  assert.equal(connectionSettings(uri.replace('sslmode=require','sslmode=disable')).options.ssl.rejectUnauthorized,true);
} finally { await sql.end(); }
for (const [value, expected] of [
  ['not-a-url','DB_URL_INVALID'],
  ['"'+uri+'"','DB_URL_INVALID'],
  [uri.replace(encodeURIComponent(password),'[YOUR-PASSWORD]'),'DB_URL_INVALID'],
  [uri.replace('postgres.localtest:','postgres:'),'DB_POOLER_USER_INVALID'],
  [uri+'&options=unknown','DB_URL_OPTIONS_UNSUPPORTED'],
  [uri.replace(encodeURIComponent(password),'bad%ZZ'),'DB_URL_INVALID'],
]) assert.throws(()=>connectionSettings(value),error=>error.code===expected);
for (const [error, expected] of [
  [{code:'28P01'},'DB_AUTH_FAILED'],
  [{message:'Tenant or user not found'},'DB_AUTH_FAILED'],
  [{message:'unsupported startup parameter: statement_timeout'},'DB_STARTUP_UNSUPPORTED'],
  [{code:'SELF_SIGNED_CERT_IN_CHAIN'},'DB_TLS_UNTRUSTED'],
  [{cause:{code:'ENOTFOUND'}},'DB_DNS_FAILED'],
  [{code:'CONNECT_TIMEOUT'},'DB_CONNECTION_TIMEOUT'],
  [{code:'ECONNREFUSED'},'DB_NETWORK_UNREACHABLE'],
  [{code:'42P01'},'DB_SCHEMA_MISSING'],
  [{code:'42501'},'DB_PERMISSION_DENIED'],
  [{code:'53300'},'DB_POOL_EXHAUSTED'],
  [{message:'private-url-password-must-never-be-returned'},'DB_UNKNOWN'],
]) assert.equal(databaseDiagnostic(error),expected);
console.log('PASS: pooler options, single password decoding, strict TLS, unsupported startup hints removed, URL validation and safe failure classification. No network used.');
