import shell from '../public/classroom.html?raw';
import {env} from 'cloudflare:workers';
export function GET() {
 const html=(env as Record<string,unknown>).HARMONY_RUNTIME==='vercel'&&!(env as Record<string,unknown>).HARMONY_READY
  ? shell.replace('<main id="main">','<section role="status" style="padding:16px;background:#fff4d6">새 환경 준비 중: 화면을 확인할 수 있습니다. 로그인·학급 저장·파일 업로드는 Supabase 연결 후 사용할 수 있습니다.</section><main id="main">')
  : shell;
 return new Response(html, {headers: {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
