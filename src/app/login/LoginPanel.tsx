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
      <button className="btn btn-primary" onClick={() => oauth("google")} disabled={oauthPending !== null}>
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
          <button className="btn btn-secondary" disabled={signInPending}>{signInPending ? "Entrando…" : "Entrar"}</button>
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
            <button className="btn btn-secondary" disabled={signUpPending}>{signUpPending ? "Criando…" : "Criar conta"}</button>
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
          <button className="btn btn-secondary" disabled={resetPending || resetState.status === "sent"}>
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
