import {env} from 'cloudflare:workers';
import {handleReviewer} from '../../lib/reviewer';
import {handle} from '../../lib/classroom';
import {handleCreation} from '../../lib/creation';
export const dynamic='force-dynamic';
const route=(request:Request)=>new URL(request.url).pathname.startsWith('/api/reviewer/')?handleReviewer(request,env):new URL(request.url).pathname.startsWith('/api/creation/')?handleCreation(request):handle(request);
export const GET=route;
export const POST=route;
