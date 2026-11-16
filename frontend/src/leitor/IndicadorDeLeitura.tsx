import { Icone } from "../componentes/Icone.tsx";
import type { EstadoDoLeitor } from "./useLeitor.ts";

export function IndicadorDeLeitura({ leitor }: { leitor: EstadoDoLeitor }) {
  const { serial } = leitor;
  return (
    <div className="leitor">
      <span className={leitor.pronto ? "leitor-estado leitor-estado--pronto" : "leitor-estado"} role="status">
        <span className="leitor-ponto" aria-hidden="true" />
        {leitor.pronto ? "Pronto para leitura" : "Campo em foco: a leitura vai para o campo"}
      </span>
      {serial.conectado ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={serial.desconectar}>
          <Icone nome="radio" />
          Leitor serial conectado
        </button>
      ) : serial.disponivel ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={serial.conectar} disabled={serial.conectando} aria-busy={serial.conectando}>
          <Icone nome="radio" />
          {serial.conectando ? "Conectando…" : "Conectar leitor serial"}
        </button>
      ) : (
        <span className="leitor-ajuda" title="A leitura por porta serial exige HTTPS (ou localhost) e Chrome ou Edge. O leitor em modo teclado funciona em qualquer navegador.">
          Modo teclado
        </span>
      )}
      {serial.erro ? (
        <span className="leitor-erro" role="alert">
          {serial.erro}
        </span>
      ) : null}
    </div>
  );
}
