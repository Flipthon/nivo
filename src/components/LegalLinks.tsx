import Link from "next/link";

export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Informações legais">
      <Link href="/privacidade">Política de privacidade</Link>
      <Link href="/excluir-conta">Excluir conta</Link>
    </nav>
  );
}
