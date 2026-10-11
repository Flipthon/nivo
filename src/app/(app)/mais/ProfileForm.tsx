"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileFormState } from "@/lib/profile/actions";

const BR_ZONES: { id: string; label: string }[] = [
  { id: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, GO, DF…)" },
  { id: "America/Bahia", label: "Bahia" },
  { id: "America/Fortaleza", label: "Ceará, RN, PB, PI, MA" },
  { id: "America/Recife", label: "Pernambuco" },
  { id: "America/Maceio", label: "Alagoas e Sergipe" },
  { id: "America/Belem", label: "Pará e Amapá" },
  { id: "America/Araguaina", label: "Tocantins" },
  { id: "America/Noronha", label: "Fernando de Noronha" },
  { id: "America/Cuiaba", label: "Mato Grosso" },
  { id: "America/Campo_Grande", label: "Mato Grosso do Sul" },
  { id: "America/Manaus", label: "Amazonas" },
  { id: "America/Porto_Velho", label: "Rondônia" },
  { id: "America/Boa_Vista", label: "Roraima" },
  { id: "America/Rio_Branco", label: "Acre" },
];

type Props = {
  initial: { display_name: string; timezone: string };
  email: string | null;
  allZones: string[];
};

export function ProfileForm({ initial, email, allZones }: Props) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(updateProfile, { status: "idle" });
  const errors: Record<string, string> = state.status === "error" ? state.fieldErrors ?? {} : {};
  const brIds = new Set(BR_ZONES.map((z) => z.id));
  const otherZones = allZones.filter((z) => !brIds.has(z));

  return (
    <form action={formAction} noValidate>
      <div className="field">
        <label htmlFor="display_name">Nome</label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={initial.display_name}
          autoComplete="name"
          maxLength={60}
          aria-invalid={Boolean(errors.display_name)}
          aria-describedby={errors.display_name ? "display_name-erro" : undefined}
        />
        {errors.display_name && <span id="display_name-erro" className="error">{errors.display_name}</span>}
      </div>

      {email && (
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" value={email} readOnly />
          <span className="hint">Vem da sua conta de login.</span>
        </div>
      )}

      <div className="field">
        <label htmlFor="timezone">Fuso horário</label>
        <select id="timezone" name="timezone" defaultValue={initial.timezone} aria-invalid={Boolean(errors.timezone)}>
          <optgroup label="Brasil">
            {BR_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
          </optgroup>
          <optgroup label="Outros">
            {otherZones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
          </optgroup>
        </select>
        {errors.timezone && <span className="error">{errors.timezone}</span>}
      </div>

      <div className="field">
        <label htmlFor="currency">Moeda</label>
        <input id="currency" value="Real brasileiro (R$)" readOnly />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar perfil"}
      </button>

      <p className={`form-status ${state.status === "saved" ? "ok" : "error"}`} role="status" aria-live="polite">
        {state.status === "saved" && "Perfil salvo."}
        {state.status === "error" && state.message}
      </p>
    </form>
  );
}
