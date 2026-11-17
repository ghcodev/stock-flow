import type { Lote } from "../../api/tipos.ts";
import { Badge } from "../../componentes/Badge.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { diaDeHoje, formatarDia } from "../../util/datas.ts";
import { formatarQuantidade } from "../../util/decimal.ts";
import { ROTULOS_DE_ETIQUETA, ROTULOS_DE_STATUS, TONS_DE_STATUS, rotuloDaLocalizacao, situacaoDeValidade } from "../lotes/apresentacao.ts";

type Propriedades = {
  lote: Lote | null;
  aviso?: { tom: "alerta" | "perigo"; texto: string } | null;
  aoTrocar: () => void;
  desabilitado: boolean;
};

export function ResumoDoLote({ lote, aviso, aoTrocar, desabilitado }: Propriedades) {
  if (lote === null) {
    return (
      <div className="resumo-lote resumo-lote--vazio">
        <Icone nome="scan" />
        <strong>Nenhum lote selecionado</strong>
        <span>Leia a etiqueta ou busque o lote pelo número para ver o saldo atual.</span>
      </div>
    );
  }
  const validade = situacaoDeValidade(lote, diaDeHoje());
  return (
    <div className="resumo-lote" aria-live="polite">
      <div className="resumo-lote-topo">
        <div>
          <div className="resumo-lote-numero">{lote.numero_lote}</div>
          <div className="celula-secundaria">{lote.produto.nome}</div>
        </div>
        <Badge tom={TONS_DE_STATUS[lote.status_lote]} ponto>
          {ROTULOS_DE_STATUS[lote.status_lote]}
        </Badge>
      </div>
      <div className="resumo-lote-saldo">
        <span className="detalhe-rotulo">Saldo atual</span>
        <strong>
          <span key={lote.quantidade} className="pulsar">
            {formatarQuantidade(lote.quantidade)} <small>{lote.produto.unidade_medida}</small>
          </span>
        </strong>
      </div>
      <dl className="resumo-lote-dados">
        <div>
          <dt>Localização</dt>
          <dd className="codigo">{rotuloDaLocalizacao(lote.localizacao)}</dd>
        </div>
        <div>
          <dt>Validade</dt>
          <dd>
            {formatarDia(lote.data_validade)}
            {validade ? <span className={validade.tom === "perigo" ? "celula-validade celula-validade--perigo" : "celula-validade celula-validade--alerta"}> · {validade.texto}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Etiqueta</dt>
          <dd className="codigo">{lote.identificacao ? `${ROTULOS_DE_ETIQUETA[lote.identificacao.tipo_identificacao]} ${lote.identificacao.codigo}` : "—"}</dd>
        </div>
      </dl>
      {aviso ? (
        <div className={aviso.tom === "perigo" ? "aviso-do-formulario" : "aviso-do-formulario aviso-do-formulario--alerta"} role="alert">
          <Icone nome="alert-triangle" />
          <span>{aviso.texto}</span>
        </div>
      ) : null}
      <button type="button" className="btn btn-outline btn-sm" onClick={aoTrocar} disabled={desabilitado}>
        <Icone nome="refresh" />
        Trocar lote
      </button>
    </div>
  );
}
