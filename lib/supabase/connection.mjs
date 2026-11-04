const diagnoses = new Set(['DB_URL_INVALID', 'DB_POOLER_USER_INVALID', 'DB_URL_OPTIONS_UNSUPPORTED', 'DB_STARTUP_UNSUPPORTED', 'DB_AUTH_FAILED', 'DB_TLS_UNTRUSTED', 'DB_DNS_FAILED', 'DB_CONNECTION_TIMEOUT', 'DB_CONNECTION_CLOSED', 'DB_NETWORK_UNREACHABLE', 'DB_SCHEMA_MISSING', 'DB_PERMISSION_DENIED', 'DB_POOL_EXHAUSTED', 'DB_QUERY_FAILED', 'DB_UNKNOWN']);
function invalid(code) { throw Object.assign(Error('Invalid database configuration'), { code }); }

export function connectionSettings(value, ca) {
  let url;
  try {
    url = new URL(value.trim());
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || !/^\/[^/]+$/.test(url.pathname) || url.hash) invalid('DB_URL_INVALID');
    const password = decodeURIComponent(url.password);
    if (/\[YOUR[-_]PASSWORD\]|<[^>]+>/i.test(password)) invalid('DB_URL_INVALID');
    decodeURIComponent(url.username);
  } catch { invalid('DB_URL_INVALID'); }
  if (url.hostname.endsWith('.pooler.supabase.com') && !/^postgres\.[a-z0-9]+$/.test(decodeURIComponent(url.username))) invalid('DB_POOLER_USER_INVALID');
  // Prisma/client hints are not PostgreSQL startup parameters. Never forward them
  // (or sslmode) to the server. TLS verification is explicitly enforced below.
  for (const key of url.searchParams.keys()) {
    if (!['sslmode', 'pgbouncer', 'connection_limit', 'pool_timeout'].includes(key)) invalid('DB_URL_OPTIONS_UNSUPPORTED');
  }
  url.search = '';
  return {
    url: url.href,
    options: {
      ssl: { rejectUnauthorized: true, ...(ca ? { ca: ca.replace(/\\n/g, '\n') } : {}) },
      prepare: false, max: 3, connect_timeout: 10, idle_timeout: 20,
      // Keep startup parameters at driver defaults for Supavisor compatibility.
    },
  };
}

// Classify only. Never return/log raw errors, URLs, messages, SQL, or parameters.
export function databaseDiagnostic(error) {
  const code = typeof error?.code === 'string' ? error.code : error?.cause?.code;
  if (diagnoses.has(code)) return code;
  if (['28P01', '28000'].includes(code) || /tenant or user not found/i.test(error?.message || '')) return 'DB_AUTH_FAILED';
  if (/unsupported startup parameter/i.test(error?.message || '')) return 'DB_STARTUP_UNSUPPORTED';
  if (['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_OSSL_PEM_NO_START_LINE'].includes(code)) return 'DB_TLS_UNTRUSTED';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return 'DB_DNS_FAILED';
  if (['CONNECT_TIMEOUT', 'CONNECTION_TIMEOUT', 'ETIMEDOUT'].includes(code)) return 'DB_CONNECTION_TIMEOUT';
  if (['CONNECTION_CLOSED', 'CONNECTION_ENDED', 'ECONNRESET'].includes(code)) return 'DB_CONNECTION_CLOSED';
  if (['ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) return 'DB_NETWORK_UNREACHABLE';
  if (['42P01', '3F000'].includes(code)) return 'DB_SCHEMA_MISSING';
  if (code === '42501') return 'DB_PERMISSION_DENIED';
  if (code === '53300') return 'DB_POOL_EXHAUSTED';
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return 'DB_QUERY_FAILED';
  return 'DB_UNKNOWN';
}
