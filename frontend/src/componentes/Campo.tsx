import { useId, type ChangeEvent, type ReactNode } from "react";
import { Icone } from "./Icone.tsx";

type Base = {
  rotulo: string;
  erro?: string | undefined;
  ajuda?: string | undefined;
  obrigatorio?: boolean;
  largo?: boolean;
  desabilitado?: boolean;
};

function Envoltorio({
  id,
  base,
  children,
}: {
  id: string;
  base: Base;
  children: (ligacoes: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode;
}) {
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const descricao = [base.erro ? idErro : undefined, base.ajuda ? idAjuda : undefined].filter((v) => v !== undefined).join(" ");
  return (
    <div className={base.largo ? "campo campo--largo" : "campo"}>
      <label className="form-label" htmlFor={id}>
        {base.rotulo}
        {base.obrigatorio ? (
          <span className="campo-obrigatorio" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": base.erro !== undefined, "aria-describedby": descricao === "" ? undefined : descricao })}
      {base.ajuda ? (
        <div id={idAjuda} className="campo-ajuda">
          {base.ajuda}
        </div>
      ) : null}
      {base.erro ? (
        <div id={idErro} className="form-error" role="alert">
          <Icone nome="alert-triangle" />
          <span>{base.erro}</span>
        </div>
      ) : null}
    </div>
  );
}

type PropriedadesDeTexto = Base & {
  valor: string;
  aoMudar: (valor: string) => void;
  tipo?: "text" | "date" | "search";
  tamanhoMaximo?: number;
  inputMode?: "decimal" | "text";
  placeholder?: string;
  autoFoco?: boolean;
};

export function CampoDeTexto({ valor, aoMudar, tipo = "text", tamanhoMaximo, inputMode, placeholder, autoFoco, ...base }: PropriedadesDeTexto) {
  const id = useId();
  return (
    <Envoltorio id={id} base={base}>
      {(ligacoes) => (
        <input
          {...ligacoes}
          className="input"
          type={tipo}
          value={valor}
          maxLength={tamanhoMaximo}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={base.desabilitado}
          autoComplete="off"
          data-foco-inicial={autoFoco ? "" : undefined}
          onChange={(evento: ChangeEvent<HTMLInputElement>) => aoMudar(evento.target.value)}
        />
      )}
    </Envoltorio>
  );
}

export function CampoDeAreaDeTexto({
  valor,
  aoMudar,
  tamanhoMaximo,
  linhas = 3,
  ...base
}: Base & { valor: string; aoMudar: (valor: string) => void; tamanhoMaximo?: number; linhas?: number }) {
  const id = useId();
  return (
    <Envoltorio id={id} base={base}>
      {(ligacoes) => (
        <textarea
          {...ligacoes}
          className="input"
          value={valor}
          rows={linhas}
          maxLength={tamanhoMaximo}
          disabled={base.desabilitado}
          onChange={(evento: ChangeEvent<HTMLTextAreaElement>) => aoMudar(evento.target.value)}
        />
      )}
    </Envoltorio>
  );
}

export type OpcaoDeSelecao = { valor: string; rotulo: string };

export function CampoDeSelecao({
  valor,
  aoMudar,
  opcoes,
  vazio,
  ...base
}: Base & { valor: string; aoMudar: (valor: string) => void; opcoes: readonly OpcaoDeSelecao[]; vazio: string }) {
  const id = useId();
  return (
    <Envoltorio id={id} base={base}>
      {(ligacoes) => (
        <select
          {...ligacoes}
          className="input"
          value={valor}
          disabled={base.desabilitado}
          onChange={(evento: ChangeEvent<HTMLSelectElement>) => aoMudar(evento.target.value)}
        >
          <option value="">{vazio}</option>
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      )}
    </Envoltorio>
  );
}

export function AvisoDoFormulario({ mensagem }: { mensagem: string | null }) {
  if (mensagem === null) return null;
  return (
    <div className="aviso-do-formulario" role="alert">
      <Icone nome="alert-triangle" />
      <span>{mensagem}</span>
    </div>
  );
}
