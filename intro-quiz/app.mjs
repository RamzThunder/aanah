import {BANK, RETIRED_SONG_IDS, updateLegacySong} from './bank.mjs';
import {validateBank,mergeSavedSongs,filterSongs,pickSongs,publicState} from './core.mjs';
import {questionYear, clipStart, defaultShortformStart} from './shortform-bank.mjs';
import {createPlayer,playerError} from './player.mjs';
const $=s=>document.querySelector(s), KEY='aanah-intro-bank-v1';
// 선생님이 출제에서 빼 둔 곡 ID. 문제은행 수정 내용과 따로 저장해 기본 문제은행이 바뀌어도 유지된다.
const EXCLUDED_KEY='aanah-intro-excluded-songs-v1';
const excludedSongs=new Set();
try{const saved=JSON.parse(localStorage.getItem(EXCLUDED_KEY)||'[]');if(Array.isArray(saved))for(const id of saved)if(typeof id==='string')excludedSongs.add(id);}catch{}
function saveExcluded(){try{localStorage.setItem(EXCLUDED_KEY,JSON.stringify([...excludedSongs]));}catch{status('브라우저에 제외 목록을 저장하지 못했어요.');}}
const playableBank=()=>bank.filter(song=>!excludedSongs.has(song.id));
const defaultSongs = new Map(BANK.map(song => [song.id, song]));
let bank=BANK.map(s=>({...s}));
try{const saved=localStorage.getItem(KEY);if(saved)bank=mergeSavedSongs(BANK,validateBank(JSON.parse(saved)).map(updateLegacySong),RETIRED_SONG_IDS);}catch{$('#status').textContent='저장된 목록을 불러오지 못해 기본 목록을 열었어요.';}
let playlist=[],index=-1,phase='idle',stage=0,duration=0,player,playerPromise,active=null,tv=null,lastSeen=0,editing=null;
const room=crypto.randomUUID(), channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel(`intro-quiz-${room}`):null;
const workLabel = song => song.work ? `〈${song.work}〉` : '';
const songCredit = song => [song.artist, workLabel(song)].filter(Boolean).join(' · ');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const song=()=>playlist[index];
function status(text){$('#status').textContent=text;}
function send(){const data={type:'state',room,state:publicState({phase,index,stage,duration,total:playlist.length,song:song()})};channel?.postMessage(data);if(tv&&!tv.closed)tv.postMessage(data,location.origin);}
function receive(data){if(data?.room!==room)return;if(data.type==='hello'){lastSeen=Date.now();send();}if(data.type==='heartbeat')lastSeen=Date.now();if(data.type==='video-error')status(`정답 영상: ${playerError(data.code)} TV 창의 ‘유튜브에서 열기’를 사용할 수 있어요.`);}
channel?.addEventListener('message',e=>receive(e.data));
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===tv)receive(e.data);});
setInterval(()=>{$('#connection').textContent=lastSeen&&Date.now()-lastSeen<6000?'TV 화면 연결됨':'TV 화면 연결 전 / 연결 끊김';},1500);
$('#openTV').onclick=()=>{tv=window.open(`tv.html?room=${room}`,`intro-tv-${room}`,'popup,width=1280,height=800');if(!tv)status('팝업이 차단됐어요. 이 사이트의 팝업을 허용하고 다시 열어 주세요.');};
const excludedArtists = new Set();
const mode = () => $('#questionMode').value;
const currentYear = song => questionYear(song, mode());
let playlistMode = 'release';

function availableSongs() {
  return filterSongs(playableBank(), selectedYears(), selectedGenres(), excludedArtists, currentYear);
}

function fillFilters(){
 const previouslyUncheckedYears = new Set([...document.querySelectorAll('#years input:not(:checked)')].map(input => Number(input.value)));
 const years = [...new Set(bank.map(currentYear).filter(Number.isInteger))].sort((a, b) => a - b);
 const yearLabel = mode() === 'shortform' ? '유행 연도' : '발매 연도';
 $('#yearsTitle').textContent = yearLabel;
 $('#years').innerHTML = `<legend class="sr-only">${yearLabel}</legend>` +
   years.map(year => `<label class="year-choice"><input type="checkbox" value="${year}" ${previouslyUncheckedYears.has(year) ? '' : 'checked'}>${year}</label>`).join('');
 const genreInputs = [...$('#genresFilter').querySelectorAll('input')];
 const previouslyUnchecked = new Set(genreInputs.filter(input => !input.checked).map(input => input.value));
 const genres = [...new Set(bank.filter(song => Number.isInteger(currentYear(song))).map(song => song.genre))];
 $('#genresFilter').innerHTML = '<legend class="sr-only">장르</legend>' +
   genres.map(genre => {
     const checked = previouslyUnchecked.has(genre) ? '' : ' checked';
     return `<label class="year-choice"><input type="checkbox" value="${esc(genre)}"${checked}>${esc(genre)}</label>`;
   }).join('');
 const by=$('#bankYear').value;$('#bankYear').innerHTML='<option value="">모든 연도</option>'+years.map(y=>`<option>${y}</option>`).join('');if (years.includes(Number(by))) $('#bankYear').value=by;
 renderArtistOptions();
 poolCount();
}
function selectedYears() {
  return [...document.querySelectorAll('#years input:checked')].map(input => Number(input.value));
}

function selectedGenres() {
  return [...$('#genresFilter').querySelectorAll('input:checked')].map(input => input.value);
}

function renderArtistOptions() {
  const artists = [...new Set(bank.map(song => song.artist))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
  for (const artist of excludedArtists) {
    if (!artists.includes(artist)) excludedArtists.delete(artist);
  }
  $('#excludedArtists').innerHTML = artists.map(artist => {
    const checked = excludedArtists.has(artist) ? ' checked' : '';
    return `<label><input type="checkbox" value="${esc(artist)}"${checked}>${esc(artist)}</label>`;
  }).join('');
}

// 접힌 연도·장르 칸에도 무엇을 골랐는지 보이게 한다.
function foldSummary(fieldset) {
  const inputs = [...$(fieldset).querySelectorAll('input')], picked = inputs.filter(input => input.checked).map(input => input.value);
  if (!inputs.length) return '';
  if (picked.length === inputs.length) return `전체 ${inputs.length}개`;
  if (!picked.length) return '선택 안 함';
  return picked.length <= 3 ? picked.join(', ') : `${inputs.length}개 중 ${picked.length}개`;
}
for (const button of document.querySelectorAll('[data-select-all],[data-select-none]')) button.onclick = () => {
  const all = !!button.dataset.selectAll;
  for (const input of $(`#${button.dataset.selectAll || button.dataset.selectNone}`).querySelectorAll('input')) input.checked = all;
  poolCount();
};
function poolCount() {
  $('#yearsSummary').textContent = foldSummary('#years');
  $('#genresSummary').textContent = foldSummary('#genresFilter');
  const available = availableSongs().length;
  const excludedCount = bank.filter(song => excludedSongs.has(song.id)).length;
  $('#poolCount').textContent = `출제 가능 ${available}곡 · ${Math.min(available, Number($('#count').value))}문제 출제${excludedCount ? ` · 내가 제외한 곡 ${excludedCount}곡` : ''}`;
  $('#start').disabled = available === 0;
  $('#excludedCount').textContent = excludedArtists.size ? `${excludedArtists.size}팀 제외` : '없음';
  $('#clearExcluded').disabled = excludedArtists.size === 0;
  renderBank();
}

$('#excludedArtists').onchange = event => {
  const input = event.target;
  if (input.checked) excludedArtists.add(input.value);
  else excludedArtists.delete(input.value);
  poolCount();
};
$('#clearExcluded').onclick = () => {
  excludedArtists.clear();
  $('#excludedArtists').querySelectorAll('input:checked').forEach(input => { input.checked = false; });
  poolCount();
};
$('#questionMode').onchange=fillFilters;
$('#years').onchange=poolCount;$('#genresFilter').onchange=poolCount;$('#count').onchange=poolCount;
function stopPlayback(){if(active){clearInterval(active.timer);clearTimeout(active.watchdog);active=null;}player?.pauseVideo?.();}
function stop(){stopPlayback();if(['listening','loading'].includes(phase))phase='question';render();}
function render(){const s=song(),has=!!s&&phase!=='done';
 $('#progress').textContent=has?`${index+1} / ${playlist.length}`:phase==='done'?'게임 완료':'시작 전';
 $('#answerTitle').textContent=has?s.title:'아직 선택된 곡이 없어요';$('#answerArtist').textContent=has?`${songCredit(s)} · ${s.year}`:'새 플레이리스트를 시작해 주세요.';
 $('#stageTag').textContent=phase==='done'?'PLAYLIST COMPLETE':has?`QUESTION ${String(index+1).padStart(2,'0')} / ${playlist.length}`:'READY TO PLAY';
 $('#previewTitle').textContent=phase==='done'?'게임 종료':phase==='answer'?s.title:has?'이 노래의 제목은?':'전주 듣고 노래 맞히기';
 $('#previewText').textContent=phase==='done'?'다시 하려면 문제를 새로 섞어 주세요.':phase==='answer'?songCredit(s):phase==='loading'?'유튜브 재생 준비 중…':phase==='listening'?`${stage}단계 · ${duration}초 전주를 들어보세요`:has?(stage?`${stage}단계 · ${duration}초, 어떤 노래일까요?`:'1단계부터 전주를 들려주세요.'):'출제 범위를 고르고 시작하세요.';
 $('#preview').classList.toggle('playing',phase==='listening');
 document.querySelectorAll('[data-stage]').forEach(b=>{b.disabled=!has||phase==='answer'||!!active;b.classList.toggle('selected',+b.dataset.stage===stage);});
 $('#reveal').disabled=!has||phase==='answer';$('#next').disabled=!has;$('#editCurrent').disabled=!has;
 $('#next').textContent=index===playlist.length-1?'게임 마치기':'다음 문제';
 $('#queue').innerHTML=playlist.length?playlist.map((s,i)=>`<li class="${i===index?'current':''}">${i<index?'✓ ':''}${esc(s.title)}</li>`).join(''):'<li>새 플레이리스트를 기다리고 있어요.</li>';
 send();
}
async function getPlayer(){if(!playerPromise){playerPromise=createPlayer('introPlayer',{onStateChange:onPlayerState,onError:e=>{stop();status(playerError(e.data));},onAutoplayBlocked:()=>{stop();status('자동재생이 차단됐어요. 플레이어를 한 번 클릭해 허용한 뒤 다시 전주 버튼을 눌러 주세요.');}}).then(p=>(player=p)).catch(e=>{playerPromise=null;throw e;});}return playerPromise;}
function finishClip(message){const previewOnly=active?.previewOnly;stopPlayback();if(!previewOnly)phase='question';render();status(message||'전주 재생 완료. 다시 듣거나 다음 단계로 넘어가세요.');}
function onPlayerState(e){
 if(e.data===1){
  // Manual playback outside a requested snippet is stopped to avoid accidental leaks.
  if(!active){player?.pauseVideo();return;}
  clearTimeout(active.watchdog);
  if(!active.previewOnly){phase='listening';render();}
  if(!active.timer)active.timer=setInterval(()=>{
   if(!active||!player)return;
   const now=player.getCurrentTime();
   // Ignore stale positions left over from the previous clip until playback
   // actually reaches this clip's window.
   if(!active.reached&&now>=active.start-0.3&&now<active.end)active.reached=true;
   if((active.reached&&now>=active.end)||Date.now()-active.startedAt>30000)finishClip();
  },16);
 } else if(e.data===0&&active?.reached)finishClip('영상이 끝났어요. 시작 시간과 영상 길이를 확인해 주세요.');
}
async function playClip(s,seconds,previewOnly=false,playbackMode='release'){
 stopPlayback();
 const start = clipStart(s, playbackMode);
 const token={start,end:start+seconds,previewOnly,startedAt:Date.now()};active=token;
 if(!previewOnly){phase='loading';render();}else{send();}
 status(previewOnly?`${s.title} · ${seconds}초 미리듣기 (현재 소리 출력 장치)`:'유튜브에서 전주를 준비하고 있어요.');
 try{
  const p=await getPlayer();if(active!==token)return;
  token.watchdog=setTimeout(()=>{if(active===token)finishClip('재생 대기 시간이 길어 중지했어요. 광고·네트워크·영상 제한을 확인하고 다시 시도하세요.');},25000);
  p.unMute();p.setVolume(80);p.loadVideoById({videoId:s.introVideo,startSeconds:start});
 }catch(e){if(active===token){stop();status(e.message);}}
}
$('#start').onclick=()=>{stopPlayback();playlist=pickSongs(playableBank(),selectedYears(),selectedGenres(),+$('#count').value,Math.random,excludedArtists,currentYear).map(s=>({...s}));if(!playlist.length)return;playlistMode=mode();index=0;stage=0;duration=0;phase='question';render();status('플레이리스트를 준비했어요. 1단계부터 시작해 주세요.');};
for(const b of document.querySelectorAll('[data-stage]'))b.onclick=()=>{stage=+b.dataset.stage;duration=stage===1?.5:stage===2?1:+$('#easy').value;playClip(song(),duration,false,playlistMode);};
$('#easy').onchange=()=>{$('#easyLabel').innerHTML=`${$('#easy').value}<small>초</small>`;};
$('#stop').onclick=()=>{stop();if(phase==='answer'){phase='question';render();}status('재생을 중지했어요.');};
$('#reveal').onclick=()=>{stopPlayback();phase='answer';render();status('TV 화면에 정답과 영상이 공개됐어요. 자동재생이 막히면 TV 영상의 재생 버튼을 눌러 주세요.');};
$('#next').onclick=()=>{stopPlayback();index++;stage=0;duration=0;phase=index>=playlist.length?'done':'question';render();status(phase==='done'?'모든 문제를 마쳤어요!':song().checked?'다음 문제예요. 1단계부터 시작하세요.':'이 곡은 전주 시작 지점 확인이 필요해요.');};
function renderBankRow(s) {
  const original = defaultSongs.get(s.id);
  const modified = original && [...new Set([...Object.keys(original), ...Object.keys(s)])].some(key => key !== 'checked' && (s[key] ?? '') !== (original[key] ?? ''));
  const kind = !original ? 'added' : modified ? 'modified' : '';
  const label = kind === 'added' ? '추가곡' : '수정곡';
  const badge = kind ? ` <span class="song-label">${label}</span>` : '';
  const trendYear = mode() === 'shortform' ? questionYear(s, 'shortform') : undefined;
  const yearText = trendYear ? `${trendYear} 유행<small>${s.year} 발매</small>` : s.year;
  const start = clipStart(s, mode());
  const out = excludedSongs.has(s.id);
  const excludeButton = `<button data-exclude="${esc(s.id)}" class="exclude-toggle" aria-pressed="${out}" title="${out ? '다시 출제 대상에 넣어요' : '이 브라우저에서 이 곡을 출제하지 않아요'}">${out ? '다시 출제' : '출제 제외'}</button>`;
  return `<tr class="${kind}${out ? ' excluded' : ''}"><td>${yearText}</td><td><b>${esc(s.title)}</b>${badge}<small>${esc(songCredit(s))}</small></td><td>${esc(s.genre)}</td><td>${start}초</td><td class="${s.checked?'ready':'unchecked'}">${s.checked?'준비 완료':'미리듣기 필요'}</td><td><button data-preview="${esc(s.id)}">3초 미리듣기</button><button data-edit="${esc(s.id)}">설정</button>${excludeButton}</td></tr>`;
}

// 머리글을 누를 때마다 오름차순 → 내림차순 → 원래 순서로 돌아간다. 출제 가능/범위 밖 묶음 안에서 정렬한다.
let bankSort = {key: '', dir: 1};
const collator = new Intl.Collator('ko', {numeric: true, sensitivity: 'base'});
const sortValue = {
  year: s => currentYear(s) ?? s.year,
  title: s => s.title,
  genre: s => s.genre,
  start: s => clipStart(s, mode()),
  checked: s => (s.checked ? 1 : 0),
};
function sortedBank() {
  const value = sortValue[bankSort.key];
  if (!value) return bank;
  return bank.map((song, i) => ({song, i})).sort((a, b) => {
    const x = value(a.song), y = value(b.song);
    const diff = typeof x === 'string' ? collator.compare(x, y) : x - y;
    return diff * bankSort.dir || a.i - b.i;
  }).map(({song}) => song);
}
$('#bankHead').onclick = e => {
  const key = e.target.closest('[data-sort]')?.dataset.sort;
  if (!key) return;
  bankSort = bankSort.key !== key ? {key, dir: 1} : bankSort.dir === 1 ? {key, dir: -1} : {key: '', dir: 1};
  for (const b of document.querySelectorAll('#bankHead [data-sort]')) {
    b.closest('th').setAttribute('aria-sort', b.dataset.sort !== bankSort.key ? 'none' : bankSort.dir === 1 ? 'ascending' : 'descending');
  }
  renderBank();
};

function renderBank() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const year = $('#bankYear').value;
  const eligibleIds = new Set(
    availableSongs().map(song => song.id)
  );
  const eligible = [];
  const remaining = [];
  const excluded = [];

  for (const song of sortedBank()) {
    if (year && currentYear(song) !== Number(year)) continue;
    if (!`${song.title} ${songCredit(song)}`.toLocaleLowerCase().includes(query)) continue;
    (excludedSongs.has(song.id) ? excluded : eligibleIds.has(song.id) ? eligible : remaining).push(song);
  }

  const heading = (title, count) =>
    `<tr class="bank-group"><th colspan="6">${title} <span>${count}곡</span></th></tr>`;
  const empty = query || year ? '검색 조건에 맞는 출제 가능 곡이 없어요.' : '현재 출제 설정에 맞는 곡이 없어요.';
  $('#bankCount').textContent = `${bank.length}곡`;
  $('#songs').innerHTML = heading('출제 가능한 노래들', eligible.length) +
    (eligible.map(renderBankRow).join('') || `<tr><td colspan="6">${empty}</td></tr>`) +
    (remaining.length ? heading('현재 출제 범위 밖', remaining.length) + remaining.map(renderBankRow).join('') : '') +
    (excluded.length ? heading('내가 제외한 노래 · 이 브라우저에 저장돼요', excluded.length) + excluded.map(renderBankRow).join('') : '');
}
$('#search').oninput=renderBank;$('#bankYear').onchange=renderBank;
$('#songs').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.exclude){const id=b.dataset.exclude,title=bank.find(s=>s.id===id)?.title||'';if(excludedSongs.has(id)){excludedSongs.delete(id);status(`‘${title}’을(를) 다시 출제 대상에 넣었어요.`);}else{excludedSongs.add(id);status(`‘${title}’을(를) 출제에서 뺐어요. 이 브라우저에 저장돼요.`);}saveExcluded();poolCount();return;}const s=bank.find(s=>s.id===(b.dataset.edit||b.dataset.preview));if(!s)return;if(b.dataset.edit)edit(s);else{stop();if(phase==='answer'){phase='question';render();}$('#answerTitle').textContent=`미리듣기: ${s.title}`;$('#answerArtist').textContent=songCredit(s);playClip(s,3,true,mode());}};
function edit(s){stop();if(phase==='answer'){phase='question';render();}editing=s.id;const f=$('#editForm');for(const k of ['title','artist','year','genre','work','introVideo','answerVideo','introStart','shortformStart','answerStart'])f.elements[k].value=k.endsWith('Video')?(s[k]?`https://www.youtube.com/watch?v=${s[k]}`:''):(s[k]??'');$('#shortformStartField').hidden=questionYear(s,'shortform')===undefined;f.elements.shortformStart.placeholder=`기본값 ${defaultShortformStart(s)}초`;f.elements.checked.checked=s.checked;$('#editError').textContent='';searchLinks();$('#editor').showModal();}
function searchLinks() {
  const {artist, title} = $('#editForm').elements;
  const query = `${artist.value} ${title.value}`.trim();
  $('#findAudio').href = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
  $('#findStage').href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' 교차편집')}`;
}
$('#editForm').oninput=searchLinks;
$('#editCurrent').onclick=()=>edit(song());$('#closeEditor').onclick=()=>$('#editor').close();
$('#add').onclick=()=>edit({id:crypto.randomUUID(),title:'',artist:'',year:2026,genre:'K-pop',introVideo:'',answerVideo:'',introStart:0,answerStart:0,checked:false});
function persist(next){const validated=validateBank(next);localStorage.setItem(KEY,JSON.stringify(validated));bank=validated;fillFilters();}
$('#editForm').onsubmit=e=>{e.preventDefault();const f=e.target;try{const s=validateBank([{id:editing,title:f.elements.title.value,artist:f.elements.artist.value,genre:f.elements.genre.value,work:f.elements.work.value,year:+f.elements.year.value,introVideo:f.elements.introVideo.value,answerVideo:f.elements.answerVideo.value,introStart:+f.elements.introStart.value,shortformStart:f.elements.shortformStart.value === '' ? undefined : f.elements.shortformStart.valueAsNumber,answerStart:+f.elements.answerStart.value,checked:f.elements.checked.checked}])[0];const next=bank.some(x=>x.id===s.id)?bank.map(x=>x.id===s.id?s:x):[...bank,s];persist(next);playlist=playlist.map(x=>x.id===s.id?{...s}:x);if(phase==='answer')phase='question';render();$('#editor').close();status('저장했어요. 미리듣기로 시작 시간을 확인하세요.');}catch(err){$('#editError').textContent=`저장하지 못했어요. ${err.message}`;}};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,songs:bank,excludedSongIds:[...excludedSongs]},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='aanah-intro-bank.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw Error('2MB 이하 파일을 선택해 주세요.');const data=JSON.parse(await file.text());const incoming=validateBank(data.songs||data).map(updateLegacySong);const activeSongs=incoming.filter(song=>!RETIRED_SONG_IDS.has(song.id));persist(mergeSavedSongs(bank,activeSongs));const removedCount=incoming.length-activeSongs.length;if(Array.isArray(data.excludedSongIds)){for(const id of data.excludedSongIds)if(typeof id==='string')excludedSongs.add(id);saveExcluded();poolCount();}status(`${activeSongs.length}곡을 가져왔어요. ${removedCount ? `기본 문제은행에서 제외된 ${removedCount}곡은 건너뛰었어요. ` : ''} 같은 ID는 갱신되며, 진행 중 게임에는 다음 게임부터 적용돼요.`);}catch(err){status(`가져오지 못했어요. ${err.message}`);}e.target.value='';};
window.addEventListener('beforeunload',()=>{channel?.postMessage({type:'closed',room});stopPlayback();});
fillFilters();render();
if(location.protocol==='file:')status('유튜브 재생을 위해 HTTP 서버로 열어 주세요. 사용 안내의 실행 방법을 확인하세요.');
