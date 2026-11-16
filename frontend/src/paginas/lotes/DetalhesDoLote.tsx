import { useState } from "react";
import { desbloquearLote } from "../../api/lotes.ts";
import type { Lote } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { Badge } from "../../componentes/Badge.tsx";
import { AvisoDoFormulario } from "../../componentes/Campo.tsx";
import { Gaveta } from "../../componentes/Gaveta.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { diaDeHoje, formatarDataHora, formatarDia } from "../../util/datas.ts";
import { formatarQuantidade } from "../../util/decimal.ts";
import { interpretarFalhaDeFormulario } from "../../util/formularios.ts";
import { ROTULOS_DE_ETIQUETA, ROTULOS_DE_STATUS, TONS_DE_STATUS, rotuloDaLocalizacao, situacaoDeValidade } from "./apresentacao.ts";

type Propriedades = {
  lote: Lote;
  aoFechar: () => void;
  aoBloquear: () => void;
  aoAssociarEtiqueta: () => void;
  aoDesbloquear: (lote: Lote) => void;
};

export function DetalhesDoLote({ lote, aoFechar, aoBloquear, aoAssociarEtiqueta, aoDesbloquear }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [desbloqueando, setDesbloqueando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const validade = situacaoDeValidade(lote, diaDeHoje());

  const desbloquear = async () => {
    if (desbloqueando) return;
    setDesbloqueando(true);
    setErro(null);
    try {
      aoDesbloquear(await desbloquearLote(cliente, lote.id_lote));
    } catch (falha) {
      setErro(interpretarFalhaDeFormulario(falha).geral);
    } finally {
      setDesbloqueando(false);
    }
  };

  return (
    <Gaveta
      aberta
      titulo={lote.numero_lote}
      subtitulo={`Lote #${lote.id_lote}`}
      aoFechar={aoFechar}
      larga
      rodape={
        <>
          {lote.identificacao === null ? (
            <button type="button" className="btn btn-outline" onClick={aoAssociarEtiqueta}>
              <Icone nome="tag" />
              Associar etiqueta
            </button>
          ) : null}
          {lote.status_lote === "bloqueado" ? (
            <button type="button" className="btn btn-primary" onClick={desbloquear} disabled={desbloqueando} aria-busy={desbloqueando}>
              {desbloqueando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="unlock" />}
              {desbloqueando ? "Desbloqueando…" : "Desbloquear"}
            </button>
          ) : null}
          {lote.status_lote === "ativo" ? (
            <button type="button" className="btn btn-perigo" onClick={aoBloquear}>
              <Icone nome="lock" />
              Bloquear
            </button>
          ) : null}
        </>
      }
    >
      <AvisoDoFormulario mensagem={erro} />
      <div className="detalhes">
        <div className="detalhes-grupo">
          <div className="detalhes-titulo">Situação</div>
          <div>
            <div className="detalhe-rotulo">Status</div>
            <div className="detalhe-valor">
              <Badge tom={TONS_DE_STATUS[lote.status_lote]} ponto>
                {ROTULOS_DE_STATUS[lote.status_lote]}
              </Badge>
            </div>
          </div>
          <div>
            <div className="detalhe-rotulo">Saldo atual</div>
            <div className="detalhe-valor">
              {formatarQuantidade(lote.quantidade)} {lote.produto.unidade_medida}
            </div>
          </div>
          {lote.status_lote === "bloqueado" ? (
            <>
              <div>
                <div className="detalhe-rotulo">Bloqueado em</div>
                <div className="detalhe-valor">{formatarDataHora(lote.data_bloqueio)}</div>
              </div>
              <div className="detalhe-valor--largo">
                <div className="detalhe-rotulo">Motivo do bloqueio</div>
                <div className="detalhe-valor">{lote.motivo_bloqueio ?? "—"}</div>
              </div>
            </>
          ) : null}
        </div>
        <div className="detalhes-grupo">
          <div className="detalhes-titulo">Produto e posição</div>
          <div>
            <div className="detalhe-rotulo">Produto</div>
            <div className="detalhe-valor">{lote.produto.nome}</div>
          </div>
          <div>
            <div className="detalhe-rotulo">Localização</div>
            <div className="detalhe-valor">{rotuloDaLocalizacao(lote.localizacao)}</div>
          </div>
        </div>
        <div className="detalhes-grupo">
          <div className="detalhes-titulo">Datas</div>
          <div>
            <div className="detalhe-rotulo">Fabricação</div>
            <div className="detalhe-valor">{formatarDia(lote.data_fabricacao)}</div>
          </div>
          <div>
            <div className="detalhe-rotulo">Validade</div>
            <div className="detalhe-valor">
              {formatarDia(lote.data_validade)}
              {validade ? <div className={validade.tom === "perigo" ? "celula-validade celula-validade--perigo" : "celula-validade celula-validade--alerta"}>{validade.texto}</div> : null}
            </div>
          </div>
        </div>
        <div className="detalhes-grupo">
          <div className="detalhes-titulo">Etiqueta</div>
          {lote.identificacao ? (
            <>
              <div>
                <div className="detalhe-rotulo">Tipo</div>
                <div className="detalhe-valor">{ROTULOS_DE_ETIQUETA[lote.identificacao.tipo_identificacao]}</div>
              </div>
              <div>
                <div className="detalhe-rotulo">Código</div>
                <div className="detalhe-valor codigo">{lote.identificacao.codigo}</div>
              </div>
            </>
          ) : (
            <div className="detalhe-valor detalhe-valor--largo">Este lote ainda não tem etiqueta.</div>
          )}
        </div>
      </div>
    </Gaveta>
  );
}
