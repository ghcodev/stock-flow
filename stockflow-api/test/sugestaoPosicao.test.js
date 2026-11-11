const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pontuarPosicoes } = require('../src/services/sugestaoPosicao');

const produto = { id: 1, tipo_armazenagem: 'seco', peso_unitario_kg: null };
const entrada = { quantidade: 5 };
const contexto = { hoje: '2026-11-10' };
const lote = { id_produto: 1, quantidade: '5.125', ativo: true };

function posicao(id, dados = {}) {
  return { id, corredor: 'A', nivel: 1, posicao: id, distancia_expedicao: id,
    tipo_zona: 'seco', capacidade: null, ocupantes: [], ...dados };
}

function verificarDescarte(local, produtoEntrada = produto) {
  const resultado = pontuarPosicoes([local], produtoEntrada, entrada, contexto);
  assert.deepEqual(resultado.sugestoes, []);
  assert.equal(resultado.descartadas, 1);
  assert.ok(resultado.motivo_vazio);
}

test('elimina zona incompatível', () => {
  verificarDescarte(posicao(1, { tipo_zona: 'quimico' }));
});

test('elimina posição com lote de outro produto', () => {
  verificarDescarte(posicao(1, { ocupantes: [{ ...lote, id_produto: 2, ativo: false }] }));
});

test('elimina capacidade insuficiente e aceita a capacidade livre exata', () => {
  verificarDescarte(posicao(1, { capacidade: '10.124', ocupantes: [lote] }));
  const exata = posicao(1, { capacidade: '10.125', ocupantes: [lote] });
  assert.equal(pontuarPosicoes([exata], produto, entrada, contexto).sugestoes.length, 1);
});

test('produto de 25 kg não vai acima do nível 2 e prefere nível 1', () => {
  const pesada = { ...produto, peso_unitario_kg: '25.000' };
  verificarDescarte(posicao(1, { nivel: 3 }), pesada);
  const locais = [posicao(1, { nivel: 2 }), posicao(2, { distancia_expedicao: 1 })];
  const { sugestoes } = pontuarPosicoes(locais, pesada, entrada, contexto);
  assert.deepEqual(sugestoes.map(local => local.criterios.ergonomia), [1, 0.5]);
});

test('classe A prefere perto, classe B prefere o meio e classe C prefere longe', () => {
  const locais = [posicao(1, { distancia_expedicao: 0 }), posicao(2), posicao(4)];
  for (const [classeAbc, melhorId] of [['A', 1], ['B', 2], ['C', 4], [undefined, 4]]) {
    const { sugestoes } = pontuarPosicoes(locais, produto, entrada, { ...contexto, classeAbc });
    assert.equal(sugestoes[0].id, melhorId);
    assert.equal(sugestoes[0].criterios.validade, 0.5);
  }
});

test('validade próxima favorece nível baixo e proximidade', () => {
  const locais = [posicao(1), posicao(2, { nivel: 3, distancia_expedicao: 1 }), posicao(3)];
  const { sugestoes } = pontuarPosicoes(locais, produto, { ...entrada, data_validade: '2026-11-11' },
    { ...contexto, classeAbc: 'A' });
  assert.equal(sugestoes[0].id, 1);
  assert.ok(sugestoes[0].criterios.validade > sugestoes[1].criterios.validade);
  assert.ok(sugestoes[0].criterios.validade > sugestoes[2].criterios.validade);
});

test('corredor com lote ativo do produto ganha pontos', () => {
  const locais = [
    posicao(1, { corredor: 'B', ocupantes: [{ ...lote, ativo: false }] }),
    posicao(2, { distancia_expedicao: 1 }),
    posicao(3, { ocupantes: [lote], tipo_zona: 'refrigerado' }),
  ];
  const { sugestoes } = pontuarPosicoes(locais, produto, entrada, contexto);
  assert.deepEqual(sugestoes.map(local => local.id), [2, 1]);
  assert.deepEqual(sugestoes.map(local => local.criterios.agrupamento), [1, 0]);
});

test('retorna até três posições ordenadas com motivos e conta só as descartadas', () => {
  const locais = [posicao(2), posicao(1), posicao(3), posicao(4), posicao(5, { tipo_zona: 'quimico' })];
  const resultado = pontuarPosicoes(locais, produto, entrada, contexto);
  assert.deepEqual(resultado.sugestoes.map(local => local.id), [4, 3, 2]);
  assert.ok(resultado.sugestoes.every(local => local.motivos.length > 0 && local.pontuacao <= 100));
  assert.equal(resultado.descartadas, 1);
  assert.equal(resultado.motivo_vazio, null);
});
