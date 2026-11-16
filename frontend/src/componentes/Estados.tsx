import { Icone } from "./Icone.tsx";

export function EstadoVazio({ titulo, descricao }: { titulo: string; descricao?: string | undefined }) {
  return (
    <div className="estado">
      <Icone nome="package" />
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
