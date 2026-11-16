import { mensagemDoErro } from "../api/erros.ts";
import { capturaGlobal } from "./captura.ts";
import type { Leitura } from "./detector.ts";
import { conectarSerial, serialDisponivel, type AmbienteSerial, type ConexaoSerial, type OpcoesDeConexao } from "./serial.ts";

export type EstadoDoGerenciador = {
  disponivel: boolean;
  conectado: boolean;
  conectando: boolean;
  erro: string | null;
};

export type GerenciadorSerial = {
  estado: () => EstadoDoGerenciador;
  assinar: (ouvinte: () => void) => () => void;
  conectar: () => void;
  desconectar: () => void;
};

type Dependencias = {
  ambiente: () => AmbienteSerial;
  emitir: (leitura: Leitura) => void;
  conectarPorta?: (ambiente: AmbienteSerial, opcoes: OpcoesDeConexao) => Promise<ConexaoSerial>;
};

function cancelamentoDoUsuario(falha: unknown): boolean {
  return typeof falha === "object" && falha !== null && "name" in falha && (falha.name === "NotFoundError" || falha.name === "AbortError");
}

export function criarGerenciadorSerial(dependencias: Dependencias): GerenciadorSerial {
  const conectarPorta = dependencias.conectarPorta ?? conectarSerial;
  const ouvintes = new Set<() => void>();
  let conexao: ConexaoSerial | null = null;
  let geracao = 0;
  let atual: EstadoDoGerenciador = { disponivel: serialDisponivel(dependencias.ambiente()), conectado: false, conectando: false, erro: null };

  const mudar = (parcial: Partial<EstadoDoGerenciador>) => {
    atual = { ...atual, disponivel: serialDisponivel(dependencias.ambiente()), ...parcial };
    for (const ouvinte of Array.from(ouvintes)) ouvinte();
  };

  return {
    estado: () => atual,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    conectar() {
      if (conexao !== null || atual.conectando || !serialDisponivel(dependencias.ambiente())) return;
      const minha = ++geracao;
      mudar({ conectando: true, erro: null });
      conectarPorta(dependencias.ambiente(), {
        aoLer: (leitura) => {
          if (minha === geracao) dependencias.emitir(leitura);
        },
        cancelado: () => minha !== geracao,
        aoEncerrar: (falha) => {
          if (minha !== geracao) return;
          conexao = null;
          mudar({ conectado: false, erro: falha === null ? null : mensagemDoErro(falha) });
        },
      }).then(
        (nova) => {
          if (minha !== geracao) {
            void nova.encerrar();
            return;
          }
          conexao = nova;
          mudar({ conectado: true, conectando: false });
        },
        (falha: unknown) => {
          if (minha !== geracao) return;
          mudar({ conectando: false, erro: cancelamentoDoUsuario(falha) ? null : "Não foi possível abrir a porta serial." });
        },
      );
    },
    desconectar() {
      geracao += 1;
      const anterior = conexao;
      conexao = null;
      mudar({ conectado: false, conectando: false, erro: null });
      if (anterior !== null) void anterior.encerrar();
    },
  };
}

let unico: GerenciadorSerial | null = null;

export function gerenciadorSerial(): GerenciadorSerial {
  unico ??= criarGerenciadorSerial({
    ambiente: () => ({ isSecureContext: window.isSecureContext, navigator: window.navigator as { serial?: unknown } }),
    emitir: (leitura) => capturaGlobal().emitir(leitura),
  });
  return unico;
}
