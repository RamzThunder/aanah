import {applyTheme} from './theme.mjs';
import {createPlayer} from './player.mjs';
import {fetchLyrics,lineIndexAt,wordProgress} from './lyrics.mjs';
const $=s=>document.querySelector(s),room=new URLSearchParams(location.search).get('room');
const channel=room&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel(`intro-quiz-${room}`):null;
let currentKey='',player,loadVersion=0,lastContact=Date.now(),currentSong=null;
function send(type,extra={}){const data={type,room,...extra};channel?.postMessage(data);window.opener?.postMessage(data,location.origin);}
function destroy(){loadVersion++;stopLyrics();currentSong=null;player?.destroy();player=null;$('#answerPlayer')?.remove();const el=document.createElement('div');el.id='answerPlayer';$('#videoStage').prepend(el);}
async function showVideo(song) {
 destroy();
 currentSong = song;
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
  if (lyricsOn) loadLyrics(song);
 } catch {
  if (version === loadVersion) fallback.hidden = false;
 }
}
function receive(data){if(data?.room!==room)return;if(data.type==='closed'){destroy();currentKey='';$('#tvFooter').textContent='교사용 창이 닫혔어요. 교사용 페이지에서 TV 화면을 다시 열어 주세요.';return;}if(data.type!=='state')return;lastContact=Date.now();applyTheme(data.theme);const s=data.state;const key=JSON.stringify(s);if(key===currentKey)return;currentKey=key;render(s);}
function render(s){
 const answer=s.phase==='answer'&&s.song,done=s.phase==='done',idle=s.phase==='idle';
 $('#screen').classList.toggle('answer',!!answer);$('#screen').classList.toggle('playing',s.phase==='listening');
 $('#tvProgress').textContent=idle?'전주 듣고 노래 맞히기':done?'PLAYLIST COMPLETE':`${s.index+1} / ${s.total}`;
 $('#tvTag').textContent=answer?'THE ANSWER IS':done?'PLAYLIST COMPLETE':idle?'READY TO PLAY':s.stage?`${s.stage}단계 · ${s.duration}초`:'LISTEN CLOSELY';
 $('#tvTitle').textContent=answer?s.song.title:done?'게임 종료':idle?'전주 듣고 노래 맞히기':'이 노래의 제목과 가수는?';
 $('#tvSub').textContent=answer?[s.song.artist, s.song.work && `〈${s.song.work}〉`].filter(Boolean).join(' · '):done?'':idle?'곧 시작합니다.':s.phase==='loading'?'잠깐만요, 음악을 준비하고 있어요.':s.phase==='listening'?'잘 듣고 맞혀보세요!':'생각났다면 손을 들어주세요!';
 $('#tvRecord').hidden=!!answer;$('#tvLevels').hidden=!!answer||done;$('#videoWrap').hidden=!answer;
 [...$('#tvLevels').children].forEach((el,i)=>el.classList.toggle('selected',s.stage===i+1));$('#tvEasy').textContent=s.stage===3?`하 · ${s.duration}초`:'하 · 3초 이상';
 $('#tvFooter').textContent='';
 if(answer)showVideo(s.song);else destroy();
}
channel?.addEventListener('message',e=>receive(e.data));
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.opener)receive(e.data);});
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#tvFooter').textContent='브라우저의 전체 화면 메뉴를 사용해 주세요.';}};
const SIZE_KEY='intro-quiz-tv-video-scale',SIZE_MIN=50,SIZE_MAX=100,SIZE_STEP=10;
let videoSize=SIZE_MAX;try{videoSize=Number(localStorage.getItem(SIZE_KEY))||SIZE_MAX;}catch{}
function setVideoSize(value){videoSize=Math.min(SIZE_MAX,Math.max(SIZE_MIN,Math.round(value/SIZE_STEP)*SIZE_STEP));$('#videoWrap').style.setProperty('--video-scale',videoSize/100);$('#sizeValue').textContent=`${videoSize}%`;$('#sizeDown').disabled=videoSize<=SIZE_MIN;$('#sizeUp').disabled=videoSize>=SIZE_MAX;try{localStorage.setItem(SIZE_KEY,videoSize);}catch{}}
setVideoSize(videoSize);
$('#sizeDown').onclick=()=>setVideoSize(videoSize-SIZE_STEP);$('#sizeUp').onclick=()=>setVideoSize(videoSize+SIZE_STEP);
// 노래방식 가사. 가사는 정답 공개 때마다 LRCLIB에서 받아 오고 저장하지 않는다.
// 뮤비는 음원과 시작점이 달라 곡마다 싱크가 다르다. 맞춘 싱크 값(초)만 영상별로 이 브라우저에 기억한다.
const LYRICS_KEY='intro-quiz-tv-lyrics',OFFSETS_KEY='intro-quiz-tv-lyrics-offsets',OFFSET_STEP=0.5;
let lyricsOn=false,lyrics=null,lyricsVersion=0,frame=0,shownLine=null;
try{lyricsOn=localStorage.getItem(LYRICS_KEY)==='1';}catch{}
function savedOffsets(){try{return JSON.parse(localStorage.getItem(OFFSETS_KEY))||{};}catch{return {};}}
function lyricsStatus(text){$('#lyricsStatus').textContent=text;}
function stopLyrics(){lyricsVersion++;cancelAnimationFrame(frame);lyrics=null;shownLine=null;$('#lyrics').hidden=true;$('#lyricsBar').hidden=true;$('#lyricsSync').hidden=true;lyricsStatus('');}
async function loadLyrics(song){
 stopLyrics();
 const version=lyricsVersion,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 $('#lyricsBar').hidden=false;lyricsStatus('가사를 불러오는 중…');
 try{
  const found=await fetchLyrics(song,{signal:controller.signal});
  if(version!==lyricsVersion)return;
  if(!found){lyricsStatus('이 곡은 가사를 찾지 못했어요.');return;}
  lyrics={...found,video:song.answerVideo,offset:Number(savedOffsets()[song.answerVideo])||0};
  lyricsStatus('');$('#lyricsSync').hidden=false;$('#lyrics').hidden=false;showOffset();tick();
 }catch{if(version===lyricsVersion)lyricsStatus('가사를 불러오지 못했어요.');}
 finally{clearTimeout(timer);}
}
function showOffset(){const value=lyrics.offset;$('#lyricsOffset').textContent=`싱크 ${value>0?'+':''}${value.toFixed(1)}초`;}
function setOffset(value){
 if(!lyrics)return;lyrics.offset=Math.round(value*10)/10;
 const offsets=savedOffsets();if(lyrics.offset)offsets[lyrics.video]=lyrics.offset;else delete offsets[lyrics.video];
 try{localStorage.setItem(OFFSETS_KEY,JSON.stringify(offsets));}catch{}
 showOffset();
}
function adjustLyrics(step){if(lyrics)setOffset(lyrics.offset+step);}
// 가수가 화면 첫 줄을 부르기 시작한 순간에 누르면 그 줄이 지금 시작하도록 맞춘다.
function syncHere(){const time=player?.getCurrentTime?.();if(lyrics&&shownLine&&Number.isFinite(time))setOffset(time-shownLine.start);}
function drawLine(line){
 const now=$('#lyricNow');now.replaceChildren();
 for(const word of line?.words||[]){const span=document.createElement('span');span.className='w';span.dataset.t=word.text;span.textContent=word.text;now.append(span);}
}
function tick(){
 if(!lyrics)return;
 frame=requestAnimationFrame(tick);
 const time=player?.getCurrentTime?.();if(!Number.isFinite(time))return;
 const t=time-lyrics.offset,lines=lyrics.lines,index=lineIndexAt(lines,t);
 // 줄이 끝나고 잠시 쉬는 동안에는 다음에 부를 줄을 미리 보여 준다.
 const nowIndex=index>=0&&t<=lines[index].end+0.6?index:index+1;
 const line=lines[nowIndex];
 if(line!==shownLine){shownLine=line;drawLine(line);$('#lyricNext').textContent=lines[nowIndex+1]?.text||'';$('#lyrics').hidden=!line;}
 if(line)wordProgress(line,t).forEach((p,i)=>$('#lyricNow').children[i]?.style.setProperty('--p',p.toFixed(3)));
}
function setLyrics(on){
 lyricsOn=on;try{localStorage.setItem(LYRICS_KEY,on?'1':'0');}catch{}
 $('#lyricsToggle').textContent=on?'가사 켬':'가사 끔';$('#lyricsToggle').setAttribute('aria-pressed',String(on));
 $('#screen').classList.toggle('lyrics-on',on);
 if(on&&currentSong&&player)loadLyrics(currentSong);else if(!on)stopLyrics();
}
setLyrics(lyricsOn);
$('#lyricsToggle').onclick=()=>setLyrics(!lyricsOn);
$('#lyricsEarlier').onclick=()=>adjustLyrics(-OFFSET_STEP);$('#lyricsHere').onclick=syncHere;$('#lyricsLater').onclick=()=>adjustLyrics(OFFSET_STEP);
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='+'||e.key==='=')setVideoSize(videoSize+SIZE_STEP);else if(e.key==='-'||e.key==='_')setVideoSize(videoSize-SIZE_STEP);else if(e.key==='l'||e.key==='L'||e.key==='ㅣ')setLyrics(!lyricsOn);else if(e.key==='[')adjustLyrics(-OFFSET_STEP);else if(e.key===']')adjustLyrics(OFFSET_STEP);else if(e.key==='s'||e.key==='S'||e.key==='ㄴ')syncHere();});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'전체 화면 해제':'전체 화면';});
if(room){send('hello');setInterval(()=>{send('heartbeat');send('hello');if(Date.now()-lastContact>8000){if(player)destroy();currentKey='';$('#tvFooter').textContent='교사용 화면과 연결을 기다리고 있어요.';}},2000);}else{$('#tvSub').textContent='교사용 페이지의 ‘TV 화면 열기’ 버튼으로 시작해 주세요.';}
