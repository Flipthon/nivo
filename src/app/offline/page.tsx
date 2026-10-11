import { NivoLogo } from "@/components/NivoMark";

export const metadata = { title: "Sem conexão · Nivo" };

export default function OfflinePage() {
  return (
    <main className="login">
      <NivoLogo size={36} />
      <h1>Você está sem internet</h1>
      <p className="lead" style={{ marginBottom: 24 }}>
        O Nivo precisa de conexão para mostrar e salvar seus lançamentos. Nada foi salvo enquanto você
        estava offline. Quando a conexão voltar, toque em tentar de novo.
      </p>
      <a href="/" className="btn btn-primary">Tentar de novo</a>
    </main>
  );
}
