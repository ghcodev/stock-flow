import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { listarMapa, type PosicaoDoMapa } from "../api/mapa.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { CampoDeTexto } from "../componentes/Campo.tsx";
import { EstadoDeErro, EstadoVazio } from "../componentes/Estados.tsx";
import { Gaveta } from "../componentes/Gaveta.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { Paginacao } from "../componentes/Paginacao.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { formatarInteiro, formatarQuantidade } from "../util/decimal.ts";
import { ligacaoParaLotesDaLocalizacao } from "../util/filtroDeUrl.ts";
import { agruparPorCorredorENivel, haMaisLotesQueOsListados, textoDaCapacidade, validarCorredor } from "../util/mapa.ts";
import { paginaCorrigida } from "../util/paginacao.ts";
import { ROTULOS_DE_STATUS, TONS_DE_STATUS, rotuloDaLocalizacao } from "./lotes/apresentacao.ts";
import "../estilos/dashboard.css";
import "../estilos/mapa.css";

const LIMITE = 60;

function DetalheDaPosicao({ posicao, aoFechar }: { posicao: PosicaoDoMapa; aoFechar: () => void }) {
  const rotulo = rotuloDaLocalizacao(posicao);
  const capacidade = textoDaCapacidade(posicao.capacidade);
  return (
    <Gaveta aberta titulo={`Posição ${rotulo}`} subtitulo={`Corredor ${posicao.corredor} · Nível ${posicao.nivel}`} aoFechar={aoFechar}>
      <div className="detalhes-grupo">
        <div>
          <div className="detalhe-rotulo">Lotes na posição</div>
          <div className="detalhe-valor">{formatarInteiro(posicao.total_lotes)}</div>
        </div>
        {capacidade ? (
          <div>
            <div className="detalhe-rotulo">Capacidade</div>
            <div className="detalhe-valor">{capacidade}</div>
          </div>
        ) : null}
        {posicao.descricao ? (
          <div>
            <div className="detalhe-rotulo">Descrição</div>
            <div className="detalhe-valor">{posicao.descricao}</div>
          </div>
        ) : null}
      </div>
      {posicao.lotes.length === 0 ? (
        <EstadoVazio titulo="Posição vazia" descricao="Nenhum lote com saldo está armazenado aqui." />
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela tabela--compacta" aria-label={`Lotes na posição ${rotulo}`}>
            <thead>
              <tr>
                <th scope="col">Lote</th>
                <th scope="col">Produto</th>
                <th scope="col" className="num">
                  Quantidade
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {posicao.lotes.map((lote) => (
                <tr key={lote.id_lote}>
                  <td className="mono">{lote.numero_lote}</td>
                  <td className="celula-truncada">{lote.produto}</td>
                  <td className="num">
                    {formatarQuantidade(lote.quantidade)} {lote.unidade_medida}
                  </td>
                  <td>
                    <Badge tom={TONS_DE_STATUS[lote.status_lote]} ponto>
                      {ROTULOS_DE_STATUS[lote.status_lote]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {haMaisLotesQueOsListados(posicao) ? (
        <p className="bloco-nota">
          Mostrando {formatarInteiro(posicao.lotes.length)} de {formatarInteiro(posicao.total_lotes)} lotes.{" "}
          <Link to={ligacaoParaLotesDaLocalizacao(posicao.id_localizacao, rotulo)}>Ver todos em Lotes</Link>
        </p>
      ) : null}
    </Gaveta>
  );
}

export function Mapa() {
  const { cliente } = useAutenticacao();
  const [rascunho, setRascunho] = useState("");
  const [corredor, setCorredor] = useState("");
  const [erro, setErro] = useState<string | undefined>(undefined);
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<number | null>(null);

  const lista = useCarregar((sinal) => listarMapa(cliente, corredor, pagina, LIMITE, sinal), [cliente, corredor, pagina]);
  const posicoes = lista.dados?.dados ?? [];
  const grupos = useMemo(() => agruparPorCorredorENivel(posicoes), [posicoes]);
  const selecionada = aberta === null ? null : (posicoes.find((p) => p.id_localizacao === aberta) ?? null);

  const totalDaLista = lista.dados?.total;
  const vaziaNaPagina = lista.dados !== null && lista.dados.dados.length === 0;
  useEffect(() => {
    if (totalDaLista === undefined || !vaziaNaPagina || pagina <= 1) return;
    const valida = paginaCorrigida(pagina, totalDaLista, LIMITE);
    if (valida !== pagina) setPagina(valida);
  }, [totalDaLista, vaziaNaPagina, pagina]);

  const aplicar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const problema = validarCorredor(rascunho);
    setErro(problema ?? undefined);
    if (problema !== null) return;
    setAberta(null);
    setPagina(1);
    setCorredor(rascunho.trim());
  };

  return (
    <>
      <CabecalhoDePagina
        titulo="Mapa do Armazém"
        resumo={[
          { texto: lista.dados ? <><strong>{formatarInteiro(lista.dados.total)}</strong> posições{corredor ? ` no corredor ${corredor}` : ""}</> : "Carregando…" },
          { texto: "Somente lotes com saldo" },
        ]}
        acoes={
          <button type="button" className="btn btn-outline btn-sm" onClick={lista.recarregar} disabled={lista.carregando}>
            <Icone nome="refresh" />
            Atualizar
          </button>
        }
      />

      <section className="cartao" aria-label="Posições do armazém">
        <form className="mapa-filtro" onSubmit={aplicar} noValidate>
          <CampoDeTexto rotulo="Corredor" valor={rascunho} aoMudar={(valor) => { setRascunho(valor); setErro(undefined); }} erro={erro} tamanhoMaximo={10} placeholder="Ex.: A" />
          <button type="submit" className="btn btn-primary btn-sm">
            <Icone nome="filter" />
            Filtrar
          </button>
          {corredor !== "" ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setRascunho("");
                setCorredor("");
                setPagina(1);
                setAberta(null);
              }}
            >
              <Icone nome="x" />
              Limpar
            </button>
          ) : null}
        </form>

        {lista.erro && lista.dados === null ? (
          <EstadoDeErro mensagem={lista.erro} aoTentarNovamente={lista.recarregar} />
        ) : lista.dados === null ? (
          <div className="grafico-carregando">
            <span className="esqueleto" />
          </div>
        ) : grupos.length === 0 ? (
          <EstadoVazio titulo="Nenhuma posição encontrada" descricao={corredor ? "Revise o corredor informado." : "Cadastre localizações para montar o mapa."} />
        ) : (
          <div className="mapa-corpo" aria-busy={lista.carregando}>
            {grupos.map((grupo) => (
              <div key={grupo.corredor} className="mapa-corredor">
                <h2>Corredor {grupo.corredor}</h2>
                {grupo.niveis.map((nivel) => (
                  <div key={nivel.nivel} className="mapa-nivel">
                    <h3>Nível {nivel.nivel}</h3>
                    <ul className="mapa-posicoes">
                      {nivel.posicoes.map((posicao) => {
                        const capacidade = textoDaCapacidade(posicao.capacidade);
                        return (
                          <li key={posicao.id_localizacao}>
                            <button
                              type="button"
                              className={posicao.total_lotes > 0 ? "mapa-posicao mapa-posicao--ocupada" : "mapa-posicao"}
                              onClick={() => setAberta(posicao.id_localizacao)}
                              aria-label={`Posição ${rotuloDaLocalizacao(posicao)}, ${posicao.total_lotes === 0 ? "vazia" : `${posicao.total_lotes} lote(s)`}`}
                            >
                              <span className="mapa-posicao-codigo">{posicao.posicao}</span>
                              <span className="mapa-posicao-lotes">{posicao.total_lotes === 0 ? "vazia" : `${formatarInteiro(posicao.total_lotes)} lote(s)`}</span>
                              {capacidade ? <span className="mapa-posicao-capacidade">cap. {capacidade}</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {lista.dados ? <Paginacao pagina={lista.dados.pagina} limite={lista.dados.limite} total={lista.dados.total} carregando={lista.carregando} aoMudar={setPagina} /> : null}
      </section>

      {selecionada ? <DetalheDaPosicao posicao={selecionada} aoFechar={() => setAberta(null)} /> : null}
    </>
  );
}
