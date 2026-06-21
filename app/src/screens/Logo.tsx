// Знак «Го»: уголок янтарного гобана на тёплом кремовом кружке, на пересечениях
// чёрный и белый камень, между ними звёздный пункт. Тот же дух, что у соседних
// игр: уютно и премиально.

export function Logo({ size = 132 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" className="brand-logo" aria-label="Го">
      <defs>
        <radialGradient id="lg-cream" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#fff7e6" />
          <stop offset="1" stopColor="#ecd9b2" />
        </radialGradient>
        <linearGradient id="lg-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0c279" />
          <stop offset="1" stopColor="#cc9040" />
        </linearGradient>
        <radialGradient id="lg-black" cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#5b6473" />
          <stop offset="0.4" stopColor="#2c333f" />
          <stop offset="1" stopColor="#161b23" />
        </radialGradient>
        <radialGradient id="lg-white" cx="0.4" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f3ead2" />
          <stop offset="1" stopColor="#dcc9a0" />
        </radialGradient>
      </defs>

      {/* тёплый кружок и тень */}
      <ellipse cx="80" cy="136" rx="54" ry="12" fill="rgba(110,74,44,.16)" />
      <circle cx="80" cy="80" r="60" fill="url(#lg-cream)" stroke="rgba(110,74,44,.16)" strokeWidth="2" />

      {/* уголок гобана (наклонён) */}
      <g transform="rotate(-8 80 84)">
        <rect x="34" y="48" width="92" height="78" rx="12" fill="#7a4f26" />
        <rect x="37" y="50" width="86" height="72" rx="10" fill="url(#lg-wood)" stroke="rgba(90,54,18,.4)" strokeWidth="1.4" />
        <g stroke="rgba(74,44,16,.55)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M52 50 V122 M80 50 V122 M108 50 V122" />
          <path d="M37 68 H123 M37 96 H123" />
        </g>
        {/* звёздный пункт */}
        <circle cx="80" cy="96" r="3" fill="rgba(58,34,12,.8)" />
      </g>

      {/* чёрный камень */}
      <g transform="rotate(-8 80 84)">
        <ellipse cx="52" cy="71" rx="15.5" ry="15" fill="rgba(0,0,0,.26)" />
        <circle cx="52" cy="68" r="15" fill="url(#lg-black)" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
        <ellipse cx="47" cy="62" rx="5.5" ry="3.6" fill="rgba(255,255,255,.32)" />
      </g>

      {/* белый камень */}
      <g transform="rotate(-8 80 84)">
        <ellipse cx="108" cy="99" rx="15.5" ry="15" fill="rgba(0,0,0,.22)" />
        <circle cx="108" cy="96" r="15" fill="url(#lg-white)" stroke="rgba(150,120,70,.4)" strokeWidth="1" />
        <ellipse cx="103" cy="90" rx="5" ry="3.4" fill="rgba(255,255,255,.7)" />
      </g>
    </svg>
  )
}
