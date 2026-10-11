"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

// Botão oficial do Google renderizado dentro do Nivo.
// Assim o Google mostra "Prosseguir para meunivo.vercel.app" em vez do endereço do Supabase.
// O Google devolve um token assinado; o Supabase confere esse token e cria a sessão.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleCredential = { credential: string };
type GoogleId = {
  initialize: (opts: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

async function sha256Hex(text: string) {
  const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(data)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function GoogleSignIn({ next, fallback }: { next: string; fallback: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!CLIENT_ID);
  const [status, setStatus] = useState<string | null>(null);

  const setup = useCallback(async () => {
    const gid = window.google?.accounts.id;
    if (!gid || !box.current || !CLIENT_ID) return;
    // Nonce: o Google recebe o resumo, o Supabase recebe o original e confere se batem.
    const raw = crypto.randomUUID() + crypto.randomUUID();
    const hashed = await sha256Hex(raw);

    gid.initialize({
      client_id: CLIENT_ID,
      nonce: hashed,
      use_fedcm_for_prompt: true,
      callback: async ({ credential }: GoogleCredential) => {
        setStatus("Entrando…");
        const { error } = await createClient().auth.signInWithIdToken({ provider: "google", token: credential, nonce: raw });
        if (error) {
          setStatus("Não consegui concluir o login com o Google. Tente de novo.");
          return;
        }
        window.location.assign(next);
      },
    });
    gid.renderButton(box.current, {
      type: "standard", theme: "outline", size: "large", shape: "rectangular",
      text: "continue_with", logo_alignment: "center", locale: "pt-BR",
      width: Math.min(box.current.offsetWidth || 360, 400),
    });
    setReady(true);
  }, [next]);

  useEffect(() => {
    if (window.google?.accounts?.id) setup();
  }, [setup]);

  if (failed) {
    return (
      <button type="button" className="btn btn-secondary" onClick={fallback}>Entrar com Google</button>
    );
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={setup} onError={() => setFailed(true)} />
      <div ref={box} className="google-btn" aria-busy={!ready} />
      {status && <p className={status === "Entrando…" ? "muted" : "login-alert"} role="status">{status}</p>}
    </>
  );
}
