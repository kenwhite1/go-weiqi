import { db } from './db'
import type { Profile } from '../../shared/types'

interface UserRow {
  id: number
  name: string
  username: string | null
  wins: number
  losses: number
  played: number
  coins: number
  best_score: number
}

export function getOrCreateUser(id: number, name: string, username?: string): UserRow {
  const existing = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined
  if (existing) {
    db.prepare("UPDATE users SET name=?, last_seen=datetime('now') WHERE id=?").run(name, id)
    return { ...existing, name }
  }
  db.prepare("INSERT INTO users (id, name, username, last_seen) VALUES (?,?,?,datetime('now'))").run(
    id,
    name,
    username ?? null,
  )
  return db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow
}

export function toProfile(u: UserRow): Profile {
  return {
    id: u.id,
    name: u.name,
    wins: u.wins,
    losses: u.losses,
    played: u.played,
    coins: u.coins,
    bestScore: u.best_score,
  }
}

export function getProfile(id: number): Profile | null {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined
  return u ? toProfile(u) : null
}

const WIN_COINS = 25
const PLAY_COINS = 5

// captures это число снятых игроком камней за партию (для монет и рекорда).
export function recordResult(id: number, mode: 'solo' | 'online', won: boolean, captures: number): Profile {
  // Все записи итога атомарны: при падении процесса между шагами счётчики и
  // журнал результатов не разъедутся.
  const apply = db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, name) VALUES (?, 'Игрок')").run(id)
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow
    const coins = u.coins + PLAY_COINS + Math.max(0, captures) + (won ? WIN_COINS : 0)
    const bestScore = Math.max(u.best_score, captures)
    db.prepare(
      `UPDATE users SET played=played+1, wins=wins+?, losses=losses+?, coins=?, best_score=? WHERE id=?`,
    ).run(won ? 1 : 0, won ? 0 : 1, coins, bestScore, id)
    db.prepare('INSERT INTO results (user_id, mode, won, score) VALUES (?,?,?,?)').run(
      id,
      mode,
      won ? 1 : 0,
      Math.max(0, Math.min(CELLS, captures | 0)),
    )
  })
  apply()
  return getProfile(id)!
}

const CELLS = 81

export interface LeaderRow {
  name: string
  wins: number
  best: number
}

export function topPlayers(limit = 20): LeaderRow[] {
  return db
    .prepare('SELECT name, wins, best_score AS best FROM users WHERE played > 0 ORDER BY wins DESC, best_score DESC LIMIT ?')
    .all(limit) as LeaderRow[]
}
