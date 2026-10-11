"use client";

import { useRef, useState } from "react";
import { ArrowDownRight, ArrowUp, ArrowUpRight, ImagePlus, Mic } from "lucide-react";

const SUGGESTIONS = [
  { title: "Registrar um gasto", example: "Almoço 35 e Uber 18", Icon: ArrowDownRight },
  { title: "Adicionar receita", example: "Recebi 3500 de salário", Icon: ArrowUpRight },
];

/**
 * Convite e caixa de conversa da tela Início.
 * Nesta versão a caixa ainda não envia: o envio, o áudio e as fotos chegam com os lançamentos (etapa 2).
 */
export function HomeConversation({ showWelcome }: { showWelcome: boolean }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function pickExample(example: string) {
    setText(example);
    inputRef.current?.focus();
  }

  return (
    <>
      {showWelcome && (
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

      <div className="composer-spacer" aria-hidden="true" />
      <div className="composer">
        <form className="composer-box" onSubmit={(e) => e.preventDefault()} aria-label="Conversa com o Nivo">
          <label htmlFor="mensagem" className="sr-only">Mensagem</label>
          <textarea
            id="mensagem"
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: hoje gastei R$ 50 no almoço…"
            maxLength={500}
          />
          <div className="composer-bar">
            <span className="hint">A conversa é ativada na próxima atualização do Nivo.</span>
            <button type="button" className="icon-btn" disabled aria-label="Enviar foto (em breve)"><ImagePlus size={20} /></button>
            <button type="button" className="icon-btn" disabled aria-label="Gravar áudio (em breve)"><Mic size={20} /></button>
            <button type="submit" className="icon-btn send" disabled aria-label="Enviar (em breve)"><ArrowUp size={19} /></button>
          </div>
        </form>
      </div>
    </>
  );
}
