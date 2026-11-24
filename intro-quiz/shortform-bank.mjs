// Each group is tagged with the year it circulated on short-form platforms.
const trendGroups = [
  [2020, [36, 179, 180, 181, 182]],
  [2021, [183, 184, 120, 185, 186]],
  [2022, [51, 58, 187, 188, 189]],
  [2023, [62, 63, 190, 191, 192]],
  [2024, [193, 194, 195, 2, 3]],
  [2025, [14, 99, 196, 197, 198]],
  [2026, [171, 29, 199, 200, 201]],
];

const newRows = [
  [179, 2019, 'Don’t Start Now', 'Dua Lipa', '팝', 'htg8v0g_4e4', 'oygrmJFKYZY'],
  [180, 2019, 'Say So', 'Doja Cat', '팝', 'kThCbGnWVDo', 'pok8H_KF1FA'],
  [181, 2020, 'Savage Love (Laxed – Siren Beat)', 'Jawsh 685 & Jason Derulo', '팝', 'mUuyEX2M0gc', 'Jvcv8trEuao'],
  [182, 2019, 'Supalonely', 'BENEE feat. Gus Dapperton', '팝', 'bMQN-uJa2Ac', 'Rb6Scz-5YOs'],
  [183, 2021, 'STAY', 'The Kid LAROI & Justin Bieber', '팝', 'rkYlZnIbe2E', 'kTJczUoc26U'],
  [184, 2017, '롤린 (Rollin’)', '브레이브걸스', 'K-pop', '0ZCCBPeRVLo', 'odY9BGCxG98'],
  [185, 2021, '똥 밟았네', '레트로봇', '어린이 애니 OST', 's9d44ikc02k', 's9d44ikc02k', '포텐독'],
  [186, 2021, 'Wellerman', 'Nathan Evans', '팝', 'DPe2diiGJRE', 'DPe2diiGJRE'],
  [187, 2022, 'Polaroid Love', 'ENHYPEN', 'K-pop', 'vRdZVDWs3BI', 'JQ-2sk2ELJI'],
  [188, 2022, '다라리 (DARARI)', 'TREASURE', 'K-pop', 'cXCwKMvt9wE', '2bCdVnoztc8'],
  [189, 2022, 'Jiggle Jiggle', 'Louis Theroux & Duke & Jones', '힙합', 'JZBg58A_ZiE', '_G1cVDy0fTg'],
  [190, 2023, 'Cupid', 'FIFTY FIFTY', 'K-pop', 'Xxb9Hl5d6n4', 'Qc7_zRjH808'],
  [191, 2023, '아이돌 (アイドル)', 'YOASOBI', 'J-pop', 'm9SMT5ipbxk', 'ZRtdQ81jPUQ', '최애의 아이'],
  [192, 2022, 'NIGHT DANCER', 'imase', 'J-pop', '0t0HtFYjcU8', 'kagoEGKHZvU'],
  [193, 2017, '날 바라바라봐', 'TWICE', 'K-pop', 'Q97pvL6GsIA', 'Q97pvL6GsIA'],
  [194, 2024, '잘자요 아가씨', 'ASMRZ (다나카 & 닛몰캐쉬)', 'K-pop', '7Fsie5WvzFM', '7Fsie5WvzFM'],
  [195, 2015, '티라미수 케익', '위아더나잇', '밴드·인디', 'xWD7-OrL2LA', 'sg8tJnndyiI'],
  [196, 2025, 'Soda Pop', 'Saja Boys', '영화 수록곡', 'y7CrvsCIjyo', '983bBbJx0Mk', '케이팝 데몬 헌터스'],
  [197, 2009, 'Rock That Body', 'The Black Eyed Peas', '팝', 'EXeXTc7IqJE', 'nmnjL26OBcY'],
  [198, 2021, '머리어깨무릎발 (H.S.K.T.)', '이하이 feat. 원슈타인', 'R&B', '_7-Ynbwrk8E', 'ww9hZfgC2d8'],
  [199, 2026, '가짜사랑', '최준성 (Jun S)', '발라드', 'H4mB3mxPTrQ', '6XmqH1s7s2c'],
  [200, 2026, '흥흥흥 (HMPH!)', 'PLAVE feat. SOLE', 'K-pop', 'YcH2U4HHIDs', 'YcH2U4HHIDs'],
  [201, 2018, '사랑을 했다 (LOVE SCENARIO)', 'iKON', 'K-pop', 'OmEPFmyKO74', 'vecSVX1QYbQ'],
];

export const SHORTFORM_ADDITIONS = newRows.map(([id, year, title, artist, genre, introVideo, answerVideo, work]) => ({
  id: `song-${id}`, year, title, artist, genre, introVideo, answerVideo,
  ...(work ? {work} : {}), introStart: 0, answerStart: 0, checked: false,
}));

const trendYearById = new Map(trendGroups.flatMap(([year, ids]) => ids.map(id => [`song-${id}`, year])));
const shortformOnly = new Set(SHORTFORM_ADDITIONS.map(song => song.id));

export function questionYear(song, mode) {
  if (mode === 'shortform') return trendYearById.get(song.id);
  return shortformOnly.has(song.id) ? undefined : song.year;
}

// Approximate cue points (seconds) where each trend's hook starts in the
// linked recording, taken from synced lyrics whose length matches the video.
// Changing the source invalidates the suggestion so a different video never
// inherits its offset.
const defaultCues = new Map([
  ['song-2', {videoId: 'HBqH4uJS0PU', seconds: 36.5}], // Magnetic
  ['song-3', {videoId: 'bKeU99EygzY', seconds: 45.4}], // 첫 만남은 계획대로 되지 않아
  ['song-14', {videoId: 'HMQlkbXjSTM', seconds: 25.9}], // like JENNIE
  ['song-29', {videoId: 'XDzGoMtSqZA', seconds: 44.8}], // It’s Me
  ['song-36', {videoId: 'GOtF5_Ow0_Y', seconds: 26.7}], // 아무노래
  ['song-51', {videoId: 'hh5GKVa8VtM', seconds: 40.6}], // LOVE DIVE
  ['song-58', {videoId: 'R9TPed_ohKM', seconds: 39.1}], // POP!
  ['song-62', {videoId: 'n7ePZLn9_lQ', seconds: 12.1}], // Super Shy
  ['song-63', {videoId: 'v_gO_P8gug8', seconds: 51.8}], // 퀸카 (Queencard)
  ['song-99', {videoId: '9_bTl2vvYQg', seconds: 61.3}], // Golden
  ['song-120', {videoId: '9Ibf10h9U0c', seconds: 79.3}], // 신호등
  ['song-171', {videoId: '5sOgJQ3N03Q', seconds: 39.6}], // REDRED
  ['song-179', {videoId: 'htg8v0g_4e4', seconds: 47.1}], // Don’t Start Now
  ['song-180', {videoId: 'kThCbGnWVDo', seconds: 8.3}], // Say So
  ['song-182', {videoId: 'bMQN-uJa2Ac', seconds: 6.7}], // Supalonely
  ['song-183', {videoId: 'rkYlZnIbe2E', seconds: 11.3}], // STAY
  ['song-184', {videoId: '0ZCCBPeRVLo', seconds: 53.4}], // 롤린 (Rollin’)
  ['song-186', {videoId: 'DPe2diiGJRE', seconds: 2.2}], // Wellerman
  ['song-187', {videoId: 'vRdZVDWs3BI', seconds: 1}], // Polaroid Love
  ['song-188', {videoId: 'cXCwKMvt9wE', seconds: 59.5}], // 다라리 (DARARI)
  ['song-189', {videoId: 'JZBg58A_ZiE', seconds: 8.3}], // Jiggle Jiggle
  ['song-190', {videoId: 'Xxb9Hl5d6n4', seconds: 32.2}], // Cupid
  ['song-191', {videoId: 'm9SMT5ipbxk', seconds: 8.5}], // 아이돌 (アイドル)
  ['song-192', {videoId: '0t0HtFYjcU8', seconds: 74.3}], // NIGHT DANCER
  ['song-193', {videoId: 'Q97pvL6GsIA', seconds: 58}], // 날 바라바라봐
  ['song-194', {videoId: '7Fsie5WvzFM', seconds: 36.2}], // 잘자요 아가씨
  ['song-195', {videoId: 'xWD7-OrL2LA', seconds: 46.4}], // 티라미수 케익
  ['song-196', {videoId: 'y7CrvsCIjyo', seconds: 60.6}], // Soda Pop
  ['song-197', {videoId: 'EXeXTc7IqJE', seconds: 45.8}], // Rock That Body
  ['song-198', {videoId: '_7-Ynbwrk8E', seconds: 50.7}], // 머리어깨무릎발 (H.S.K.T.)
  ['song-199', {videoId: 'H4mB3mxPTrQ', seconds: 0.2}], // 가짜사랑
  ['song-200', {videoId: 'YcH2U4HHIDs', seconds: 78.9}], // 흥흥흥 (HMPH!)
  ['song-201', {videoId: 'OmEPFmyKO74', seconds: 1.1}], // 사랑을 했다 (LOVE SCENARIO)
]);

export function defaultShortformStart(song) {
  const cue = defaultCues.get(song.id);
  return cue?.videoId === song.introVideo ? cue.seconds : song.introStart;
}

export function clipStart(song, mode) {
  return mode === 'shortform'
    ? song.shortformStart ?? defaultShortformStart(song)
    : song.introStart;
}
