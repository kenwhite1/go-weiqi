import { Hono } from 'hono'
import { z } from 'zod'
import { validateInitData, issueToken, verifyToken } from './auth'
import type { Env } from './env'
import { BOT_USERNAME } from './env'
import { getOrCreateUser, getProfile, topPlayers } from './profiles'
import { storeLaunchToken, withHubCoins, hubFriends, inviteHubFriends } from './gg'
import {
  createSolo, createRoom, joinRoom, quickMatch, startRoom, setRoomDifficulty,
  playMove, passMove, resignMove, getRoomState, leaveRoom,
} from './rooms'
import { CELLS } from '../../shared/engine'

export const api = new Hono<Env>()

api.get('/health', c => c.json({ ok: true }))

api.post('/auth', async c => {
  const body = await c.req.json<{ initData: string }>().catch(() => null)
  if (!body) return c.json({ error: 'bad_request' }, 400)
  const v = validateInitData(body.initData ?? '')
  if (!v) return c.json({ error: 'invalid_init_data' }, 401)
  const name = [v.user.first_name, v.user.last_name].filter(Boolean).join(' ').slice(0, 40) || 'Игрок'
  getOrCreateUser(v.user.id, name, v.user.username)
  storeLaunchToken(v.user.id, v.startParam)
  const token = await issueToken(v.user.id)
  const profile = await withHubCoins(v.user.id, getProfile(v.user.id))
  return c.json({ token, profile, startParam: v.startParam, botUsername: BOT_USERNAME })
})

// Лёгкий лимит на пишущие запросы (на пользователя, скользящее окно). Опрос
// состояния это GET и под лимит не попадает, как и обычный темп ходов; отсекаем
// лишь явный флуд. Память ограничена числом активных игроков и чистится по сроку.
const writeHits = new Map<number, number[]>()
const WRITE_LIMIT = 120
const WRITE_WINDOW = 60_000
function writeAllowed(uid: number): boolean {
  const now = Date.now()
  const arr = (writeHits.get(uid) ?? []).filter(t => now - t < WRITE_WINDOW)
  arr.push(now)
  writeHits.set(uid, arr)
  return arr.length <= WRITE_LIMIT
}
setInterval(() => {
  const now = Date.now()
  for (const [uid, arr] of writeHits) {
    if (arr.every(t => now - t >= WRITE_WINDOW)) writeHits.delete(uid)
  }
}, 5 * 60_000).unref?.()

api.use('/*', async (c, next) => {
  if (c.req.path === '/api/auth' || c.req.path === '/api/health') return next()
  const token = c.req.header('authorization')?.replace(/^Bearer /, '')
  const uid = token ? await verifyToken(token) : null
  if (!uid) return c.json({ error: 'unauthorized' }, 401)
  if (c.req.method !== 'GET' && !writeAllowed(uid)) return c.json({ error: 'rate_limited' }, 429)
  c.set('uid', uid)
  return next()
})

api.get('/profile', async c => c.json({ profile: await withHubCoins(c.get('uid'), getProfile(c.get('uid'))) }))
api.get('/leaderboard', c => c.json({ top: topPlayers(20) }))

const difficultySchema = z.enum(['easy', 'medium', 'hard'])
const nameOf = (uid: number) => getProfile(uid)?.name ?? 'Игрок'

api.post('/solo', async c => {
  const uid = c.get('uid')
  const body = await c.req.json<{ difficulty?: string }>().catch(() => null)
  const diff = difficultySchema.safeParse(body?.difficulty)
  return c.json(createSolo(uid, nameOf(uid), diff.success ? diff.data : 'medium'))
})

api.post('/room/create', async c => {
  const uid = c.get('uid')
  const body = await c.req.json<{ difficulty?: string }>().catch(() => null)
  const diff = difficultySchema.safeParse(body?.difficulty)
  return c.json(createRoom(uid, nameOf(uid), diff.success ? diff.data : 'medium'))
})

api.post('/room/join', async c => {
  const uid = c.get('uid')
  const body = await c.req.json<{ code: string }>().catch(() => null)
  const code = (body?.code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{4}$/.test(code)) return c.json({ error: 'bad_code' }, 400)
  const r = joinRoom(code, uid, nameOf(uid))
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

api.post('/room/quick', c => {
  const uid = c.get('uid')
  return c.json(quickMatch(uid, nameOf(uid)))
})

api.post('/room/:code/difficulty', async c => {
  const body = await c.req.json<{ difficulty?: string }>().catch(() => null)
  const diff = difficultySchema.safeParse(body?.difficulty)
  if (!diff.success) return c.json({ error: 'bad_difficulty' }, 400)
  const r = setRoomDifficulty(c.req.param('code'), c.get('uid'), diff.data)
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

api.get('/room/:code', c => {
  const r = getRoomState(c.req.param('code'), c.get('uid'))
  if ('error' in r) return c.json(r, 404)
  return c.json(r)
})

api.post('/room/:code/start', c => {
  const r = startRoom(c.req.param('code'), c.get('uid'))
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

const playSchema = z.object({ point: z.number().int().min(0).max(CELLS - 1) })

api.post('/room/:code/play', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = playSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'bad_move' }, 400)
  const r = playMove(c.req.param('code'), c.get('uid'), parsed.data.point)
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

api.post('/room/:code/pass', c => {
  const r = passMove(c.req.param('code'), c.get('uid'))
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

api.post('/room/:code/resign', c => {
  const r = resignMove(c.req.param('code'), c.get('uid'))
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

api.post('/room/:code/leave', c => {
  leaveRoom(c.req.param('code'), c.get('uid'))
  return c.json({ ok: true })
})

// Друзья из хаба: список для панели «позвать» и сама рассылка приглашений.
api.get('/friends/hub', async c => {
  const friends = await hubFriends(c.get('uid')).catch(() => [])
  return c.json({ friends })
})
api.post('/friends/invite', async c => {
  type InviteBody = { friendIds?: number[]; note?: string }
  const body = await c.req.json<InviteBody>().catch((): InviteBody => ({}))
  const ids = Array.isArray(body.friendIds) ? body.friendIds.slice(0, 20) : []
  if (ids.length === 0) return c.json({ error: 'bad_request' }, 400)
  const sent = await inviteHubFriends(c.get('uid'), ids, body.note).catch(() => 0)
  return c.json({ sent })
})
