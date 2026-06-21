import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { Scene } from '../game/Scene'
import { Board } from '../game/Board'

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Game() {
  const room = useStore(s => s.room)
  const leaveGame = useStore(s => s.leaveGame)
  const pass = useStore(s => s.pass)
  const resign = useStore(s => s.resign)
  const busy = useStore(s => s.busy)
  const [confirmResign, setConfirmResign] = useState(false)

  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // плавный отсчёт времени на ход: засекаем дедлайн один раз на ход
  const deadlineRef = useRef<{ key: string; at: number } | null>(null)
  if (room && room.youAreCurrent && room.turnDeadlineMs != null) {
    const key = `${room.currentSeatId}-${room.lastMove}-${room.passes}`
    if (deadlineRef.current?.key !== key) deadlineRef.current = { key, at: Date.now() + room.turnDeadlineMs }
  } else {
    deadlineRef.current = null
  }

  if (!room) {
    return (
      <div className="table">
        <Scene />
        <div className="feltwrap"><p style={{ color: 'var(--chalk-dim)', fontWeight: 900 }}>Расставляем доску<span className="dots-anim" /></p></div>
      </div>
    )
  }

  const youAreCurrent = room.youAreCurrent
  const playing = room.status === 'playing'
  const current = room.players.find(p => p.id === room.currentSeatId)
  const timeLeft = deadlineRef.current ? Math.max(0, deadlineRef.current.at - Date.now()) : null
  const lowTime = timeLeft != null && timeLeft < 15000
  const oppPassed = playing && room.passes === 1 && youAreCurrent

  return (
    <div className="table">
      <Scene />

      <div className="topbar">
        <button className="round-btn dark" onClick={leaveGame} aria-label="Выйти">‹</button>
        <span className="badge mid">
          {room.status === 'finished' ? 'Партия окончена'
            : youAreCurrent ? 'Твой ход'
            : current ? `Ходит ${current.name}` : 'Партия'}
        </span>
        <span className="badge">
          {timeLeft != null ? <span className={lowTime ? 'low-txt' : ''}>⏱ {fmt(timeLeft)}</span> : `коми ${room.komi}`}
        </span>
      </div>

      <div className="players">
        {room.players.map(p => (
          <div
            key={p.id}
            className={`pl ${p.id === room.currentSeatId && playing ? 'turn' : ''} ${p.id === room.yourSeatId ? 'me' : ''}`}
          >
            {p.place === 1 && room.status === 'finished' && <span className="pl-crown">👑</span>}
            {p.id === room.currentSeatId && playing && <span className="pl-turn-dot" />}
            <div className="pl-top">
              <span className={`stone-chip ${p.color}`} />
              <span className="pl-name">{p.id === room.yourSeatId ? 'Ты' : p.name}</span>
            </div>
            <span className="pl-score">{p.captures}</span>
            <span className="pl-sub">{p.color === 'black' ? 'чёрные' : 'белые'}</span>
          </div>
        ))}
      </div>

      <Board />

      <div className="turn-hint">
        {room.status === 'finished' ? (
          <span className="wait">Считаем территорию<span className="dots-anim" /></span>
        ) : oppPassed ? (
          <span className="pass-note">Соперник спасовал. Спасуй и ты, чтобы закончить</span>
        ) : youAreCurrent ? (
          <span className={lowTime ? 'low' : ''}>Твой ход, ставь камень на пересечение</span>
        ) : (
          <span className="wait">Ждём ход соперника<span className="dots-anim" /></span>
        )}
      </div>

      {playing ? (
        <div className="game-actions">
          <button className="btn ghost" disabled={!youAreCurrent || busy} onClick={pass}>Пас</button>
          <button className="btn ghost" onClick={() => setConfirmResign(true)}>Сдаться</button>
        </div>
      ) : (
        <div className="game-actions-fill" />
      )}

      {confirmResign && (
        <div className="scrim center" onClick={() => setConfirmResign(false)}>
          <div className="sheet pop" style={{ maxWidth: 360, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div style={{ fontSize: 40 }}>🏳️</div>
            <h2 style={{ marginTop: 4 }}>Сдаться?</h2>
            <p style={{ color: 'var(--ink-soft)', fontWeight: 800, margin: '8px 0 16px' }}>
              Партия засчитается сопернику как победа.
            </p>
            <button className="btn danger block lg" onClick={() => { setConfirmResign(false); resign() }}>Сдаться</button>
            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setConfirmResign(false)}>Продолжить игру</button>
          </div>
        </div>
      )}
    </div>
  )
}
