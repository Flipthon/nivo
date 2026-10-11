"use client";

import { useActionState, useEffect, useRef } from "react";
import { archiveCard, createCard, type FormState } from "@/lib/transactions/manage";

const KIND_LABEL = { credit: "Crédito", meal: "Vale-refeição", transport: "Vale-transporte" } as const;

export type CardView = { id: string; name: string; kind: keyof typeof KIND_LABEL; closing_day: number | null; due_day: number | null };

export function CardsPanel({ cards }: { cards: CardView[] }) {
  const [state, action, saving] = useActionState<FormState, FormData>(createCard, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <>
      {cards.length > 0 ? (
        <ul className="card-list">
          {cards.map((c) => (
            <li key={c.id}>
              <span>
                {c.name}
                <small>
                  {KIND_LABEL[c.kind]}
                  {c.closing_day ? ` · fecha dia ${c.closing_day}` : ""}
                  {c.due_day ? ` · vence dia ${c.due_day}` : ""}
                </small>
              </span>
              <form action={archiveCard}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="link-btn" style={{ color: "var(--muted)" }}>Remover</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ marginBottom: 12, fontSize: "0.9rem" }}>
          Nenhum cartão ainda. Ao dizer “no cartão Nubank”, eu cadastro para você.
        </p>
      )}

      <form ref={formRef} action={action} className="card-form">
        <div className="confirm-row">
          <label>
            Nome
            <input name="name" maxLength={30} placeholder="Ex.: Nubank" required />
          </label>
          <label>
            Tipo
            <select name="kind" defaultValue="credit">
              <option value="credit">Crédito</option>
              <option value="meal">Vale-refeição</option>
              <option value="transport">Vale-transporte</option>
            </select>
          </label>
        </div>
        <div className="confirm-row">
          <label>
            Fecha no dia
            <input name="closing_day" type="number" min={1} max={31} inputMode="numeric" />
          </label>
          <label>
            Vence no dia
            <input name="due_day" type="number" min={1} max={31} inputMode="numeric" />
          </label>
        </div>
        {state.status !== "idle" && (
          <p className={`form-status ${state.status === "ok" ? "ok" : "error"}`} role="status">{state.message}</p>
        )}
        <button type="submit" className="btn btn-secondary" disabled={saving}>Adicionar cartão</button>
      </form>
    </>
  );
}
