import { NivoMark } from "@/components/NivoMark";

export const metadata = { title: "Sem conexão · Nivo" };

export default function OfflinePage() {
  return (
    <main className="login">
      <NivoMark size={64} />
      <h1 style={{ fontSize: "1.8rem" }}>Você está sem internet</h1>
      <p className="muted">
        O Nivo precisa de conexão para mostrar e salvar seus lançamentos. Nada foi salvo enquanto você
        estava offline. Quando a conexão voltar, toque em tentar de novo.
      </p>
      <a href="/" className="btn btn-primary">Tentar de novo</a>
    </main>
  );
}
