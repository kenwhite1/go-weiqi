// Общие DTO между клиентом и сервером.
//
// «Го» это игра с полной информацией: вся доска видна обоим. Сервер шлёт клиенту
// готовую доску (81 пересечение), служебные поля для подсветки и анимации снятия
// пленных, а в конце партии карту территории и итоговый счёт. Скрытого состояния
// нет, сервер остаётся авторитетным.

import type { Difficulty } from './difficulty'

export type StoneColor = 'black' | 'white'

export interface Profile {
  id: number
  name: string
  wins: number
  losses: number
  played: number
  coins: number
  bestScore: number // рекорд: больше всего камней снято за партию
}

export interface RoomPlayerDto {
  id: string
  name: string
  color: StoneColor // цвет камней игрока
  isBot: boolean
  isHost: boolean
  connected: boolean
  captures: number // снято камней соперника за партию (пленные)
  score: number // итоговая площадь (только в конце партии, иначе 0)
  place: number | null // итоговое место (когда партия закончена)
}

export interface StandingDto {
  id: string
  name: string
  isBot: boolean
  color: StoneColor
  score: number // итоговая площадь (с коми у белых)
  captures: number
  place: number
}

export type EventKind = 'play' | 'pass' | 'capture' | 'resign' | 'timeout' | 'start'

export interface GameEventDto {
  seq: number
  seatId: string
  name: string
  kind: EventKind
  point?: number // куда поставлен камень
  captured?: number // сколько камней снято этим ходом
}

export interface RoomResultDto {
  winnerId: string
  winnerName: string
  youWon: boolean
  draw: boolean
  resign: boolean // партия решена сдачей соперника
  yourScore: number
  blackScore: number
  whiteScore: number
  komi: number
  standings: StandingDto[]
}

// Полное состояние комнаты для одного игрока.
export interface RoomStateDto {
  code: string
  status: 'lobby' | 'playing' | 'finished'
  quick: boolean
  difficulty: Difficulty
  youAreHost: boolean
  yourSeatId: string
  players: RoomPlayerDto[]
  maxPlayers: number
  version: number

  // игровое поле
  board: number[] // 81 пересечение: 0 пусто, 1 чёрный, 2 белый
  yourColor: StoneColor | null
  currentSeatId: string // чьё сейчас место
  youAreCurrent: boolean
  lastMove: number | null // последний поставленный камень (для подсветки)
  removed: number[] // что снято последним ходом (для анимации)
  koPoint: number | null // запрещённое правилом ко пересечение (если твой ход)
  passes: number // сколько пасов подряд (1 = соперник только что спасовал)
  komi: number
  turnDeadlineMs: number | null // сколько осталось на ход

  territory: number[] // карта территории в конце партии (0/1/2), иначе пусто
  lastEvent: GameEventDto | null
  result: RoomResultDto | null
}

export type { Difficulty }
