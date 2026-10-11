import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/lib/auth/session";

// Toda página dentro de (app) exige sessão válida, além da checagem do middleware.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <main className="shell">{children}</main>
      <BottomNav />
    </>
  );
}
