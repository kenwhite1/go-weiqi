// Движок «Го» (вэйци) на доске 9x9, своя реализация без заимствований.
//
// Го это древняя игра про окружение. Камни ставят на пересечения линий. У каждой
// группы соединённых камней одного цвета есть «дыхания» (свободы) это соседние
// пустые пересечения. Группа без дыханий снимается с доски (её взяли в плен).
//
// Правила хода:
//   • Ход это постановка своего камня на пустое пересечение.
//   • Сначала снимаются все группы соперника, у которых после хода не осталось
//     дыханий.
//   • Затем проверяется свой камень: если у его группы нет дыханий, ход
//     самоубийственный и запрещён (если только он не снял камни соперника).
//   • Правило ко: нельзя ходом вернуть доску в положение, которое было перед
//     предыдущим ходом соперника (запрет вечного отыгрыша одного камня).
//   • Можно пропустить ход (пас). Два паса подряд заканчивают партию.
//
// Подсчёт по площади (китайский): очки стороны = её камни на доске плюс пустые
// области, окружённые только её камнями (территория). Белые получают коми
// (компенсацию за второй ход). Больше очков, тот и победил.
//
// Информация открыта полностью: сервер шлёт всю доску обоим игрокам. Сервер
// авторитетен: проверяет легальность хода, снимает пленных и считает очки сам.

export const SIZE = 9
export const CELLS = SIZE * SIZE
export const DEFAULT_KOMI = 6.5 // компенсация белым; дробная, чтобы не было ничьих

// Значения пересечений доски.
export const EMPTY = 0
export const BLACK = 1 // игрок 0, ходит первым
export const WHITE = 2 // игрок 1, получает коми

export type Cell = 0 | 1 | 2

export interface GameState {
  board: Cell[] // 81 пересечение
  turn: number // чей ход: 0 (чёрные) или 1 (белые)
  over: boolean
  koPoint: number | null // запрещённое правилом ко пересечение для текущего хода
  captures: [number, number] // взято в плен камней игроками [чёрные, белые]
  lastMove: number | null // последний поставленный камень (null после паса)
  lastWasPass: boolean
  passes: number // сколько пасов подряд
  removed: number[] // что снято последним ходом (для анимации)
  moveCount: number
  komi: number
  resignedBy: number | null // кто сдался (иначе null)
}

export function discOf(player: number): Cell {
  return (player === 0 ? BLACK : WHITE) as Cell
}

function oppDisc(player: number): Cell {
  return (player === 0 ? WHITE : BLACK) as Cell
}

export function idx(r: number, c: number): number {
  return r * SIZE + c
}

// Ортогональные соседи пересечения (без диагоналей: дыхания считаются по линиям).
export function neighbors(point: number): number[] {
  const r = Math.floor(point / SIZE)
  const c = point % SIZE
  const out: number[] = []
  if (r > 0) out.push(point - SIZE)
  if (r < SIZE - 1) out.push(point + SIZE)
  if (c > 0) out.push(point - 1)
  if (c < SIZE - 1) out.push(point + 1)
  return out
}

// Диагональные соседи (нужны для распознавания «глаза» в логике ботов).
export function diagonals(point: number): number[] {
  const r = Math.floor(point / SIZE)
  const c = point % SIZE
  const out: number[] = []
  if (r > 0 && c > 0) out.push(point - SIZE - 1)
  if (r > 0 && c < SIZE - 1) out.push(point - SIZE + 1)
  if (r < SIZE - 1 && c > 0) out.push(point + SIZE - 1)
  if (r < SIZE - 1 && c < SIZE - 1) out.push(point + SIZE + 1)
  return out
}

export interface GroupInfo {
  stones: number[]
  liberties: number[]
}

// Группа соединённых камней одного цвета, начиная с точки start, и её дыхания.
// Возвращает пустую группу, если в start нет камня.
export function groupAt(board: Cell[], start: number): GroupInfo {
  const color = board[start]
  if (color === EMPTY) return { stones: [], liberties: [] }
  const stones: number[] = []
  const seen = new Uint8Array(CELLS)
  const libSeen = new Uint8Array(CELLS)
  const liberties: number[] = []
  const stack = [start]
  seen[start] = 1
  while (stack.length) {
    const p = stack.pop()!
    stones.push(p)
    for (const n of neighbors(p)) {
      if (board[n] === EMPTY) {
        if (!libSeen[n]) { libSeen[n] = 1; liberties.push(n) }
      } else if (board[n] === color && !seen[n]) {
        seen[n] = 1
        stack.push(n)
      }
    }
  }
  return { stones, liberties }
}

// Быстрый подсчёт числа дыханий группы (без выделения массива дыханий целиком).
export function libertyCount(board: Cell[], start: number): number {
  const color = board[start]
  if (color === EMPTY) return 0
  const seen = new Uint8Array(CELLS)
  const libSeen = new Uint8Array(CELLS)
  let libs = 0
  const stack = [start]
  seen[start] = 1
  while (stack.length) {
    const p = stack.pop()!
    for (const n of neighbors(p)) {
      if (board[n] === EMPTY) {
        if (!libSeen[n]) { libSeen[n] = 1; libs++ }
      } else if (board[n] === color && !seen[n]) {
        seen[n] = 1
        stack.push(n)
      }
    }
  }
  return libs
}

export interface TryResult {
  ok: boolean
  reason?: 'occupied' | 'ko' | 'suicide'
  board: Cell[] // итоговая доска (на ней уже сняты пленные)
  captured: number[] // снятые камни соперника
  koPoint: number | null // новое ко-пересечение после хода
}

// Чистая попытка хода: не меняет вход, возвращает новую доску и последствия.
// Используется и для проверки легальности, и для симуляций ботами.
export function tryMove(board: Cell[], player: number, point: number, koPoint: number | null): TryResult {
  if (point < 0 || point >= CELLS || board[point] !== EMPTY) {
    return { ok: false, reason: 'occupied', board, captured: [], koPoint: null }
  }
  if (point === koPoint) {
    return { ok: false, reason: 'ko', board, captured: [], koPoint: null }
  }
  const me = discOf(player)
  const opp = oppDisc(player)
  const next = board.slice()
  next[point] = me

  // 1) снимаем группы соперника без дыханий
  const captured: number[] = []
  const seenCap = new Uint8Array(CELLS)
  for (const n of neighbors(point)) {
    if (next[n] === opp && !seenCap[n]) {
      const g = groupAt(next, n)
      if (g.liberties.length === 0) {
        for (const s of g.stones) {
          if (!seenCap[s]) { seenCap[s] = 1; captured.push(s) }
        }
      } else {
        for (const s of g.stones) seenCap[s] = 1
      }
    }
  }
  for (const s of captured) next[s] = EMPTY

  // 2) свой камень: без дыханий и без взятия это самоубийство
  if (captured.length === 0 && libertyCount(next, point) === 0) {
    return { ok: false, reason: 'suicide', board, captured: [], koPoint: null }
  }

  // 3) простое ко: взяли ровно один камень и свой камень одинокий с одним дыханием.
  // Тогда снятое пересечение запрещено сопернику на следующий ход.
  let newKo: number | null = null
  if (captured.length === 1) {
    const g = groupAt(next, point)
    if (g.stones.length === 1 && g.liberties.length === 1) newKo = captured[0]
  }

  return { ok: true, board: next, captured, koPoint: newKo }
}

export function legalMove(state: GameState, player: number, point: number): boolean {
  if (state.over || player !== state.turn) return false
  return tryMove(state.board, player, point, state.koPoint).ok
}

// Список всех легальных пересечений для игрока (без учёта «глаз», это дело ботов).
export function legalMoves(board: Cell[], player: number, koPoint: number | null): number[] {
  const out: number[] = []
  for (let p = 0; p < CELLS; p++) {
    if (board[p] !== EMPTY) continue
    if (tryMove(board, player, p, koPoint).ok) out.push(p)
  }
  return out
}

export function createGame(komi: number = DEFAULT_KOMI): GameState {
  return {
    board: new Array(CELLS).fill(EMPTY) as Cell[],
    turn: 0,
    over: false,
    koPoint: null,
    captures: [0, 0],
    lastMove: null,
    lastWasPass: false,
    passes: 0,
    removed: [],
    moveCount: 0,
    komi,
    resignedBy: null,
  }
}

export interface MoveResult {
  ok: boolean
  reason?: 'occupied' | 'ko' | 'suicide' | 'not_turn'
  captured: number[]
}

// Применить ход игрока. Возвращает ok=false, если не его очередь или ход нелегален.
export function applyMove(state: GameState, player: number, point: number): MoveResult {
  if (state.over || player !== state.turn) return { ok: false, reason: 'not_turn', captured: [] }
  const res = tryMove(state.board, player, point, state.koPoint)
  if (!res.ok) return { ok: false, reason: res.reason, captured: [] }

  state.board = res.board
  state.captures[player] += res.captured.length
  state.koPoint = res.koPoint
  state.lastMove = point
  state.lastWasPass = false
  state.passes = 0
  state.removed = res.captured
  state.moveCount++
  state.turn = player ^ 1
  return { ok: true, captured: res.captured }
}

// Пропуск хода. Два паса подряд заканчивают партию (дальше идёт подсчёт).
export function applyPass(state: GameState, player: number): boolean {
  if (state.over || player !== state.turn) return false
  state.koPoint = null
  state.lastMove = null
  state.lastWasPass = true
  state.removed = []
  state.passes++
  state.moveCount++
  state.turn = player ^ 1
  if (state.passes >= 2) state.over = true
  return true
}

export function resign(state: GameState, player: number): boolean {
  if (state.over) return false
  state.over = true
  state.resignedBy = player
  return true
}

export interface ScoreResult {
  black: number // площадь чёрных (камни + территория)
  white: number // площадь белых (камни + территория + коми)
  blackTerritory: number
  whiteTerritory: number
  komi: number
  // карта владения пустыми пунктами: 0 ничьё/нейтрально, 1 чёрные, 2 белые
  territory: number[]
}

// Подсчёт по площади (китайский). Пустые области, граничащие только с одним
// цветом, отходят ему как территория; граничащие с обоими нейтральны (даме).
export function score(board: Cell[], komi: number): ScoreResult {
  let blackStones = 0
  let whiteStones = 0
  for (let p = 0; p < CELLS; p++) {
    if (board[p] === BLACK) blackStones++
    else if (board[p] === WHITE) whiteStones++
  }

  const territory = new Array(CELLS).fill(0)
  const seen = new Uint8Array(CELLS)
  let blackTerritory = 0
  let whiteTerritory = 0

  for (let p = 0; p < CELLS; p++) {
    if (board[p] !== EMPTY || seen[p]) continue
    // обходим связную пустую область и смотрим, какие цвета её окружают
    const region: number[] = []
    const stack = [p]
    seen[p] = 1
    let touchBlack = false
    let touchWhite = false
    while (stack.length) {
      const q = stack.pop()!
      region.push(q)
      for (const n of neighbors(q)) {
        if (board[n] === EMPTY) {
          if (!seen[n]) { seen[n] = 1; stack.push(n) }
        } else if (board[n] === BLACK) touchBlack = true
        else if (board[n] === WHITE) touchWhite = true
      }
    }
    if (touchBlack && !touchWhite) {
      blackTerritory += region.length
      for (const q of region) territory[q] = BLACK
    } else if (touchWhite && !touchBlack) {
      whiteTerritory += region.length
      for (const q of region) territory[q] = WHITE
    }
  }

  return {
    black: blackStones + blackTerritory,
    white: whiteStones + whiteTerritory + komi,
    blackTerritory,
    whiteTerritory,
    komi,
    territory,
  }
}

// Победитель завершённой партии: 0 (чёрные), 1 (белые) или null (ничья).
export function winnerOf(state: GameState): number | null {
  if (state.resignedBy != null) return state.resignedBy ^ 1
  const s = score(state.board, state.komi)
  if (s.black === s.white) return null
  return s.black > s.white ? 0 : 1
}
