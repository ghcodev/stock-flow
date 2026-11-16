import { useEffect, useRef, useState } from "react";
import { buscarLotesParaSeletor } from "../../api/buscas.ts";
import { mensagemDoErro } from "../../api/erros.ts";
import { buscarLotePorEtiqueta, obterLote } from "../../api/lotes.ts";
import type { Lote } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../../componentes/Avisos.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { SeletorComBusca } from "../../componentes/SeletorComBusca.tsx";
import { normalizarCodigoLido } from "../../leitor/captura.ts";
import { IndicadorDeLeitura } from "../../leitor/IndicadorDeLeitura.tsx";
import { useLeitor } from "../../leitor/useLeitor.ts";
import { criarFiltroDeLeituraDupla } from "../../util/envio.ts";
import { criarVigencia } from "../../util/vigencia.ts";

type Propriedades = {
  ocupado: boolean;
  aoEscolher: (lote: Lote) => void;
};

const JANELA_DE_LEITURA_DUPLA_MS = 1500;

export function SeletorDeLote({ ocupado, aoEscolher }: Propriedades) {
  const { cliente } = useAutenticacao();
  const { mostrar } = useAvisos();
  const [chave, setChave] = useState(0);
  const cache = useRef(new Map<string, Lote>());
  const filtro = useRef(criarFiltroDeLeituraDupla(JANELA_DE_LEITURA_DUPLA_MS));
  const vigencia = useRef(criarVigencia());
  const ocupadoAgora = useRef(ocupado);

  useEffect(() => {
    const atual = vigencia.current;
    return () => atual.invalidar();
  }, []);
  ocupadoAgora.current = ocupado;

  const procurarPorEtiqueta = async (codigoBruto: string) => {
    if (ocupadoAgora.current) return;
    const codigo = normalizarCodigoLido(codigoBruto);
    if (codigo === null) {
      mostrar("erro", "Código inválido", "A etiqueta deve ter de 1 a 128 caracteres, sem caracteres de controle.");
      return;
    }
    if (!filtro.current(codigo, Date.now())) return;
    const resumo = codigo.length > 40 ? `${codigo.slice(0, 40)}…` : codigo;
    const pedido = vigencia.current.iniciar();
    try {
      const lote = await buscarLotePorEtiqueta(cliente, codigo, pedido.sinal);
      if (!pedido.vigente() || ocupadoAgora.current) return;
      if (lote === null) mostrar("info", "Etiqueta sem lote", resumo);
      else aoEscolher(lote);
    } catch (falha) {
      if (!pedido.vigente()) return;
      mostrar("erro", "Não foi possível buscar a etiqueta", mensagemDoErro(falha));
    }
  };

  const leitor = useLeitor((leitura) => {
    void procurarPorEtiqueta(leitura.codigo);
  });

  const escolherPorNumero = async (valor: string) => {
    if (valor === "" || ocupadoAgora.current) return;
    const encontrado = cache.current.get(valor);
    setChave((atual) => atual + 1);
    const pedido = vigencia.current.iniciar();
    try {
      const lote = await obterLote(cliente, encontrado?.id_lote ?? Number(valor), pedido.sinal);
      if (pedido.vigente() && !ocupadoAgora.current) aoEscolher(lote);
    } catch (falha) {
      if (!pedido.vigente()) return;
      mostrar("erro", "Não foi possível carregar o lote", mensagemDoErro(falha));
    }
  };

  return (
    <div className="seletor-de-lote">
      <IndicadorDeLeitura leitor={leitor} />
      <div className="campo-etiqueta campo-etiqueta--largo">
        <Icone nome="scan" />
        <input
          type="text"
          aria-label="Ler ou digitar o código da etiqueta"
          placeholder="Ler ou digitar etiqueta…"
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
          disabled={ocupado}
          onKeyDown={(evento) => {
            if (evento.key !== "Enter") return;
            evento.preventDefault();
            const campo = evento.currentTarget;
            void procurarPorEtiqueta(campo.value).then(() => {
              campo.value = "";
            });
          }}
        />
      </div>
      <SeletorComBusca
        key={chave}
        rotulo="Ou busque o lote pelo número"
        placeholder="Digite o número do lote"
        valor=""
        desabilitado={ocupado}
        aoMudar={(valor) => {
          void escolherPorNumero(valor);
        }}
        buscar={async (texto, sinal) => {
          const resultado = await buscarLotesParaSeletor(cliente, texto, sinal);
          cache.current = new Map(resultado.map((item) => [item.opcao.valor, item.lote]));
          return resultado.map((item) => item.opcao);
        }}
      />
    </div>
  );
}
