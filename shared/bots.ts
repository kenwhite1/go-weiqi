// Боты «Го»: выбор хода по сложности.
//   • Новичок ставит почти наугад по легальным пунктам, не лезет в свои глаза и
//     избегает явного самоатари, но иногда всё же берёт камни.
//   • Знаток смотрит на один ход вперёд тактически: берёт пленных, ставит
//     соперника под атари, спасает свои группы от атари, тянет дыхания и занимает
//     границу, фейся на хорошие линии в начале.
//   • Мастер добавляет к этому оценку территории по всей доске и глубже видит
//     безопасность: не оставляет свои группы под боем и метит в крупную выгоду.
//
// Полноценный перебор в Го невозможен (ветвление огромно, оценка трудна), поэтому
// здесь сильная эвристика. Главное свойство: бот доигрывает партию (заполняет
// даме, снимает мёртвое) и пасует только когда полезных ходов не осталось, иначе
// подсчёт по площади был бы неверным.

import {
  tryMove, libertyCount, groupAt, neighbors, diagonals, score,
  EMPTY, BLACK, WHITE, CELLS, discOf,
  type Cell, type GameState,
} from './engine'
import type { Difficulty } from './difficulty'

export { DIFFICULTIES, botThinkDelay } from './difficulty'
export type { Difficulty, DifficultyInfo } from './difficulty'

export type BotAction = { kind: 'play'; point: number } | { kind: 'pass' }

const PASS_THRESHOLD = 0.8 // ниже этого «полезность» хода считаем недостаточной для игры

// Позиционный вес линии (0..8): третья линия и центр ценны, первая (край) слаба.
const LINE: number[] = [-2, 2, 4, 3, 3, 3, 4, 2, -2]

function positional(point: number): number {
  const r = Math.floor(point / 9)
  const c = point % 9
  return LINE[r] + LINE[c]
}

// «Глаз»: пустой пункт, окружённый своими камнями так, что заполнять его вредно.
// Консервативно: все ортогональные соседи свои; по диагоналям в центре нужно
// минимум 3 из 4 своих, на краю и в углу все имеющиеся. Этого хватает, чтобы бот
// не зашивал свои настоящие глаза в эндшпиле (когда диагонали уже заняты).
function isEye(board: Cell[], point: number, me: Cell): boolean {
  if (board[point] !== EMPTY) return false
  for (const n of neighbors(point)) if (board[n] !== me) return false
  const diags = diagonals(point)
  let friendly = 0
  for (const d of diags) if (board[d] === me) friendly++
  return diags.length === 4 ? friendly >= 3 : friendly === diags.length
}

interface MoveEval {
  point: number
  value: number
  captured: number
}

// Тактическая оценка одного легального хода с точки зрения игрока player.
// deep=true включает «мастерское» зрение: оценку территории и безопасность всех
// своих групп (а не только что поставленной).
function evalMove(
  state: GameState,
  player: number,
  point: number,
  openness: number,
  deep: boolean,
  rng: () => number,
): MoveEval | null {
  const board = state.board
  const me = discOf(player)
  const opp = discOf(player ^ 1)
  const res = tryMove(board, player, point, state.koPoint)
  if (!res.ok) return null

  let v = 0

  // 1) взятие пленных это почти всегда главное
  v += res.captured.length * 12

  // 2) свобода своей получившейся группы; самоатари наказываем
  const myLibs = libertyCount(res.board, point)
  if (res.captured.length === 0 && myLibs === 1) v -= 14
  else v += Math.min(myLibs, 4) * 0.8

  // 3) спасение своих групп из атари (соседняя своя группа имела 1 дыхание)
  const savedRoots = new Set<number>()
  for (const n of neighbors(point)) {
    if (board[n] === me) {
      const g = groupAt(board, n)
      if (g.liberties.length === 1 && !savedRoots.has(g.stones[0])) {
        savedRoots.add(g.stones[0])
        if (myLibs >= 2 || res.captured.length > 0) v += 4 + g.stones.length
      }
    }
  }

  // 4) атари по сопернику (его соседняя группа осталась с 1 дыханием)
  const atariRoots = new Set<number>()
  let enemyContact = 0
  for (const n of neighbors(point)) {
    if (board[n] === opp) enemyContact++
    if (res.board[n] === opp) {
      const g = groupAt(res.board, n)
      const root = g.stones[0]
      if (g.liberties.length === 1 && !atariRoots.has(root)) {
        atariRoots.add(root)
        v += 3 + g.stones.length * 0.5
      }
    }
  }

  // 5) контактные и позиционные мотивы. Мирные ходы (без контакта с врагом и без
  //    тактики) ценны лишь в начале и тают по мере заполнения доски, поэтому в
  //    эндшпиле бот их не делает и спокойно пасует, оставив только глаза.
  let friendlyContact = 0
  for (const n of neighbors(point)) if (board[n] === me) friendlyContact++
  const peaceful = positional(point) * 0.5 + friendlyContact * 1.2
  v += enemyContact * 2.2 // даме и граница всегда уместны
  v += peaceful * openness

  // 6) мастер: видит территорию по всей доске и безопасность своих групп
  if (deep) {
    const sc = score(res.board, state.komi)
    const myArea = player === 0 ? sc.black : sc.white
    const oppArea = player === 0 ? sc.white : sc.black
    v += (myArea - oppArea) * 0.25

    // штраф за любые свои группы, оставшиеся под боем (1 дыхание) после хода
    let inAtari = 0
    const seen = new Uint8Array(CELLS)
    for (let p = 0; p < CELLS; p++) {
      if (res.board[p] === me && !seen[p]) {
        const g = groupAt(res.board, p)
        for (const s of g.stones) seen[s] = 1
        if (g.liberties.length === 1) inAtari += g.stones.length
      }
    }
    v -= inAtari * 2
  }

  v += rng() * 1.5 // лёгкая случайность для разнообразия
  return { point, value: v, captured: res.captured.length }
}

// Кандидаты: легальные пункты, не являющиеся своим глазом.
function candidates(state: GameState, player: number): number[] {
  const me = discOf(player)
  const out: number[] = []
  for (let p = 0; p < CELLS; p++) {
    if (state.board[p] !== EMPTY) continue
    if (isEye(state.board, p, me)) continue
    if (!tryMove(state.board, player, p, state.koPoint).ok) continue
    out.push(p)
  }
  return out
}

function emptyCount(board: Cell[]): number {
  let n = 0
  for (let i = 0; i < CELLS; i++) if (board[i] === EMPTY) n++
  return n
}

export function chooseBotMove(
  state: GameState,
  player: number,
  difficulty: Difficulty,
  rng: () => number = Math.random,
): BotAction {
  const cands = candidates(state, player)
  if (cands.length === 0) return { kind: 'pass' }

  const openness = emptyCount(state.board) / CELLS

  if (difficulty === 'easy') {
    // новичок: избегает самоубийственных ходов, иногда берёт камни, иначе наугад
    const safe: number[] = []
    const capturing: number[] = []
    for (const p of cands) {
      const res = tryMove(state.board, player, p, state.koPoint)
      if (res.captured.length > 0) capturing.push(p)
      const selfAtari = res.captured.length === 0 && libertyCount(res.board, p) === 1
      if (!selfAtari) safe.push(p)
    }
    if (capturing.length > 0 && rng() < 0.55) {
      return { kind: 'play', point: capturing[Math.floor(rng() * capturing.length)] }
    }
    const pool = safe.length > 0 ? safe : cands
    return { kind: 'play', point: pool[Math.floor(rng() * pool.length)] }
  }

  const deep = difficulty === 'hard'
  const scored: MoveEval[] = []
  for (const p of cands) {
    const e = evalMove(state, player, p, openness, deep, rng)
    if (e) scored.push(e)
  }
  if (scored.length === 0) return { kind: 'pass' }
  scored.sort((a, b) => b.value - a.value)

  // полезных ходов нет (только заполнение своей территории) → пас
  if (scored[0].value < PASS_THRESHOLD) return { kind: 'pass' }

  if (difficulty === 'medium') {
    // обычно лучший ход, иногда второй: остаётся обыгрываемым
    const i = rng() < 0.82 ? 0 : Math.min(1, scored.length - 1)
    return { kind: 'play', point: scored[i].point }
  }

  // hard: почти всегда лучший по углублённой оценке
  return { kind: 'play', point: scored[0].point }
}
