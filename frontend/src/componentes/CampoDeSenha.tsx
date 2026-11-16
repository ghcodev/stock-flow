import { useId, useState } from "react";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  erro?: string | undefined;
  ajuda?: string | undefined;
  obrigatorio?: boolean;
  desabilitado?: boolean;
  largo?: boolean;
  autoComplete?: "new-password" | "current-password";
};

export function CampoDeSenha({ rotulo, valor, aoMudar, erro, ajuda, obrigatorio, desabilitado, largo, autoComplete = "new-password" }: Propriedades) {
  const id = useId();
  const [visivel, setVisivel] = useState(false);
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const descricao = [erro ? idErro : undefined, ajuda ? idAjuda : undefined].filter((v) => v !== undefined).join(" ");
  return (
    <div className={largo ? "campo campo--largo" : "campo"}>
      <label className="form-label" htmlFor={id}>
        {rotulo}
        {obrigatorio ? (
          <span className="campo-obrigatorio" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <div className="campo-senha">
        <input
          id={id}
          className="input"
          type={visivel ? "text" : "password"}
          value={valor}
          autoComplete={autoComplete}
          spellCheck={false}
          disabled={desabilitado}
          aria-invalid={erro !== undefined}
          aria-describedby={descricao === "" ? undefined : descricao}
          onChange={(evento) => aoMudar(evento.target.value)}
        />
        <button type="button" className="campo-senha-alternar" onClick={() => setVisivel((atual) => !atual)} aria-pressed={visivel} aria-label={visivel ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`} disabled={desabilitado}>
          <Icone nome={visivel ? "eye-off" : "eye"} />
        </button>
      </div>
      {ajuda ? (
        <div id={idAjuda} className="campo-ajuda">
          {ajuda}
        </div>
      ) : null}
      {erro ? (
        <div id={idErro} className="form-error" role="alert">
          <Icone nome="alert-triangle" />
          <span>{erro}</span>
        </div>
      ) : null}
    </div>
  );
}
