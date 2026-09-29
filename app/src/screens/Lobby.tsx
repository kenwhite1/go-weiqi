import { useState } from 'react'
import { useStore } from '../store'
import { HubInvite } from './HubInvite'
import { shareLink, haptic } from '../telegram'
import { APP_NAME } from '../brand'
import { faceFor } from '../faces'
import { DIFFICULTIES } from '@shared/difficulty'
import { t } from '../i18n'
import { GGAvatar } from '../gg/GGAvatar'

export function Lobby() {
  const room = useStore(s => s.room)
  const botUsername = useStore(s => s.botUsername)
  const startRoom = useStore(s => s.startRoom)
  const leaveGame = useStore(s => s.leaveGame)
  const joinRoom = useStore(s => s.joinRoom)
  const setDifficulty = useStore(s => s.setDifficulty)
  const joinError = useStore(s => s.joinError)
  const busy = useStore(s => s.busy)
  const [code, setCode] = useState('')

  // форма входа по коду (комнаты ещё нет)
  if (!room) {
    return (
      <div className="lobby rise">
        <div className="page-head" style={{ alignSelf: 'flex-start' }}>
          <button className="round-btn" onClick={() => useStore.getState().go('home')}>‹</button>
          <h1>{t('Войти по коду')}</h1>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <input
            className="code-input"
            placeholder={t('КОД')}
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))}
          />
          {joinError && <p style={{ color: 'var(--red-deep)', textAlign: 'center', fontWeight: 800, marginTop: 12 }}>{joinError}</p>}
          <button className="btn block lg" style={{ marginTop: 18 }} disabled={code.length !== 4 || busy} onClick={() => joinRoom(code)}>
            {busy ? t('Входим…') : t('Войти в игру')}
          </button>
        </div>
      </div>
    )
  }

  // быстрый матч: экран подбора
  if (room.quick) {
    return (
      <div className="lobby rise">
        <div className="page-head" style={{ alignSelf: 'flex-start' }}>
          <button className="round-btn" onClick={leaveGame}>‹</button>
          <h1>{t('Быстрая игра')}</h1>
        </div>
        <div className="code-card" style={{ textAlign: 'center' }}>
          <div className="searching-bob" style={{ fontSize: 46 }}>⚡</div>
          <h2 style={{ color: 'var(--ink)', marginTop: 6 }}>{t('Ищем соперника')}<span className="dots-anim" /></h2>
          <p style={{ color: 'var(--ink-soft)', fontWeight: 800, marginTop: 6 }}>{t('Можно начать сейчас или подождать пару секунд')}</p>
        </div>
        <div className="seatlist">
          {room.players.map(p => (
            <div className="seat" key={p.id}>
              <div className="av"><GGAvatar id={p.id} fallback={<>{p.id === room.yourSeatId ? '🙂' : faceFor(p.id)}</>} /></div>
              <div className="nm">{p.name}</div>
              <div className="tag wait">{t('в игре')}</div>
            </div>
          ))}
        </div>
        <button className="btn block lg" style={{ maxWidth: 420, marginTop: 16 }} disabled={busy} onClick={startRoom}>
          {busy ? t('Начинаем…') : t('Начать сейчас ⚡')}
        </button>
      </div>
    )
  }

  // лобби комнаты друзей
  const isHost = room.youAreHost
  const humans = room.players.filter(p => !p.isBot)

  const share = () => {
    haptic('tap')
    const link = `https://t.me/${botUsername}?startapp=room_${room.code}`
    shareLink(link, `${t('Заходи ко мне в')} ${t(APP_NAME)}. ${t('Код комнаты')} ${room.code} ⚫️⚪️`)
  }

  return (
    <div className="lobby rise">
      <div className="page-head" style={{ alignSelf: 'flex-start' }}>
        <button className="round-btn" onClick={leaveGame}>‹</button>
        <h1>{t('Комната')}</h1>
      </div>

      <div className="code-card">
        <div style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>{t('Поделись кодом')}</div>
        <div className="code-big">{room.code}</div>
        <button className="btn accent block" style={{ marginTop: 8 }} onClick={share}>{t('Позвать друга ↗')}</button>
      </div>
      <HubInvite />

      <div className="cat-block">
        <div className="cat-block-title">{t('Сложность бота')}</div>
        {isHost ? (
          <div className="cat-pills">
            {DIFFICULTIES.map(d => (
              <button key={d.d} className={`cat-pill ${room.difficulty === d.d ? 'on' : ''}`} onClick={() => setDifficulty(d.d)}>
                <span>{d.emoji}</span>
                <span>{t(d.t)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="cat-readonly">
            {DIFFICULTIES.find(d => d.d === room.difficulty)?.emoji} {t(DIFFICULTIES.find(d => d.d === room.difficulty)?.t ?? '')}
          </div>
        )}
      </div>

      <div className="seatlist">
        {room.players.map(p => (
          <div className="seat" key={p.id}>
            <div className="av"><GGAvatar id={p.id} fallback={<>{p.isBot ? '🤖' : p.id === room.yourSeatId ? '🙂' : faceFor(p.id)}</>} /></div>
            <div className="nm">{p.name}</div>
            {p.isHost ? <div className="tag host">{t('ХОЗЯИН')}</div> : p.isBot ? <div className="tag bot">{t('БОТ')}</div> : <div className="tag wait">{t('готов')}</div>}
          </div>
        ))}
        {humans.length < room.maxPlayers && (
          <div className="seat" style={{ opacity: 0.6 }}>
            <div className="av">＋</div>
            <div className="nm" style={{ fontWeight: 800 }}>{t('Ждём соперника')}<span className="dots-anim" /></div>
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 16, textAlign: 'center', color: 'var(--ink-soft)' }}>
        {t('Пустое место займёт бот, когда начнёшь.')}
      </p>

      {isHost ? (
        <button className="btn block lg" style={{ maxWidth: 420, marginTop: 8 }} disabled={busy} onClick={startRoom}>
          {busy ? t('Расставляем…') : t('Начать игру ⚫️⚪️')}
        </button>
      ) : (
        <p className="hint" style={{ marginTop: 8, color: 'var(--ink-soft)' }}>{t('Ждём, пока хозяин начнёт')}<span className="dots-anim" /></p>
      )}
    </div>
  )
}
