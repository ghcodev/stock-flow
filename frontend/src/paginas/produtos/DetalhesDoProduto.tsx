import type { Produto } from "../../api/tipos.ts";
import { Badge } from "../../componentes/Badge.tsx";
import { Gaveta } from "../../componentes/Gaveta.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { formatarQuantidade } from "../../util/decimal.ts";
import { formatarDataHora } from "../../util/datas.ts";

type Propriedades = {
  produto: Produto;
  aoFechar: () => void;
  aoEditar: () => void;
  aoInativar: () => void;
};

export function DetalhesDoProduto({ produto, aoFechar, aoEditar, aoInativar }: Propriedades) {
  return (
    <Gaveta
      aberta
      titulo={produto.nome}
      subtitulo={`#${produto.id_produto}`}
      aoFechar={aoFechar}
      rodape={
        <>
          {produto.ativo ? (
            <button type="button" className="btn btn-outline" onClick={aoInativar}>
              <Icone nome="pause" />
              Inativar
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={aoEditar}>
            <Icone nome="edit" />
            Editar
          </button>
        </>
      }
    >
      <div className="detalhes">
        <div className="detalhes-grupo">
          <div className="detalhes-titulo">Identificação</div>
          <div>
            <div className="detalhe-rotulo">Situação</div>
            <div className="detalhe-valor">
              <Badge tom={produto.ativo ? "sucesso" : "neutro"} ponto>
                {produto.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="detalhe-rotulo">Cadastrado em</div>
            <div className="detalhe-valor">{formatarDataHora(produto.created_at)}</div>
          </div>
          <div>
            <div className="detalhe-rotulo">Categoria</div>
            <div className="detalhe-valor">{produto.categoria ?? "—"}</div>
          </div>
          <div>
            <div className="detalhe-rotulo">Unidade de medida</div>
            <div className="detalhe-valor">{produto.unidade_medida}</div>
          </div>
        </div>
        <div className="detalhes-grupo">
          <div className="detalhes-titulo">Estoque</div>
          <div>
            <div className="detalhe-rotulo">Estoque mínimo</div>
            <div className="detalhe-valor">
              {formatarQuantidade(produto.estoque_minimo)} {produto.unidade_medida}
            </div>
          </div>
        </div>
        <div className="detalhes-grupo">
          <div className="detalhes-titulo">Descrição</div>
          <div className="detalhe-valor detalhe-valor--largo">{produto.descricao ?? "Sem descrição."}</div>
        </div>
      </div>
    </Gaveta>
  );
}
