import {json, db} from './_lib.js';

export async function onRequest({request, env}) {
  if (request.method !== 'GET') return json({error: 'Method Not Allowed'}, 405);
  if (!env.DB) return json({starts: []});
  const DB = await db(env);
  const {results} = await DB.prepare('SELECT song_id, intro_video, intro_start, previous_starts, updated_at FROM bank_audio_starts').all();
  return json({starts: results.map(row => ({...row, previous_starts: JSON.parse(row.previous_starts)}))});
}
