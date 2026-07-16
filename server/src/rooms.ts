// --- Менеджер комнат «Го» -----------------------------------------------------
// Партия на двоих: чёрные против белых. Сервер авторитетен: у него доска, порядок
// хода, проверка легальности, снятие пленных и подсчёт очков. Клиент рисует
// присланную доску и шлёт попытку хода (индекс пересечения), пас или сдачу.
//
// Три вида комнат:
//   * одиночная: человек и один бот, стартует сразу;
//   * быстрая: публичный подбор, пустое место занимает бот под видом человека;
//   * с друзьями: по коду, пустое место занимает видимый бот при старте.
//
// Боты живут на сервере: на их ход заводится таймер «раздумья», движок ищет им
// ход (или решает спасовать) и применяет его. Партия заканчивается двумя пасами
// подряд или сдачей; затем считаем территорию по площади с учётом коми.

import {
  createGame, applyMove, applyPass, resign as resignGame, winnerOf, score,
  type GameState,
} from '../../shared/engine'
import { chooseBotMove, botThinkDelay, type Difficulty } from '../../shared/bots'
import { mulberry32, randomSeed, shuffle } from '../../shared/rng'
import type {
  RoomStateDto, RoomPlayerDto, StandingDto, GameEventDto, EventKind, StoneColor,
} from '../../shared/types'
import { recordResult } from './profiles'
import { reportMatch } from './gg'
import type { MatchMode } from '../../shared/gg'

interface Seat {
  id: string // 'u<tgid>' у людей, 'bot1'... у ботов
  publicId: string // непрозрачный токен для быстрых комнат
  tgId: number | null
  name: string
  isBot: boolean
  isHost: boolean
  difficulty: Difficulty
  gameIndex: number // 0 чёрные, 1 белые (после старта)
  lastSeen: number
  left: boolean
  place: number | null
}

interface Room {
  code: string
  hostTgId: number
  seats: Seat[]
  quick: boolean
  solo: boolean
  difficulty: Difficulty
  maxPlayers: number
  started: boolean
  finished: boolean
  version: number
  game: GameState | null
  createdAt: number
  lastActivity: number
  turnStartedAt: number | null
  turnTimer: ReturnType<typeof setTimeout> | null
  startTimer: ReturnType<typeof setTimeout> | null
  lastEvent: GameEventDto | null
  eventSeq: number
  winnerId: string | null
  winnerName: string
  draw: boolean
  byResign: boolean
  finalBlack: number
  finalWhite: number
  territory: number[]
  scored: boolean
}

const rooms = new Map<string, Room>()
const MAX = 2 // «Го» строго на двоих
const CELLS = 81
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const QUICK_DELAY = 7000 // окно подбора перед авто-стартом
const TURN_MS = 60_000 // на ход человеку, чтобы партия не зависала
const MAX_ROOMS_PER_USER = 5 // потолок одновременных партий на игрока (анти-DoS)
const MAX_ROOMS = 3000 // глобальный потолок комнат в памяти

// Анти-DoS: не даём одному игроку плодить комнаты без конца и держим общий
// потолок, выселяя самые старые завершённые/простаивающие комнаты.
function enforceLimits(tgId: number): void {
  const mine = [...rooms.values()].filter(r => !r.finished && r.seats.some(s => s.tgId === tgId && !s.left))
  if (mine.length >= MAX_ROOMS_PER_USER) {
    mine.sort((a, b) => a.createdAt - b.createdAt)
    const victim = mine[0]
    clearTimers(victim)
    rooms.delete(victim.code)
  }
  if (rooms.size >= MAX_ROOMS) {
    let victim: Room | null = null
    for (const r of rooms.values()) {
      if (r.finished || Date.now() - r.lastActivity > 5 * 60_000) {
        if (!victim || r.lastActivity < victim.lastActivity) victim = r
      }
    }
    if (victim) { clearTimers(victim); rooms.delete(victim.code) }
  }
}

const BOT_NAMES = ['Аня', 'Боря', 'Вера', 'Гена', 'Даша']
const HUMAN_NAMES = [
  'Максим', 'Лена', 'Дима', 'Соня', 'Костя', 'Вера', 'Паша', 'Юля',
  'Олег', 'Катя', 'Рома', 'Настя', 'Игорь', 'Маша', 'Артём', 'Поля',
]

function newCode(): string {
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  } while (rooms.has(code))
  return code
}

function seatFor(room: Room, tgId: number): Seat | undefined {
  return room.seats.find(s => s.tgId === tgId)
}

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

function pickQuickDiff(): Difficulty {
  const r = Math.random()
  return r < 0.3 ? 'easy' : r < 0.8 ? 'medium' : 'hard'
}

function freshSeat(p: Partial<Seat> & { id: string; name: string; isBot: boolean }): Seat {
  return {
    publicId: randomToken(),
    tgId: null,
    isHost: false,
    difficulty: 'medium',
    gameIndex: -1,
    lastSeen: Date.now(),
    left: false,
    place: null,
    ...p,
  }
}

// id места по сети: в быстрых комнатах непрозрачный токен (бота не вычислить).
function pubId(room: Room, seat: Seat): string {
  return room.quick ? seat.publicId : seat.id
}

function colorOf(seat: Seat): StoneColor {
  return seat.gameIndex === 0 ? 'black' : 'white'
}

function fillBots(room: Room): void {
  const used = new Set(room.seats.map(s => s.name))
  const pool = room.quick ? HUMAN_NAMES : BOT_NAMES
  const target = MAX // на двоих: одно пустое место занимает бот
  let b = room.seats.filter(s => s.isBot).length + 1
  let pi = Math.floor(Math.random() * pool.length)
  while (room.seats.length < target) {
    let name = pool[pi % pool.length]
    let tries = 0
    while (used.has(name) && tries++ < pool.length) name = pool[++pi % pool.length]
    used.add(name)
    pi++
    room.seats.push(
      freshSeat({
        id: `bot${b++}`,
        name,
        isBot: true,
        difficulty: room.quick ? pickQuickDiff() : room.difficulty,
      }),
    )
  }
}

function clearTurnTimer(room: Room): void {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null }
}
function clearTimers(room: Room): void {
  clearTurnTimer(room)
  if (room.startTimer) { clearTimeout(room.startTimer); room.startTimer = null }
}

function setEvent(room: Room, seat: Seat, kind: EventKind, extra?: { point?: number; captured?: number }): void {
  room.lastEvent = {
    seq: ++room.eventSeq,
    seatId: pubId(room, seat),
    name: seat.name,
    kind,
    ...extra,
  }
}

// ── старт партии ────────────────────────────────────────────────────────────
function beginGame(room: Room): void {
  if (room.started) return
  if (room.startTimer) { clearTimeout(room.startTimer); room.startTimer = null }
  fillBots(room)
  // честный жребий: кому достанутся чёрные (ходят первыми). Перемешиваем места.
  shuffle(room.seats, mulberry32(randomSeed()))
  room.seats.forEach((s, i) => { s.gameIndex = i; s.place = null })
  room.game = createGame()
  room.started = true
  room.finished = false
  room.scored = false
  room.version++
  room.lastActivity = Date.now()
  const starter = room.seats[room.game.turn]
  setEvent(room, starter, 'start')
  armTurn(room)
}

// Завести таймер на текущий ход: боту даём «раздумье», человеку лимит времени.
function armTurn(room: Room): void {
  clearTurnTimer(room)
  if (!room.game || room.finished) return
  room.turnStartedAt = Date.now()
  const seat = room.seats[room.game.turn]
  if (seat.isBot) {
    room.turnTimer = setTimeout(() => autoTurn(room), botThinkDelay(seat.difficulty, room.quick))
  } else if (seat.left) {
    room.turnTimer = setTimeout(() => autoTurn(room), 700) // ушедшего ведём за него
  } else {
    room.turnTimer = setTimeout(() => autoTurn(room), TURN_MS)
  }
}

// Применить ход бота/автохода (постановка или пас) и обработать последствия.
function commitBotAction(room: Room, seat: Seat, diff: Difficulty): void {
  const game = room.game!
  // подстраховка от зависших партий: после очень длинной игры просто пасуем
  if (game.moveCount > CELLS * 4) {
    applyPass(game, game.turn)
    setEvent(room, seat, 'pass')
    afterMove(room)
    return
  }
  const action = chooseBotMove(game, game.turn, diff)
  if (action.kind === 'pass') {
    applyPass(game, game.turn)
    setEvent(room, seat, 'pass')
  } else {
    const res = applyMove(game, game.turn, action.point)
    if (!res.ok) { applyPass(game, game.turn); setEvent(room, seat, 'pass') }
    else setEvent(room, seat, 'play', { point: action.point, captured: res.captured.length })
  }
  afterMove(room)
}

// Автоход текущего места: бот думает; ушедший/просрочивший человек разруливается
// ботом, чтобы партия не зависала.
function autoTurn(room: Room): void {
  clearTurnTimer(room)
  if (!room.game || room.finished) return
  const seat = room.seats[room.game.turn]
  const diff: Difficulty = seat.isBot ? seat.difficulty : seat.left ? 'easy' : 'medium'
  commitBotAction(room, seat, diff)
}

function afterMove(room: Room): void {
  room.version++
  room.lastActivity = Date.now()
  const game = room.game
  if (!game) return
  if (game.over) { finalize(room); return }
  armTurn(room)
}

function finalize(room: Room): void {
  if (room.finished) return
  room.finished = true
  clearTimers(room)
  const game = room.game
  let win: number | null = null
  if (game) {
    const sc = score(game.board, game.komi)
    room.finalBlack = sc.black
    room.finalWhite = sc.white
    room.territory = sc.territory
    room.byResign = game.resignedBy != null
    win = winnerOf(game)
  }

  room.draw = win === null
  if (win === null) {
    room.seats.forEach(s => { s.place = 1 }) // ничья: общее первое место
    room.winnerId = null
    room.winnerName = '-'
  } else {
    const winner = room.seats.find(s => s.gameIndex === win) ?? null
    room.seats.forEach(s => { s.place = s.gameIndex === win ? 1 : 2 })
    room.winnerId = winner ? winner.id : null
    room.winnerName = winner ? winner.name : '-'
  }

  if (!room.scored && game) {
    room.scored = true
    const humans = room.seats.filter(s => !s.isBot && s.tgId != null)
    const mode: MatchMode = room.solo ? 'solo' : room.quick ? 'multi' : 'friends'
    for (const seat of room.seats) {
      // Учитываем и тех, кто вышел из партии: счёт уже посчитан, а Mini App в
      // Telegram часто сворачивают, иначе честная победа пропала бы.
      if (seat.isBot || seat.tgId == null) continue
      const won = !room.draw && seat.id === room.winnerId
      const captures = game.captures[seat.gameIndex] ?? 0
      recordResult(seat.tgId, room.solo ? 'solo' : 'online', won, captures)
      // Рапорт хабу: room.scored выше гарантирует один раз на партию, а ключ
      // идемпотентности (код+время создания комнаты) — что повтор не доплатит.
      const mine = seat.gameIndex === 0 ? room.finalBlack : room.finalWhite
      const theirs = seat.gameIndex === 0 ? room.finalWhite : room.finalBlack
      reportMatch({
        userId: seat.tgId,
        idempotencyKey: `go-${room.code}-${room.createdAt}-${seat.tgId}`,
        result: room.draw ? 'draw' : won ? 'win' : 'loss',
        placement: seat.place,
        players: room.seats.length,
        humanPlayers: humans.length,
        score: mine,
        mode,
        opponents: humans.filter(s => s.tgId !== seat.tgId).map(s => s.tgId as number),
        stats: won
          ? {
              // «Безупречно»: соперник не снял ни одного нашего камня.
              ...(game.captures[seat.gameIndex ^ 1] === 0 ? { flawless: true } : {}),
              // «Молния»: партия уложилась меньше чем в 25 ходов.
              ...(game.moveCount < 25 ? { fast: true } : {}),
              // «Территория»: перевес 50+ очков. Только у доигранной партии —
              // при сдаче счёт на доске исход не решал, флаг был бы враньём.
              ...(!room.byResign && mine - theirs >= 50 ? { signature: true } : {}),
            }
          : undefined,
      })
    }
  }
  room.version++
  room.lastActivity = Date.now()
}

// ── проекция состояния для одного игрока ────────────────────────────────────
function playerDto(room: Room, seat: Seat): RoomPlayerDto {
  const game = room.game
  return {
    id: pubId(room, seat),
    name: seat.name,
    color: colorOf(seat),
    isBot: room.quick ? false : seat.isBot,
    isHost: room.quick ? false : seat.isHost,
    // в быстрых комнатах не выдаём ботов «всегда на связи»: показываем по факту ухода
    connected: room.quick ? !seat.left : seat.isBot || (!seat.left && Date.now() - seat.lastSeen < 15000),
    captures: game && seat.gameIndex >= 0 ? game.captures[seat.gameIndex] : 0,
    score: room.finished ? (seat.gameIndex === 0 ? room.finalBlack : room.finalWhite) : 0,
    place: seat.place,
  }
}

function stateFor(room: Room, tgId: number): RoomStateDto {
  const seat = seatFor(room, tgId)
  const game = room.game
  const status: RoomStateDto['status'] = !room.started ? 'lobby' : room.finished ? 'finished' : 'playing'
  const current = game && !room.finished ? room.seats[game.turn] : null
  const youAreCurrent = !!seat && !!current && current.id === seat.id && !room.finished

  const standings: StandingDto[] | null = room.finished
    ? [...room.seats]
        .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
        .map(s => ({
          id: pubId(room, s),
          name: s.name,
          isBot: room.quick ? false : s.isBot,
          color: colorOf(s),
          score: s.gameIndex === 0 ? room.finalBlack : room.finalWhite,
          captures: game ? game.captures[s.gameIndex] : 0,
          place: s.place ?? 0,
        }))
    : null

  const result =
    room.finished && standings
      ? {
          winnerId: room.winnerId ? pubId(room, room.seats.find(s => s.id === room.winnerId)!) : '',
          winnerName: room.winnerName,
          youWon: !!seat && !room.draw && room.winnerId === seat.id,
          draw: room.draw,
          resign: room.byResign,
          yourScore: seat ? (seat.gameIndex === 0 ? room.finalBlack : room.finalWhite) : 0,
          blackScore: room.finalBlack,
          whiteScore: room.finalWhite,
          komi: game ? game.komi : 0,
          standings,
        }
      : null

  const turnDeadlineMs =
    youAreCurrent && room.turnStartedAt != null ? Math.max(0, TURN_MS - (Date.now() - room.turnStartedAt)) : null

  return {
    code: room.code,
    status,
    quick: room.quick,
    difficulty: room.difficulty,
    youAreHost: !room.quick && room.hostTgId === tgId && !room.started,
    yourSeatId: seat ? pubId(room, seat) : '',
    players: room.seats.map(s => playerDto(room, s)),
    maxPlayers: room.maxPlayers,
    version: room.version,
    board: game ? game.board.slice() : new Array(CELLS).fill(0),
    yourColor: seat && seat.gameIndex >= 0 ? colorOf(seat) : null,
    currentSeatId: current ? pubId(room, current) : '',
    youAreCurrent,
    lastMove: game ? game.lastMove : null,
    removed: game ? game.removed : [],
    koPoint: youAreCurrent && game ? game.koPoint : null,
    passes: game ? game.passes : 0,
    komi: game ? game.komi : 0,
    turnDeadlineMs,
    territory: room.finished ? room.territory : [],
    lastEvent: room.lastEvent,
    result,
  }
}

function baseRoom(code: string, tgId: number, name: string, opts: Partial<Room>): Room {
  return {
    code,
    hostTgId: tgId,
    seats: [freshSeat({ id: `u${tgId}`, tgId, name, isBot: false, isHost: true })],
    quick: false,
    solo: false,
    difficulty: 'medium',
    maxPlayers: MAX,
    started: false,
    finished: false,
    version: 1,
    game: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    turnStartedAt: null,
    turnTimer: null,
    startTimer: null,
    lastEvent: null,
    eventSeq: 0,
    winnerId: null,
    winnerName: '-',
    draw: false,
    byResign: false,
    finalBlack: 0,
    finalWhite: 0,
    territory: [],
    scored: false,
    ...opts,
  }
}

// ── публичный API ───────────────────────────────────────────────────────────
export function createSolo(tgId: number, name: string, difficulty: Difficulty): RoomStateDto {
  enforceLimits(tgId)
  const code = newCode()
  const room = baseRoom(code, tgId, name, { solo: true, difficulty })
  rooms.set(code, room)
  beginGame(room)
  return stateFor(room, tgId)
}

export function createRoom(tgId: number, name: string, difficulty: Difficulty): RoomStateDto {
  enforceLimits(tgId)
  const code = newCode()
  const room = baseRoom(code, tgId, name, { difficulty })
  rooms.set(code, room)
  return stateFor(room, tgId)
}

export function joinRoom(code: string, tgId: number, name: string): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  if (room.started) return { error: 'already_started' }
  const existing = seatFor(room, tgId)
  if (existing) { existing.lastSeen = Date.now(); return stateFor(room, tgId) }
  const humans = room.seats.filter(s => !s.isBot).length
  if (humans >= room.maxPlayers) return { error: 'full' }
  room.seats.push(freshSeat({ id: `u${tgId}`, tgId, name, isBot: false }))
  room.version++
  room.lastActivity = Date.now()
  return stateFor(room, tgId)
}

export function setRoomDifficulty(code: string, tgId: number, difficulty: Difficulty): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  if (room.hostTgId !== tgId) return { error: 'not_host' }
  if (room.started) return { error: 'already_started' }
  room.difficulty = difficulty
  room.version++
  return stateFor(room, tgId)
}

export function quickMatch(tgId: number, name: string): RoomStateDto {
  for (const room of rooms.values()) {
    if (!room.quick || room.started) continue
    const seat = seatFor(room, tgId)
    if (seat) { seat.lastSeen = Date.now(); return stateFor(room, tgId) }
    const humans = room.seats.filter(s => !s.isBot).length
    if (humans >= room.maxPlayers) continue
    room.seats.push(freshSeat({ id: `u${tgId}`, tgId, name, isBot: false }))
    room.version++
    room.lastActivity = Date.now()
    if (room.seats.filter(s => !s.isBot).length >= room.maxPlayers) beginGame(room)
    return stateFor(room, tgId)
  }
  enforceLimits(tgId)
  const code = newCode()
  const room = baseRoom(code, tgId, name, { quick: true, difficulty: 'medium' })
  rooms.set(code, room)
  room.startTimer = setTimeout(() => {
    const r = rooms.get(code)
    if (r && !r.started) beginGame(r)
  }, QUICK_DELAY)
  return stateFor(room, tgId)
}

export function startRoom(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  if (room.quick) {
    if (!seatFor(room, tgId)) return { error: 'not_in_room' }
  } else if (room.hostTgId !== tgId) {
    return { error: 'not_host' }
  }
  if (room.started) return stateFor(room, tgId)
  beginGame(room)
  return stateFor(room, tgId)
}

// Человек ставит камень.
export function playMove(code: string, tgId: number, point: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room || !room.game) return { error: 'no_room' }
  const seat = seatFor(room, tgId)
  if (!seat) return { error: 'not_in_room' }
  seat.lastSeen = Date.now()
  seat.left = false // активный ход значит, игрок вернулся за стол
  if (room.finished) return stateFor(room, tgId)
  if (room.seats[room.game.turn].id !== seat.id) return { error: 'not_your_turn' }
  const res = applyMove(room.game, room.game.turn, point)
  if (!res.ok) return { error: res.reason === 'ko' ? 'ko' : res.reason === 'suicide' ? 'suicide' : 'bad_move' }
  setEvent(room, seat, 'play', { point, captured: res.captured.length })
  afterMove(room)
  return stateFor(room, tgId)
}

// Человек пропускает ход.
export function passMove(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room || !room.game) return { error: 'no_room' }
  const seat = seatFor(room, tgId)
  if (!seat) return { error: 'not_in_room' }
  seat.lastSeen = Date.now()
  seat.left = false
  if (room.finished) return stateFor(room, tgId)
  if (room.seats[room.game.turn].id !== seat.id) return { error: 'not_your_turn' }
  applyPass(room.game, room.game.turn)
  setEvent(room, seat, 'pass')
  afterMove(room)
  return stateFor(room, tgId)
}

// Человек сдаётся: побеждает соперник.
export function resignMove(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room || !room.game) return { error: 'no_room' }
  const seat = seatFor(room, tgId)
  if (!seat) return { error: 'not_in_room' }
  seat.lastSeen = Date.now()
  if (room.finished) return stateFor(room, tgId)
  resignGame(room.game, seat.gameIndex)
  setEvent(room, seat, 'resign')
  finalize(room)
  return stateFor(room, tgId)
}

export function getRoomState(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  const seat = seatFor(room, tgId)
  // Состояние комнаты (доска, имена соперников) видно только её участникам:
  // войти можно через join/quick, а опрашивать чужую комнату по коду нельзя.
  if (!seat) return { error: 'not_in_room' }
  seat.lastSeen = Date.now()
  return stateFor(room, tgId)
}

export function leaveRoom(code: string, tgId: number): void {
  const room = rooms.get(code.toUpperCase())
  if (!room) return
  if (!room.started) {
    const wasHost = room.hostTgId === tgId
    room.seats = room.seats.filter(s => s.tgId !== tgId)
    const humans = room.seats.filter(s => !s.isBot && s.tgId != null)
    if (humans.length === 0) { clearTimers(room); rooms.delete(code.toUpperCase()); return }
    if (wasHost) {
      const next = humans[0]
      room.hostTgId = next.tgId!
      room.seats.forEach(s => { s.isHost = s.tgId === next.tgId })
    }
    room.version++
  } else {
    const seat = seatFor(room, tgId)
    if (!seat || seat.isBot) return
    seat.left = true
    seat.lastSeen = Date.now()
    room.version++
    room.lastActivity = Date.now()
    const anyHuman = room.seats.some(s => !s.isBot && !s.left)
    if (!anyHuman) {
      // все люди вышли: доигрывать некому, завершаем партию по текущей позиции
      if (!room.finished) { if (room.game) room.game.over = true; finalize(room) }
      clearTimers(room)
    } else if (room.game && !room.finished && room.seats[room.game.turn].id === seat.id) {
      // ушёл в свой ход: разруливаем за него сразу, чтобы партия шла дальше
      clearTurnTimer(room)
      autoTurn(room)
    }
  }
}

// чистим простаивающие комнаты (30 минут простоя = удаление)
setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > 30 * 60_000) {
      clearTimers(room)
      rooms.delete(code)
    }
  }
}, 10 * 60_000).unref?.()
