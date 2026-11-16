import { useState } from "react";
import { inativarProduto } from "../../api/produtos.ts";
import type { Produto } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario } from "../../componentes/Campo.tsx";
import { Modal } from "../../componentes/Modal.tsx";
import { interpretarFalhaDeFormulario } from "../../util/formularios.ts";

type Propriedades = {
  produto: Produto;
  aoCancelar: () => void;
  aoConfirmar: (produto: Produto) => void;
};

export function ConfirmarInativacao({ produto, aoCancelar, aoConfirmar }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      aoConfirmar(await inativarProduto(cliente, produto.id_produto));
    } catch (falha) {
      setErro(interpretarFalhaDeFormulario(falha).geral);
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto
      titulo="Inativar produto"
      aoFechar={enviando ? () => undefined : aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoCancelar} disabled={enviando} data-foco-inicial="">
            Cancelar
          </button>
          <button type="button" className="btn btn-perigo" onClick={confirmar} disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : null}
            {enviando ? "Inativando…" : "Inativar produto"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={erro} />
      <p>
        Deseja inativar <strong>{produto.nome}</strong>? Um produto inativo deixa de aceitar novos lotes e não volta a ficar ativo por esta tela. Os lotes e
        movimentações já registrados são mantidos.
      </p>
    </Modal>
  );
}
