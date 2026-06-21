import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Home } from './screens/Home'
import { Game } from './screens/Game'
import { Lobby } from './screens/Lobby'
import { Rules } from './screens/Rules'
import { Leaderboard } from './screens/Leaderboard'
import { Logo } from './screens/Logo'
import { APP_NAME } from './brand'
import { DIFFICULTIES, type Difficulty } from '@shared/difficulty'

const CONFETTI = ['#2f9e6f', '#e8a23d', '#8fe0bb', '#f4cf86', '#fbf3df']

export function App() {
  const ready = useStore(s => s.ready)
  const screen = useStore(s => s.screen)
  const init = useStore(s => s.init)

  useEffect(() => { init() }, [init])

  if (!ready) {
    return (
      <div className="app">
        <div className="home" style={{ justifyContent: 'center' }}>
          <div className="brand" style={{ animation: 'pop-in .5s ease both' }}>
            <Logo />
            <div className="brand-name">{APP_NAME}</div>
            <div className="brand-tag">Расставляем доску<span className="dots-anim" /></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {screen === 'home' && <Home />}
      {screen === 'game' && <Game />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'rules' && <Rules />}
      {screen === 'leaderboard' && <Leaderboard />}
      <Overlays />
    </div>
  )
}

function Overlays() {
  const setupOpen = useStore(s => s.setupOpen)
  const result = useStore(s => s.result)
  const toast = useStore(s => s.toast)

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      {setupOpen && <SetupSheet kind={setupOpen} />}
      {result && <ResultModal />}
    </>
  )
}

function SetupSheet({ kind }: { kind: 'solo' | 'create' }) {
  const storeDiff = useStore(s => s.difficulty)
  const startSolo = useStore(s => s.startSolo)
  const createRoom = useStore(s => s.createRoom)
  const closeSetup = useStore(s => s.closeSetup)
  const busy = useStore(s => s.busy)
  const [diff, setDiff] = useState<Difficulty>(storeDiff)

  const go = () => {
    if (kind === 'solo') startSolo(diff)
    else createRoom(diff)
  }

  return (
    <div className="scrim center" onClick={closeSetup}>
      <div className="sheet pop" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div style={{ fontSize: 42, textAlign: 'center' }}>{kind === 'solo' ? '⚫️⚪️' : '👥'}</div>
        <h2 style={{ textAlign: 'center', marginTop: 2 }}>{kind === 'solo' ? 'Одиночная игра' : 'Игра с другом'}</h2>

        <div className="setup-label">Сложность соперника</div>
        <div className="setup-grid">
          {DIFFICULTIES.map(d => (
            <button key={d.d} className={`setup-card ${diff === d.d ? 'on' : ''}`} onClick={() => setDiff(d.d)}>
              <span className="setup-emoji">{d.emoji}</span>
              <span className="setup-t">{d.t}</span>
              <span className="setup-s">{d.s}</span>
            </button>
          ))}
        </div>

        {kind === 'create' && (
          <p className="hint" style={{ textAlign: 'center', color: 'var(--ink-soft)', marginTop: 14 }}>
            Создашь комнату, поделишься кодом. Не дождёшься друга, место займёт бот.
          </p>
        )}

        <button className="btn block lg" style={{ marginTop: 18 }} disabled={busy} onClick={go}>
          {kind === 'solo' ? 'Играть ⚫️⚪️' : busy ? 'Создаём…' : 'Создать комнату 👥'}
        </button>
      </div>
    </div>
  )
}

function ResultModal() {
  const result = useStore(s => s.result)!
  const mode = useStore(s => s.mode)
  const difficulty = useStore(s => s.difficulty)
  const startSolo = useStore(s => s.startSolo)
  const leaveGame = useStore(s => s.leaveGame)
  const yourId = useStore(s => s.room?.yourSeatId)
  const won = result.youWon
  const draw = result.draw
  const myCaptures = result.standings.find(p => p.id === yourId)?.captures ?? 0
  const reward = 5 + myCaptures + (won ? 25 : 0)

  const title = draw ? 'Ничья!' : won ? 'Ты выиграл!' : 'В этот раз мимо'
  const scoreLine = `Чёрные ${result.blackScore} : Белые ${result.whiteScore}`
  const sub = draw
    ? 'Очки разделились поровну.'
    : result.resign
      ? won ? 'Соперник сдался.' : 'Ты сдался.'
      : `${scoreLine} (с коми)`

  return (
    <div className="scrim center">
      {won && (
        <div className="confetti">
          {Array.from({ length: 40 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 137) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 10) * 0.12}s`, transform: `rotate(${i * 35}deg)` }} />
          ))}
        </div>
      )}
      <div className="sheet pop result">
        <div className="sheet-grip" />
        {draw ? (
          <div className="result-emoji">⚖️</div>
        ) : won ? (
          <div className="result-emoji">👑</div>
        ) : (
          <div className="result-stones"><span className="rs black" /><span className="rs white" /></div>
        )}
        <h1>{title}</h1>
        <div className="result-sub">{sub}</div>

        {result.standings.length > 0 && (
          <div className="standings">
            {result.standings.map(p => (
              <div className={`stand-row ${p.id === yourId ? 'me' : ''}`} key={p.id}>
                <span className={`stone-chip ${p.color}`} />
                <span className="stand-name">{p.id === yourId ? 'Ты' : p.name}</span>
                <span className="stand-cap">в плену {p.captures}</span>
                <span className="stand-score">{result.resign ? '·' : p.score}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 14px' }}>
          <span className="coin-chip">🪙 +{reward} монет</span>
        </div>

        <button className="btn block lg" onClick={mode === 'solo' ? () => startSolo(difficulty) : leaveGame}>
          {mode === 'solo' ? 'Играть ещё ⚫️⚪️' : 'В меню'}
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={leaveGame}>Домой</button>
      </div>
    </div>
  )
}
