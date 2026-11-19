// 입력 조건·배점이 바뀌면 보드 버전을 새로 씀 (2026-11-15: 나머지 채널 32·주 130~190·색별 7문제·R→G→B 한 문제씩 번갈아·Δ9(8단계)에서 시작 ±1·Δ1까지 16단계·칸 9→16→25)
export const BOARD_PATH = 'rgbSensitivity/boards/v1_32_q7_s8_g345_mix/records';
const Q = 7, MAX_CH = 770, MAX_STAGE_PTS = 160;   // 색별 만점: 8→14단계 (80+90+…+140)
export const TOP_LIMIT = 50;
const CHANNELS = ['R', 'G', 'B'];
const integerBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function normalizeName(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}

export function validResult(value) {
  if (!value || !integerBetween(value.score, 0, MAX_CH * 3) || !integerBetween(value.correct, 0, Q * 3) || value.attempted !== Q * 3) return false;
  let score = 0, correct = 0;
  for (const ch of CHANNELS) {
    const rec = value.channels?.[ch];
    if (!rec || !integerBetween(rec.score, 0, MAX_CH) || !integerBetween(rec.correct, 0, Q) || rec.score % 10 !== 0 || rec.score < rec.correct * 10 || rec.score > rec.correct * MAX_STAGE_PTS) return false;
    score += rec.score;
    correct += rec.correct;
  }
  return value.score === score && value.correct === correct;
}

export function rankedEntries(records) {
  const sorted = Object.entries(records || {}).filter(([, rec]) => validResult(rec) && typeof rec.name === 'string' && normalizeName(rec.name) === rec.name && rec.name.length > 0)
    .map(([uid, rec]) => ({ ...rec, uid }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko') || a.uid.localeCompare(b.uid));
  let rank = 0;
  return sorted.slice(0, TOP_LIMIT).map((rec, index) => {
    if (index === 0 || sorted[index - 1].score !== rec.score) rank = index + 1;
    return { ...rec, rank };
  });
}

// Transaction callback: a lower attempt can never replace a personal best.
// Equal scores are equal ranks; neither elapsed time nor a preferred channel breaks a tie.
export function bestRecord(current, result, name, timestamp) {
  if (!validResult(result) || !name || name !== normalizeName(name)) throw new Error('등록할 기록이나 별명이 올바르지 않아요.');
  if (current && validResult(current) && current.score >= result.score) {
    if (current.name === name) return undefined;
    return { ...current, name, updatedAt: timestamp };
  }
  return {
    name, score: result.score, correct: result.correct, attempted: Q * 3,
    channels: Object.fromEntries(CHANNELS.map(ch => [ch, { score: result.channels[ch].score, correct: result.channels[ch].correct }])),
    updatedAt: timestamp
  };
}
