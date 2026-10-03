import { useStore } from '../store'
import { Logo } from './Logo'
import { APP_NAME, APP_TAG } from '../brand'
import { t, getLang, setLang } from '../i18n'

export function Home() {
  const profile = useStore(s => s.profile)
  const openSetup = useStore(s => s.openSetup)
  const quickMatch = useStore(s => s.quickMatch)
  const go = useStore(s => s.go)
  const busy = useStore(s => s.busy)

  const lang = getLang()

  return (
    <div className="home rise">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 4 }}>
        {(['ru', 'en'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-label={l === 'ru' ? 'Русский' : 'English'}
            style={{
              border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
              fontWeight: 800, fontSize: 13,
              background: lang === l ? 'var(--accent, #2f9e6f)' : 'rgba(0,0,0,.08)',
              color: lang === l ? '#fff' : 'var(--ink-soft, #6b5b45)',
            }}
          >
            {l === 'ru' ? 'RU' : 'EN'}
          </button>
        ))}
      </div>
      <div className="brand">
        <Logo />
        <div className="brand-name">{t(APP_NAME)}</div>
        <div className="brand-tag">{t(APP_TAG)}</div>
      </div>

      {profile && (
        <div className="stat-strip">
          <div className="stat-pill"><div className="v">{profile.wins}</div><div className="l">{t('Победы')}</div></div>
          <div className="stat-pill"><div className="v">{profile.bestScore}</div><div className="l">{t('Рекорд')}</div></div>
          <div className="stat-pill"><div className="v">{profile.coins}</div><div className="l">{t('Монеты')}</div></div>
        </div>
      )}

      <div className="menu-spacer" />

      <div className="menu">
        <button className="tile-btn primary" onClick={() => openSetup('solo')}>
          <span className="tile-emoji">⚫️</span>
          <span className="tile-text">
            <span className="tile-title">{t('Одиночная игра')}</span>
            <span className="tile-sub">{t('С ботом, выбери сложность')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile-btn" onClick={quickMatch} disabled={busy}>
          <span className="tile-emoji">⚡</span>
          <span className="tile-text">
            <span className="tile-title">{t('Быстрая игра')}</span>
            <span className="tile-sub">{t('Случайный соперник онлайн')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile-btn" onClick={() => openSetup('create')} disabled={busy}>
          <span className="tile-emoji">👥</span>
          <span className="tile-text">
            <span className="tile-title">{t('Игра с другом')}</span>
            <span className="tile-sub">{t('Создай комнату и поделись кодом')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile-btn" onClick={() => go('lobby')}>
          <span className="tile-emoji">🔢</span>
          <span className="tile-text">
            <span className="tile-title">{t('Войти по коду')}</span>
            <span className="tile-sub">{t('Введи код из 4 символов')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <div style={{ display: 'flex', gap: 13 }}>
          <button className="tile-btn" style={{ flex: 1 }} onClick={() => { go('leaderboard'); useStore.getState().loadLeaderboard() }}>
            <span className="tile-emoji">🏆</span>
            <span className="tile-text"><span className="tile-title">{t('Рейтинг')}</span></span>
          </button>
          <button className="tile-btn" style={{ flex: 1 }} onClick={() => go('rules')}>
            <span className="tile-emoji">📖</span>
            <span className="tile-text"><span className="tile-title">{t('Правила')}</span></span>
          </button>
        </div>
      </div>
    </div>
  )
}
