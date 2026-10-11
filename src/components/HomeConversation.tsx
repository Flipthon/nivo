"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUp, ArrowUpRight, Check, CreditCard, ImagePlus, Mic, Undo2, X } from "lucide-react";
import { confirmItems, sendMessage, undoRequest, type ChatReply } from "@/lib/transactions/actions";
import { formatCents } from "@/lib/money/format";
import type { Item } from "@/lib/transactions/plan";

const SUGGESTIONS = [
  { title: "Registrar um gasto", example: "Almoço 35 e Uber 18", Icon: ArrowDownRight },
  { title: "Adicionar receita", example: "Recebi 3500 de salário", Icon: ArrowUpRight },
];

type Msg =
  | { id: string; from: "user"; text: string }
  | { id: string; from: "nivo"; reply: ChatReply; settled?: "undone" | "confirmed" | "cancelled" };

function newId() {
  return crypto.randomUUID();
}

/** Conversa da tela Início: lança gastos e receitas, confirma quando preciso e permite desfazer. */
export function HomeConversation({ showWelcome }: { showWelcome: boolean }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function pickExample(example: string) {
    setText(example);
    inputRef.current?.focus();
  }

  function push(msg: Msg) {
    setMessages((m) => [...m, msg].slice(-40));
  }
  function settle(id: string, settled: "undone" | "confirmed" | "cancelled") {
    setMessages((m) => m.map((x) => (x.id === id && x.from === "nivo" ? { ...x, settled } : x)));
  }

  async function run(action: () => Promise<ChatReply>) {
    let reply: ChatReply;
    try {
      reply = await action();
    } catch {
      reply = { kind: "error", text: "Sem conexão com o Nivo agora. Nada foi salvo — tente de novo." };
    }
    push({ id: newId(), from: "nivo", reply });
    if (reply.kind === "saved" || (reply.kind === "answer" && reply.text.startsWith("Desfeito"))) router.refresh();
    return reply;
  }

  function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || pending) return;
    const requestId = newId();
    push({ id: newId(), from: "user", text: value });
    setText("");
    startTransition(async () => {
      await run(() => sendMessage(value, requestId));
    });
  }

  function undo(msgId: string, requestId: string) {
    startTransition(async () => {
      const r = await run(() => undoRequest(requestId));
      if (r.kind !== "error") settle(msgId, "undone");
    });
  }

  function confirm(msgId: string, requestId: string, items: Item[]) {
    startTransition(async () => {
      const r = await run(() => confirmItems(requestId, items));
      if (r.kind === "saved") settle(msgId, "confirmed");
    });
  }

  const showHero = showWelcome && messages.length === 0;

  return (
    <>
      {showHero && (
        <section className="hero" aria-labelledby="convite">
          <p className="tagline">SEU DINHEIRO. SEU MÊS. SEU NIVO.</p>
          <h2 id="convite">Vamos organizar<br />o seu mês?</h2>
          <p>Me conte um gasto ou uma receita.<br />Eu cuido dos detalhes.</p>
          <div className="suggestions">
            {SUGGESTIONS.map(({ title, example, Icon }) => (
              <button key={title} type="button" className="suggestion" onClick={() => pickExample(example)}>
                <Icon size={18} aria-hidden="true" />
                {title}
                <span>&ldquo;{example}&rdquo;</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {messages.length > 0 && (
        <section className="chat" aria-live="polite" aria-label="Conversa">
          {messages.map((m) =>
            m.from === "user" ? (
              <p key={m.id} className="bubble me">{m.text}</p>
            ) : (
              <NivoBubble
                key={m.id}
                msg={m}
                busy={pending}
                onUndo={(rid) => undo(m.id, rid)}
                onConfirm={(rid, items) => confirm(m.id, rid, items)}
                onCancel={() => settle(m.id, "cancelled")}
              />
            ),
          )}
          {pending && <p className="bubble nivo typing" aria-label="Nivo está pensando">•••</p>}
          <div ref={endRef} />
        </section>
      )}

      <div className="composer-spacer" aria-hidden="true" />
      <div className="composer">
        <form className="composer-box" onSubmit={submit} aria-label="Conversa com o Nivo">
          <label htmlFor="mensagem" className="sr-only">Mensagem</label>
          <textarea
            id="mensagem"
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
            }}
            placeholder="Ex.: hoje gastei R$ 50 no almoço…"
            maxLength={500}
            enterKeyHint="send"
          />
          <div className="composer-bar">
            <span className="hint">Áudio e fotos chegam em breve.</span>
            <button type="button" className="icon-btn" disabled aria-label="Enviar foto (em breve)"><ImagePlus size={20} /></button>
            <button type="button" className="icon-btn" disabled aria-label="Gravar áudio (em breve)"><Mic size={20} /></button>
            <button type="submit" className="icon-btn send" disabled={!text.trim() || pending} aria-label="Enviar">
              <ArrowUp size={19} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function NivoBubble({
  msg,
  busy,
  onUndo,
  onConfirm,
  onCancel,
}: {
  msg: Extract<Msg, { from: "nivo" }>;
  busy: boolean;
  onUndo: (requestId: string) => void;
  onConfirm: (requestId: string, items: Item[]) => void;
  onCancel: () => void;
}) {
  const r = msg.reply;
  if (r.kind === "answer" || r.kind === "error") {
    return <p className={`bubble nivo${r.kind === "error" ? " error" : ""}`}>{r.text}</p>;
  }
  if (r.kind === "saved") {
    return (
      <div className="bubble nivo">
        <p>{msg.settled === "undone" ? <s>{r.text}</s> : r.text}</p>
        {r.lines.length > 0 && (
          <ul className="saved-lines">
            {r.lines.map((l, i) => (
              <li key={i} className={msg.settled === "undone" ? "undone" : undefined}>
                <span>
                  {l.description}
                  {l.detail && <small>{l.detail}</small>}
                </span>
                <strong className={l.kind === "income" ? "income" : undefined}>
                  {l.kind === "income" ? "+" : "−"}{formatCents(l.cents)}
                </strong>
              </li>
            ))}
          </ul>
        )}
        {msg.settled !== "undone" && r.lines.length > 0 && (
          <button type="button" className="link-btn" disabled={busy} onClick={() => onUndo(r.requestId)}>
            <Undo2 size={15} aria-hidden="true" /> Desfazer
          </button>
        )}
      </div>
    );
  }
  return <ConfirmCard reply={r} settled={msg.settled} busy={busy} onConfirm={onConfirm} onCancel={onCancel} />;
}

function centsToInput(c: number) {
  return (c / 100).toFixed(2).replace(".", ",");
}
function inputToCents(s: string): number | null {
  const clean = s.replace(/[R$\s]/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(clean)) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const v = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(v) && v > 0 ? v : null;
}

function ConfirmCard({
  reply,
  settled,
  busy,
  onConfirm,
  onCancel,
}: {
  reply: Extract<ChatReply, { kind: "confirm" }>;
  settled?: "undone" | "confirmed" | "cancelled";
  busy: boolean;
  onConfirm: (requestId: string, items: Item[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState(() => reply.items.map((it) => ({ ...it, amount: centsToInput(it.cents) })));
  const [error, setError] = useState<string | null>(null);
  const done = settled === "confirmed" || settled === "cancelled";

  function update(i: number, patch: Partial<(typeof items)[number]>) {
    setItems((list) => list.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }

  function submit() {
    const out: Item[] = [];
    for (const it of items) {
      const cents = inputToCents(it.amount);
      if (cents === null) return setError(`Valor inválido em “${it.description || "item"}”.`);
      if (!it.description.trim()) return setError("Descreva cada lançamento.");
      const { amount: _amount, ...rest } = it;
      void _amount;
      out.push({ ...rest, cents, description: it.description.trim() });
    }
    setError(null);
    onConfirm(reply.requestId, out);
  }

  return (
    <div className={`bubble nivo confirm${done ? " done" : ""}`}>
      <p>{settled === "cancelled" ? "Cancelado. Nada foi salvo." : settled === "confirmed" ? "Confirmado." : reply.text}</p>
      {!done && (
        <>
          <ul className="reasons">
            {reply.reasons.map((x) => <li key={x}>{x}</li>)}
          </ul>
          {items.map((it, i) => (
            <fieldset key={i} className="confirm-item">
              <legend className="sr-only">Lançamento {i + 1}</legend>
              <label>
                Descrição
                <input value={it.description} maxLength={80} onChange={(e) => update(i, { description: e.target.value })} />
              </label>
              <div className="confirm-row">
                <label>
                  Valor (R$)
                  <input inputMode="decimal" value={it.amount} onChange={(e) => update(i, { amount: e.target.value })} />
                </label>
                <label>
                  Data
                  <input type="date" value={it.occurredOn} onChange={(e) => update(i, { occurredOn: e.target.value })} />
                </label>
              </div>
              <label>
                Categoria
                <select value={it.categoryId ?? ""} onChange={(e) => update(i, { categoryId: e.target.value || null })}>
                  <option value="">Sem categoria</option>
                  {reply.categories.filter((c) => c.kind === it.kind).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              {it.kind === "expense" && (it.cardId || it.newCardName || it.installments > 1 || reply.reasons.includes("Em qual cartão foi?")) && (
                <div className="confirm-row">
                  <label>
                    <span><CreditCard size={13} aria-hidden="true" /> Cartão</span>
                    <select
                      value={it.cardId ?? (it.newCardName ? "__new" : "")}
                      onChange={(e) =>
                        update(i, e.target.value === "__new"
                          ? { cardId: null, newCardName: it.newCardName ?? "Cartão de crédito" }
                          : { cardId: e.target.value || null, newCardName: null })
                      }
                    >
                      <option value="">Sem cartão</option>
                      {reply.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="__new">{it.newCardName ? `Novo: ${it.newCardName}` : "Novo cartão"}</option>
                    </select>
                  </label>
                  <label>
                    Parcelas
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={it.installments}
                      onChange={(e) => update(i, { installments: Math.min(48, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                  </label>
                </div>
              )}
              {it.newCardName && !it.cardId && (
                <label>
                  Nome do novo cartão
                  <input value={it.newCardName} maxLength={30} onChange={(e) => update(i, { newCardName: e.target.value })} />
                </label>
              )}
            </fieldset>
          ))}
          {error && <p className="form-status error" role="alert">{error}</p>}
          <div className="confirm-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
              <X size={16} aria-hidden="true" /> Cancelar
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
              <Check size={16} aria-hidden="true" /> Salvar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
