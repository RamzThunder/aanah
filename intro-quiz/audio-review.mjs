export function reviewStatus(song, result, draft, published) {
  if (!song || song.introVideo !== result.introVideo) return 'stale';
  if (draft && ['introVideo', 'introStart'].some(field => Object.hasOwn(draft.changes, field))) return 'stale';
  if (published && published.intro_video === song.introVideo && published.intro_start === song.introStart) return 'applied';
  if (song.introStart !== result.introStart) return 'stale';
  return Number.isFinite(result.suggested_start) ? 'available' : 'unavailable';
}
