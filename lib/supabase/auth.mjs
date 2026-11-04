const accessCookie = 'harmony-teacher-access';
const refreshCookie = 'harmony-teacher-refresh';
function requestOrigin(req) {
  const url = new URL(req.url);
  // Next.js may use localhost internally. Host is the browser-facing authority;
  // do not accept an arbitrary Origin or client-supplied forwarded-host header.
  if(req.headers.get('host'))url.host=req.headers.get('host');
  return url.origin;
}
const page = (content, status = 200) => new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>우리 반 하모니 · 교사 로그인</title><body><main>${content}</main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", 'X-Content-Type-Options': 'nosniff' } });

export function createAuth({ url, anonKey, request = fetch, rateLimit = async (_request) => true }) {
  const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
  const serviceUrl = () => {
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !anonKey.trim()) throw Error();
      return parsed.origin;
    } catch { throw Object.assign(Error('Invalid auth configuration'), { code: 'AUTH_CONFIG_INVALID' }); }
  };
  const cookie = (req, name, value, age) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
  const cookiesFor = (req, session) => [
    cookie(req, accessCookie, session.access_token, Math.min(Number(session.expires_in) || 3600, 86400)),
    cookie(req, refreshCookie, session.refresh_token, 7 * 86400),
  ];
  const cleared = req => [cookie(req, accessCookie, '', 0), cookie(req, refreshCookie, '', 0)];
  const sessionRequest = async (grant, body) => {
    const response = await request(`${serviceUrl()}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
    if (!response.ok) return null;
    const session = await response.json();
    return typeof session.access_token === 'string' && typeof session.refresh_token === 'string' ? session : null;
  };
  const getUser = async token => {
    if (!token) return null;
    const response = await request(`${serviceUrl()}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) return null;
    const user = await response.json();
    // Supabase validates the token, not a locally decoded JWT or user header.
    return user.id && user.email && user.email_confirmed_at ? user : null;
  };
  return {
    async prepareRequest(req) {
      const cleanHeaders = new Headers(req.headers);
      for (const name of [...cleanHeaders.keys()]) {
        if (name.startsWith('oai-authenticated-user-') || name === 'cf-connecting-ip') cleanHeaders.delete(name);
      }
      // Vercel supplies this header. Never trust a client-provided CF IP header.
      cleanHeaders.set('CF-Connecting-IP', process.env.VERCEL === '1' ? (req.headers.get('x-vercel-forwarded-for') || 'unknown') : 'local');
      const values = Object.fromEntries((req.headers.get('cookie') || '').split(';').map(part => {
        const split = part.indexOf('=');
        try { return [part.slice(0, split).trim(), decodeURIComponent(part.slice(split + 1))]; } catch { return ['', '']; }
      }));
      let user = await getUser(values[accessCookie]);
      let cookies = [];
      if (!user && values[refreshCookie]) {
        const session = await sessionRequest('refresh_token', { refresh_token: values[refreshCookie] });
        user = session ? await getUser(session.access_token) : null;
        cookies = user ? cookiesFor(req, session) : cleared(req);
      }
      if (user) {
        cleanHeaders.set('oai-authenticated-user-id', `supabase:${user.id}`);
        cleanHeaders.set('oai-authenticated-user-email', user.email);
      }
      const publicUrl = new URL(req.url);publicUrl.host=new URL(requestOrigin(req)).host;
      const canonicalRequest = publicUrl.href===req.url?req:new Request(publicUrl.href,req);
      return { request: new Request(canonicalRequest, { headers: cleanHeaders }), cookies };
    },
    async handle(req) {
      const path = new URL(req.url).pathname;
      const logout = path.endsWith('/logout') || path.endsWith('/signout-with-chatgpt');
      const returnTo = new URL(req.url).searchParams.get('return_to') === '/?newclass=1' ? '/?newclass=1' : '/';
      const loginAction = '/api/auth/login?return_to=' + encodeURIComponent(returnTo);
      if (req.method === 'GET') return logout
        ? page('<h1>교사 로그아웃</h1><form method="post" action="/api/auth/logout"><button>로그아웃</button></form><a href="/">돌아가기</a>')
        : page('<h1>교사 로그인</h1><p>Supabase에 등록된 교사 이메일과 비밀번호로 로그인하세요.</p><form method="post" action="' + loginAction + '"><label>이메일 <input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>비밀번호 <input name="password" type="password" autocomplete="current-password" required maxlength="128"></label><button>로그인</button></form><a href="/">돌아가기</a>');
      if (req.method !== 'POST') return page('지원하지 않는 요청입니다.', 405);
      if (req.headers.get('Origin') !== requestOrigin(req)) return page('같은 사이트에서 다시 시도해 주세요.', 403);
      if (Number(req.headers.get('Content-Length') || 0) > 4096) return page('입력이 너무 길어요.', 413);
      if (logout) {
        const response = new Response(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store' } });
        cleared(req).forEach(value => response.headers.append('Set-Cookie', value));
        return response;
      }
      const input = await req.formData(), email = String(input.get('email') || '').trim(), password = String(input.get('password') || '');
      if (!email || email.length > 254 || !password || password.length > 128) return page('이메일과 비밀번호를 확인해 주세요.', 400);
      serviceUrl();
      let allowed;
      try { allowed = await rateLimit(req); }
      catch { throw Object.assign(Error('Login database unavailable'), { code: 'AUTH_DATABASE_UNAVAILABLE' }); }
      if (!allowed) return page('로그인 시도가 많아요. 잠시 후 다시 시도해 주세요.', 429);
      const session = await sessionRequest('password', { email, password });
      const user = session ? await getUser(session.access_token) : null;
      if (!user) return page('<p>로그인하지 못했어요. 계정 정보를 확인해 주세요.</p><a href="/api/auth/login">다시 시도</a>', 401);
      const response = new Response(null, { status: 303, headers: { Location: returnTo, 'Cache-Control': 'no-store' } });
      cookiesFor(req, session).forEach(value => response.headers.append('Set-Cookie', value));
      return response;
    },
  };
}
