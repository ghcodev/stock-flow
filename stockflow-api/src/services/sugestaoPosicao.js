const PESOS = { giro: 0.35, validade: 0.25, agrupamento: 0.20, ergonomia: 0.20 };
const MILISSEGUNDOS_POR_DIA = 86_400_000;
const MOTIVOS_GIRO = {
  A: 'Produto de giro alto favorece posições perto da expedição.',
  B: 'Produto de giro médio favorece posições a meia distância da expedição.',
  C: 'Produto de giro baixo favorece posições mais longe da expedição.',
};

function pontuarPosicoes(candidatas, produto, entrada, contexto) {
  const pesada = Number(produto.peso_unitario_kg) >= 25;
  const classe = contexto.classeAbc ?? 'C';
  const corredores = new Set(candidatas.filter(local =>
    local.ocupantes.some(lote => lote.id_produto === produto.id && lote.ativo)
  ).map(local => local.corredor));
  const maiorDistancia = candidatas.reduce((maior, local) => Math.max(maior, local.distancia_expedicao), 0);
  const dias = (Date.parse(entrada.data_validade) - Date.parse(contexto.hoje)) / MILISSEGUNDOS_POR_DIA;
  const urgencia = entrada.data_validade ? Math.max(0, Math.min(1, 1 - dias / 180)) : 0;
  const sugestoes = [];

  for (const local of candidatas) {
    const { id, corredor, nivel, posicao } = local;
    const nivelBaixo = nivel <= 2;
    const ocupacao = local.ocupantes.reduce((total, lote) => total + emMilesimos(lote.quantidade), 0);
    if (local.tipo_zona !== produto.tipo_armazenagem ||
        local.ocupantes.some(lote => lote.id_produto !== produto.id) ||
        (local.capacidade != null && ocupacao + emMilesimos(entrada.quantidade) > emMilesimos(local.capacidade)) ||
        (pesada && !nivelBaixo)) continue;

    const proximidade = maiorDistancia ? 1 - Math.max(0, local.distancia_expedicao) / maiorDistancia : 1;
    const giro = { A: proximidade, B: 1 - Math.abs(proximidade - 0.5) * 2, C: 1 - proximidade }[classe];
    const acesso = (proximidade + (nivelBaixo ? 1 : 0.4)) / 2;
    const validade = urgencia * acesso + (1 - urgencia) * 0.5;
    const agrupamento = Number(corredores.has(corredor));
    const ergonomia = pesada ? (Number(nivel) === 1 ? 1 : 0.5) : (nivelBaixo ? 1 : 0.6);
    const criterios = { giro, validade, agrupamento, ergonomia };
    const pontuacao = 100 * Object.keys(PESOS).reduce((total, criterio) => total + criterios[criterio] * PESOS[criterio], 0);
    const motivos = [MOTIVOS_GIRO[classe]];
    if (urgencia > 0) motivos.push('Validade próxima favorece posições de acesso fácil.');
    if (agrupamento) motivos.push('O corredor já tem lote ativo do produto.');
    motivos.push(nivelBaixo ? 'Nível baixo facilita o manuseio.' : 'Nível alto exige mais esforço no manuseio.');
    sugestoes.push({ id, corredor, nivel, posicao, pontuacao, criterios, motivos });
  }

  const descartadas = candidatas.length - sugestoes.length;
  sugestoes.sort((a, b) => b.pontuacao - a.pontuacao || a.id - b.id);
  return {
    sugestoes: sugestoes.slice(0, 3).map(local => ({ ...local, pontuacao: Number(local.pontuacao.toFixed(2)) })),
    descartadas,
    motivo_vazio: sugestoes.length ? null : 'Nenhuma posição atende aos requisitos de armazenagem da entrada.',
  };
}

function emMilesimos(quantidade) {
  return Math.round(Number(quantidade) * 1000);
}

async function sugerirPosicoes(idProduto, entrada) {
  const pool = require('../config/database');
  const carregarCurvaAbc = require('./curvaAbc');
  const [[produto]] = await pool.execute(
    'SELECT id, tipo_armazenagem, peso_unitario_kg FROM produto WHERE id = ?', [idProduto]
  );
  if (!produto) return null;

  const [[rows], curva] = await Promise.all([
    pool.execute(`SELECT loc.id, loc.corredor, loc.nivel, loc.posicao, loc.capacidade,
                         loc.tipo_zona, loc.distancia_expedicao,
                         l.id_produto, l.status_lote, SUM(l.quantidade) AS quantidade
                  FROM localizacao loc
                  LEFT JOIN lote l ON l.id_localizacao = loc.id AND l.status_lote <> 'finalizado'
                  GROUP BY loc.id, loc.corredor, loc.nivel, loc.posicao, loc.capacidade,
                           loc.tipo_zona, loc.distancia_expedicao, l.id_produto, l.status_lote`),
    carregarCurvaAbc(),
  ]);

  const localizacoes = new Map();
  for (const { id_produto, status_lote, quantidade, ...local } of rows) {
    if (!localizacoes.has(local.id)) localizacoes.set(local.id, { ...local, ocupantes: [] });
    if (id_produto !== null) {
      localizacoes.get(local.id).ocupantes.push({ id_produto, quantidade, ativo: status_lote === 'ativo' });
    }
  }
  return pontuarPosicoes([...localizacoes.values()], produto, entrada, {
    classeAbc: curva.find(item => item.id_produto === produto.id)?.classe,
    hoje: new Date().toISOString().slice(0, 10),
  });
}

module.exports = { pontuarPosicoes, sugerirPosicoes };
