import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile/queries";
import { signOut } from "@/lib/auth/actions";
import Link from "next/link";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Mais · Nivo" };

export default async function MaisPage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  const allZones = Intl.supportedValuesOf("timeZone");

  return (
    <>
      <header className="page-head">
        <h1>Mais</h1>
        <p>Seu perfil e as configurações do Nivo.</p>
      </header>

      <section className="panel" aria-labelledby="perfil">
        <h2 id="perfil" style={{ marginBottom: 16 }}>Perfil</h2>
        <ProfileForm
          initial={{ display_name: profile.display_name ?? "", timezone: profile.timezone }}
          email={profile.email}
          allZones={allZones}
        />
      </section>

      <section className="panel" aria-labelledby="dados">
        <h2 id="dados" style={{ marginBottom: 12 }}>Seus dados</h2>
        <div className="link-list">
          <Link href="/privacidade">Política de privacidade</Link>
          <Link href="/mais/excluir-conta" className="danger-link">Excluir conta</Link>
        </div>
      </section>

      <section className="panel">
        <form action={signOut}>
          <button type="submit" className="btn btn-danger">Sair da conta</button>
        </form>
      </section>
    </>
  );
}
