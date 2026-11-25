import {json, db, isAdmin} from '../_lib.js';
import {BANK_EDITS} from '../../../intro-quiz/bank-edits.mjs';
import {BANK} from '../../../intro-quiz/bank.mjs';
import {AUDIO_REVIEW} from '../../../intro-quiz/audio-review-data.mjs';
import {reviewStatus} from '../../../intro-quiz/audio-review.mjs';

export async function onRequest({request, env}) {
  if (!env.DB || !env.ADMIN_PASSWORD) return json({error: '관리자 설정이 아직 없어요.'}, 503);
  if (!(await isAdmin(request, env))) return json({error: '비밀번호가 맞지 않아요.'}, 401);
  if (request.method !== 'POST') return json({error: 'Method Not Allowed'}, 405);
  const body = await request.json().catch(() => ({}));
  const original = BANK.find(song => song.id === body.id);
  const result = AUDIO_REVIEW.results.find(row => row.id === body.id);
  if (!original || !result || !Number.isFinite(result.suggested_start) ||
      !Number.isFinite(body.start) || body.start < 0 || body.start > 86400) {
    return json({error: '반영할 곡과 시작 시간을 확인해 주세요.'}, 400);
  }
  const DB = await db(env);
  const pending = await DB.prepare('SELECT changes FROM bank_edits WHERE song_id = ?').bind(body.id).first();
  const live = await DB.prepare('SELECT * FROM bank_audio_starts WHERE song_id = ?').bind(body.id).first();
  const current = {...original};
  if (live?.intro_video === original.introVideo) current.introStart = live.intro_start;
  const draft = pending ? {changes: JSON.parse(pending.changes)} : null;
  if (draft) Object.assign(current, draft.changes);
  const status = reviewStatus(current, result, draft, live, BANK_EDITS[body.id]);
  if (!['available', 'applied'].includes(status) || current.introVideo !== body.expectedVideo || current.introStart !== body.expectedStart) {
    return json({error: '영상이나 시작 시간이 바뀌었어요. 새로고침하고 현재 수정안을 확인해 주세요.'}, 409);
  }
  const history = [...new Set([original.introStart, current.introStart, ...(live ? JSON.parse(live.previous_starts) : [])])];
  const now = Math.max(Date.now(), (live?.updated_at || 0) + 1);
  // 읽은 뒤 다른 창에서 수정했으면 저장하지 않는다. 다른 필드의 반영 대기는 그대로 보존한다.
  const saved = await DB.prepare(`INSERT INTO bank_audio_starts (song_id, intro_video, intro_start, previous_starts, updated_at)
    SELECT ?, ?, ?, ?, ?
    WHERE COALESCE((SELECT changes FROM bank_edits WHERE song_id = ?), '') = ?
      AND COALESCE((SELECT updated_at FROM bank_audio_starts WHERE song_id = ?), 0) = ?
    ON CONFLICT(song_id) DO UPDATE SET intro_video = excluded.intro_video, intro_start = excluded.intro_start,
      previous_starts = excluded.previous_starts, updated_at = excluded.updated_at`)
    .bind(body.id, current.introVideo, body.start, JSON.stringify(history), now,
      body.id, pending?.changes || '', body.id, live?.updated_at || 0).run();
  if (saved.meta.changes !== 1) return json({error: '다른 창에서 수정됐어요. 새로고침한 뒤 다시 확인해 주세요.'}, 409);
  return json({ok: true});
}
