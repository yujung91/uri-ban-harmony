import {env} from 'cloudflare:workers';
import {handleReviewer} from '../../lib/reviewer';
import {handle} from '../../lib/classroom';
import {handleCreation} from '../../lib/creation';
export const dynamic='force-dynamic';
const route=(request:Request)=>{
 if((env as Record<string,unknown>).HARMONY_RUNTIME==='vercel'){
  const me=request.method==='GET'&&new URL(request.url).pathname==='/api/me';
  return Response.json(me?{teacher:false,siteOwner:false,reviewer:false,account:null,classes:[],setupRequired:true}:{error:'새 환경의 데이터베이스와 인증 연결을 준비 중입니다.',code:'BACKEND_NOT_CONFIGURED'}, {status:me?200:503,headers:{'Cache-Control':'no-store'}});
 }
 return new URL(request.url).pathname.startsWith('/api/reviewer/')?handleReviewer(request,env):new URL(request.url).pathname.startsWith('/api/creation/')?handleCreation(request):handle(request);
};
export const GET=route;
export const POST=route;
