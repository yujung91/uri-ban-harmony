// A separate synthetic classroom identity. Never grant this identity the site owner's ID.
export const REVIEW_OWNER='reviewer:classroom-demo-v1';
export const REVIEW_CLASS='reviewer-demo-class-v1';
const cookieName='harmony-review';
const hex=(v:Uint8Array)=>Array.from(v,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async(v:string)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))));
const json=(data:unknown,status=200,cookie?:string)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export function isSiteOwner(req:Request,env:any){const uid=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');return !!(uid&&email&&env.TEACHER_EMAIL&&email.toLowerCase()===env.TEACHER_EMAIL.toLowerCase())}
async function sign(value:string,secret:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))))}
function equal(a:string,b:string){let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0}
async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)))}
const access=async(db:any)=>await db.prepare('SELECT hits,reset FROM limits WHERE id=?').bind('reviewer-access').first();
export async function reviewerIdentity(req:Request,env:any){
 if(!env.REVIEW_SESSION_SECRET||!env.REVIEW_PASSWORD_HASH)return false;
 const token=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 const parts=token.split('.');if(parts.length!==4)return false;
 const [issued,expires,nonce,signature]=parts;if(!/^\d+$/.test(issued)||!/^\d+$/.test(expires)||!/^\w{64}$/.test(nonce)||Number(expires)<=Date.now()||Number(issued)>Date.now()||Number(expires)-Number(issued)>86400000)return false;
 if(!equal(await sign(parts.slice(0,3).join('.'),env.REVIEW_SESSION_SECRET),signature))return false;
 const row=await access(env.DB);return !row||(row.hits===1&&Number(issued)>row.reset);
}
export async function teacherIdentity(req:Request,env:any){
 if(await reviewerIdentity(req,env))return {teacher:true,user:REVIEW_OWNER,email:'점검용 교사',reviewer:true};
 const teacher=!!(req.headers.get('oai-authenticated-user-id')&&req.headers.get('oai-authenticated-user-email'));return {teacher,user:req.headers.get('oai-authenticated-user-id'),email:teacher?req.headers.get('oai-authenticated-user-email'):null,reviewer:false};
}
async function seed(db:any){
 const existing=await db.prepare('SELECT id FROM classes WHERE id=? AND owner=?').bind(REVIEW_CLASS,REVIEW_OWNER).first();if(existing)return;
 let code='';for(let i=0;i<20;i++){const n=crypto.getRandomValues(new Uint32Array(1))[0];if(n>=4200000000)continue;code=String(n%100000000).padStart(8,'0');if(!await db.prepare('SELECT id FROM classes WHERE code=?').bind(code).first())break;code=''}if(!code)throw Error('code');
 const project={name:'점검용 우리 반 하모니',className:'가상 학급',topic:"즐거운 학교생활을 위해 우리 반 친구들이 지켜야 할 일은 무엇인가요?",total:4,end:'2099-12-31',guide:'가상의 학생과 예시 작품으로 자유롭게 체험하세요. 실제 학급과 분리되어 있습니다.',modes:['text','melody','draw','rhythm','image','video']};
 const q=(sql:string,...args:any[])=>db.prepare(sql).bind(...args),statements=[q('INSERT OR IGNORE INTO classes (id,owner,code,project,created) VALUES (?,?,?,?,?)',REVIEW_CLASS,REVIEW_OWNER,code,JSON.stringify(project),Date.now())];
 for(let number=1;number<=3;number++){
  const sid='review-demo-student-'+number,did='review-demo-work-'+number,salt=random();
  const data={title:['친구의 이야기를 들어요','복도에서는 천천히','차례를 지켜요'][number-1],writing:['친구의 말을 끝까지 들어요.','복도에서는 천천히 걸어요.','차례를 지키고 서로 배려해요.'][number-1],song:{tempo:100,bars:Array.from({length:4},(_,bar)=>Array.from({length:4},(_,i)=>({pitch:(i+bar+number)%8,duration:1,lyric:Array.from(['친구말을끝까지잘들어봐요함께해요','복도에선걸어가요천천히요안전해요','차례대로기다려요서로서로배려해요'][number-1])[bar*4+i]||'요'})))},imageId:null};
  statements.push(q('INSERT OR IGNORE INTO creation_students (id,classId,number,salt,pinHash,created) VALUES (?,?,?,?,?,?)',sid,REVIEW_CLASS,number,salt,await passwordHash(random(),salt),Date.now()),q('INSERT OR IGNORE INTO creation_drafts (id,classId,studentId,data,updated) VALUES (?,?,?,?,?)',did,REVIEW_CLASS,sid,JSON.stringify(data),Date.now()));
  if(number<3)statements.push(q('INSERT OR IGNORE INTO creation_submissions (draftId,classId,studentId,data,original,revision,submitted) VALUES (?,?,?,?,?,?,?)',did,REVIEW_CLASS,sid,JSON.stringify(data),JSON.stringify(data),1,Date.now()),q('INSERT OR IGNORE INTO creation_choices (classId,studentId,teacherDraftId,position) VALUES (?,?,?,?)',REVIEW_CLASS,sid,did,number*10));
 }
 await db.batch(statements);
}

// Add revised examples once, retaining every existing demo/student work.
async function schoolExamples(db:any){
 if(await db.prepare('SELECT id FROM limits WHERE id=?').bind('review-school-examples-v2').first())return;
 const c=await db.prepare('SELECT project FROM classes WHERE id=? AND owner=?').bind(REVIEW_CLASS,REVIEW_OWNER).first();if(!c)return;
 const project=JSON.parse(c.project);project.topic="즐거운 학교생활을 위해 우리 반 친구들이 지켜야 할 일은 무엇인가요?";
 const q=(sql:string,...args:any[])=>db.prepare(sql).bind(...args),ss=[q('UPDATE classes SET project=? WHERE id=? AND owner=?',JSON.stringify(project),REVIEW_CLASS,REVIEW_OWNER)];
 const titles=['친구의 이야기를 들어요','복도에서는 천천히','차례를 지켜요'],words=['친구말을끝까지잘들어봐요함께해요','복도에선걸어가요천천히요안전해요','차례대로기다려요서로서로배려해요'],writing=['친구의 말을 끝까지 들어요.','복도에서는 천천히 걸어요.','차례를 지키고 서로 배려해요.'];
 for(let n=1;n<=3;n++){const sid='review-demo-student-'+n,old='review-demo-work-'+n,did='review-school-example-v2-'+n;const previous=await q('SELECT data FROM creation_drafts WHERE id=?',old).first();if(previous&&JSON.parse(previous.data).writing===writing[n-1])continue;
 const data=JSON.stringify({title:titles[n-1],writing:writing[n-1],imageId:null,song:{tempo:100,bars:Array.from({length:4},(_,b)=>Array.from({length:4},(_,i)=>({pitch:([0,2,4,2][i]+b)%8,duration:1,lyric:Array.from(words[n-1])[b*4+i]})))}});
 ss.push(q('INSERT OR IGNORE INTO creation_drafts (id,classId,studentId,data,updated) VALUES (?,?,?,?,?)',did,REVIEW_CLASS,sid,data,Date.now()),q('INSERT OR IGNORE INTO creation_submissions (draftId,classId,studentId,data,original,revision,submitted) VALUES (?,?,?,?,?,?,?)',did,REVIEW_CLASS,sid,data,data,1,Date.now()));
 if(n<3)ss.push(q('UPDATE creation_choices SET teacherDraftId=? WHERE classId=? AND studentId=? AND teacherDraftId=?',did,REVIEW_CLASS,sid,old));
 }
 ss.push(q('INSERT OR IGNORE INTO limits (id,hits,reset) VALUES (?,1,?)','review-school-examples-v2',Number.MAX_SAFE_INTEGER));await db.batch(ss);
}

export async function handleReviewer(req:Request,env:any){try{
 const url=new URL(req.url),path=url.pathname.replace('/api/reviewer/',''),db=env.DB;
 if(!db)return json({error:'저장소를 준비 중입니다.'},503);
 if(req.method!=='POST')return json({error:'요청을 찾지 못했어요.'},404);
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin)return json({error:'같은 사이트에서 다시 시도해 주세요.'},403);
 if(Number(req.headers.get('Content-Length')||0)>4096)return json({error:'입력이 너무 길어요.'},413);
 const cookie=(value:string,age:number)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${url.protocol==='https:'?'; Secure':''}`;
 if(path==='logout')return json({ok:true},200,cookie('',0));
 if(path==='access'){
  if(!isSiteOwner(req,env))return json({error:'사이트 소유자만 설정할 수 있어요.'},403);
  const b:any=await req.json();if(typeof b.enabled!=='boolean')return json({error:'설정을 확인해 주세요.'},400);
  await db.batch([db.prepare('INSERT INTO limits (id,hits,reset) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET hits=excluded.hits,reset=excluded.reset').bind('reviewer-access',b.enabled?1:0,Date.now()),db.prepare('UPDATE creation_students SET authVersion=authVersion+1 WHERE classId IN (SELECT id FROM classes WHERE owner=?)').bind(REVIEW_OWNER)]);return json({enabled:b.enabled});
 }
 if(path==='login'){
  if(!env.REVIEW_SESSION_SECRET||!env.REVIEW_PASSWORD_HASH)return json({error:'점검 계정이 준비되지 않았어요.'},503);
  const row=await access(db);if(row&&row.hits!==1)return json({error:'점검 계정 사용이 종료되었어요.'},403);
  const b:any=await req.json(),key='review-login:'+await digest(req.headers.get('CF-Connecting-IP')||'local'),now=Date.now();
  const limit=await db.prepare('SELECT hits,reset FROM limits WHERE id=?').bind(key).first();if(limit&&limit.reset>now&&limit.hits>=10)return json({error:'로그인을 여러 번 시도했어요. 15분 후 다시 시도해 주세요.'},429);
  await db.prepare('INSERT INTO limits (id,hits,reset) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=CASE WHEN reset<? THEN 1 ELSE hits+1 END,reset=CASE WHEN reset<? THEN ? ELSE reset END').bind(key,now+900000,now,now,now+900000).run();
  const [salt,hash]=String(env.REVIEW_PASSWORD_HASH).split(':');if(typeof b.password!=='string'||b.password.length>128||b.username!==(env.REVIEW_USERNAME||'demo')||!equal(await passwordHash(b.password,salt),hash))return json({error:'점검용 아이디와 비밀번호를 확인해 주세요.'},401);
  await seed(db);await schoolExamples(db);await db.prepare('DELETE FROM limits WHERE id=?').bind(key).run();const issued=Date.now(),value=[issued,issued+86400000,random()].join('.');return json({classId:REVIEW_CLASS},200,cookie(value+'.'+await sign(value,env.REVIEW_SESSION_SECRET),86400));
 }
 if(path==='student'){
  if(!await reviewerIdentity(req,env))return json({error:'점검용 교사로 다시 로그인해 주세요.'},403);
  const b:any=await req.json();const c=await db.prepare('SELECT id FROM classes WHERE id=? AND owner=?').bind(String(b.classId),REVIEW_OWNER).first();if(!c)return json({error:'점검용 학급에서만 체험할 수 있어요.'},403);
  const s=await db.prepare('SELECT id,number,authVersion FROM creation_students WHERE classId=? AND number=?').bind(c.id,Number(b.number)).first();if(!s)return json({error:'먼저 해당 번호의 비밀번호를 발급해 주세요.'},404);
  const token=random();await db.prepare('INSERT INTO creation_sessions (tokenHash,studentId,authVersion,expires) VALUES (?,?,?,?)').bind(await digest(token),s.id,s.authVersion,Date.now()+86400000).run();return json({classId:c.id,studentId:s.id,number:s.number,token});
 }
 return json({error:'요청을 찾지 못했어요.'},404);
 }catch(e){console.error('Reviewer API failed');return json({error:'점검 작업실에 연결하지 못했어요. 다시 시도해 주세요.'},500)}}

