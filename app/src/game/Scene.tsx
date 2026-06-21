// Фоновая сцена за игрой: тёплая комната под мягким светом лампы, на столе доска.
// Уютно и ненавязчиво, чтобы гобан оставался в центре внимания.
export function Scene() {
  return (
    <svg className="studyscene" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ss-room" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#33231a" />
          <stop offset="0.55" stopColor="#271a13" />
          <stop offset="1" stopColor="#1b120c" />
        </linearGradient>
        <radialGradient id="ss-pool" cx="0.5" cy="0.32" r="0.62">
          <stop offset="0" stopColor="rgba(255,228,168,.5)" />
          <stop offset="0.6" stopColor="rgba(255,214,144,.12)" />
          <stop offset="1" stopColor="rgba(255,214,144,0)" />
        </radialGradient>
        <linearGradient id="ss-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a22" />
          <stop offset="1" stopColor="#3c2614" />
        </linearGradient>
      </defs>

      <rect width="400" height="800" fill="url(#ss-room)" />

      {/* мягкий свет, пролитый на доску чуть ниже центра */}
      <ellipse className="ss-glow" cx="200" cy="300" rx="260" ry="240" fill="url(#ss-pool)" />

      {/* лампа на шнуре, высоко у самого верха, чтобы не спорить с карточками игроков */}
      <g className="ss-lamp">
        <line x1="200" y1="0" x2="200" y2="20" stroke="#1c120a" strokeWidth="3" />
        <path d="M184 20 H216 L208 37 H192 Z" fill="#2a1a0f" stroke="#15100a" strokeWidth="1.5" />
        <ellipse cx="200" cy="37" rx="11" ry="4" fill="#ffe6a6" />
        <circle cx="200" cy="39" r="5" fill="#fff3cf" />
      </g>

      {/* деревянная столешница снизу */}
      <rect x="0" y="660" width="400" height="140" fill="url(#ss-wood)" />
      <g opacity="0.18" stroke="#1c120a" strokeWidth="2" fill="none">
        <path d="M0 690 H400" />
        <path d="M0 720 H400" />
        <path d="M0 752 H400" />
      </g>
    </svg>
  )
}
