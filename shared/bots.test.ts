import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGame, applyMove, applyPass, score, idx,
  BLACK, WHITE, EMPTY, CELLS,
  type Cell,
} from './engine'
import { chooseBotMove } from './bots'
import { mulberry32 } from './rng'

function emptyBoard(): Cell[] {
  return new Array(CELLS).fill(EMPTY) as Cell[]
}

test('бот всегда находит ход на пустой доске (все уровни)', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const g = createGame()
    const a = chooseBotMove(g, 0, d, mulberry32(7))
    assert.equal(a.kind, 'play')
  }
})

test('знаток и мастер берут очевидного пленного', () => {
  for (const d of ['medium', 'hard'] as const) {
    const g = createGame()
    g.board = emptyBoard()
    g.board[idx(0, 0)] = WHITE
    g.board[idx(1, 0)] = BLACK // белый (0,0) под атари, дыхание (0,1)
    g.turn = 0
    const a = chooseBotMove(g, 0, d, mulberry32(3))
    assert.equal(a.kind, 'play')
    assert.equal(a.kind === 'play' && a.point, idx(0, 1)) // снимает белого
  }
})

test('бот не лезет в свой глаз, а пасует, когда полезных ходов нет', () => {
  // вся доска чёрная, кроме угла-глаза (0,0); чёрным ходить некуда полезно
  const g = createGame()
  g.board = new Array(CELLS).fill(BLACK) as Cell[]
  g.board[idx(0, 0)] = EMPTY // глаз чёрных
  g.turn = 0
  const a = chooseBotMove(g, 0, 'hard', mulberry32(1))
  assert.equal(a.kind, 'pass')
})

test('у соперника против живой группы только самоубийство → пас', () => {
  // доска вся чёрная, кроме двух раздельных глаз: чёрные живы (два глаза),
  // и любой ход белых в эти пункты самоубийствен (никого не снимает)
  const g = createGame()
  g.board = new Array(CELLS).fill(BLACK) as Cell[]
  g.board[idx(0, 0)] = EMPTY
  g.board[idx(8, 8)] = EMPTY
  g.turn = 1 // белые
  const a = chooseBotMove(g, 1, 'medium', mulberry32(2))
  assert.equal(a.kind, 'pass')
})

test('самоигра ботов завершается и даёт корректный счёт', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const g = createGame()
    const rng = mulberry32(123)
    let moves = 0
    while (!g.over && moves < 600) {
      const a = chooseBotMove(g, g.turn, d, rng)
      if (a.kind === 'pass') applyPass(g, g.turn)
      else {
        const r = applyMove(g, g.turn, a.point)
        if (!r.ok) applyPass(g, g.turn) // подстраховка: нелегальный ход не должен случаться
      }
      moves++
    }
    assert.equal(g.over, true, `партия (${d}) должна завершиться`)
    const s = score(g.board, g.komi)
    assert.ok(s.black >= 0 && s.white >= 0)
    // на 9x9 сумма площадей и нейтральных пунктов не превосходит числа пунктов + коми
    assert.ok(s.black + (s.white - g.komi) <= CELLS)
  }
})

test('мастер обыгрывает новичка за чёрных в большинстве партий', () => {
  // не строгий тест силы, а проверка, что мастер не слабее новичка вчистую
  let hardWins = 0
  const games = 6
  for (let i = 0; i < games; i++) {
    const g = createGame()
    const rng = mulberry32(1000 + i)
    let moves = 0
    while (!g.over && moves < 600) {
      const me = g.turn
      const d = me === 0 ? 'hard' : 'easy'
      const a = chooseBotMove(g, me, d, rng)
      if (a.kind === 'pass') applyPass(g, me)
      else if (!applyMove(g, me, a.point).ok) applyPass(g, me)
      moves++
    }
    const s = score(g.board, g.komi)
    if (s.black > s.white) hardWins++
  }
  assert.ok(hardWins >= 4, `мастер за чёрных выиграл ${hardWins}/${games}`)
})
