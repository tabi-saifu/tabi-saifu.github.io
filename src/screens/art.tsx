// 画面の飾り。エアメールの封筒・消印・飛行機をモチーフにした線画で、色はすべて CSS 変数から取る。

/** 消印風のロゴ */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="var(--stamp)" strokeWidth="3" />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="var(--stamp)" strokeWidth="1.2" strokeDasharray="2 2.2" />
      <path d="M17 15l7 10 7-10M24 25v10M18.5 26h11M18.5 30.5h11" fill="none" stroke="var(--stamp)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** エアメールの封筒から飛び立つ飛行機 */
export function AirmailArt({ className = '' }: { className?: string }) {
  return (
    <svg className={`art ${className}`} viewBox="0 0 240 150" aria-hidden="true">
      <path d="M18 120 C 70 118, 92 70, 150 58 S 214 30, 226 16" fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" opacity="0.6" />
      <g transform="translate(26 62) rotate(-6)">
        <rect width="128" height="80" rx="8" fill="var(--card)" stroke="var(--ink)" strokeWidth="2.5" />
        <clipPath id="env"><rect width="128" height="80" rx="8" /></clipPath>
        <g clipPath="url(#env)">
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={i * 12 - 20} y="-6" width="6" height="16" transform={`skewX(-40)`} fill={i % 2 ? 'var(--accent)' : 'var(--stamp)'} />
          ))}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={`b${i}`} x={i * 12 + 30} y="70" width="6" height="16" transform={`skewX(-40)`} fill={i % 2 ? 'var(--accent)' : 'var(--stamp)'} />
          ))}
        </g>
        <path d="M6 14 L64 46 L122 14" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" opacity="0.35" />
        <g transform="translate(92 22)">
          <rect width="24" height="28" rx="2" fill="var(--paper)" stroke="var(--stamp)" strokeWidth="1.6" strokeDasharray="2.5 1.8" />
          <text x="12" y="20" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--stamp)">¥</text>
        </g>
      </g>
      <g transform="translate(196 24) rotate(-28)">
        <path d="M-20 0 L18 -3 Q 26 0 18 3 L-20 0 Z" fill="var(--ink)" />
        <path d="M-2 -1 L-12 -16 L-6 -16 L8 -2 Z M-2 1 L-12 16 L-6 16 L8 2 Z M-18 -1 L-23 -8 L-19 -8 L-12 -1 Z M-18 1 L-23 8 L-19 8 L-12 1 Z" fill="var(--ink)" />
      </g>
    </svg>
  );
}

const AVATAR_COLORS = ['var(--c-food)', 'var(--c-transport)', 'var(--c-hotel)', 'var(--c-sightseeing)', 'var(--c-shopping)'];

/** 名前の頭文字の丸いアイコン。同じ人は同じ色になる */
export function Avatar({ uid, name, size = 32 }: { uid: string; name: string; size?: number }) {
  const hash = [...uid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (
    <span className="avatar" aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.45, background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}>
      {[...name.trim()][0] ?? '?'}
    </span>
  );
}
