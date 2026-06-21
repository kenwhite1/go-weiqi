import { useStore } from '../store'
import type { StoneColor } from '@shared/types'

const SIZE = 9
const STAR = [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]] // хоси (звёздные пункты) на 9x9

// Сетка линий гобана и звёздные пункты. Система координат 0..8 растягивается на
// квадратную область пересечений (preserveAspectRatio none, без искажения).
function GridLines() {
  const lines = []
  for (let i = 0; i < SIZE; i++) {
    lines.push(<line key={`h${i}`} x1="0" y1={i} x2={SIZE - 1} y2={i} />)
    lines.push(<line key={`v${i}`} x1={i} y1="0" x2={i} y2={SIZE - 1} />)
  }
  return (
    <svg className="goban-lines" viewBox={`0 0 ${SIZE - 1} ${SIZE - 1}`} preserveAspectRatio="none" aria-hidden="true">
      <g>{lines}</g>
      {STAR.map(([x, y], k) => <circle key={k} className="hoshi" cx={x} cy={y} r="0.1" />)}
    </svg>
  )
}

// Гобан: камни стоят на пересечениях линий. Постановка камня всплывает (scale),
// снятые камни тают (cap-ghost), последний ход помечен точкой, в конце партии
// видна карта территории.
export function Board() {
  const room = useStore(s => s.room)
  const play = useStore(s => s.play)
  const busy = useStore(s => s.busy)
  if (!room) return null

  const { board, lastMove, removed, koPoint, youAreCurrent, yourColor, territory, status } = room
  const playing = status === 'playing'
  const canPlay = youAreCurrent && playing && !busy
  const ghostColor: StoneColor = yourColor ?? 'black'
  const removedSet = new Set(removed)
  const terr = status === 'finished' ? territory : []

  return (
    <div className="boardwrap">
      <div className="goban">
        <div className="goban-grid">
          <GridLines />
          <div className="points">
            {board.map((v, i) => {
              const r = Math.floor(i / SIZE)
              const c = i % SIZE
              const style = { left: `${(c / (SIZE - 1)) * 100}%`, top: `${(r / (SIZE - 1)) * 100}%` }
              const color: StoneColor | null = v === 1 ? 'black' : v === 2 ? 'white' : null
              const empty = color === null
              const isKo = koPoint === i
              const live = canPlay && empty && !isKo
              const t = empty ? terr[i] : 0
              return (
                <button
                  key={i}
                  className={`point ${live ? 'live' : ''}`}
                  style={style}
                  onClick={() => live && play(i)}
                  disabled={!live}
                  aria-label={color ? (color === 'black' ? 'Чёрный камень' : 'Белый камень') : live ? 'Поставить камень' : 'Пустой пункт'}
                >
                  {color && (
                    <span className={`stone ${color}`}>
                      {i === lastMove && <span className="last-dot" />}
                    </span>
                  )}
                  {removedSet.has(i) && empty && <span className="cap-ghost" />}
                  {live && <span className={`place-ghost ${ghostColor}`} />}
                  {isKo && empty && <span className="ko-mark" />}
                  {t === 1 && <span className="terr black" />}
                  {t === 2 && <span className="terr white" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
