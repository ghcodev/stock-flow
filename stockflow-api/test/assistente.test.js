const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MAX_RODADAS_FERRAMENTA, executarFerramenta, responder } = require('../src/services/assistente');

function chamada(name, args) {
  return { function: { name, arguments: args } };
}

test('responde direto quando o modelo não pede ferramenta', async () => {
  const chamadas = [];
  const chat = async (mensagens, comFerramentas) => {
    chamadas.push({ mensagens, comFerramentas });
    return { role: 'assistant', content: 'Olá! Posso ajudar com o estoque.' };
  };
  const resultado = await responder('oi', [{ papel: 'usuario', texto: 'antes' }], { chat, hoje: '2026-11-10' });
  assert.equal(resultado.resposta, 'Olá! Posso ajudar com o estoque.');
  assert.deepEqual(resultado.atalhos, []);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].comFerramentas, true);
  assert.match(chamadas[0].mensagens[0].content, /Hoje é 2026-11-10/);
  assert.deepEqual(chamadas[0].mensagens.slice(1).map(m => m.role), ['user', 'user']);
});

test('executa as ferramentas, devolve os resultados ao modelo e monta o atalho', async () => {
  const respostas = [
    { role: 'assistant', content: '', tool_calls: [chamada('buscar_produto', { nome: 'cimento' })] },
    { role: 'assistant', content: '', tool_calls: [chamada('sugerir_posicao', '{"id_produto":7,"quantidade":40}')] },
    { role: 'assistant', content: 'Guarde em A-N1-P1. Confirme na tela de lote.' },
  ];
  const historico = [];
  const chat = async mensagens => {
    historico.push(mensagens.map(m => m.role));
    return respostas.shift();
  };
  const executadas = [];
  const executar = async (nome, args) => {
    executadas.push([nome, args]);
    if (nome === 'buscar_produto') return { produtos: [{ id: 7, nome: 'Cimento 50kg' }] };
    return { id_produto: 7, sugestoes: [{ posicao: 'A-N1-P1', pontuacao: 90, motivos: [] }] };
  };
  const resultado = await responder('onde guardo 40 sacos de cimento?', [], { chat, executar });
  assert.deepEqual(executadas, [['buscar_produto', { nome: 'cimento' }], ['sugerir_posicao', { id_produto: 7, quantidade: 40 }]]);
  assert.deepEqual(historico[2].slice(-4), ['assistant', 'tool', 'assistant', 'tool']);
  assert.deepEqual(resultado.atalhos, [{ id_produto: 7, nome: 'Cimento 50kg' }]);
  assert.match(resultado.resposta, /A-N1-P1/);
});

test(`para depois de ${MAX_RODADAS_FERRAMENTA} rodadas de ferramenta e pede a resposta sem ferramentas`, async () => {
  const usouFerramentas = [];
  const chat = async (mensagens, comFerramentas) => {
    usouFerramentas.push(comFerramentas);
    return comFerramentas
      ? { role: 'assistant', content: '', tool_calls: [chamada('lotes_vencendo', { dias: 7 })] }
      : { role: 'assistant', content: 'Resumo final.' };
  };
  let execucoes = 0;
  const executar = async () => { execucoes += 1; return { total: 0, lotes: [] }; };
  const resultado = await responder('lotes?', [], { chat, executar });
  assert.equal(execucoes, MAX_RODADAS_FERRAMENTA);
  assert.deepEqual(usouFerramentas, [...Array(MAX_RODADAS_FERRAMENTA).fill(true), false]);
  assert.equal(resultado.resposta, 'Resumo final.');
});

test('resposta vazia vira mensagem padrão', async () => {
  const resultado = await responder('?', [], { chat: async () => ({ role: 'assistant', content: '  ' }) });
  assert.match(resultado.resposta, /Tente reformular/);
});

test('ferramentas validam os argumentos do modelo antes de consultar o banco', async () => {
  assert.ok((await executarFerramenta('lotes_vencendo', { dias: 0 })).erro);
  assert.ok((await executarFerramenta('lotes_vencendo', { dias: 400 })).erro);
  assert.ok((await executarFerramenta('buscar_produto', { nome: '  ' })).erro);
  assert.ok((await executarFerramenta('sugerir_posicao', { id_produto: 'x', quantidade: 5 })).erro);
  assert.ok((await executarFerramenta('sugerir_posicao', { id_produto: 1, quantidade: -1 })).erro);
  assert.ok((await executarFerramenta('sugerir_posicao', { id_produto: 1, quantidade: 5, data_validade: '31/03/2027' })).erro);
  assert.ok((await executarFerramenta('apagar_tudo', {})).erro);
});
