import {env} from 'cloudflare:workers';
import {handleReviewer} from '../../lib/reviewer';
import {handle} from '../../lib/classroom';
import {handleCreation} from '../../lib/creation';
export const dynamic='force-dynamic';
function authFailure(error:any){
 const code=['AUTH_CONFIG_INVALID','AUTH_DATABASE_UNAVAILABLE'].includes(error?.code)?error.code:'AUTH_SERVICE_UNAVAILABLE';
 const message=code==='AUTH_CONFIG_INVALID'?'Supabase URL과 인증 키의 설정 형식을 확인해 주세요.':code==='AUTH_DATABASE_UNAVAILABLE'?'로그인 확인용 데이터베이스에 연결하지 못했어요.':'인증 서비스에 연결하지 못했어요.';
 const diagnostic=code==='AUTH_DATABASE_UNAVAILABLE'&&/^DB_(URL_INVALID|POOLER_USER_INVALID|URL_OPTIONS_UNSUPPORTED|STARTUP_UNSUPPORTED|AUTH_FAILED|TLS_UNTRUSTED|DNS_FAILED|CONNECTION_TIMEOUT|CONNECTION_CLOSED|NETWORK_UNREACHABLE|SCHEMA_MISSING|PERMISSION_DENIED|POOL_EXHAUSTED|QUERY_FAILED|UNKNOWN)$/.test(error?.diagnostic)?error.diagnostic:undefined;
 console.error('Teacher authentication failed:',code,diagnostic||'');
 return Response.json({error:message,code,...(diagnostic?{diagnostic}:{})},{status:503,headers:{'Cache-Control':'no-store'}});
}
const route=async(request:Request)=>{
 const runtime=env as Record<string,any>;
 const authRoute=/\/(?:api\/auth\/(?:login|logout)|signin-with-chatgpt|signout-with-chatgpt)$/.test(new URL(request.url).pathname);
 // A login GET only renders HTML; it must not require a working DB/Auth service.
 if(runtime.HARMONY_RUNTIME==='vercel'&&authRoute&&request.method==='GET'){
  try{return await runtime.handleAuth(request);}catch(error){return authFailure(error);}
 }
 if(runtime.HARMONY_RUNTIME==='vercel'&&!runtime.HARMONY_READY){
  const me=request.method==='GET'&&new URL(request.url).pathname==='/api/me';
  return Response.json(me?{teacher:false,siteOwner:false,reviewer:false,account:null,classes:[],setupRequired:true}:{error:'새 환경의 데이터베이스와 인증 연결을 준비 중입니다.',code:'BACKEND_NOT_CONFIGURED'}, {status:me?200:503,headers:{'Cache-Control':'no-store'}});
 }
 let cookies:string[]=[];
 if(runtime.HARMONY_RUNTIME==='vercel'){
  try{
   if(authRoute)return await runtime.handleAuth(request);
   const prepared=await runtime.prepareRequest(request);request=prepared.request;cookies=prepared.cookies;
  }catch(error){return authFailure(error);}
 }
 const result=await(new URL(request.url).pathname.startsWith('/api/reviewer/')?handleReviewer(request,env):new URL(request.url).pathname.startsWith('/api/creation/')?handleCreation(request):handle(request));
 cookies.forEach(cookie=>result.headers.append('Set-Cookie',cookie));return result;
};
export const GET=route;
export const POST=route;
