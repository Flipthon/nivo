"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { publicEnv } from "@/lib/env";
import { Turnstile } from "@/components/Turnstile";
import {
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  type AuthFormState,
} from "@/lib/auth/email-actions";

type Mode = "entrar" | "criar" | "esqueci";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-4 7-9.9 7-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
const idle: AuthFormState = { status: "idle" };

function Field({ id, label, type = "text", autoComplete, error, hint }: {
  id: string; label: string; type?: string; autoComplete?: string; error?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} type={type} autoComplete={autoComplete} aria-invalid={Boolean(error)}
        inputMode={type === "email" ? "email" : undefined} autoCapitalize={type === "email" ? "none" : undefined} />
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function Status({ state }: { state: AuthFormState }) {
  if (state.status === "sent") return <p className="login-ok" role="status">{state.message}</p>;
  if (state.status === "error" && !state.fields) return <p className="login-alert" role="alert">{state.message}</p>;
  return null;
}

export function LoginPanel({ next = "/" }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("entrar");
  const [oauthPending, setOauthPending] = useState<"google" | "apple" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const [signInState, signInAction, signInPending] = useActionState(signInWithEmail, idle);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpWithEmail, idle);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, idle);

  async function oauth(provider: "google" | "apple") {
    setOauthPending(provider);
    setOauthError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setOauthError("Não consegui abrir o login. Verifique sua conexão e tente de novo.");
      setOauthPending(null);
    }
  }

  const fields = (s: AuthFormState) => (s.status === "error" ? s.fields ?? {} : {});

  return (
    <div className="actions">
      <button className="btn btn-secondary" onClick={() => oauth("google")} disabled={oauthPending !== null}>
        <GoogleIcon />
        {oauthPending === "google" ? "Abrindo o Google…" : "Entrar com Google"}
      </button>
      {publicEnv.appleEnabled && (
        <button className="btn btn-secondary" onClick={() => oauth("apple")} disabled={oauthPending !== null}>
          {oauthPending === "apple" ? "Abrindo a Apple…" : "Entrar com Apple"}
        </button>
      )}
      {oauthError && <p className="login-alert" role="alert">{oauthError}</p>}

      <div className="divider" role="separator"><span>ou com e-mail</span></div>

      {mode === "entrar" && (
        <form action={signInAction} noValidate>
          <input type="hidden" name="next" value={next} />
          <Field id="email" label="E-mail" type="email" autoComplete="email" error={fields(signInState).email} />
          <Field id="password" label="Senha" type="password" autoComplete="current-password" error={fields(signInState).password} />
          <Turnstile />
          <button className="btn btn-primary" disabled={signInPending}>{signInPending ? "Entrando…" : "Entrar"}</button>
          <Status state={signInState} />
          <div className="mode-links">
            <button type="button" className="link-btn" onClick={() => setMode("criar")}>Criar conta</button>
            <button type="button" className="link-btn" onClick={() => setMode("esqueci")}>Esqueci minha senha</button>
          </div>
        </form>
      )}

      {mode === "criar" && (
        signUpState.status === "sent" ? (
          <div>
            <Status state={signUpState} />
            <button type="button" className="link-btn" onClick={() => setMode("entrar")}>Voltar para entrar</button>
          </div>
        ) : (
          <form action={signUpAction} noValidate>
            <Field id="name" label="Nome" autoComplete="name" error={fields(signUpState).name} />
            <Field id="email" label="E-mail" type="email" autoComplete="email" error={fields(signUpState).email} />
            <Field id="password" label="Senha" type="password" autoComplete="new-password" error={fields(signUpState).password}
              hint="Pelo menos 8 caracteres, com letras e números." />
            <Field id="confirm" label="Repita a senha" type="password" autoComplete="new-password" error={fields(signUpState).confirm} />
            <Turnstile />
            <button className="btn btn-primary" disabled={signUpPending}>{signUpPending ? "Criando…" : "Criar conta"}</button>
            <Status state={signUpState} />
            <div className="mode-links">
              <button type="button" className="link-btn" onClick={() => setMode("entrar")}>Já tenho conta</button>
            </div>
          </form>
        )
      )}

      {mode === "esqueci" && (
        <form action={resetAction} noValidate>
          <p className="muted" style={{ marginBottom: 12 }}>Vamos enviar um link para você criar uma nova senha.</p>
          <Field id="email" label="E-mail" type="email" autoComplete="email" error={fields(resetState).email} />
          <Turnstile />
          <button className="btn btn-primary" disabled={resetPending || resetState.status === "sent"}>
            {resetPending ? "Enviando…" : "Enviar link"}
          </button>
          <Status state={resetState} />
          <div className="mode-links">
            <button type="button" className="link-btn" onClick={() => setMode("entrar")}>Voltar para entrar</button>
          </div>
        </form>
      )}
    </div>
  );
}
