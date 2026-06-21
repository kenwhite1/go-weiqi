// Лёгкий модуль с уровнями сложности: его можно безопасно тянуть и в браузер
// (в отличие от bots.ts, который тянет генератор ходов). Здесь только метаданные
// для интерфейса и темп раздумий ботов.

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface DifficultyInfo {
  d: Difficulty
  t: string
  s: string
  emoji: string
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { d: 'easy', t: 'Новичок', s: 'Ставит наугад', emoji: '🌱' },
  { d: 'medium', t: 'Знаток', s: 'Бьёт и спасает', emoji: '🎯' },
  { d: 'hard', t: 'Мастер', s: 'Думает наперёд', emoji: '🔥' },
]

// Пауза перед ходом бота, чтобы темп читался как живой.
// В быстрых играх (humanize) растягиваем «раздумье» и добавляем длинный хвост,
// чтобы скорость хода ботов перекрывалась с живыми игроками и их нельзя было
// вычислить по тому, что они всегда отвечают за пару секунд.
export function botThinkDelay(difficulty: Difficulty, humanize = false): number {
  const base = difficulty === 'hard' ? 1500 : difficulty === 'medium' ? 1900 : 2400
  const jitter = difficulty === 'hard' ? 1100 : difficulty === 'medium' ? 1500 : 2000
  let delay = base + Math.floor(Math.random() * jitter)
  if (humanize) {
    delay += 2000 + Math.floor(Math.random() * 6500) // обычное живое раздумье
    if (Math.random() < 0.18) delay += Math.floor(Math.random() * 8000) // иногда «отвлёкся»
  }
  return delay
}
