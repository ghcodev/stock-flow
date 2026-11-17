import { useEffect, useId, useMemo, useState, type KeyboardEvent as EventoDeTeclado } from "react";
import { useNavigate } from "react-router";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { menuDoPerfil } from "../sessao/navegacao.ts";
import { atalhoDaPaleta, filtrarComandos, type ComandoDeTela } from "../util/paleta.ts";
import "../estilos/paleta.css";
import { Icone } from "./Icone.tsx";
import { Modal } from "./Modal.tsx";

type Propriedades = { aberta: boolean; aoAlterar: (aberta: boolean) => void };

export function PaletaDeComandos({ aberta, aoAlterar }: Propriedades) {
  const { sessao } = useAutenticacao();
  const navegar = useNavigate();
  const idLista = useId();
  const [texto, setTexto] = useState("");
  const [ativo, setAtivo] = useState(0);

  const comandos = useMemo<ComandoDeTela[]>(
    () => menuDoPerfil(sessao?.usuario.perfil ?? null).flatMap((grupo) => grupo.itens.map((item) => ({ rotulo: item.rotulo, caminho: item.caminho, grupo: grupo.rotulo }))),
    [sessao],
  );
  const resultados = useMemo(() => filtrarComandos(comandos, texto), [comandos, texto]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (!atalhoDaPaleta(evento)) return;
      evento.preventDefault();
      aoAlterar(!aberta);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberta, aoAlterar]);

  useEffect(() => {
    if (aberta) {
      setTexto("");
      setAtivo(0);
    }
  }, [aberta]);

  const ir = (comando: ComandoDeTela | undefined) => {
    if (!comando) return;
    aoAlterar(false);
    navegar(comando.caminho);
  };

  const aoTeclarNoCampo = (evento: EventoDeTeclado<HTMLInputElement>) => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAtivo((atual) => (resultados.length === 0 ? 0 : (atual + 1) % resultados.length));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAtivo((atual) => (resultados.length === 0 ? 0 : (atual - 1 + resultados.length) % resultados.length));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      ir(resultados[ativo]);
    }
  };

  return (
    <Modal aberto={aberta} titulo="Ir para uma tela" aoFechar={() => aoAlterar(false)}>
      <div className="paleta">
        <div className="paleta-campo">
          <Icone nome="search" />
          <input
            className="input"
            role="combobox"
            aria-expanded="true"
            aria-controls={idLista}
            aria-activedescendant={resultados[ativo] ? `${idLista}-${ativo}` : undefined}
            aria-label="Buscar tela pelo nome"
            placeholder="Digite o nome da tela…"
            autoComplete="off"
            spellCheck={false}
            value={texto}
            data-foco-inicial=""
            onChange={(evento) => {
              setTexto(evento.target.value);
              setAtivo(0);
            }}
            onKeyDown={aoTeclarNoCampo}
          />
        </div>
        <ul id={idLista} className="paleta-lista" role="listbox" aria-label="Telas">
          {resultados.map((comando, indice) => (
            <li
              key={comando.caminho}
              id={`${idLista}-${indice}`}
              role="option"
              aria-selected={indice === ativo}
              className={indice === ativo ? "paleta-item paleta-item--ativo" : "paleta-item"}
              onMouseEnter={() => setAtivo(indice)}
              onClick={() => ir(comando)}
            >
              <span>{comando.rotulo}</span>
              <span className="celula-secundaria">{comando.grupo}</span>
            </li>
          ))}
          {resultados.length === 0 ? <li className="paleta-vazio">Nenhuma tela encontrada</li> : null}
        </ul>
        <p className="campo-ajuda">Setas para escolher, Enter para abrir, Esc para fechar. Atalho: Ctrl+K.</p>
      </div>
    </Modal>
  );
}
