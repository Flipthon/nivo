import { redirect } from "next/navigation";
import { NivoLogo } from "@/components/NivoMark";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata = { title: "Nova senha · Nivo" };

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?erro=link");

  return (
    <main className="login">
      <NivoLogo size={36} />
      <h1>Crie uma nova senha</h1>
      <p className="lead" style={{ marginBottom: 24 }}>Para {data.user.email}</p>
      <NewPasswordForm />
    </main>
  );
}
