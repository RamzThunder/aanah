import {createPlayer} from './player.mjs';
const $=s=>document.querySelector(s),room=new URLSearchParams(location.search).get('room');
const channel=room&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel(`intro-quiz-${room}`):null;
let currentKey='',player,loadVersion=0,lastContact=Date.now();
function send(type,extra={}){const data={type,room,...extra};channel?.postMessage(data);window.opener?.postMessage(data,location.origin);}
function destroy(){loadVersion++;player?.destroy();player=null;$('#answerPlayer')?.remove();const el=document.createElement('div');el.id='answerPlayer';$('#videoWrap').prepend(el);}
async function showVideo(song) {
 destroy();
 const version = loadVersion;
 const fallback = $('#externalVideo');
 fallback.hidden = true;
 fallback.href = `https://www.youtube.com/watch?v=${song.answerVideo}&t=${Math.floor(song.answerStart)}s`;
 try {
  const answerPlayer = await createPlayer('answerPlayer', {
   onError: event => {
    if (version !== loadVersion) return;
    fallback.hidden = false;
    send('video-error', {code: event.data});
   }
  });
  if (version !== loadVersion) {
   answerPlayer.destroy();
   return;
  }
  player = answerPlayer;
  player.loadVideoById({videoId: song.answerVideo, startSeconds: song.answerStart});
 } catch {
  if (version === loadVersion) fallback.hidden = false;
 }
}
function receive(data){if(data?.room!==room)return;if(data.type==='closed'){destroy();currentKey='';$('#tvFooter').textContent='교사용 창이 닫혔어요. 교사용 페이지에서 TV 화면을 다시 열어 주세요.';return;}if(data.type!=='state')return;lastContact=Date.now();const s=data.state;const key=JSON.stringify(s);if(key===currentKey)return;currentKey=key;render(s);}
function render(s){
 const answer=s.phase==='answer'&&s.song,done=s.phase==='done',idle=s.phase==='idle';
 $('#screen').classList.toggle('answer',!!answer);$('#screen').classList.toggle('playing',s.phase==='listening');
 $('#tvProgress').textContent=idle?'전주 듣고 노래 맞히기':done?'PLAYLIST COMPLETE':`${s.index+1} / ${s.total}`;
 $('#tvTag').textContent=answer?'THE ANSWER IS':done?'PLAYLIST COMPLETE':idle?'READY TO PLAY':s.stage?`${s.stage}단계 · ${s.duration}초`:'LISTEN CLOSELY';
 $('#tvTitle').textContent=answer?s.song.title:done?'오늘의 음악 퀴즈 끝!':idle?'귀를 쫑긋, 준비됐나요?':'이 노래의 제목은?';
 $('#tvSub').textContent=answer?[s.song.artist, s.song.work && `〈${s.song.work}〉`].filter(Boolean).join(' · '):done?'함께 들어서 더 즐거웠어요.':idle?'선생님이 음악 퀴즈를 준비하고 있어요.':s.phase==='loading'?'잠깐만요, 음악을 준비하고 있어요.':s.phase==='listening'?'잘 듣고 맞혀보세요!':'생각났다면 손을 들어주세요!';
 $('#tvRecord').hidden=!!answer;$('#tvLevels').hidden=!!answer||done;$('#videoWrap').hidden=!answer;
 [...$('#tvLevels').children].forEach((el,i)=>el.classList.toggle('selected',s.stage===i+1));$('#tvEasy').textContent=s.stage===3?`하 · ${s.duration}초`:'하 · 3초 이상';
 $('#tvFooter').textContent='';
 if(answer)showVideo(s.song);else destroy();
}
channel?.addEventListener('message',e=>receive(e.data));
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.opener)receive(e.data);});
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#tvFooter').textContent='브라우저의 전체 화면 메뉴를 사용해 주세요.';}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'전체 화면 해제':'전체 화면';});
if(room){send('hello');setInterval(()=>{send('heartbeat');send('hello');if(Date.now()-lastContact>8000){if(player)destroy();currentKey='';$('#tvFooter').textContent='교사용 화면과 연결을 기다리고 있어요.';}},2000);}else{$('#tvSub').textContent='교사용 페이지의 ‘TV 화면 열기’ 버튼으로 시작해 주세요.';}
