"use client";

import Script from "next/script";

// Verificação anti-robô da Cloudflare (gratuita). Só aparece quando a chave está configurada.
// O token vai no campo "cf-turnstile-response" do formulário e é conferido pelo Supabase.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function Turnstile() {
  if (!SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={SITE_KEY} data-language="pt-br" data-theme="light" style={{ marginBottom: 12 }} />
    </>
  );
}
