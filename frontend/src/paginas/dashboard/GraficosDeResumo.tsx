import { useId, type CSSProperties } from "react";
import type { LotesPorSituacao, MovimentacaoDoHistorico, ProdutoMovimentado, SaldoDeCategoria } from "../../api/tipos.ts";
import { Badge, type TomDeBadge } from "../../componentes/Badge.tsx";
import { formatarDataHoraUtc } from "../../util/datas.ts";
import { formatarInteiro, formatarQuantidade } from "../../util/decimal.ts";
import type { DiaDoGrafico } from "../../util/grafico.ts";
import { ROTULOS_DOS_TIPOS, maximoDaEscala } from "../../util/grafico.ts";
import { cortarTexto, fatiasDaRosca, larguraRelativa, paraGeometria, pontosDaLinha } from "../../util/resumo.ts";

const RAIO = 70;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export function RoscaDeLotes({ situacao }: { situacao: LotesPorSituacao }) {
  const idTitulo = useId();
  const idDescricao = useId();
  const { fatias, total } = fatiasDaRosca(situacao, CIRCUNFERENCIA);
  const descricao = `${formatarInteiro(total)} lotes: ${fatias.map((f) => `${f.rotulo.toLowerCase()} ${formatarInteiro(f.valor)}`).join(", ")}.`;
  return (
    <div className="rosca">
      <svg className="rosca-svg" viewBox="0 0 200 200" role="img" aria-labelledby={`${idTitulo} ${idDescricao}`}>
        <title id={idTitulo}>Lotes por situação</title>
        <desc id={idDescricao}>{descricao}</desc>
        <circle className="rosca-trilho" cx="100" cy="100" r={RAIO} />
        <g transform="rotate(-90 100 100)">
          {fatias.map((fatia, indice) =>
            fatia.valor === 0 ? null : (
              <circle
                key={fatia.chave}
                className={`rosca-fatia rosca-fatia--${fatia.chave}`}
                cx="100"
                cy="100"
                r={RAIO}
                pathLength={CIRCUNFERENCIA}
                strokeDasharray={`${Math.max(0, fatia.comprimento - 2)} ${CIRCUNFERENCIA}`}
                strokeDashoffset={-fatia.deslocamento}
                style={{ "--i": indice } as CSSProperties}
              >
                <title>{`${fatia.rotulo}: ${formatarInteiro(fatia.valor)}`}</title>
              </circle>
            ),
          )}
        </g>
        <text className="rosca-total" x="100" y="100" textAnchor="middle">
          {formatarInteiro(total)}
        </text>
        <text className="rosca-rotulo" x="100" y="120" textAnchor="middle">
          lotes
        </text>
      </svg>
      <ul className="rosca-legenda">
        {fatias.map((fatia) => (
          <li key={fatia.chave}>
            <span className={`rosca-amostra rosca-fatia--${fatia.chave}`} aria-hidden="true" />
            <span className="rosca-legenda-rotulo">{fatia.rotulo}</span>
            <strong>{formatarInteiro(fatia.valor)}</strong>
            <span className="celula-secundaria">{total === 0 ? "0%" : `${Math.round(fatia.fracao * 100)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ItemDeBarra = { chave: string; rotulo: string; valor: number; texto: string };

function BarrasHorizontais({ titulo, descricao, itens }: { titulo: string; descricao: string; itens: readonly ItemDeBarra[] }) {
  const idTitulo = useId();
  const idDescricao = useId();
  const linha = 34;
  const altura = itens.length * linha + 6;
  const maximo = Math.max(0, ...itens.map((item) => item.valor));
  return (
    <svg className="barras-svg" viewBox={`0 0 480 ${altura}`} role="img" aria-labelledby={`${idTitulo} ${idDescricao}`} preserveAspectRatio="xMidYMin meet">
      <title id={idTitulo}>{titulo}</title>
      <desc id={idDescricao}>{descricao}</desc>
      {itens.map((item, indice) => {
        const topo = indice * linha + 4;
        const largura = 230 * larguraRelativa(item.valor, maximo);
        return (
          <g key={item.chave} style={{ "--i": indice } as CSSProperties}>
            <text className="barras-rotulo" x="0" y={topo + 14}>
              {cortarTexto(item.rotulo, 24)}
              <title>{item.rotulo}</title>
            </text>
            <rect className="barras-trilho" x="170" y={topo + 3} width="230" height="14" rx="4" />
            <rect className="barras-barra" x="170" y={topo + 3} width={Math.max(2, largura)} height="14" rx="4">
              <title>{`${item.rotulo}: ${item.texto}`}</title>
            </rect>
            <text className="barras-valor" x="408" y={topo + 14}>
              {item.texto}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function BarrasDeCategoria({ categorias }: { categorias: readonly SaldoDeCategoria[] }) {
  const itens = categorias.map((categoria) => ({ chave: categoria.categoria, rotulo: categoria.categoria, valor: paraGeometria(categoria.saldo_kg), texto: `${formatarQuantidade(categoria.saldo_kg)} kg` }));
  return <BarrasHorizontais titulo="Saldo por categoria" descricao={`Saldo ativo em quilos: ${itens.map((i) => `${i.rotulo} ${i.texto}`).join("; ")}.`} itens={itens} />;
}

export function BarrasDeProdutos({ produtos }: { produtos: readonly ProdutoMovimentado[] }) {
  const itens = produtos.map((produto) => ({ chave: String(produto.id_produto), rotulo: produto.nome, valor: produto.movimentacoes, texto: `${formatarInteiro(produto.movimentacoes)} mov.` }));
  return <BarrasHorizontais titulo="Produtos mais movimentados" descricao={`Entradas e saídas em 30 dias: ${itens.map((i) => `${i.rotulo} ${i.texto}`).join("; ")}.`} itens={itens} />;
}

const LARGURA = 720;
const ALTURA = 190;
const MARGEM = { esquerda: 36, direita: 10, topo: 10, base: 22 };

export function LinhaDeFluxo({ dias }: { dias: readonly DiaDoGrafico[] }) {
  const idTitulo = useId();
  const idDescricao = useId();
  const entradas = dias.map((dia) => dia.valores.entrada);
  const saidas = dias.map((dia) => dia.valores.saida);
  const escala = maximoDaEscala(Math.max(0, ...entradas, ...saidas));
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base;
  const totalEntradas = entradas.reduce((soma, valor) => soma + valor, 0);
  const totalSaidas = saidas.reduce((soma, valor) => soma + valor, 0);
  return (
    <div className="grafico">
      <svg className="grafico-svg" viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-labelledby={`${idTitulo} ${idDescricao}`} preserveAspectRatio="xMidYMid meet">
        <title id={idTitulo}>Entradas contra saídas por dia</title>
        <desc id={idDescricao}>{`Em ${dias.length} dias: ${formatarInteiro(totalEntradas)} entradas e ${formatarInteiro(totalSaidas)} saídas concluídas.`}</desc>
        {[0, 0.5, 1].map((fracao) => {
          const y = MARGEM.topo + alturaUtil - fracao * alturaUtil;
          return (
            <g key={fracao}>
              <line className="grafico-grade" x1={MARGEM.esquerda} x2={LARGURA - MARGEM.direita} y1={y} y2={y} />
              <text className="grafico-rotulo" x={MARGEM.esquerda - 6} y={y + 4} textAnchor="end">
                {formatarInteiro(Math.round(escala * fracao))}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${MARGEM.esquerda} ${MARGEM.topo})`}>
          <polyline className="linha-fluxo linha-fluxo--entrada" pathLength={1} points={pontosDaLinha(entradas, larguraUtil, alturaUtil, escala)} />
          <polyline className="linha-fluxo linha-fluxo--saida" pathLength={1} points={pontosDaLinha(saidas, larguraUtil, alturaUtil, escala)} />
        </g>
      </svg>
      <ul className="grafico-legenda" aria-label="Legenda das linhas">
        <li>
          <span className="grafico-amostra grafico-barra--entrada" aria-hidden="true" />
          {ROTULOS_DOS_TIPOS.entrada}: {formatarInteiro(totalEntradas)}
        </li>
        <li>
          <span className="grafico-amostra grafico-barra--saida" aria-hidden="true" />
          {ROTULOS_DOS_TIPOS.saida}: {formatarInteiro(totalSaidas)}
        </li>
      </ul>
    </div>
  );
}

const TONS: Record<string, TomDeBadge> = { entrada: "sucesso", saida: "perigo", transferencia: "info", ajuste: "alerta", inventario: "admin" };

export function AtividadeRecente({ movimentacoes }: { movimentacoes: readonly MovimentacaoDoHistorico[] }) {
  return (
    <ul className="atividade" aria-label="Últimas movimentações">
      {movimentacoes.map((movimentacao, indice) => (
        <li key={movimentacao.id_movimentacao} className="atividade-item" style={{ "--i": indice } as CSSProperties}>
          <Badge tom={TONS[movimentacao.tipo_movimentacao] ?? "neutro"} ponto>
            {ROTULOS_DOS_TIPOS[movimentacao.tipo_movimentacao]}
          </Badge>
          <div className="atividade-corpo">
            <span className="codigo">{movimentacao.numero_lote}</span>
            <span className="celula-secundaria">
              {movimentacao.tipo_movimentacao === "transferencia" ? "mudou de posição" : `${formatarQuantidade(movimentacao.quantidade)} · saldo ${formatarQuantidade(movimentacao.saldo_posterior)}`}
            </span>
          </div>
          <div className="atividade-meta">
            <span className="celula-truncada">{movimentacao.nome_usuario}</span>
            <span className="celula-secundaria">{formatarDataHoraUtc(movimentacao.data_movimentacao)} UTC</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
