import { Icone } from "./Icone.tsx";

type Propriedades = {
  mensagem: string;
  horario: string | null;
  aoTentarNovamente: () => void;
};

export function AvisoDeAtualizacao({ mensagem, horario, aoTentarNovamente }: Propriedades) {
  return (
    <div className="aviso-do-formulario aviso-de-atualizacao" role="alert">
      <Icone nome="alert-triangle" />
      <span>
        Não foi possível atualizar: {mensagem}
        {horario ? ` Os dados exibidos são de ${horario}.` : ""}
      </span>
      <button type="button" className="btn btn-outline btn-sm" onClick={aoTentarNovamente}>
        Tentar novamente
      </button>
    </div>
  );
}
