import {teacherIdentity} from './reviewer';
import {env as bindings} from 'cloudflare:workers';

class Problem extends Error {constructor(public status:number,message:string,public current?:unknown){super(message)}}
function requireCondition(ok:unknown,status:number,message:string):asserts ok {if(!ok)throw new Problem(status,message)}
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=()=>crypto.randomUUID();
const hex=(a:Uint8Array)=>Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async(s:string)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
async function pinHash(pin:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)))}
function equal(a:string,b:string){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
function numericPin(){let n;do{n=crypto.getRandomValues(new Uint16Array(1))[0]}while(n>=60000);return String(n%10000).padStart(4,'0')}
export function normaliseCreation(input:any,complete=false){
 const bars=input?.song?.bars;requireCondition(Array.isArray(bars)&&bars.length===4,400,'멜로디는 네 마디예요.');let soundCount=0,lyricCount=0;
 const song={tempo:100,bars:bars.map((bar:any)=>{requireCondition(Array.isArray(bar)&&bar.length<=16,400,'한 마디의 음을 확인해 주세요.');let sum=0;const notes=bar.map((note:any)=>{requireCondition([.25,.5,.75,1,1.5,2,3,4].includes(note.duration),400,'음표 길이를 확인해 주세요.');requireCondition(note.pitch===null||Number.isInteger(note.pitch)&&note.pitch>=0&&note.pitch<=7,400,'음높이를 확인해 주세요.');sum+=note.duration;requireCondition(sum<=4.001,400,'한 마디는 네 박까지예요.');const lyric=note.pitch===null?'':Array.from(String(note.lyric||'').trim()).slice(0,1).join('');if(note.pitch!==null){soundCount++;if(lyric)lyricCount++}return {pitch:note.pitch,duration:note.duration,lyric}});if(complete)requireCondition(Math.abs(sum-4)<.001,400,'각 마디를 음표나 쉼표로 4박씩 채워주세요.');return notes})};
 const result={title:String(input?.title||'나의 작품').trim().slice(0,60)||'나의 작품',writing:String(input?.writing||'').slice(0,1200),song,imageId:input?.imageId?String(input.imageId).slice(0,80):null};
 if(complete){requireCondition(result.writing.trim(),400,'내 생각을 한 문장이나 짧은 말로 적어주세요.');requireCondition(soundCount>0,400,'소리가 나는 음을 하나 이상 넣어주세요.');requireCondition(lyricCount>0,400,'음표 아래에 노랫말을 한 글자 이상 넣어주세요.')}
 return result;
}
export async function handleCreation(req:Request){
 const env=bindings as any,db=env.DB;
 try{
 requireCondition(db,503,'학급 저장소를 준비하고 있어요.');const url=new URL(req.url),path=url.pathname.replace(/^\/api\/creation\/?/,'');
 if(req.method==='POST'){requireCondition(!req.headers.get('Origin')||req.headers.get('Origin')===url.origin,403,'이 사이트에서 다시 시도해 주세요.');requireCondition(Number(req.headers.get('Content-Length')||0)<=3*1024*1024,413,'파일 크기가 너무 커요.')}
 const query=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
 const one=async(sql:string,...args:any[])=>query(sql,...args).first();
 const all=async(sql:string,...args:any[])=>((await query(sql,...args).all()).results||[]);
 const run=async(sql:string,...args:any[])=>query(sql,...args).run();
 async function countLimit(key:string,max:number,period:number){const now=Date.now();await run('INSERT INTO limits (id,hits,reset) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=CASE WHEN reset<? THEN 1 ELSE hits+1 END,reset=CASE WHEN reset<? THEN ? ELSE reset END',key,now+period,now,now,now+period);const row=await one('SELECT hits FROM limits WHERE id=?',key);requireCondition(row.hits<=max,429,'여러 번 시도했어요. 잠시 후 다시 해주세요.')}
 const identity=await teacherIdentity(req,env),user=identity.user,owner=identity.teacher;
 if(path==='login'&&req.method==='POST'){
 const b:any=await req.json();requireCondition(/^\d{8}$/.test(String(b.code))&&Number.isInteger(Number(b.number))&&Number(b.number)>0&&Number(b.number)<=100&&/^\d{4}$/.test(String(b.pin)),400,'학급 코드·출석번호·비밀번호를 확인해 주세요.');
 const c=await one('SELECT * FROM classes WHERE code=?',b.code);requireCondition(c,401,'학급 코드나 비밀번호를 확인해 주세요.');const number=Number(b.number),key='pin:'+c.id+':'+number;
 const attempt=await one('SELECT hits,reset FROM limits WHERE id=?',key);requireCondition(!attempt||attempt.reset<Date.now()||attempt.hits<5,429,'로그인을 여러 번 틀렸어요. 15분 뒤 다시 하거나 선생님께 비밀번호 재설정을 부탁해 주세요.');
 await countLimit('login-ip:'+await digest(req.headers.get('CF-Connecting-IP')||'local'),80,60000);
 const student=await one('SELECT * FROM creation_students WHERE classId=? AND number=?',c.id,number);
 if(!student||!equal(await pinHash(String(b.pin),student?.salt||'invalid-salt'),student?.pinHash||'')){await countLimit(key,5,900000);throw new Problem(401,'출석번호나 비밀번호를 확인해 주세요.')}
 await run('DELETE FROM limits WHERE id=?',key);
 if(!b.confirm)return respond({confirm:true,number,className:JSON.parse(c.project).className});
 const token=random();await run('INSERT INTO creation_sessions (tokenHash,studentId,authVersion,expires) VALUES (?,?,?,?)',await digest(token),student.id,student.authVersion,Date.now()+7*86400000);return respond({token,classId:c.id,studentId:student.id,number});
 }
 const cid=url.searchParams.get('classId');requireCondition(cid,400,'학급을 먼저 선택해 주세요.');const classroom=await one('SELECT * FROM classes WHERE id=?',cid);requireCondition(classroom,404,'학급을 찾지 못했어요.');
 const token=req.headers.get('X-Classroom-Token');const teacher=owner&&classroom.owner===user&&!token;let student:any=null;
 if(token)student=await one('SELECT s.* FROM creation_sessions t JOIN creation_students s ON s.id=t.studentId WHERE t.tokenHash=? AND t.expires>? AND t.authVersion=s.authVersion AND s.classId=?',await digest(token),Date.now(),cid);
 requireCondition(teacher||student,403,'다시 로그인해 주세요.');const actor=teacher?user:student.id;
 const project=JSON.parse(classroom.project);const topic=String(project.topic||project.name||'우리 반 이야기');
 const teacherOnly=()=>requireCondition(teacher,403,'선생님만 할 수 있어요.');
 const activityOpen=()=>{if(!teacher)requireCondition(classroom.joinOpen&&Date.now()<=new Date(project.end+'T23:59:59+09:00').getTime(),403,'활동이 닫혀 있어요. 선생님께 확인해 주세요.')};
 const draftRow=async(id:string,includeDeleted=false)=>{const row=await one('SELECT * FROM creation_drafts WHERE id=? AND classId=?',id,cid);requireCondition(row&&(includeDeleted||!row.deletedAt)&&(teacher||row.studentId===student.id),404,'내 작품을 찾지 못했어요.');return row};
 const serialDraft=(row:any)=>({id:row.id,studentId:row.studentId,data:JSON.parse(row.data),revision:row.revision,updated:row.updated,deletedAt:row.deletedAt||null});
 async function imagePermission(imageId:any,studentId:string){if(imageId)requireCondition(await one('SELECT id FROM creation_files WHERE id=? AND classId=? AND studentId=?',imageId,cid,studentId),400,'그림 파일을 확인해 주세요.')}
 async function finalItems(){const rows=await all('SELECT s.number,c.* FROM creation_choices c JOIN creation_students s ON s.id=c.studentId WHERE c.classId=? ORDER BY c.position,s.number',cid);const result=[];for(const choice of rows){if(choice.teacherBlocked)continue;const selected=choice.teacherDraftId||(choice.delegate?null:choice.studentDraftId);if(!selected)continue;const submission=await one('SELECT * FROM creation_submissions WHERE draftId=? AND classId=? AND studentId=?',selected,cid,choice.studentId);if(submission)result.push({id:submission.draftId,studentId:choice.studentId,number:choice.number,chosenBy:choice.teacherDraftId?'teacher':'student',data:JSON.parse(submission.teacherData||submission.data)})}return result}
 if(path==='state'&&req.method==='GET'){
 const list=await all('SELECT d.*,s.number FROM creation_drafts d JOIN creation_students s ON s.id=d.studentId WHERE d.classId=? AND (?=1 OR d.studentId=?) ORDER BY s.number,d.updated DESC',cid,teacher?1:0,student?.id||'');
 const submitted=await all('SELECT * FROM creation_submissions WHERE classId=? AND (?=1 OR studentId=?)',cid,teacher?1:0,student?.id||'');
 const selection=await all('SELECT * FROM creation_choices WHERE classId=? AND (?=1 OR studentId=?)',cid,teacher?1:0,student?.id||'');
 return respond({reviewer:identity.reviewer&&classroom.owner===user,classId:cid,stage:classroom.stage,role:teacher?'teacher':'student',studentId:student?.id||null,number:student?.number||null,project:{...project,topic},joinOpen:!!classroom.joinOpen,code:teacher?classroom.code:undefined,students:teacher?await all('SELECT id,number FROM creation_students WHERE classId=? ORDER BY number',cid):[],drafts:list.filter((d:any)=>!d.deletedAt).map((d:any)=>({...serialDraft(d),number:d.number})),trash:list.filter((d:any)=>d.deletedAt).map((d:any)=>({...serialDraft(d),number:d.number})),submissions:submitted.map((s:any)=>({...s,data:JSON.parse(s.data),original:teacher?JSON.parse(s.original):null,teacherData:s.teacherData?JSON.parse(s.teacherData):null})),choices:selection,finalItems:await finalItems()});
 }
 if(path.startsWith('file/')&&req.method==='GET'){
 const id=path.slice(5),file=await one('SELECT * FROM creation_files WHERE id=? AND classId=?',id,cid);requireCondition(file,404,'그림을 찾지 못했어요.');if(!teacher&&file.studentId!==student.id)requireCondition((await finalItems()).some(x=>x.data.imageId===id),403,'볼 수 없는 그림이에요.');const obj=await env.BUCKET.get(file.objectKey);requireCondition(obj,404,'그림을 찾지 못했어요.');return new Response(obj.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 requireCondition(req.method==='POST',404,'요청을 찾지 못했어요.');await countLimit('creation-write:'+actor,120,60000);
 if(path==='credentials'){
 teacherOnly();const b:any=await req.json(),numbers=b.number?[Number(b.number)]:Array.from({length:Math.min(100,Math.max(1,Number(project.total)||24))},(_,i)=>i+1);const output=[];
 for(const number of numbers){requireCondition(Number.isInteger(number)&&number>=1&&number<=100,400,'출석번호를 확인해 주세요.');const previous=await one('SELECT * FROM creation_students WHERE classId=? AND number=?',cid,number);if(previous&&!b.reset)continue;const pin=numericPin(),salt=random(),password=await pinHash(pin,salt);if(previous)await run('UPDATE creation_students SET salt=?,pinHash=?,authVersion=authVersion+1 WHERE id=?',salt,password,previous.id);else await run('INSERT INTO creation_students (id,classId,number,salt,pinHash,created) VALUES (?,?,?,?,?,?)',uuid(),cid,number,salt,password,Date.now());await run('DELETE FROM limits WHERE id=?','pin:'+cid+':'+number);output.push({number,pin})}return respond({credentials:output});
 }
 if(path==='drawing'){
 activityOpen();const f=await req.formData(),row=await draftRow(String(f.get('draftId')));if(!teacher&&row.revision!==Number(f.get('revision')))throw new Problem(409,'다른 기기에 더 새로운 작품이 있어요.',serialDraft(row));const file=f.get('file');requireCondition(file instanceof File&&file.type==='image/png'&&file.size<=2*1024*1024&&file.size>0,400,'그림을 PNG 형식, 2MB 이하로 저장해 주세요.');const bytes=await file.arrayBuffer();requireCondition(new Uint8Array(bytes)[0]===137&&new Uint8Array(bytes)[1]===80,400,'그림 형식을 확인해 주세요.');const id=uuid(),key=cid+'/creation/'+row.id+'/'+id+'.png';await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/png'}});await run('INSERT INTO creation_files (id,classId,studentId,draftId,objectKey,created) VALUES (?,?,?,?,?,?)',id,cid,row.studentId,row.id,key,Date.now());return respond({id});
 }
 const b:any=await req.json();
 if(path==='trash'||path==='untrash'){
 if(path==='trash')requireCondition(!teacher,403,'학생 초안의 휴지통 이동은 학생이 해요.');activityOpen();const row=await draftRow(String(b.id),true);
 if(path==='trash')requireCondition(!await one('SELECT draftId FROM creation_submissions WHERE draftId=? AND classId=?',row.id,cid),409,'제출한 작품은 삭제할 수 없어요. 선생님께 알려주세요.');
 requireCondition(row.revision===Number(b.revision),409,'다른 기기에서 바뀌었어요. 목록을 다시 확인해 주세요.');
 const result=await query('UPDATE creation_drafts SET deletedAt=?,revision=revision+1 WHERE id=? AND classId=? AND revision=?'+(path==='trash'?' AND NOT EXISTS (SELECT 1 FROM creation_submissions WHERE draftId=creation_drafts.id)':'')+' RETURNING *',path==='trash'?Date.now():null,row.id,cid,row.revision).first();requireCondition(result,409,'작품 상태가 바뀌었어요. 목록을 다시 확인해 주세요.');return respond(serialDraft(result));
 }
 if(path==='new'){
 requireCondition(!teacher,403,'학생 작업실에서 작품을 시작해 주세요.');activityOpen();const count=await one('SELECT COUNT(*) n FROM creation_drafts WHERE studentId=?',student.id);requireCondition(count.n<50,409,'작품은 50개까지 만들 수 있어요.');const data=normaliseCreation(b.data||{title:'작품 '+(count.n+1),song:{tempo:100,bars:[[],[],[],[]]}});const id=uuid();await run('INSERT INTO creation_drafts (id,classId,studentId,data,updated) VALUES (?,?,?,?,?)',id,cid,student.id,JSON.stringify(data),Date.now());return respond(serialDraft(await draftRow(id)));
 }
 if(path==='save'){
 requireCondition(!teacher,403,'학생 초안은 학생이 저장해요.');activityOpen();const row=await draftRow(String(b.id)),data=normaliseCreation(b.data);await imagePermission(data.imageId,student.id);const updated=await query('UPDATE creation_drafts SET data=?,revision=revision+1,updated=? WHERE id=? AND classId=? AND studentId=? AND revision=? AND deletedAt IS NULL RETURNING *',JSON.stringify(data),Date.now(),row.id,cid,student.id,Number(b.revision)).first();if(!updated)throw new Problem(409,'다른 기기에 더 새로운 작품이 있어요.',serialDraft(await draftRow(row.id)));return respond(serialDraft(updated));
 }
 if(path==='submit'){
 requireCondition(!teacher,403,'학생 작업실에서 제출해 주세요.');activityOpen();const row=await draftRow(String(b.id));if(row.revision!==Number(b.revision))throw new Problem(409,'저장한 내용을 다시 확인해 주세요.',serialDraft(row));const data=normaliseCreation(JSON.parse(row.data),true);await imagePermission(data.imageId,student.id);const encoded=JSON.stringify(data);await db.batch([query('INSERT INTO creation_history (id,classId,draftId,actor,data,created) VALUES (?,?,?,?,?,?)',uuid(),cid,row.id,student.id,encoded,Date.now()),query('INSERT INTO creation_submissions (draftId,classId,studentId,data,original,revision,submitted) VALUES (?,?,?,?,?,?,?) ON CONFLICT(draftId) DO UPDATE SET data=excluded.data,revision=excluded.revision,submitted=excluded.submitted',row.id,cid,student.id,encoded,encoded,row.revision,Date.now())]);return respond({ok:true});
 }
 if(path==='choose'){
 const target=teacher?String(b.studentId):student.id;const person=await one('SELECT * FROM creation_students WHERE id=? AND classId=?',target,cid);requireCondition(person,404,'학생을 찾지 못했어요.');if(!teacher)activityOpen();if(b.draftId)requireCondition(await one('SELECT draftId FROM creation_submissions WHERE draftId=? AND studentId=? AND classId=?',b.draftId,target,cid),400,'제출한 작품 중에서 골라주세요.');
 if(teacher)await run('INSERT INTO creation_choices (classId,studentId,teacherDraftId,teacherBlocked,position) VALUES (?,?,?,?,?) ON CONFLICT(classId,studentId) DO UPDATE SET teacherDraftId=excluded.teacherDraftId,teacherBlocked=excluded.teacherBlocked',cid,target,b.draftId||null,b.draftId?0:1,person.number*10);
 else await run('INSERT INTO creation_choices (classId,studentId,studentDraftId,delegate,position) VALUES (?,?,?,?,?) ON CONFLICT(classId,studentId) DO UPDATE SET studentDraftId=excluded.studentDraftId,delegate=excluded.delegate',cid,target,b.draftId||null,b.delegate?1:0,person.number*10);return respond({ok:true});
 }
 if(path==='order'){
 teacherOnly();requireCondition(Array.isArray(b.students)&&b.students.length<=100&&new Set(b.students).size===b.students.length,400,'순서를 확인해 주세요.');for(const id of b.students)requireCondition(await one('SELECT id FROM creation_students WHERE id=? AND classId=?',id,cid),400,'다른 학급의 학생은 넣을 수 없어요.');await db.batch(b.students.map((id:string,i:number)=>query('UPDATE creation_choices SET position=? WHERE classId=? AND studentId=?',i,cid,id)));return respond({ok:true});
 }
 if(path==='recover'){
 teacherOnly();const submission=await one('SELECT * FROM creation_submissions WHERE draftId=? AND classId=?',b.id,cid);requireCondition(submission,404,'제출물을 찾지 못했어요.');const data=normaliseCreation(JSON.parse(b.source==='original'?submission.original:submission.data));data.title=(data.title+' (복구 사본)').slice(0,60);const id=uuid();await run('INSERT INTO creation_drafts (id,classId,studentId,data,updated) VALUES (?,?,?,?,?)',id,cid,submission.studentId,JSON.stringify(data),Date.now());return respond({id});
 }
 if(path==='teacher-edit'||path==='teacher-restore'){
 teacherOnly();const submission=await one('SELECT * FROM creation_submissions WHERE draftId=? AND classId=?',b.id,cid);requireCondition(submission,404,'제출물을 찾지 못했어요.');if(submission.teacherRevision!==Number(b.revision))throw new Problem(409,'다른 창에서 수정했어요. 다시 열어주세요.');const data=path==='teacher-restore'?null:normaliseCreation(b.data,true);if(data)await imagePermission(data.imageId,submission.studentId);const encoded=data?JSON.stringify(data):null;
 const saved=await query('UPDATE creation_submissions SET teacherData=?,teacherRevision=teacherRevision+1 WHERE draftId=? AND classId=? AND teacherRevision=? RETURNING draftId',encoded,b.id,cid,b.revision).first();requireCondition(saved,409,'다른 창에서 수정했어요. 다시 열어주세요.');await run('INSERT INTO creation_history (id,classId,draftId,actor,data,created) VALUES (?,?,?,?,?,?)',uuid(),cid,b.id,user,submission.teacherData||submission.data,Date.now());return respond({ok:true});
 }
 throw new Problem(404,'요청을 찾지 못했어요.');
 }catch(e:any){if(e instanceof Problem)return respond({error:e.message,current:e.current},e.status);console.error('Creation API failed',e?.name||'Error');return respond({error:'저장소와 연결하지 못했어요. 다시 시도해 주세요.'},500)}
}
