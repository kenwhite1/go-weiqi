import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGame, applyMove, applyPass, resign, tryMove, legalMoves, groupAt,
  score, winnerOf, idx, neighbors,
  BLACK, WHITE, EMPTY, CELLS, SIZE, DEFAULT_KOMI,
  type Cell,
} from './engine'

function emptyBoard(): Cell[] {
  return new Array(CELLS).fill(EMPTY) as Cell[]
}

test('новая партия: пустая доска, ход чёрных', () => {
  const g = createGame()
  assert.equal(g.board.filter(v => v !== EMPTY).length, 0)
  assert.equal(g.turn, 0)
  assert.equal(g.over, false)
  assert.equal(g.komi, DEFAULT_KOMI)
  assert.deepEqual(g.captures, [0, 0])
})

test('соседи углов и центра', () => {
  assert.deepEqual(neighbors(idx(0, 0)).sort((a, b) => a - b), [idx(0, 1), idx(1, 0)].sort((a, b) => a - b))
  assert.equal(neighbors(idx(4, 4)).length, 4)
  assert.equal(neighbors(idx(0, 4)).length, 3) // на краю
})

test('ход ставит камень и передаёт очередь', () => {
  const g = createGame()
  const r = applyMove(g, 0, idx(4, 4))
  assert.equal(r.ok, true)
  assert.equal(g.board[idx(4, 4)], BLACK)
  assert.equal(g.turn, 1)
  assert.equal(g.lastMove, idx(4, 4))
})

test('нельзя ходить не в свою очередь и на занятый пункт', () => {
  const g = createGame()
  assert.equal(applyMove(g, 1, idx(4, 4)).ok, false) // ход чёрных, не белых
  applyMove(g, 0, idx(4, 4))
  const r = applyMove(g, 1, idx(4, 4)) // занятый пункт
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'occupied')
})

test('взятие одиночного камня в атари', () => {
  const g = createGame()
  g.board = emptyBoard()
  // белый камень в углу под атари: чёрные на (0,1) и (1,0), дыхание одно: (0,1)? нет
  g.board[idx(0, 0)] = WHITE
  g.board[idx(1, 0)] = BLACK
  g.turn = 0
  // у белого (0,0) дыхания: (0,1). Чёрные ставят (0,1) и снимают белого.
  const r = applyMove(g, 0, idx(0, 1))
  assert.equal(r.ok, true)
  assert.deepEqual(r.captured, [idx(0, 0)])
  assert.equal(g.board[idx(0, 0)], EMPTY)
  assert.equal(g.captures[0], 1) // чёрные взяли 1
})

test('самоубийственный ход запрещён', () => {
  const board = emptyBoard()
  board[idx(0, 1)] = WHITE
  board[idx(1, 0)] = WHITE
  // чёрные ставят в угол (0,0): нет дыханий и никого не снимают → самоубийство
  const r = tryMove(board, 0, idx(0, 0), null)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'suicide')
})

test('ход со взятием легален, даже если сам по себе был бы без дыханий', () => {
  const board = emptyBoard()
  board[idx(0, 0)] = WHITE
  board[idx(1, 0)] = BLACK
  // чёрные в (0,1): снимают белого (0,0), значит дыхание появляется → легально
  const r = tryMove(board, 0, idx(0, 1), null)
  assert.equal(r.ok, true)
  assert.equal(r.captured.length, 1)
})

test('правило ко: нельзя сразу отыграть назад', () => {
  const g = createGame()
  g.board = emptyBoard()
  // классическая форма ко вокруг (3,4)
  g.board[idx(2, 3)] = BLACK; g.board[idx(2, 4)] = WHITE
  g.board[idx(3, 2)] = BLACK; g.board[idx(3, 3)] = WHITE; g.board[idx(3, 5)] = WHITE
  g.board[idx(4, 3)] = BLACK; g.board[idx(4, 4)] = WHITE
  g.turn = 0
  // чёрные берут белого (3,3), играя (3,4)
  const r = applyMove(g, 0, idx(3, 4))
  assert.equal(r.ok, true)
  assert.deepEqual(r.captured, [idx(3, 3)])
  assert.equal(g.koPoint, idx(3, 3))
  // белые не могут немедленно отыграть на (3,3)
  const ko = applyMove(g, 1, idx(3, 3))
  assert.equal(ko.ok, false)
  assert.equal(ko.reason, 'ko')
  // но другой ход белым разрешён, и ко снимается
  assert.equal(applyMove(g, 1, idx(7, 7)).ok, true)
  assert.equal(g.koPoint, null)
})

test('два паса заканчивают партию', () => {
  const g = createGame()
  applyMove(g, 0, idx(4, 4))
  assert.equal(applyPass(g, 1), true)
  assert.equal(g.over, false)
  assert.equal(applyPass(g, 0), true)
  assert.equal(g.over, true)
})

test('пас сбрасывает счётчик при ходе между ними', () => {
  const g = createGame()
  applyPass(g, 0)
  applyMove(g, 1, idx(4, 4)) // ход обнуляет серию пасов
  assert.equal(g.passes, 0)
  applyPass(g, 0)
  assert.equal(g.over, false)
})

test('подсчёт по площади: один чёрный камень владеет всей доской', () => {
  const board = emptyBoard()
  board[idx(4, 4)] = BLACK
  const s = score(board, DEFAULT_KOMI)
  assert.equal(s.black, CELLS) // 1 камень + 80 территории
  assert.equal(s.white, DEFAULT_KOMI)
})

test('подсчёт по площади: ровный раздел стенками, центр нейтрален', () => {
  const board = emptyBoard()
  for (let r = 0; r < SIZE; r++) { board[idx(r, 3)] = BLACK; board[idx(r, 5)] = WHITE }
  const s = score(board, DEFAULT_KOMI)
  // чёрные: стенка 9 + столбцы 0,1,2 (27) = 36
  assert.equal(s.black, 36)
  // белые: стенка 9 + столбцы 6,7,8 (27) + коми
  assert.equal(s.white, 36 + DEFAULT_KOMI)
  assert.equal(winnerOf({ ...createGame(), board, over: true } as never), 1) // белые с коми
})

test('пустая доска нейтральна', () => {
  const s = score(emptyBoard(), DEFAULT_KOMI)
  assert.equal(s.black, 0)
  assert.equal(s.white, DEFAULT_KOMI)
})

test('сдача: побеждает соперник', () => {
  const g = createGame()
  applyMove(g, 0, idx(4, 4))
  resign(g, 1) // белые сдались
  assert.equal(g.over, true)
  assert.equal(winnerOf(g), 0) // чёрные выиграли
})

test('legalMoves исключает занятые и нелегальные пункты', () => {
  const board = emptyBoard()
  board[idx(0, 1)] = WHITE
  board[idx(1, 0)] = WHITE
  const moves = legalMoves(board, 0, null)
  assert.ok(!moves.includes(idx(0, 0))) // самоубийство исключено
  assert.ok(!moves.includes(idx(0, 1))) // занято
  assert.equal(moves.length, CELLS - 3) // все пустые кроме угла-самоубийства
})

test('группа и её дыхания считаются верно', () => {
  const board = emptyBoard()
  board[idx(4, 4)] = BLACK
  board[idx(4, 5)] = BLACK
  const g = groupAt(board, idx(4, 4))
  assert.equal(g.stones.length, 2)
  assert.equal(g.liberties.length, 6) // две соединённые точки имеют 6 дыханий
})
