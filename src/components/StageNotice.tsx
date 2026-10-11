/** Aviso honesto para áreas que ainda não foram construídas. Nada aqui finge funcionar. */
export function StageNotice({ stage, children }: { stage: number; children: React.ReactNode }) {
  return (
    <section className="panel stage-notice">
      <span className="tag">Chega na etapa {stage}</span>
      <p className="muted">{children}</p>
    </section>
  );
}
