import { useEffect, useId, useRef, useState, type KeyboardEvent as EventoDeTeclado } from "react";
import { ErroDeRede } from "../api/erros.ts";
import { Icone } from "./Icone.tsx";

export type OpcaoDeBusca = { valor: string; rotulo: string };

type Propriedades = {
  rotulo: string;
  valor: string;
  rotuloInicial?: string;
  aoMudar: (valor: string, rotulo: string) => void;
  buscar: (texto: string, sinal: AbortSignal) => Promise<OpcaoDeBusca[]>;
  placeholder?: string;
  erro?: string | undefined;
  ajuda?: string | undefined;
  obrigatorio?: boolean;
  desabilitado?: boolean;
  semRotulo?: boolean;
  largo?: boolean;
  atrasoMs?: number;
};

type Situacao = "ocioso" | "carregando" | "erro";

export function SeletorComBusca({
  rotulo,
  valor,
  rotuloInicial = "",
  aoMudar,
  buscar,
  placeholder,
  erro,
  ajuda,
  obrigatorio,
  desabilitado,
  semRotulo,
  largo,
  atrasoMs = 250,
}: Propriedades) {
  const id = useId();
  const idLista = `${id}-lista`;
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const [texto, setTexto] = useState(rotuloInicial);
  const [aberto, setAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcaoDeBusca[]>([]);
  const [ativa, setAtiva] = useState(-1);
  const [situacao, setSituacao] = useState<Situacao>("ocioso");
  const [consulta, setConsulta] = useState("");
  const editando = useRef(false);
  const funcaoDeBusca = useRef(buscar);
  funcaoDeBusca.current = buscar;

  useEffect(() => {
    if (editando.current) {
      editando.current = false;
      return;
    }
    if (valor === "") setTexto("");
  }, [valor]);

  useEffect(() => {
    if (!aberto) return;
    const controle = new AbortController();
    const temporizador = window.setTimeout(
      () => {
        setSituacao("carregando");
        funcaoDeBusca.current(consulta, controle.signal).then(
          (resultado) => {
            if (controle.signal.aborted) return;
            setOpcoes(resultado);
            setAtiva(resultado.length > 0 ? 0 : -1);
            setSituacao("ocioso");
          },
          (falha: unknown) => {
            if (controle.signal.aborted) return;
            if (falha instanceof ErroDeRede && falha.motivo === "CANCELADO") return;
            setOpcoes([]);
            setAtiva(-1);
            setSituacao("erro");
          },
        );
      },
      consulta === "" ? 0 : atrasoMs,
    );
    return () => {
      window.clearTimeout(temporizador);
      controle.abort();
    };
  }, [aberto, consulta, atrasoMs]);

  const escolher = (opcao: OpcaoDeBusca) => {
    editando.current = true;
    setTexto(opcao.rotulo);
    setAberto(false);
    aoMudar(opcao.valor, opcao.rotulo);
  };

  const limpar = () => {
    editando.current = false;
    setTexto("");
    setConsulta("");
    aoMudar("", "");
  };

  const aoTeclar = (evento: EventoDeTeclado<HTMLInputElement>) => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      if (!aberto) setAberto(true);
      else if (opcoes.length > 0) setAtiva((atual) => (atual + 1) % opcoes.length);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      if (aberto && opcoes.length > 0) setAtiva((atual) => (atual - 1 + opcoes.length) % opcoes.length);
    } else if (evento.key === "Enter") {
      if (aberto) {
        evento.preventDefault();
        const opcao = opcoes[ativa];
        if (opcao) escolher(opcao);
      }
    } else if (evento.key === "Escape") {
      if (aberto) {
        evento.preventDefault();
        evento.stopPropagation();
        setAberto(false);
      }
    } else if (evento.key === "Tab") {
      setAberto(false);
    }
  };

  const descricao = [erro ? idErro : undefined, ajuda ? idAjuda : undefined].filter((v) => v !== undefined).join(" ");
  const idDaOpcaoAtiva = aberto && ativa >= 0 ? `${id}-opcao-${ativa}` : undefined;

  return (
    <div className={largo ? "campo campo--largo" : "campo"}>
      <label className={semRotulo ? "sr-only" : "form-label"} htmlFor={id}>
        {rotulo}
        {obrigatorio && !semRotulo ? (
          <span className="campo-obrigatorio" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <div className="seletor-busca">
        <input
          id={id}
          className="input"
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={idDaOpcaoAtiva}
          aria-invalid={erro !== undefined}
          aria-describedby={descricao === "" ? undefined : descricao}
          aria-required={obrigatorio ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          placeholder={placeholder}
          value={texto}
          disabled={desabilitado}
          onChange={(evento) => {
            const digitado = evento.target.value;
            setTexto(digitado);
            setConsulta(digitado.trim());
            setAberto(true);
            if (valor !== "") {
              editando.current = true;
              aoMudar("", "");
            }
          }}
          onFocus={() => {
            setConsulta(valor === "" ? texto.trim() : "");
            setAberto(true);
          }}
          onBlur={() => setAberto(false)}
          onKeyDown={aoTeclar}
        />
        {texto !== "" && !desabilitado ? (
          <button type="button" className="seletor-busca-limpar" onMouseDown={(evento) => evento.preventDefault()} onClick={limpar} aria-label={`Limpar ${rotulo}`}>
            <Icone nome="x" />
          </button>
        ) : null}
        {aberto ? (
          <ul id={idLista} role="listbox" aria-label={rotulo} className="seletor-busca-lista">
            {opcoes.map((opcao, indice) => (
              <li
                key={opcao.valor}
                id={`${id}-opcao-${indice}`}
                role="option"
                aria-selected={opcao.valor === valor}
                className={indice === ativa ? "seletor-busca-opcao seletor-busca-opcao--ativa" : "seletor-busca-opcao"}
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  escolher(opcao);
                }}
                onMouseEnter={() => setAtiva(indice)}
              >
                {opcao.rotulo}
              </li>
            ))}
            {situacao === "carregando" ? <li className="seletor-busca-aviso" role="presentation">Buscando…</li> : null}
            {situacao === "erro" ? <li className="seletor-busca-aviso seletor-busca-aviso--erro" role="presentation">Não foi possível buscar. Tente de novo.</li> : null}
            {situacao === "ocioso" && opcoes.length === 0 ? <li className="seletor-busca-aviso" role="presentation">Nenhum resultado</li> : null}
          </ul>
        ) : null}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {aberto && situacao === "ocioso" ? `${opcoes.length} resultados` : ""}
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
