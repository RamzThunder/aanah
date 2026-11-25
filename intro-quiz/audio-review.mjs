export function reviewStatus(song, result, draft, published, confirmed) {
  if (!song) return 'stale';
  if (draft && ['introVideo', 'introStart'].some(field => Object.hasOwn(draft.changes, field))) return 'stale';
  if (confirmed?.introVideo?.to === song.introVideo && song.introVideo !== result.introVideo) return 'applied';
  if (song.introVideo !== result.introVideo) return 'stale';
  if (confirmed?.introStart?.to === song.introStart && song.introStart !== result.introStart) return 'applied';
  if (published && published.intro_video === song.introVideo && published.intro_start === song.introStart) return 'applied';
  if (song.introStart !== result.introStart) return 'stale';
  return Number.isFinite(result.suggested_start) ? 'available' : 'unavailable';
}
