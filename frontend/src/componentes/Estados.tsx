import { Icone } from "./Icone.tsx";

function IlustracaoVazia() {
  return (
    <svg className="estado-ilustracao" viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      <ellipse className="ilustracao-preenchimento" cx="60" cy="78" rx="44" ry="7" />
      <path className="ilustracao-preenchimento" d="M26 38 60 22l34 16v28L60 82 26 66z" />
      <path d="M26 38 60 54l34-16M60 54v28M26 38 60 22l34 16v28L60 82 26 66z" />
      <path d="M43 30l34 16" />
      <circle className="ilustracao-destaque" cx="86" cy="26" r="11" />
      <path className="ilustracao-destaque" d="m94 34 8 8" />
    </svg>
  );
}

export function EstadoVazio({ titulo, descricao }: { titulo: string; descricao?: string | undefined }) {
  return (
    <div className="estado">
      <IlustracaoVazia />
      <strong>{titulo}</strong>
      {descricao ? <span>{descricao}</span> : null}
    </div>
  );
}

export function EstadoDeErro({ mensagem, aoTentarNovamente }: { mensagem: string; aoTentarNovamente: () => void }) {
  return (
    <div className="estado estado--erro" role="alert">
      <Icone nome="alert-triangle" />
      <strong>Não foi possível carregar</strong>
      <span>{mensagem}</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={aoTentarNovamente}>
        <Icone nome="refresh" />
        Tentar novamente
      </button>
    </div>
  );
}
