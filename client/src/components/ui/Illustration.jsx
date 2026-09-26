import clsx from 'clsx';

/*
 * Empty-state illustrations. Drawn with the theme tokens so they follow
 * light / dark mode, plus the app status accent palette.
 */
const C = {
  surface: 'rgb(var(--surface))',
  surface2: 'rgb(var(--surface-2))',
  line: 'rgb(var(--line))',
  muted: 'rgb(var(--muted))',
  brand: '#6161ff',
  green: '#00c875',
  orange: '#fdab3d',
  red: '#e2445c',
  purple: '#a25ddc',
  blue: '#579bfc',
};

function Backdrop() {
  return (
    <>
      <circle cx="120" cy="92" r="74" fill={C.brand} opacity="0.07" />
      <circle cx="120" cy="92" r="52" fill={C.brand} opacity="0.06" />
    </>
  );
}

function Sparkle({ x, y, color, size = 6 }) {
  return <path d={`M${x} ${y - size}v${size * 2}M${x - size} ${y}h${size * 2}`} stroke={color} strokeWidth="2.5" strokeLinecap="round" />;
}

/** A small task card: colored dot + two text lines */
function MiniCard({ x, y, w = 110, color, dashed, opacity = 1 }) {
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height="28" rx="8" fill={C.surface} stroke={C.line} strokeWidth="1.5" strokeDasharray={dashed ? '5 4' : undefined} />
      {!dashed && (
        <>
          <circle cx={x + 14} cy={y + 14} r="5" fill={color} />
          <rect x={x + 26} y={y + 9} width={w * 0.45} height="4" rx="2" fill={C.line} />
          <rect x={x + 26} y={y + 16} width={w * 0.28} height="4" rx="2" fill={C.surface2} />
        </>
      )}
    </g>
  );
}

const ART = {
  search: () => (
    <>
      <Backdrop />
      <MiniCard x={50} y={46} color={C.green} />
      <MiniCard x={50} y={82} color={C.orange} />
      <MiniCard x={50} y={118} dashed opacity={0.8} />
      <g className="illo-float">
        <circle cx="160" cy="100" r="27" fill={C.surface} stroke={C.brand} strokeWidth="6" />
        <circle cx="160" cy="100" r="18" fill={C.brand} opacity="0.08" />
        <path d="M152.5 94.5c0-4.4 3.4-7.5 7.7-7.5 4.2 0 7.3 2.8 7.3 6.6 0 3.4-2.3 4.8-4.6 6.1-1.6.9-2.4 1.8-2.4 3.6v1" stroke={C.brand} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <circle cx="160.5" cy="110" r="2.1" fill={C.brand} />
        <path d="M180 120l17 17" stroke={C.brand} strokeWidth="10" strokeLinecap="round" />
      </g>
      <Sparkle x={196} y={52} color={C.orange} />
      <Sparkle x={38} y={36} color={C.green} size={4} />
      <circle cx="206" cy="84" r="3" fill={C.purple} />
    </>
  ),

  projects: () => (
    <>
      <Backdrop />
      <rect x="44" y="40" width="152" height="108" rx="14" fill={C.surface} stroke={C.line} strokeWidth="1.5" />
      <rect x="44" y="40" width="152" height="22" rx="14" fill={C.surface2} />
      <rect x="44" y="52" width="152" height="10" fill={C.surface2} />
      <circle cx="58" cy="51" r="3" fill={C.red} />
      <circle cx="68" cy="51" r="3" fill={C.orange} />
      <circle cx="78" cy="51" r="3" fill={C.green} />
      {[
        { x: 54, color: C.muted, cards: 2 },
        { x: 101, color: C.orange, cards: 3 },
        { x: 148, color: C.green, cards: 1 },
      ].map((col) => (
        <g key={col.x}>
          <rect x={col.x} y="70" width="38" height="4" rx="2" fill={col.color} opacity="0.9" />
          {Array.from({ length: col.cards }, (_, i) => (
            <rect key={i} x={col.x} y={80 + i * 20} width="38" height="15" rx="4" fill={C.surface2} stroke={C.line} />
          ))}
        </g>
      ))}
      <g className="illo-float">
        <circle cx="190" cy="140" r="20" fill={C.brand} />
        <circle cx="190" cy="140" r="20" fill="url(#illo-shine)" />
        <path d="M190 131v18M181 140h18" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <Sparkle x={34} y={120} color={C.purple} size={4} />
      <Sparkle x={206} y={36} color={C.orange} />
    </>
  ),

  sprint: () => (
    <>
      <Backdrop />
      <ellipse cx="120" cy="156" rx="62" ry="8" fill={C.surface2} />
      <circle cx="78" cy="150" r="14" fill={C.surface} stroke={C.line} strokeWidth="1.5" />
      <circle cx="164" cy="150" r="12" fill={C.surface} stroke={C.line} strokeWidth="1.5" />
      <g className="illo-float">
        <path d="M112 112q8 34 8 34t8-34z" fill={C.orange} />
        <path d="M116 112q4 20 4 20t4-20z" fill={C.red} />
        <path d="M98 96l-14 20h16zM142 96l14 20h-16z" fill={C.brand} />
        <path d="M120 30c20 16 28 44 22 82h-44c-6-38 2-66 22-82z" fill={C.surface} stroke={C.line} strokeWidth="1.5" />
        <path d="M120 30c9 7 15 16 19 27h-38c4-11 10-20 19-27z" fill={C.brand} />
        <circle cx="120" cy="78" r="11" fill={C.surface2} stroke={C.brand} strokeWidth="4" />
        <rect x="113" y="100" width="14" height="4" rx="2" fill={C.line} />
      </g>
      <path d="M62 64h16M58 76h10M168 60h14M174 72h10" stroke={C.line} strokeWidth="3" strokeLinecap="round" />
      <Sparkle x={194} y={98} color={C.green} size={5} />
      <circle cx="48" cy="104" r="3" fill={C.purple} />
    </>
  ),

  history: () => (
    <>
      <Backdrop />
      <path d="M40 150h160" stroke={C.line} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 8" />
      {[62, 120, 178].map((x, i) => (
        <circle key={x} cx={x} cy="150" r="6" fill={i === 2 ? C.surface : C.green} stroke={i === 2 ? C.line : 'none'} strokeWidth="2" />
      ))}
      <g className="illo-float">
        <path d="M94 46h52v26a26 26 0 0 1-52 0z" fill={C.orange} />
        <path d="M94 46h52v10H94z" fill="#fff" opacity="0.25" />
        <path d="M94 54h-8a10 10 0 0 0 0 20h9M146 54h8a10 10 0 0 1 0 20h-9" stroke={C.orange} strokeWidth="5" fill="none" />
        <rect x="114" y="96" width="12" height="14" fill={C.orange} />
        <rect x="102" y="110" width="36" height="10" rx="3" fill={C.brand} />
        <path d="M120 58l3.5 7 7.7 1.1-5.6 5.4 1.3 7.7-6.9-3.6-6.9 3.6 1.3-7.7-5.6-5.4 7.7-1.1z" fill="#fff" />
      </g>
      <Sparkle x={70} y={46} color={C.purple} size={5} />
      <Sparkle x={176} y={40} color={C.green} />
      <circle cx="186" cy="100" r="3" fill={C.blue} />
    </>
  ),

  notFound: () => (
    <>
      <Backdrop />
      <text x="120" y="118" textAnchor="middle" fontSize="72" fontWeight="800" fill={C.brand} opacity="0.12" fontFamily="inherit">
        404
      </text>
      <path d="M52 150c30-30 60 10 92-18s40-8 46-4" stroke={C.muted} strokeWidth="2.5" strokeDasharray="5 6" fill="none" strokeLinecap="round" opacity="0.6" />
      <g className="illo-float">
        <path d="M120 36c-15 0-26 11-26 25 0 19 26 45 26 45s26-26 26-45c0-14-11-25-26-25z" fill={C.brand} />
        <circle cx="120" cy="61" r="10" fill={C.surface} />
      </g>
      <ellipse cx="120" cy="112" rx="12" ry="3.5" fill={C.brand} opacity="0.2" />
      <circle cx="52" cy="150" r="5" fill={C.green} />
      <path d="M186 124l8 8M194 124l-8 8" stroke={C.red} strokeWidth="3" strokeLinecap="round" />
      <Sparkle x={196} y={50} color={C.orange} size={5} />
    </>
  ),

  error: () => (
    <>
      <Backdrop />
      <path d="M78 130a24 24 0 0 1 2-48 34 34 0 0 1 64-8 26 26 0 0 1 18 56z" fill={C.surface} stroke={C.line} strokeWidth="1.5" />
      <path d="M98 108h12M130 108h12" stroke={C.line} strokeWidth="3" strokeLinecap="round" />
      <g className="illo-float">
        <path d="M152 104l24 42h-48z" fill={C.red} stroke={C.red} strokeWidth="4" strokeLinejoin="round" />
        <path d="M152 118v14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="152" cy="139" r="2.2" fill="#fff" />
      </g>
      <path d="M60 150h40M112 150h16" stroke={C.line} strokeWidth="3" strokeLinecap="round" />
      <Sparkle x={52} y={60} color={C.orange} size={4} />
    </>
  ),

  chart: () => (
    <>
      <rect x="40" y="36" width="160" height="112" rx="14" fill={C.surface2} opacity="0.6" />
      {[58, 84, 110, 136, 162].map((x, i) => (
        <rect key={x} x={x} y={130 - [30, 48, 38, 62, 26][i]} width="16" height={[30, 48, 38, 62, 26][i]} rx="4" fill={C.line} opacity="0.8" />
      ))}
      <path d="M56 70l30 18 26-10 28 20 34-26" stroke={C.brand} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 6" opacity="0.7" />
      <path d="M52 132h140" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <circle cx="174" cy="72" r="5" fill={C.brand} />
    </>
  ),

  comments: () => (
    <>
      <rect x="54" y="48" width="96" height="46" rx="14" fill={C.surface2} />
      <path d="M72 94l-4 14 16-14z" fill={C.surface2} />
      <rect x="68" y="62" width="56" height="5" rx="2.5" fill={C.line} />
      <rect x="68" y="74" width="36" height="5" rx="2.5" fill={C.line} />
      <g className="illo-float">
        <rect x="100" y="86" width="90" height="42" rx="14" fill={C.brand} />
        <path d="M172 128l4 12-16-12z" fill={C.brand} />
        <circle cx="128" cy="107" r="4" fill="#fff" />
        <circle cx="145" cy="107" r="4" fill="#fff" opacity="0.8" />
        <circle cx="162" cy="107" r="4" fill="#fff" opacity="0.6" />
      </g>
    </>
  ),
};

export default function Illustration({ name, className }) {
  const Art = ART[name];
  if (!Art) return null;
  return (
    <svg viewBox="0 0 240 180" className={clsx('h-auto w-full', className)} fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="illo-shine" cx="0.3" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Art />
    </svg>
  );
}
