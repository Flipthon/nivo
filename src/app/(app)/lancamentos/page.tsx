import { StageNotice } from "@/components/StageNotice";

export const metadata = { title: "Lançamentos · Nivo" };

export default function LancamentosPage() {
  return (
    <>
      <header className="page-head"><h1>Lançamentos</h1></header>
      <StageNotice stage={2}>
        Aqui você vai ver, filtrar, editar e excluir seus gastos e receitas. Suas categorias padrão já
        foram criadas e estarão prontas para uso.
      </StageNotice>
    </>
  );
}
