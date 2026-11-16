import { useEffect, useMemo, useRef, useState } from "react";
import { exportarAlertasDeVencimento, listarAlertasDeVencimento } from "../api/dashboard.ts";
import type { AlertaDeVencimento } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { Paginacao } from "../componentes/Paginacao.tsx";
import { Tabela, type Coluna } from "../componentes/Tabela.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { podeExecutar } from "../sessao/permissoes.ts";
import { compararDecimais, formatarInteiro, formatarQuantidade } from "../util/decimal.ts";
import { compararDias, formatarDia } from "../util/datas.ts";
import { baixarArquivo } from "../util/download.ts";
import { criarEnvioUnico } from "../util/envio.ts";
import { NOME_PADRAO_DO_CSV, mensagemDaExportacao } from "../util/exportacao.ts";
import { compararTexto } from "../util/ordenacao.ts";
import { paginaCorrigida } from "../util/paginacao.ts";
import { criarVigencia } from "../util/vigencia.ts";
import { textoDoPrazo, tomDoPrazo } from "./vencimentos/prazo.ts";

const LIMITE = 20;

export function Vencimentos() {
  const { cliente, sessao } = useAutenticacao();
  const { mostrar } = useAvisos();
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(false);
  const envio = useRef(criarEnvioUnico());
  const vigencia = useRef(criarVigencia());
  const podeExportar = podeExecutar(sessao?.usuario.perfil ?? null, "exportar_vencimentos");

  useEffect(() => {
    const atual = vigencia.current;
    return () => atual.invalidar();
  }, []);

  const lista = useCarregar((sinal) => listarAlertasDeVencimento(cliente, pagina, LIMITE, sinal), [cliente, pagina]);

  const totalDaLista = lista.dados?.total;
  const vaziaNaPagina = lista.dados !== null && lista.dados.dados.length === 0;
  useEffect(() => {
    if (totalDaLista === undefined || !vaziaNaPagina || pagina <= 1) return;
    const valida = paginaCorrigida(pagina, totalDaLista, LIMITE);
    if (valida !== pagina) setPagina(valida);
  }, [totalDaLista, vaziaNaPagina, pagina]);

  const exportar = () => {
    if (envio.current.ocupado()) return;
    const pedido = vigencia.current.iniciar();
    const execucao = envio.current.executar(() => exportarAlertasDeVencimento(cliente, pedido.sinal));
    if (execucao === null) return;
    setExportando(true);
    execucao.then(
      (arquivo) => {
        setExportando(false);
        if (!pedido.vigente()) return;
        baixarArquivo(arquivo.blob, arquivo.nomeDoArquivo ?? NOME_PADRAO_DO_CSV);
        mostrar("sucesso", "Exportação concluída", arquivo.nomeDoArquivo ?? NOME_PADRAO_DO_CSV);
      },
      (erro: unknown) => {
        setExportando(false);
        if (!pedido.vigente()) return;
        const mensagem = mensagemDaExportacao(erro);
        if (mensagem !== null) mostrar("erro", "Não foi possível exportar", mensagem);
      },
    );
  };

  const colunas = useMemo<Coluna<AlertaDeVencimento>[]>(
    () => [
      { id: "lote", titulo: "Lote", mono: true, comparar: (a, b) => compararTexto(a.numero_lote, b.numero_lote), render: (alerta) => alerta.numero_lote },
      { id: "produto", titulo: "Produto", comparar: (a, b) => compararTexto(a.produto, b.produto), render: (alerta) => <span className="celula-truncada">{alerta.produto}</span> },
      {
        id: "validade",
        titulo: "Validade",
        comparar: (a, b) => compararDias(a.data_validade, b.data_validade),
        render: (alerta) => (
          <>
            {formatarDia(alerta.data_validade)}{" "}
            <Badge tom={tomDoPrazo(alerta.dias_restantes)} ponto>
              {textoDoPrazo(alerta.dias_restantes)}
            </Badge>
          </>
        ),
      },
      {
        id: "saldo",
        titulo: "Saldo",
        alinhar: "num",
        comparar: (a, b) => compararDecimais(a.quantidade, b.quantidade),
        render: (alerta) => `${formatarQuantidade(alerta.quantidade)} ${alerta.unidade_medida}`,
      },
      {
        id: "localizacao",
        titulo: "Localização",
        mono: true,
        comparar: (a, b) => compararTexto(`${a.corredor}-${a.nivel}-${a.posicao}`, `${b.corredor}-${b.nivel}-${b.posicao}`),
        render: (alerta) => `${alerta.corredor}-${alerta.nivel}-${alerta.posicao}`,
      },
    ],
    [],
  );

  return (
    <>
      <CabecalhoDePagina
        titulo="Vencimentos"
        resumo={[
          { texto: lista.dados ? <><strong>{formatarInteiro(lista.dados.total)}</strong> lote(s) vencem nos próximos 30 dias</> : "Carregando…", tom: lista.dados && lista.dados.total > 0 ? "alerta" : undefined },
          { texto: "Somente lotes ativos, ordenados pela validade" },
        ]}
        acoes={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={lista.recarregar} disabled={lista.carregando}>
              <Icone nome="refresh" />
              Atualizar
            </button>
            {podeExportar ? (
              <button type="button" className="btn btn-primary" onClick={exportar} disabled={exportando} aria-busy={exportando}>
                {exportando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="download" />}
                {exportando ? "Exportando…" : "Exportar CSV"}
              </button>
            ) : null}
          </>
        }
      />

      <section className="cartao" aria-label="Lotes a vencer">
        <Tabela
          rotulo="Lotes a vencer"
          colunas={colunas}
          linhas={lista.dados?.dados ?? []}
          chave={(alerta) => alerta.id_lote}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          vazio={{ titulo: "Nenhum lote vence nos próximos 30 dias", descricao: "Os lotes ativos com validade na janela aparecem aqui." }}
        />
        {lista.dados ? <Paginacao pagina={lista.dados.pagina} limite={lista.dados.limite} total={lista.dados.total} carregando={lista.carregando} aoMudar={setPagina} /> : null}
      </section>
    </>
  );
}
