import { redirect } from "next/navigation";
import { NivoMark } from "@/components/NivoMark";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata = { title: "Nova senha · Nivo" };

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?erro=link");

  return (
    <main className="login">
      <div className="brand">
        <NivoMark size={56} />
        <h1 style={{ fontSize: "2rem" }}>Crie uma nova senha</h1>
        <p className="muted">Para {data.user.email}</p>
      </div>
      <NewPasswordForm />
    </main>
  );
}
