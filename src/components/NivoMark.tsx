/** Marca do Nivo: ondas de som (o app entende o que você fala) num quadrado anil. */
export function NivoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Nivo" className="nivo-mark">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
        <line x1="8" y1="14" x2="8" y2="18" />
        <line x1="12" y1="11" x2="12" y2="21" />
        <line x1="16" y1="8" x2="16" y2="24" />
        <line x1="20" y1="11.5" x2="20" y2="20.5" />
        <line x1="24" y1="14.5" x2="24" y2="17.5" />
      </g>
    </svg>
  );
}

export function NivoLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="nivo-logo" style={{ fontSize: size * 0.68 }}>
      <NivoMark size={size} />
      Nivo
    </span>
  );
}
