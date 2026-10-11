/** Marca do Nivo: um nível de bolha, com a bolha no centro (equilíbrio). */
export function NivoMark({ size = 56, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      className={animated ? "mark" : undefined}
      width={size}
      height={size * 0.5}
      viewBox="0 0 64 32"
      role="img"
      aria-label="Nivo"
    >
      <rect x="2" y="4" width="60" height="24" rx="12" fill="#f6f8ef" stroke="#17233a" strokeWidth="3" />
      <line x1="22" y1="9" x2="22" y2="23" stroke="#17233a" strokeWidth="2" opacity=".4" />
      <line x1="42" y1="9" x2="42" y2="23" stroke="#17233a" strokeWidth="2" opacity=".4" />
      <ellipse className="mark-bubble" cx="32" cy="16" rx="8" ry="6" fill="#d3e66b" />
    </svg>
  );
}
