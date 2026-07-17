import { create } from 'zustand'
import type { Profile, RoomStateDto, GameEventDto, Difficulty } from '@shared/types'
import { api } from './api'
import { haptic } from './telegram'
import { playSfx } from './sound'
import { t } from './i18n'

type Screen = 'home' | 'rules' | 'leaderboard' | 'lobby' | 'game'

interface S {
  ready: boolean
  screen: Screen
  mode: 'solo' | 'online' | null
  profile: Profile | null
  botUsername: string

  room: RoomStateDto | null
  busy: boolean
  joinError: string | null

  toast: string | null
  result: RoomStateDto['result']

  difficulty: Difficulty
  setupOpen: 'solo' | 'create' | null

  leaderboard: { name: string; wins: number; best: number }[]

  init(): Promise<void>
  go(s: Screen): void
  openSetup(kind: 'solo' | 'create'): void
  closeSetup(): void
  startSolo(difficulty: Difficulty): Promise<void>
  quickMatch(): Promise<void>
  createRoom(difficulty: Difficulty): Promise<void>
  joinRoom(code: string): Promise<void>
  startRoom(): Promise<void>
  setDifficulty(d: Difficulty): Promise<void>
  loadLeaderboard(): Promise<void>

  play(point: number): Promise<void>
  pass(): Promise<void>
  resign(): Promise<void>
  leaveGame(): void
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false
let lastEventSeq = 0

function stopPoll() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  polling = false
}

const ERR: Record<string, string> = {
  not_your_turn: 'Сейчас не твой ход',
  occupied: 'Здесь уже есть камень',
  suicide: 'Сюда нельзя: нет дыханий',
  ko: 'Нельзя сразу отыграть ко',
  bad_move: 'Сюда походить нельзя',
  no_room: 'Комната не найдена',
}

function moveError(e: unknown): string {
  const data = (e as { data?: { error?: string } })?.data
  return (data?.error && ERR[data.error]) || 'Сюда походить нельзя'
}

function eventToast(e: GameEventDto): string {
  switch (e.kind) {
    case 'pass': return `${e.name} ${t('пропускает ход')}`
    case 'resign': return `${e.name} ${t('сдаётся')}`
    case 'timeout': return `${e.name} ${t('не успел походить')}`
    default: return ''
  }
}

export const useStore = create<S>((set, get) => {
  function toast(text: string) {
    const msg = t(text)
    set({ toast: msg })
    setTimeout(() => { if (get().toast === msg) set({ toast: null }) }, 2200)
  }

  function applyRoom(next: RoomStateDto): void {
    const prev = get().room
    set({ room: next })

    // старт партии: и хозяин, и присоединившийся узнают из опроса
    if (next.status === 'playing' && get().screen !== 'game') set({ screen: 'game' })

    // событие соперника: звук постановки/взятия и редкие тосты
    if (next.lastEvent && next.lastEvent.seq > lastEventSeq) {
      lastEventSeq = next.lastEvent.seq
      const e = next.lastEvent
      if (e.seatId !== next.yourSeatId && e.kind !== 'start') {
        if (e.kind === 'play') {
          playSfx('place')
          if ((e.captured ?? 0) > 0) setTimeout(() => playSfx('capture'), 110)
        } else {
          const txt = eventToast(e)
          if (txt) toast(txt)
        }
      }
    }

    // мой ход подошёл
    if (next.youAreCurrent && !prev?.youAreCurrent && next.status === 'playing') {
      haptic('select')
    }

    // итог партии
    if (next.result && !prev?.result) {
      stopPoll()
      playSfx(next.result.youWon ? 'win' : 'lose')
      haptic(next.result.youWon ? 'success' : 'warn')
      set({ result: next.result })
      api.profile().then(p => set({ profile: p.profile })).catch(() => {})
    }
  }

  function startPoll(code: string) {
    stopPoll()
    pollTimer = setInterval(async () => {
      if (polling) return
      polling = true
      try { applyRoom(await api.roomState(code)) } catch { /* временная сеть */ }
      finally { polling = false }
    }, 1100)
  }

  function resetGame(extra: Partial<S> = {}) {
    stopPoll()
    lastEventSeq = 0
    set({ room: null, mode: null, result: null, ...extra })
  }

  return {
    ready: false,
    screen: 'home',
    mode: null,
    profile: null,
    botUsername: 'go_play_bot',
    room: null,
    busy: false,
    joinError: null,
    toast: null,
    result: null,
    difficulty: 'medium',
    setupOpen: null,
    leaderboard: [],

    async init() {
      try {
        const { profile, startParam, botUsername } = await api.auth()
        set({ profile, botUsername: botUsername || 'go_play_bot', ready: true })
        if (startParam?.startsWith('room_')) {
          const code = startParam.slice(5).toUpperCase()
          if (/^[A-Z0-9]{4}$/.test(code)) await get().joinRoom(code)
        }
      } catch {
        set({ ready: true })
      }
    },

    go(screen) {
      haptic('tap')
      if (screen !== 'lobby' && screen !== 'game') stopPoll()
      set({ screen })
    },

    openSetup(kind) { haptic('tap'); set({ setupOpen: kind }) },
    closeSetup() { set({ setupOpen: null }) },

    async startSolo(difficulty) {
      resetGame({ busy: true, difficulty, setupOpen: null })
      try {
        const st = await api.solo(difficulty)
        set({ mode: 'solo', room: st, screen: 'game', busy: false })
        lastEventSeq = st.lastEvent?.seq ?? 0
        startPoll(st.code)
      } catch {
        set({ busy: false, joinError: t('Не удалось начать игру. Проверь связь.') })
      }
    },

    async quickMatch() {
      resetGame({ busy: true, joinError: null })
      try {
        const st = await api.roomQuick()
        set({ mode: 'online', room: st, screen: st.status === 'playing' ? 'game' : 'lobby', busy: false })
        lastEventSeq = st.lastEvent?.seq ?? 0
        startPoll(st.code)
      } catch {
        set({ busy: false, joinError: t('Не удалось подобрать игру. Проверь связь.') })
      }
    },

    async createRoom(difficulty) {
      resetGame({ busy: true, joinError: null, difficulty, setupOpen: null })
      try {
        const st = await api.roomCreate(difficulty)
        set({ mode: 'online', room: st, screen: 'lobby', busy: false })
        startPoll(st.code)
      } catch {
        set({ busy: false, joinError: t('Не удалось создать комнату. Проверь связь.') })
      }
    },

    async joinRoom(code) {
      resetGame({ busy: true, joinError: null })
      try {
        const st = await api.roomJoin(code)
        set({ mode: 'online', room: st, screen: st.status === 'playing' ? 'game' : 'lobby', busy: false })
        lastEventSeq = st.lastEvent?.seq ?? 0
        startPoll(st.code)
      } catch (e) {
        const err = (e as { data?: { error?: string } })?.data?.error
        set({
          busy: false,
          joinError:
            err === 'no_room' ? t('Нет комнаты с таким кодом.')
              : err === 'already_started' ? t('Игра уже началась.')
              : err === 'full' ? t('В комнате нет мест.')
              : t('Не удалось войти.'),
        })
      }
    },

    async startRoom() {
      const room = get().room
      if (!room) return
      set({ busy: true })
      try { applyRoom(await api.roomStart(room.code)); set({ busy: false }) }
      catch { set({ busy: false }); toast('Не удалось начать') }
    },

    async setDifficulty(d) {
      const room = get().room
      set({ difficulty: d })
      if (!room) return
      try { applyRoom(await api.roomDifficulty(room.code, d)); haptic('tap') } catch { /* не хост */ }
    },

    async loadLeaderboard() {
      try { set({ leaderboard: (await api.leaderboard()).top }) } catch { /* офлайн */ }
    },

    async play(point) {
      const st = get()
      const room = st.room
      if (!room || st.busy) return
      if (!room.youAreCurrent) { haptic('warn'); return }
      set({ busy: true })
      try {
        const next = await api.roomPlay(room.code, point)
        playSfx('place')
        const cap = next.lastEvent?.kind === 'play' ? next.lastEvent.captured ?? 0 : 0
        if (cap > 0) setTimeout(() => playSfx('capture'), 110)
        haptic('success')
        applyRoom(next)
        set({ busy: false })
      } catch (e) {
        set({ busy: false })
        haptic('warn')
        toast(moveError(e))
      }
    },

    async pass() {
      const st = get()
      const room = st.room
      if (!room || st.busy || !room.youAreCurrent) return
      set({ busy: true })
      try {
        playSfx('pass')
        haptic('tap')
        applyRoom(await api.roomPass(room.code))
        set({ busy: false })
      } catch (e) {
        set({ busy: false })
        toast(moveError(e))
      }
    },

    async resign() {
      const st = get()
      const room = st.room
      if (!room || st.busy) return
      set({ busy: true })
      try {
        applyRoom(await api.roomResign(room.code))
        set({ busy: false })
      } catch {
        set({ busy: false })
        toast('Не удалось сдаться')
      }
    },

    leaveGame() {
      const room = get().room
      if (room) api.roomLeave(room.code).catch(() => {})
      resetGame({ screen: 'home' })
      haptic('tap')
    },
  }
})
