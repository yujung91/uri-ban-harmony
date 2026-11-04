import {env} from 'cloudflare:workers';
import {handleReviewer} from '../../lib/reviewer';
import {handle} from '../../lib/classroom';
import {handleCreation} from '../../lib/creation';
export const dynamic='force-dynamic';
const route=async(request:Request)=>{
 const runtime=env as Record<string,any>;
 if(runtime.HARMONY_RUNTIME==='vercel'&&!runtime.HARMONY_READY){
  const me=request.method==='GET'&&new URL(request.url).pathname==='/api/me';
  return Response.json(me?{teacher:false,siteOwner:false,reviewer:false,account:null,classes:[],setupRequired:true}:{error:'새 환경의 데이터베이스와 인증 연결을 준비 중입니다.',code:'BACKEND_NOT_CONFIGURED'}, {status:me?200:503,headers:{'Cache-Control':'no-store'}});
 }
 let cookies:string[]=[];
 if(runtime.HARMONY_RUNTIME==='vercel'){
  try{
   if(/\/(?:api\/auth\/(?:login|logout)|signin-with-chatgpt|signout-with-chatgpt)$/.test(new URL(request.url).pathname))return await runtime.handleAuth(request);
   const prepared=await runtime.prepareRequest(request);request=prepared.request;cookies=prepared.cookies;
  }catch{return Response.json({error:'인증 서비스에 연결하지 못했어요.'},{status:503,headers:{'Cache-Control':'no-store'}});}
 }
 const result=await(new URL(request.url).pathname.startsWith('/api/reviewer/')?handleReviewer(request,env):new URL(request.url).pathname.startsWith('/api/creation/')?handleCreation(request):handle(request));
 cookies.forEach(cookie=>result.headers.append('Set-Cookie',cookie));return result;
};
export const GET=route;
export const POST=route;
