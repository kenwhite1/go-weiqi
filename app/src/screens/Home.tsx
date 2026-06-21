import { useStore } from '../store'
import { Logo } from './Logo'
import { APP_NAME, APP_TAG } from '../brand'

export function Home() {
  const profile = useStore(s => s.profile)
  const openSetup = useStore(s => s.openSetup)
  const quickMatch = useStore(s => s.quickMatch)
  const go = useStore(s => s.go)
  const busy = useStore(s => s.busy)

  return (
    <div className="home rise">
      <div className="brand">
        <Logo />
        <div className="brand-name">{APP_NAME}</div>
        <div className="brand-tag">{APP_TAG}</div>
      </div>

      {profile && (
        <div className="stat-strip">
          <div className="stat-pill"><div className="v">{profile.wins}</div><div className="l">Победы</div></div>
          <div className="stat-pill"><div className="v">{profile.bestScore}</div><div className="l">Рекорд</div></div>
          <div className="stat-pill"><div className="v">{profile.coins}</div><div className="l">Монеты</div></div>
        </div>
      )}

      <div className="menu-spacer" />

      <div className="menu">
        <button className="tile-btn primary" onClick={() => openSetup('solo')}>
          <span className="tile-emoji">⚫️</span>
          <span className="tile-text">
            <span className="tile-title">Одиночная игра</span>
            <span className="tile-sub">С ботом, выбери сложность</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile-btn" onClick={quickMatch} disabled={busy}>
          <span className="tile-emoji">⚡</span>
          <span className="tile-text">
            <span className="tile-title">Быстрая игра</span>
            <span className="tile-sub">Случайный соперник онлайн</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile-btn" onClick={() => openSetup('create')} disabled={busy}>
          <span className="tile-emoji">👥</span>
          <span className="tile-text">
            <span className="tile-title">Игра с другом</span>
            <span className="tile-sub">Создай комнату и поделись кодом</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile-btn" onClick={() => go('lobby')}>
          <span className="tile-emoji">🔢</span>
          <span className="tile-text">
            <span className="tile-title">Войти по коду</span>
            <span className="tile-sub">Введи код из 4 символов</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <div style={{ display: 'flex', gap: 13 }}>
          <button className="tile-btn" style={{ flex: 1 }} onClick={() => { go('leaderboard'); useStore.getState().loadLeaderboard() }}>
            <span className="tile-emoji">🏆</span>
            <span className="tile-text"><span className="tile-title">Рейтинг</span></span>
          </button>
          <button className="tile-btn" style={{ flex: 1 }} onClick={() => go('rules')}>
            <span className="tile-emoji">📖</span>
            <span className="tile-text"><span className="tile-title">Правила</span></span>
          </button>
        </div>
      </div>
    </div>
  )
}
