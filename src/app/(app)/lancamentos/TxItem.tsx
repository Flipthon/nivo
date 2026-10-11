"use client";

import { useActionState, useState } from "react";
import { deleteTransaction, updateTransaction, type FormState } from "@/lib/transactions/manage";
import { formatCents } from "@/lib/money/format";

export type TxView = {
  id: string;
  kind: "expense" | "income" | "card_payment";
  cents: number;
  description: string;
  occurredOn: string;
  categoryId: string | null;
  categoryName: string | null;
  cardName: string | null;
  installment: string | null;
};

export function TxItem({ tx, categories }: { tx: TxView; categories: Array<{ id: string; name: string }> }) {
  const [state, action, saving] = useActionState<FormState, FormData>(updateTransaction, { status: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = [
    tx.kind === "card_payment" ? "Pagamento de fatura" : tx.categoryName ?? "Sem categoria",
    tx.installment ? `parcela ${tx.installment}` : null,
    tx.cardName,
  ].filter(Boolean).join(" · ");
  const sign = tx.kind === "income" ? "+" : tx.kind === "expense" ? "−" : "";
  const amountClass = tx.kind === "income" ? "income" : tx.kind === "card_payment" ? "neutral" : "";

  return (
    <details>
      <summary>
        <span className="tx-desc">
          <span>{tx.description}</span>
          <small>{meta}</small>
        </span>
        <span className={`tx-amount ${amountClass}`}>{sign}{formatCents(tx.cents)}</span>
      </summary>

      <form action={action} className="tx-edit">
        <input type="hidden" name="id" value={tx.id} />
        <label>
          Descrição
          <input name="description" defaultValue={tx.description} maxLength={80} required />
        </label>
        <div className="confirm-row">
          <label>
            Valor (R$){tx.installment && " desta parcela"}
            <input name="amount" inputMode="decimal" defaultValue={(tx.cents / 100).toFixed(2).replace(".", ",")} required />
          </label>
          <label>
            Data
            <input name="occurred_on" type="date" defaultValue={tx.occurredOn} required />
          </label>
        </div>
        {tx.kind !== "card_payment" && (
          <label>
            Categoria
            <select name="category_id" defaultValue={tx.categoryId ?? ""}>
              <option value="">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {state.status !== "idle" && (
          <p className={`form-status ${state.status === "ok" ? "ok" : "error"}`} role="status">{state.message}</p>
        )}
        <div className="row-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>Salvar</button>
          {!confirmDelete ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Excluir</button>
          ) : (
            <>
              <button type="submit" formAction={deleteTransaction} className="btn btn-danger">
                {tx.installment ? "Só esta parcela" : "Confirmar exclusão"}
              </button>
              {tx.installment && (
                <button type="submit" formAction={deleteTransaction} name="all" value="1" className="btn btn-danger">
                  Todas as parcelas
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </details>
  );
}
