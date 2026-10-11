"use client";

import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "@/lib/auth/email-actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, { status: "idle" });
  const f = state.status === "error" ? state.fields ?? {} : {};
  return (
    <form action={action} noValidate>
      <div className="field">
        <label htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(f.password)} />
        {f.password ? <span className="error">{f.password}</span> : <span className="hint">Pelo menos 8 caracteres, com letras e números.</span>}
      </div>
      <div className="field">
        <label htmlFor="confirm">Repita a nova senha</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={Boolean(f.confirm)} />
        {f.confirm && <span className="error">{f.confirm}</span>}
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar nova senha"}</button>
      {state.status === "error" && !Object.keys(f).length && <p className="login-alert" role="alert" style={{ marginTop: 12 }}>{state.message}</p>}
    </form>
  );
}
