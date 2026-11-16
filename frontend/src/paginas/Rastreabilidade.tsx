import { useEffect, useRef, useState, type FormEvent } from "react";
import { rastrear, type AlvoDaRastreabilidade } from "../api/analise.ts";
import { mensagemDoErro } from "../api/erros.ts";
import { buscarLotePorEtiqueta } from "../api/lotes.ts";
import type { EventoDaLinhaDoTempo, Lote, PosicaoDoEvento, TipoMovimentacao } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { Badge, type TomDeBadge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { CarregarMais } from "../componentes/CarregarMais.tsx";
import { EstadoDeErro, EstadoVazio } from "../componentes/Estados.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { useListaComCursor } from "../hooks/useListaComCursor.ts";
import { normalizarCodigoLido } from "../leitor/captura.ts";
import { IndicadorDeLeitura } from "../leitor/IndicadorDeLeitura.tsx";
import { useLeitor } from "../leitor/useLeitor.ts";
import { formatarDataHora, formatarDia } from "../util/datas.ts";
import { formatarQuantidade } from "../util/decimal.ts";
import { ROTULOS_DOS_TIPOS } from "../util/grafico.ts";
import { contemNul } from "../util/formularios.ts";
import { alteraSaldo } from "../util/linhaDoTempo.ts";
import { criarVigencia } from "../util/vigencia.ts";
import { ROTULOS_DE_ETIQUETA, ROTULOS_DE_STATUS, TONS_DE_STATUS, rotuloDaLocalizacao } from "./lotes/apresentacao.ts";
import "../estilos/analise.css";

const TONS: Record<TipoMovimentacao, TomDeBadge> = { entrada: "sucesso", saida: "perigo", transferencia: "info", ajuste: "alerta", inventario: "admin" };

function posicao(local: PosicaoDoEvento | null): string {
  return local ? rotuloDaLocalizacao(local) : "—";
}

function Evento({ evento, unidade }: { evento: EventoDaLinhaDoTempo; unidade: string }) {
  const informativo = !alteraSaldo(evento);
  return (
    <li className={informativo ? "linha-do-tempo-item linha-do-tempo-item--informativo" : "linha-do-tempo-item"}>
      <span className="linha-do-tempo-ponto" aria-hidden="true" />
      <div className="linha-do-tempo-corpo">
        <div className="linha-do-tempo-topo">
          <Badge tom={TONS[evento.tipo_movimentacao]} ponto>
            {ROTULOS_DOS_TIPOS[evento.tipo_movimentacao]}
          </Badge>
          {evento.status_movimentacao !== "concluida" ? <Badge tom={evento.status_movimentacao === "pendente" ? "alerta" : "neutro"}>{evento.status_movimentacao === "pendente" ? "Pendente" : "Cancelada"}</Badge> : null}
          <span className="celula-secundaria">{formatarDataHora(evento.data_movimentacao)}</span>
          <span className="celula-secundaria">por {evento.usuario.nome}</span>
        </div>
        {evento.tipo_movimentacao === "inventario" ? (
          <p className="linha-do-tempo-linha">
            Contagem de {formatarQuantidade(evento.quantidade)} {unidade} sobre o saldo registrado de {formatarQuantidade(evento.saldo_anterior)} {unidade}. <strong>Informativo: a contagem não altera o saldo.</strong>
          </p>
        ) : evento.tipo_movimentacao === "transferencia" ? (
          <p className="linha-do-tempo-linha">
            {posicao(evento.origem)} → {posicao(evento.destino)}. Saldo mantido em <strong>{formatarQuantidade(evento.saldo_posterior)} {unidade}</strong>.
          </p>
        ) : (
          <p className="linha-do-tempo-linha">
            {evento.tipo_movimentacao === "ajuste" ? "Saldo ajustado" : `${formatarQuantidade(evento.quantidade)} ${unidade}`}
            {": "}
            {formatarQuantidade(evento.saldo_anterior)} → <strong>{formatarQuantidade(evento.saldo_posterior)} {unidade}</strong>
            {informativo ? " (não aplicada ao saldo)" : ""}
          </p>
        )}
        {evento.motivo_movimentacao ? <p className="celula-secundaria">Motivo: {evento.motivo_movimentacao}</p> : null}
        {evento.observacao ? <p className="celula-secundaria">Observação: {evento.observacao}</p> : null}
      </div>
    </li>
  );
}

function DadosDoLote({ lote }: { lote: Lote }) {
  const unidade = lote.produto.unidade_medida;
  return (
    <div className="rastreabilidade-lote">
      <div className="resumo-lote-topo">
        <div>
          <div className="resumo-lote-numero">{lote.numero_lote}</div>
          <div className="celula-secundaria">{lote.produto.nome}</div>
        </div>
        <Badge tom={TONS_DE_STATUS[lote.status_lote]} ponto>
          {ROTULOS_DE_STATUS[lote.status_lote]}
        </Badge>
      </div>
      <dl className="rastreabilidade-dados">
        <div>
          <dt>Saldo atual do lote</dt>
          <dd className="rastreabilidade-saldo">
            {formatarQuantidade(lote.quantidade)} {unidade}
          </dd>
        </div>
        <div>
          <dt>Localização</dt>
          <dd className="codigo">{rotuloDaLocalizacao(lote.localizacao)}</dd>
        </div>
        <div>
          <dt>Fabricação</dt>
          <dd>{formatarDia(lote.data_fabricacao)}</dd>
        </div>
        <div>
          <dt>Validade</dt>
          <dd>{formatarDia(lote.data_validade)}</dd>
        </div>
        <div>
          <dt>Etiqueta</dt>
          <dd className="codigo">{lote.identificacao ? `${ROTULOS_DE_ETIQUETA[lote.identificacao.tipo_identificacao]} ${lote.identificacao.codigo}` : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function Rastreabilidade() {
  const { cliente } = useAutenticacao();
  const { mostrar } = useAvisos();
  const [numero, setNumero] = useState("");
  const [erroDoCampo, setErroDoCampo] = useState<string | undefined>(undefined);
  const [alvo, setAlvo] = useState<AlvoDaRastreabilidade | null>(null);
  const [lote, setLote] = useState<Lote | null>(null);
  const vigencia = useRef(criarVigencia());

  useEffect(() => {
    const atual = vigencia.current;
    return () => atual.invalidar();
  }, []);

  const chave = alvo === null ? "" : alvo.tipo === "numero" ? `n:${alvo.valor}` : `i:${alvo.valor}`;
  const lista = useListaComCursor(
    async (cursor, sinal) => {
      if (alvo === null) return { dados: [], proximo: null, total: 0 };
      const resposta = await rastrear(cliente, alvo, cursor, sinal);
      setLote(resposta.lote);
      return { dados: resposta.linha_do_tempo, proximo: resposta.proximo_depois_de_id, total: resposta.total };
    },
    chave,
    alvo !== null,
  );

  const buscarPorNumero = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const limpo = numero.trim();
    if (limpo === "") return setErroDoCampo("Informe o número do lote.");
    if (limpo.length > 50) return setErroDoCampo("O número do lote deve ter até 50 caracteres.");
    if (contemNul(limpo)) return setErroDoCampo("O número do lote contém caractere inválido.");
    setErroDoCampo(undefined);
    vigencia.current.invalidar();
    setLote(null);
    setAlvo({ tipo: "numero", valor: limpo });
  };

  const procurarPorEtiqueta = async (codigoBruto: string) => {
    const codigo = normalizarCodigoLido(codigoBruto);
    if (codigo === null) return mostrar("erro", "Código inválido", "A etiqueta deve ter de 1 a 128 caracteres, sem caracteres de controle.");
    const pedido = vigencia.current.iniciar();
    try {
      const encontrado = await buscarLotePorEtiqueta(cliente, codigo, pedido.sinal);
      if (!pedido.vigente()) return;
      if (encontrado === null) return mostrar("info", "Etiqueta sem lote", codigo.length > 40 ? `${codigo.slice(0, 40)}…` : codigo);
      setNumero(encontrado.numero_lote);
      setLote(null);
      setAlvo({ tipo: "id", valor: encontrado.id_lote });
    } catch (falha) {
      if (pedido.vigente()) mostrar("erro", "Não foi possível buscar a etiqueta", mensagemDoErro(falha));
    }
  };

  const leitor = useLeitor((leitura) => {
    void procurarPorEtiqueta(leitura.codigo);
  });

  const naoEncontrado = lista.erro !== null && lista.itens.length === 0;

  return (
    <>
      <CabecalhoDePagina titulo="Rastreabilidade do lote" resumo={[{ texto: "Linha do tempo em ordem cronológica, da primeira à última movimentação" }]} acoes={<IndicadorDeLeitura leitor={leitor} />} />

      <section className="cartao" aria-label="Busca do lote">
        <form className="rastreabilidade-busca" onSubmit={buscarPorNumero} noValidate>
          <div className="campo">
            <label className="form-label" htmlFor="rastreabilidade-numero">
              Número do lote
            </label>
            <input
              id="rastreabilidade-numero"
              className="input"
              value={numero}
              maxLength={50}
              autoComplete="off"
              placeholder="Digite o número exato ou leia a etiqueta"
              aria-invalid={erroDoCampo !== undefined}
              aria-describedby={erroDoCampo ? "rastreabilidade-erro" : undefined}
              onChange={(e) => {
                setNumero(e.target.value);
                setErroDoCampo(undefined);
              }}
            />
            {erroDoCampo ? (
              <div id="rastreabilidade-erro" className="form-error" role="alert">
                <Icone nome="alert-triangle" />
                <span>{erroDoCampo}</span>
              </div>
            ) : null}
          </div>
          <button type="submit" className="btn btn-primary">
            <Icone nome="scan" />
            Rastrear
          </button>
        </form>
      </section>

      {alvo === null ? (
        <div className="estado-vazio rastreabilidade-vazio">
          <strong>Nenhum lote selecionado</strong>
          <span>Informe o número do lote ou leia a etiqueta para ver todo o histórico dele.</span>
        </div>
      ) : naoEncontrado ? (
        <div className="cartao">
          <EstadoDeErro mensagem={lista.erro ?? ""} aoTentarNovamente={lista.recarregar} />
        </div>
      ) : (
        <div className="rastreabilidade-grade">
          <section className="cartao" aria-label="Dados do lote">
            <div className="cartao-corpo">{lote ? <DadosDoLote lote={lote} /> : <span className="esqueleto" />}</div>
          </section>
          <section className="cartao" aria-label="Linha do tempo">
            <div className="cartao-cabecalho">
              <h2>Linha do tempo</h2>
            </div>
            <div className="cartao-corpo">
              {lista.carregando && lista.itens.length === 0 ? (
                <span className="esqueleto" />
              ) : lista.itens.length === 0 ? (
                <EstadoVazio titulo="Lote sem movimentações" descricao="Este lote ainda não tem nenhuma movimentação registrada." />
              ) : (
                <ol className="linha-do-tempo" aria-label="Eventos do lote em ordem cronológica">
                  {lista.itens.map((evento) => (
                    <Evento key={evento.id_movimentacao} evento={evento} unidade={lote?.produto.unidade_medida ?? ""} />
                  ))}
                </ol>
              )}
            </div>
            <CarregarMais exibidos={lista.itens.length} total={lista.total} haMais={lista.haMais} carregando={lista.carregando && lista.itens.length > 0} erro={lista.erro} aoCarregarMais={lista.carregarMais} />
          </section>
        </div>
      )}
    </>
  );
}
