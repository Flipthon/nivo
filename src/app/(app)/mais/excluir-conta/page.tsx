import Link from "next/link";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata = { title: "Excluir conta · Nivo" };

export default function ExcluirContaPage() {
  return (
    <>
      <header className="page-head">
        <Link href="/mais" className="doc-back">Voltar</Link>
        <h1>Excluir conta</h1>
      </header>
      <section className="panel">
        <p>
          Isso apaga de forma definitiva sua conta e todos os seus lançamentos, categorias, cartões e
          orçamentos. Não dá para desfazer.
        </p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
