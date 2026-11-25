import {AUDIO_REVIEW} from './audio-review-data.mjs';
import {reviewStatus} from './audio-review.mjs';
const labels = {silent: '무음 수준', quiet: '저음량·짧은 소리', error: '영상 확인 필요'};
const states = {available: '확인 전', applied: '반영됨', stale: '영상·시간 변경됨', unavailable: '영상 교체 확인'};
const $ = selector => document.querySelector(selector);
const seconds = value => Number.isFinite(value) ? `${value}초` : '—';

export function createAudioReview({getSong, getDraft, getPublished, openEditor, playAt, hasOtherChanges, refresh, closeEditor}) {
  let opened = null, currentStart = 0, expectedVideo = '', busy = false;
  const statusOf = row => reviewStatus(getSong(row.id), row, getDraft(row.id), getPublished(row.id));
  function render() {
    const counts = Object.fromEntries(['silent', 'quiet', 'error'].map(key => [key, AUDIO_REVIEW.results.filter(row => row.status === key).length]));
    const applied = AUDIO_REVIEW.results.filter(row => statusOf(row) === 'applied').length;
    $('#audioReviewSummary').textContent = `${AUDIO_REVIEW.date} 검사 · 전체 ${AUDIO_REVIEW.total}곡 중 무음 수준 ${counts.silent}곡, 저음량·짧은 소리 ${counts.quiet}곡, 영상 확인 ${counts.error}곡 · 시작 시간 반영 ${applied}곡`;
    const filter = $('#audioReviewFilter').value, search = $('#audioReviewSearch').value.trim().toLocaleLowerCase();
    const tbody = $('#audioReviewRows'); tbody.replaceChildren();
    for (const row of AUDIO_REVIEW.results) {
      const song = getSong(row.id);
      if (!song) continue;
      const status = statusOf(row);
      if ((filter === 'todo' && status === 'applied') || (filter === 'applied' && status !== 'applied') ||
          (['silent', 'quiet', 'error'].includes(filter) && row.status !== filter)) continue;
      if (search && !`${song.title} ${song.artist}`.toLocaleLowerCase().includes(search)) continue;
      const tr = tbody.insertRow(), name = tr.insertCell();
      const title = document.createElement('b'); title.textContent = song.title;
      const artist = document.createElement('small'); artist.textContent = song.artist;
      name.append(title, artist);
      tr.insertCell().textContent = labels[row.status];
      tr.insertCell().textContent = seconds(song.introStart);
      tr.insertCell().textContent = seconds(row.suggested_start);
      tr.insertCell().textContent = states[status];
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = '확인';
      button.setAttribute('aria-label', `${song.title} 검사 결과 확인`);
      button.onclick = () => openEditor(row.id); tr.insertCell().append(button);
    }
    if (!tbody.children.length) tbody.innerHTML = '<tr><td colspan="6" class="empty">해당하는 검사 결과가 없어요.</td></tr>';
  }
  function open(id) {
    opened = AUDIO_REVIEW.results.find(row => row.id === id);
    $('#audioReviewDetail').hidden = !opened;
    $('#audioApplyError').textContent = '';
    if (!opened) return;
    const song = getSong(id), status = statusOf(opened);
    currentStart = song.introStart; expectedVideo = song.introVideo;
    $('#audioReviewInfo').textContent = `${labels[opened.status]} · 검사 당시 ${seconds(opened.introStart)} · 현재 ${seconds(currentStart)} · 추천 ${seconds(opened.suggested_start)}. ` +
      (status === 'stale' ? '검사 이후 영상이나 시작 시간이 바뀌었어요. 현재 수정안을 먼저 확인해 주세요.' : status === 'unavailable' ? '검사 당시 영상을 읽지 못했어요. 영상 주소를 확인해 주세요.' : status === 'applied' ? '반영한 시작 시간입니다. 다시 듣고 조정할 수 있어요.' : '현재와 추천 구간을 비교해 주세요.');
    $('#audioListenSuggested').disabled = busy || !['available', 'applied'].includes(status);
    $('#audioApply').disabled = busy || !['available', 'applied'].includes(status);
    $('#audioListenCurrent').disabled = busy;
  }
  $('#audioReviewFilter').onchange = render;
  $('#audioReviewSearch').oninput = render;
  $('#audioListenCurrent').onclick = () => playAt(currentStart);
  $('#audioListenSuggested').onclick = () => { if (opened) playAt(opened.suggested_start); };
  $('#audioApply').onclick = async () => {
    if (!opened || busy) return;
    $('#audioApplyError').textContent = '';
    const start = $('#editForm').elements.introStart.valueAsNumber;
    if (!Number.isFinite(start) || start < 0 || start > 86400) { $('#audioApplyError').textContent = '시작 시간을 0~86400초 사이로 입력해 주세요.'; return; }
    if (hasOtherChanges(opened.id)) { $('#audioApplyError').textContent = '다른 항목도 수정 중이에요. 먼저 아래의 ‘반영 대기에 저장’으로 저장하고 다시 확인해 주세요.'; return; }
    busy = true; $('#audioApply').disabled = true; $('#audioApply').textContent = '반영 중…';
    try {
      const response = await fetch('/api/admin/audio-review', {
        method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${sessionStorage.getItem('aanah-admin-key')}`},
        body: JSON.stringify({id: opened.id, start, expectedVideo, expectedStart: currentStart}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '시작 시간을 반영하지 못했어요.');
      const title = getSong(opened.id).title;
      await refresh(); closeEditor();
      $('#audioReviewNotice').textContent = `${title}: 시작 ${seconds(start)} 반영 완료. 교사용 화면을 새로고침해 주세요.`;
    } catch (error) { $('#audioApplyError').textContent = error.message; }
    finally { busy = false; $('#audioApply').disabled = false; $('#audioApply').textContent = '현재 입력한 시작 시간 반영'; }
  };
  return {render, open};
}
