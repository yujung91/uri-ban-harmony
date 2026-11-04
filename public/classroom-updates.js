'use strict';
function creationMissingBars(song){return song.bars.map((bar,index)=>({index,beats:Math.round((4-bar.reduce((s,n)=>s+n.duration,0))*4)/4})).filter(x=>Math.abs(x.beats)>.001)}
function creationTrashView(){const list=creationState.trash||[];return `<details class="creation-trash"><summary>휴지통 (${list.length})</summary><p>삭제한 작품을 다시 꺼낼 수 있어요.</p>${list.map(d=>`<div class="progress-row"><b>${esc(d.data.title)}</b>${btn('다시 꺼내기','c-untrash-'+d.id,'secondary')}</div>`).join('')||'<p>휴지통이 비어 있어요.</p>'}</details>`}
function loadCreationView(){try{const v=JSON.parse(sessionStorage.getItem('harmony-view:'+creationSession.classId))||{};const target=location.hash.slice(1)||v.page||'home';if(['home','review','harmony','workshop','archive'].includes(target))page=target;creationStudentFilter=v.filter||'all'}catch{}}
function rememberCreationView(){if(!creationSession)return;try{sessionStorage.setItem('harmony-view:'+creationSession.classId,JSON.stringify({page,filter:creationStudentFilter}));if(location.hash!=='#'+page)history.replaceState(null,'','#'+page)}catch{}}
function creationQr(){const qr=qrcode(0,'M');qr.addData(location.origin+'/?code='+encodeURIComponent(creationState.code));qr.make();return qr}
function creationQrPng(){const qr=creationQr(),n=qr.getModuleCount(),scale=16,canvas=document.createElement('canvas');canvas.width=canvas.height=(n+8)*scale;const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='black';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))c.fillRect((x+4)*scale,(y+4)*scale,scale,scale);return canvas.toDataURL('image/png')}
function creationInvite(){if(!creationTeacher())return;if($('#dialog').open)close();const url=location.origin+'/?code='+encodeURIComponent(creationState.code),qr=creationQr();modal('학생 접속 QR',`<h3>${esc(creationState.project.className)}</h3><div class="class-qr" role="img" aria-label="학생 접속 QR코드">${qr.createSvgTag({cellSize:7,margin:28,scalable:true})}</div><p class="qr-instruction">카메라로 찍으면 학급 코드가 자동으로 들어가요.</p><p>학급 코드 <b>${esc(creationState.code)}</b></p><label for="creation-qr-url">학생 접속 주소</label><input id="creation-qr-url" readonly value="${esc(url)}"><p>학생은 자기 출석번호와 비밀번호만 입력해요.</p><div class="toolbar">${btn('QR 이미지 저장','c-download-qr','secondary')}${btn('주소 복사','c-copy-qr','secondary')}${btn('QR 크게 보기','c-large-qr','secondary')}</div>`,()=>close(),'닫기')}
async function toggleCreationFullscreen(){const player=$('#creation-player');if(!player)return;if(document.fullscreenElement){await document.exitFullscreen();return}if(player.classList.contains('player-expanded')){player.classList.remove('player-expanded');document.body.classList.remove('player-open');updateFullscreenLabel();return}try{if(!player.requestFullscreen)throw Error('fallback');await player.requestFullscreen()}catch{player.classList.add('player-expanded');document.body.classList.add('player-open')}updateFullscreenLabel()}
function updateFullscreenLabel(){const button=document.querySelector('[data-action="c-fullscreen"]');if(button)button.textContent=document.fullscreenElement||$('#creation-player')?.classList.contains('player-expanded')?'⛶ 원래 화면':'⛶ 전체 화면'}
document.addEventListener('fullscreenchange',updateFullscreenLabel);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#creation-player')?.classList.contains('player-expanded')){e.preventDefault();toggleCreationFullscreen()}});
async function creationUpdateAction(action){
 if(action==='c-fullscreen'){await toggleCreationFullscreen();return true}
 if(action==='c-download-qr'){const a=document.createElement('a');a.href=creationQrPng();a.download=creationState.project.className+'-학생접속QR.png';a.click();return true}
 if(action==='c-copy-qr'){try{await navigator.clipboard.writeText($('#creation-qr-url').value);toast('학생 접속 주소를 복사했어요.')}catch{$('#creation-qr-url').select();toast('주소를 선택했어요. 복사해 주세요.')}return true}
 if(action==='c-large-qr'){$('#dialog').classList.toggle('qr-enlarged');return true}
 if(action.startsWith('c-cancel-choice-')){if(confirm('최종 선정을 취소할까요? 작품은 보존하고 감상에서만 제외해요.')){await creationApi('choose',{body:{studentId:action.slice(16),draftId:null}});await creationRefresh();toast('선정을 취소했어요. 다른 작품이 자동으로 선택되지 않아요.')}return true}
 if(action.startsWith('c-trash-')){const d=creationState.drafts.find(x=>x.id===action.slice(8));if(d&&confirm('이 작품을 휴지통으로 옮길까요? 나중에 다시 꺼낼 수 있어요.')){await creationApi('trash',{body:{id:d.id,revision:d.revision}});await creationRefresh();toast('휴지통으로 옮겼어요.')}return true}
 if(action.startsWith('c-untrash-')){const d=creationState.trash.find(x=>x.id===action.slice(10));if(d){await creationApi('untrash',{body:{id:d.id,revision:d.revision}});await creationRefresh();toast('작품을 다시 꺼냈어요.')}return true}
 return false;
}
// Open the class form after the normal provider sign-in, never a separate OAuth flow.
const creationBaseEntry=creationEntry;
creationEntry=function(message=''){creationBaseEntry(message);if(teacherAccount&&new URLSearchParams(location.search).get('newclass')==='1'){history.replaceState(null,'','/');creationProjectForm(true)}};
document.addEventListener('close',e=>{if(e.target?.id==='dialog')e.target.classList.remove('qr-enlarged')},true);

creationBoot();
