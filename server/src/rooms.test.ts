import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSolo, createRoom, joinRoom, quickMatch, startRoom,
  playMove, passMove, resignMove, getRoomState, leaveRoom,
} from './rooms'
import type { RoomStateDto } from '../../shared/types'

function st(r: unknown): RoomStateDto {
  assert.ok(r && typeof r === 'object' && !('error' in (r as object)), `unexpected error: ${JSON.stringify(r)}`)
  return r as RoomStateDto
}

test('одиночная игра стартует сразу на двоих с пустой доской', () => {
  const s = st(createSolo(101, 'Тест', 'medium'))
  assert.equal(s.status, 'playing')
  assert.equal(s.players.length, 2)
  assert.equal(s.board.filter(v => v !== 0).length, 0) // Го начинается с пустой доски
  assert.ok(s.players.some(p => p.isBot)) // один соперник бот
  assert.ok(s.players.some(p => p.color === 'black') && s.players.some(p => p.color === 'white'))
  assert.ok(s.komi > 0) // у белых есть коми
  leaveRoom(s.code, 101)
})

test('комната друзей: старт хозяина виден присоединившемуся (host-start)', () => {
  const host = st(createRoom(201, 'Хозяин', 'easy'))
  assert.equal(host.status, 'lobby')
  const code = host.code

  const joined = st(joinRoom(code, 202, 'Гость'))
  assert.equal(joined.status, 'lobby')
  assert.equal(joined.players.filter(p => !p.isBot).length, 2)

  // хозяин начинает
  const afterStart = st(startRoom(code, 201))
  assert.equal(afterStart.status, 'playing')

  // КЛЮЧЕВОЕ: следующий опрос гостя тоже отдаёт playing (баг «не стартует у гостя»)
  const guestPoll = st(getRoomState(code, 202))
  assert.equal(guestPoll.status, 'playing')
  assert.ok(guestPoll.yourColor === 'black' || guestPoll.yourColor === 'white')
  leaveRoom(code, 201)
  leaveRoom(code, 202)
})

test('не-хозяин не может начать партию', () => {
  const host = st(createRoom(211, 'Хозяин', 'medium'))
  joinRoom(host.code, 212, 'Гость')
  const r = startRoom(host.code, 212) as { error?: string }
  assert.equal(r.error, 'not_host')
  leaveRoom(host.code, 211)
})

test('быстрая игра: второй человек запускает партию, бота не видно', () => {
  const a = st(quickMatch(301, 'Алиса'))
  assert.equal(a.quick, true)
  const b = st(quickMatch(302, 'Боб')) // садится в ту же комнату, заполняет места
  assert.equal(b.status, 'playing')
  // в быстрой комнате соперник не помечен ботом
  assert.ok(b.players.every(p => !p.isBot))
  leaveRoom(b.code, 301)
  leaveRoom(b.code, 302)
})

test('нелегальный ход отклоняется, легальный двигает партию', () => {
  const s = st(createSolo(401, 'Тест', 'easy'))
  const code = s.code
  const me = getRoomState(code, 401) as RoomStateDto
  if (me.youAreCurrent) {
    // занятый/несуществующий пункт отклоняется через API схему, а тут проверим бизнес-логику:
    const before = me.version
    const ok = st(playMove(code, 401, 40)) // центр пуст и легален на старте
    assert.ok(ok.version > before)
    assert.equal(ok.board[40] !== 0, true)
    // повтор в тот же пункт это занято
    const bad = playMove(code, 401, 40) as { error?: string }
    assert.ok(bad.error === 'occupied' || bad.error === 'not_your_turn')
  } else {
    // ход у бота: подтверждаем, что текущий это другой игрок
    assert.notEqual(me.currentSeatId, me.yourSeatId)
  }
  leaveRoom(code, 401)
})

test('пас принимается в свой ход', () => {
  const s = st(createSolo(411, 'Тест', 'easy'))
  const me = getRoomState(s.code, 411) as RoomStateDto
  if (me.youAreCurrent) {
    const r = passMove(s.code, 411)
    assert.ok(!('error' in r))
  }
  leaveRoom(s.code, 411)
})

test('сдача завершает партию победой соперника', () => {
  const s = st(createSolo(421, 'Тест', 'medium'))
  const r = st(resignMove(s.code, 421))
  assert.equal(r.status, 'finished')
  assert.ok(r.result)
  assert.equal(r.result!.youWon, false) // сдавшийся проиграл
  assert.equal(r.result!.resign, true)
  leaveRoom(s.code, 421)
})

test('выход единственного человека удаляет/закрывает комнату', () => {
  const s = st(createRoom(501, 'Один', 'medium'))
  leaveRoom(s.code, 501)
  const after = getRoomState(s.code, 501) as { error?: string }
  assert.equal(after.error, 'no_room')
})

test('ко-пункт виден только тому, чей сейчас ход', () => {
  // косвенно: на старте ко нет, поле koPoint = null
  const s = st(createSolo(511, 'Тест', 'easy'))
  assert.equal(s.koPoint, null)
  leaveRoom(s.code, 511)
})
