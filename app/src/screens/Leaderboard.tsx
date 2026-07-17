import { useStore } from '../store'
import { t } from '../i18n'

export function Leaderboard() {
  const go = useStore(s => s.go)
  const rows = useStore(s => s.leaderboard)

  return (
    <div className="page">
      <div className="page-head">
        <button className="round-btn" onClick={() => go('home')}>‹</button>
        <h1>{t('Рейтинг')}</h1>
      </div>
      <div className="board-list">
        {rows.length === 0 && (
          <p style={{ color: 'var(--ink-soft)', fontWeight: 800, textAlign: 'center', marginTop: 40 }}>
            {t('Пока пусто. Сыграй партию, чтобы попасть в таблицу!')}
          </p>
        )}
        {rows.map((r, i) => (
          <div className="board-row" key={i}>
            <div className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
            <div className="nm">{r.name}</div>
            <div className="wins">{r.wins} 🏆</div>
          </div>
        ))}
      </div>
    </div>
  )
}
