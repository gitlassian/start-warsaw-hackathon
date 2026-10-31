// Empty states: a quiet line drawing from the camera roll, then plain words on what to do next.
// Drawn with theme colours (fill-surface, stroke-line…) so they follow light and dark mode.

export function Empty({ art, title, children }: { art: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      {art}
      <p className="mt-6 text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-72 text-muted text-balance">{children}</p>
    </div>
  );
}

/** A small landscape (sun + hills): the "photo" glyph inside a frame at x, y. */
function Scene({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g className="stroke-faint" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx={x + w * 0.3} cy={y + h * 0.33} r={h * 0.09} className="fill-faint" stroke="none" />
      <path d={`M${x + w * 0.14} ${y + h * 0.78} l${w * 0.22} -${h * 0.25} ${w * 0.16} ${h * 0.17} ${w * 0.12} -${h * 0.12} ${w * 0.24} ${h * 0.2}`} />
    </g>
  );
}

/** No events: an unused film canister with an empty strip pulled out. */
export function EmptyRoll() {
  const holes = Array.from({ length: 11 }, (_, i) => 74 + i * 14);
  return (
    <svg viewBox="0 0 240 150" className="w-60" aria-hidden>
      {/* the strip, fading out to the right like it runs off the table */}
      <defs>
        <linearGradient id="empty-roll-fade" x1="0" x2="1">
          <stop offset="0.7" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="empty-roll-mask">
          <rect width="240" height="150" fill="url(#empty-roll-fade)" />
        </mask>
      </defs>
      <g mask="url(#empty-roll-mask)">
        <rect x="60" y="46" width="180" height="62" rx="6" className="fill-surface stroke-line" strokeWidth={1.5} />
        {holes.map((x) => (
          <g key={x} className="fill-bg">
            <rect x={x} y="51" width="7" height="6" rx="1.5" />
            <rect x={x} y="97" width="7" height="6" rx="1.5" />
          </g>
        ))}
        {[82, 130, 178].map((x, i) => (
          <g key={x}>
            <rect x={x} y="63" width="40" height="28" rx="4" className="fill-bg stroke-line" strokeWidth={1.5} />
            {i === 0 ? <Scene x={x} y={63} w={40} h={28} /> : null}
          </g>
        ))}
      </g>
      {/* the canister: spool on top, body between two wider rims */}
      <rect x="39" y="16" width="14" height="14" rx="3" className="fill-bg stroke-faint" strokeWidth={2} />
      <rect x="20" y="34" width="52" height="86" rx="4" className="fill-bg stroke-faint" strokeWidth={2} />
      <rect x="14" y="28" width="64" height="10" rx="4" className="fill-bg stroke-faint" strokeWidth={2} />
      <rect x="14" y="116" width="64" height="10" rx="4" className="fill-bg stroke-faint" strokeWidth={2} />
      <rect x="27" y="56" width="38" height="42" rx="6" className="fill-surface" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle
          key={a}
          cx={46 + 10 * Math.cos((a * Math.PI) / 180)}
          cy={77 + 10 * Math.sin((a * Math.PI) / 180)}
          r={3}
          className="fill-faint"
        />
      ))}
    </svg>
  );
}

/** No photos: the camera roll grid, the first tile waiting for a shot, the rest fading out. */
export function EmptyGrid() {
  const tiles = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ];
  return (
    <svg viewBox="0 0 240 150" className="w-60" aria-hidden>
      {tiles.map(([c, r], i) => {
        const x = 21 + c * 68;
        const y = 4 + r * 74;
        if (i === 0) {
          return (
            <g key={i} className="stroke-accent" strokeWidth={2} strokeLinecap="round" fill="none">
              <rect x={x + 1} y={y + 1} width="62" height="68" rx="11" strokeDasharray="6 6" />
              <path d={`M${x + 32} ${y + 25}v20M${x + 22} ${y + 35}h20`} />
            </g>
          );
        }
        return (
          <g key={i} opacity={1 - (c + r) * 0.22}>
            <rect x={x} y={y} width="64" height="70" rx="12" className="fill-surface" />
            {(c + r) % 2 ? <Scene x={x + 12} y={y + 15} w={40} h={40} /> : null}
          </g>
        );
      })}
    </svg>
  );
}
