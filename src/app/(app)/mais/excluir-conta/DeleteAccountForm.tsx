"use client";

import { useActionState } from "react";
import { deleteAccount, reauthenticate, type DeleteAccountState } from "@/lib/account/actions";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, { status: "idle" });

  if (state.status === "reauth") {
    return (
      <form action={reauthenticate} style={{ marginTop: 20 }}>
        <p className="muted" style={{ marginBottom: 12 }}>
          Por segurança, entre de novo para confirmar que é você.
        </p>
        <button type="submit" className="btn btn-primary">Entrar de novo</button>
      </form>
    );
  }

  return (
    <form action={action} style={{ marginTop: 20 }}>
      <div className="field">
        <label htmlFor="confirmacao">Digite EXCLUIR para confirmar</label>
        <input id="confirmacao" name="confirmacao" autoComplete="off" autoCapitalize="characters" />
      </div>
      <button type="submit" className="btn btn-danger" disabled={pending}>
        {pending ? "Excluindo…" : "Excluir minha conta"}
      </button>
      {state.status === "error" && <p className="form-status error" role="alert">{state.message}</p>}
    </form>
  );
}
