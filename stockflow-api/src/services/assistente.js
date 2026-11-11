const MAX_RODADAS_FERRAMENTA = 4;
const MAX_TOKENS_RESPOSTA = 1024;
const MAX_CARACTERES_RESPOSTA = 4000;
const TEMPO_LIMITE_MS = 120_000;
const TEMPO_LIMITE_STATUS_MS = 3_000;
const MAX_LOTES_VENCENDO = 50;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const FERRAMENTAS = [
  {
    type: 'function',
    function: {
      name: 'buscar_produto',
      description: 'Busca produtos ativos pelo nome (ou parte do nome) e devolve id, nome, unidade de medida e saldo total em lotes ativos. Use antes de sugerir posição para descobrir o id do produto.',
      parameters: {
        type: 'object',
        properties: { nome: { type: 'string', description: 'Nome ou parte do nome do produto' } },
        required: ['nome'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lotes_vencendo',
      description: 'Lista os lotes ativos que vencem nos próximos N dias, com produto, quantidade, validade e posição.',
      parameters: {
        type: 'object',
        properties: { dias: { type: 'integer', description: 'Quantidade de dias a partir de hoje, de 1 a 365' } },
        required: ['dias'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sugerir_posicao',
      description: 'Calcula as melhores posições de armazenagem para uma entrada de produto, usando o algoritmo do sistema. Nunca escolha posições por conta própria.',
      parameters: {
        type: 'object',
        properties: {
          id_produto: { type: 'integer', description: 'Id do produto, obtido com buscar_produto' },
          quantidade: { type: 'number', description: 'Quantidade a armazenar, maior que zero' },
          data_validade: { type: 'string', description: 'Validade no formato AAAA-MM-DD, se informada' },
        },
        required: ['id_produto', 'quantidade'],
      },
    },
  },
];

class AssistenteIndisponivel extends Error {}

function configuracao() {
  return {
    url: (process.env.ASSISTENTE_URL || 'http://localhost:11434').replace(/\/+$/, ''),
    modelo: process.env.ASSISTENTE_MODELO || 'qwen3.5:9b',
  };
}

function textoSistema(hoje) {
  return [
    'Você é o assistente de estoque do StockFlow, um sistema de gestão de armazém.',
    `Hoje é ${hoje}. Responda sempre em português do Brasil, de forma curta e objetiva.`,
    'Responda somente sobre o estoque do StockFlow. Recuse com educação qualquer outro assunto.',
    'Use as ferramentas para obter os dados. Nunca invente posições, lotes, produtos, quantidades ou datas: cite apenas o que as ferramentas retornarem.',
    'Se uma ferramenta não retornar dados ou retornar erro, diga isso claramente.',
    'Lotes com situacao "vencido" continuam ativos no estoque e precisam de atenção; separe-os dos lotes a vencer.',
    'Quando perguntarem onde guardar um produto, sempre use buscar_produto para achar o id e, em seguida, sugerir_posicao antes de responder. Se houver mais de um produto parecido, pergunte qual é.',
    'Se a validade vier só com mês e ano, use o último dia desse mês no formato AAAA-MM-DD. Se vier sem ano, use a próxima ocorrência desse mês.',
    'Ao apresentar uma sugestão de posição, lembre que ela deve ser confirmada pelo usuário na tela de lote ou de transferência. Você não grava nada no sistema.',
  ].join('\n');
}

async function chamarModelo(mensagens, comFerramentas) {
  const { url, modelo } = configuracao();
  let resposta;
  try {
    resposta = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        stream: false,
        think: false,
        messages: mensagens,
        ...(comFerramentas ? { tools: FERRAMENTAS } : {}),
        options: { num_predict: MAX_TOKENS_RESPOSTA, temperature: 0 },
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch {
    throw new AssistenteIndisponivel();
  }
  if (!resposta.ok) throw new AssistenteIndisponivel();
  const { message } = await resposta.json();
  return message || { role: 'assistant', content: '' };
}

async function disponivel() {
  const { url, modelo } = configuracao();
  try {
    const resposta = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(TEMPO_LIMITE_STATUS_MS) });
    if (!resposta.ok) return false;
    const { models = [] } = await resposta.json();
    return models.some(m => m.name === modelo || m.model === modelo);
  } catch {
    return false;
  }
}

function dataIso(valor) {
  if (!valor) return null;
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
}

function inteiroEntre(valor, minimo, maximo) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

async function buscarProduto({ nome }) {
  const termo = typeof nome === 'string' ? nome.trim().slice(0, 100) : '';
  if (!termo) return { erro: 'Informe o nome do produto.' };
  const pool = require('../config/database');
  const [rows] = await pool.execute(
    `SELECT p.id, p.nome, p.unidade_medida, COALESCE(SUM(l.quantidade), 0) AS saldo_total
     FROM produto p LEFT JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
     WHERE p.ativo = 1 AND p.nome LIKE ?
     GROUP BY p.id, p.nome, p.unidade_medida ORDER BY p.nome LIMIT 5`,
    [`%${termo}%`]
  );
  return { produtos: rows.map(p => ({ ...p, saldo_total: Number(p.saldo_total) })) };
}

async function lotesVencendo({ dias }) {
  const periodo = inteiroEntre(dias, 1, 365);
  if (periodo === null) return { erro: 'O período deve ser um número inteiro de 1 a 365 dias.' };
  const { listarLotesVencendo } = require('./lotesVencendo');
  const rows = await listarLotesVencendo(periodo);
  return {
    total: rows.length,
    lotes: rows.slice(0, MAX_LOTES_VENCENDO).map(l => ({
      numero_lote: l.numero_lote,
      produto: l.produto_nome,
      quantidade: Number(l.quantidade),
      data_validade: dataIso(l.data_validade),
      dias_para_vencer: l.dias_para_vencer,
      situacao: l.dias_para_vencer < 0 ? 'vencido' : 'a vencer',
      posicao: `${l.corredor}-N${l.nivel}-P${l.posicao}`,
    })),
  };
}

async function sugerirPosicao({ id_produto, quantidade, data_validade }) {
  const idProduto = inteiroEntre(id_produto, 1, 2147483647);
  const qtd = Math.round(Number(quantidade) * 1000) / 1000;
  if (idProduto === null) return { erro: 'Produto inválido. Use buscar_produto para obter o id.' };
  if (!Number.isFinite(qtd) || qtd <= 0 || qtd > 999999999.999) return { erro: 'A quantidade deve ser maior que zero.' };
  const validade = data_validade && DATA_ISO.test(data_validade) && !Number.isNaN(Date.parse(data_validade)) ? data_validade : undefined;
  if (data_validade && !validade) return { erro: 'Validade inválida. Use AAAA-MM-DD.' };
  const { sugerirPosicoes } = require('./sugestaoPosicao');
  const resultado = await sugerirPosicoes(idProduto, { quantidade: qtd, data_validade: validade });
  if (!resultado) return { erro: 'Produto não encontrado.' };
  return {
    id_produto: idProduto,
    sugestoes: resultado.sugestoes.map(s => ({
      posicao: `${s.corredor}-N${s.nivel}-P${s.posicao}`,
      pontuacao: s.pontuacao,
      motivos: s.motivos,
    })),
    descartadas: resultado.descartadas,
    motivo_vazio: resultado.motivo_vazio,
  };
}

const EXECUTORES = { buscar_produto: buscarProduto, lotes_vencendo: lotesVencendo, sugerir_posicao: sugerirPosicao };

async function executarFerramenta(nome, argumentos) {
  const executor = EXECUTORES[nome];
  if (!executor) return { erro: `Ferramenta desconhecida: ${nome}` };
  try {
    return await executor(argumentos && typeof argumentos === 'object' ? argumentos : {});
  } catch {
    return { erro: 'Não foi possível consultar os dados agora.' };
  }
}

function argumentosDe(chamada) {
  const args = chamada?.function?.arguments;
  if (typeof args !== 'string') return args || {};
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

async function responder(pergunta, historico = [], { chat = chamarModelo, executar = executarFerramenta, hoje = new Date().toLocaleDateString('sv-SE') } = {}) {
  const mensagens = [
    { role: 'system', content: textoSistema(hoje) },
    ...historico.map(item => ({ role: item.papel === 'assistente' ? 'assistant' : 'user', content: item.texto })),
    { role: 'user', content: pergunta },
  ];
  const nomesProduto = new Map();
  const atalhos = new Map();

  for (let rodada = 0; rodada <= MAX_RODADAS_FERRAMENTA; rodada += 1) {
    const mensagem = await chat(mensagens, rodada < MAX_RODADAS_FERRAMENTA);
    const chamadas = Array.isArray(mensagem.tool_calls) ? mensagem.tool_calls : [];
    if (!chamadas.length || rodada === MAX_RODADAS_FERRAMENTA) {
      const texto = String(mensagem.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return {
        resposta: texto.slice(0, MAX_CARACTERES_RESPOSTA) || 'Não consegui formular uma resposta. Tente reformular a pergunta.',
        atalhos: [...atalhos.values()],
      };
    }

    mensagens.push({ role: 'assistant', content: mensagem.content || '', tool_calls: chamadas });
    for (const chamada of chamadas) {
      const nome = chamada.function?.name;
      const resultado = await executar(nome, argumentosDe(chamada));
      if (nome === 'buscar_produto') resultado.produtos?.forEach(p => nomesProduto.set(p.id, p.nome));
      if (nome === 'sugerir_posicao' && resultado.sugestoes?.length) {
        atalhos.set(resultado.id_produto, { id_produto: resultado.id_produto, nome: nomesProduto.get(resultado.id_produto) || null });
      }
      mensagens.push({ role: 'tool', tool_name: nome, content: JSON.stringify(resultado) });
    }
  }
}

module.exports = { MAX_RODADAS_FERRAMENTA, AssistenteIndisponivel, disponivel, executarFerramenta, responder };
