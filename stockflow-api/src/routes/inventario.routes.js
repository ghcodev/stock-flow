const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { normalizarIP } = require('../middleware/audit');

const router = Router();
router.use(authMiddleware);

function parseItems(itens) {
  if (!itens) return [];
  if (Array.isArray(itens)) return itens;
  try {
    return JSON.parse(itens);
  } catch {
    return [];
  }
}

function etapaToStatus(etapa) {
  return etapa === 'finalizado' ? 'concluido' : 'em andamento';
}

async function getInventario(id) {
  const [rows] = await pool.execute(
    `SELECT i.*, u.nome AS usuario_nome
     FROM inventario i
     LEFT JOIN usuario u ON u.id = i.id_usuario
     WHERE i.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const row = rows[0];
  row.itens = parseItems(row.itens);
  return row;
}

function calculateStats(items) {
  const totalItens = items.length;
  const conferidos = items.filter(item => item.qtd_contada !== null && item.qtd_contada !== undefined).length;
  const totalDivergencias = items.filter(item => Number(item.divergencia || 0) !== 0).length;
  const acuracidade = totalItens ? Number((((totalItens - totalDivergencias) / totalItens) * 100).toFixed(2)) : 100;
  return { totalItens, conferidos, totalDivergencias, acuracidade };
}

router.get('/', async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT i.id, i.corredor, i.etapa, i.status, i.total_itens, i.total_conferidas,
            i.total_divergencias, i.divergencias, i.acuracidade, i.iniciado_em,
            i.concluido_em, u.nome AS usuario_nome
     FROM inventario i
     LEFT JOIN usuario u ON u.id = i.id_usuario
     ORDER BY i.iniciado_em DESC`
  );
  return res.json({ data: rows, total: rows.length });
});

router.post('/',
  body('corredor').notEmpty().withMessage('Corredor obrigatório'),
  body('id_usuario').optional().isInt({ min: 1 }).withMessage('Operador inválido'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { corredor, id_usuario } = req.body;
    const usuarioId = id_usuario || req.user.id;
    const [lotes] = await pool.execute(
      `SELECT l.id AS id_lote, l.numero_lote, p.nome AS produto_nome,
              l.quantidade AS qtd_sistema,
              CONCAT(loc.corredor, '-N', loc.nivel, '-P', loc.posicao) AS localizacao
       FROM lote l
       JOIN produto p ON p.id = l.id_produto
       JOIN localizacao loc ON loc.id = l.id_localizacao
       WHERE l.status_lote = 'ativo' AND loc.corredor = ?
       ORDER BY l.numero_lote`,
      [corredor]
    );

    const itens = lotes.map(lote => ({
      id_lote: lote.id_lote,
      numero_lote: lote.numero_lote,
      produto_nome: lote.produto_nome,
      localizacao: lote.localizacao,
      qtd_sistema: Number(lote.qtd_sistema),
      qtd_contada: null,
      divergencia: null,
    }));

    const [result] = await pool.execute(
      `INSERT INTO inventario
       (corredor, id_usuario, itens, total_itens, total_posicoes, total_conferidas,
        total_divergencias, divergencias, acuracidade, status, etapa, iniciado_em)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, 100, 'em andamento', 'iniciado', NOW())`,
      [corredor, usuarioId, JSON.stringify(itens), itens.length, itens.length]
    );

    const inventario = await getInventario(result.insertId);
    return res.status(201).json(inventario);
  }
);

router.get('/:id', async (req, res) => {
  const inventario = await getInventario(req.params.id);
  if (!inventario) return res.status(404).json({ error: 'Inventário não encontrado' });
  return res.json(inventario);
});

router.patch('/:id/contar',
  body('id_lote').isInt({ min: 1 }).withMessage('Lote inválido'),
  body('qtd_contada').isFloat({ min: 0 }).withMessage('Quantidade contada inválida'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const inventario = await getInventario(req.params.id);
    if (!inventario) return res.status(404).json({ error: 'Inventário não encontrado' });
    if (inventario.etapa === 'finalizado') return res.status(422).json({ error: 'Inventário já finalizado' });

    const idLote = Number(req.body.id_lote);
    const qtdContada = Number(req.body.qtd_contada);
    const itens = inventario.itens.map(item => {
      if (Number(item.id_lote) !== idLote) return item;
      return {
        ...item,
        qtd_contada: qtdContada,
        divergencia: Number((qtdContada - Number(item.qtd_sistema)).toFixed(3)),
      };
    });

    if (!itens.some(item => Number(item.id_lote) === idLote)) {
      return res.status(404).json({ error: 'Item não encontrado no inventário' });
    }

    const stats = calculateStats(itens);
    await pool.execute(
      `UPDATE inventario
       SET itens=?, etapa='contando', total_conferidas=?, total_itens=?,
           total_divergencias=?, divergencias=?, acuracidade=?, status='em andamento'
       WHERE id=?`,
      [JSON.stringify(itens), stats.conferidos, stats.totalItens, stats.totalDivergencias, stats.totalDivergencias, stats.acuracidade, req.params.id]
    );

    return res.json(await getInventario(req.params.id));
  }
);

router.patch('/:id/confirmar', async (req, res) => {
  const inventario = await getInventario(req.params.id);
  if (!inventario) return res.status(404).json({ error: 'Inventário não encontrado' });
  if (inventario.etapa === 'finalizado') return res.status(422).json({ error: 'Inventário já finalizado' });

  const stats = calculateStats(inventario.itens);
  if (stats.conferidos < stats.totalItens) {
    return res.status(422).json({ error: 'Todos os itens precisam ser contados antes da confirmação' });
  }

  await pool.execute(
    `UPDATE inventario
     SET etapa='confirmado', total_conferidas=?, total_itens=?,
         total_divergencias=?, divergencias=?, acuracidade=?, status='em andamento'
     WHERE id=?`,
    [stats.conferidos, stats.totalItens, stats.totalDivergencias, stats.totalDivergencias, stats.acuracidade, req.params.id]
  );
  return res.json(await getInventario(req.params.id));
});

router.patch('/:id/finalizar', async (req, res) => {
  const inventario = await getInventario(req.params.id);
  if (!inventario) return res.status(404).json({ error: 'Inventário não encontrado' });
  if (inventario.etapa === 'finalizado') return res.status(422).json({ error: 'Inventário já finalizado' });
  if (inventario.etapa !== 'confirmado') return res.status(422).json({ error: 'Confirme o inventário antes de finalizar' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('SET @audit_user_id = ?, @audit_ip = ?, @audit_op = ?', [
      req.user?.id || null,
      normalizarIP(req),
      'AJUSTE',
    ]);
    for (const item of inventario.itens) {
      const divergencia = Number(item.divergencia || 0);
      if (divergencia === 0) continue;
      await conn.execute(
        `INSERT INTO movimentacao
         (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, status, data_movimentacao)
         VALUES ('inventario', ?, ?, ?, ?, ?, 'concluida', NOW())`,
        [
          Math.abs(divergencia),
          item.id_lote,
          req.user.id,
          `Inventário rotativo #${inventario.id}`,
          `Ajuste de ${item.qtd_sistema} para ${item.qtd_contada}`,
        ]
      );
      await conn.execute('UPDATE lote SET quantidade = ? WHERE id = ?', [item.qtd_contada, item.id_lote]);
    }

    const stats = calculateStats(inventario.itens);
    await conn.execute(
      `UPDATE inventario
       SET etapa='finalizado', status='concluido', concluido_em=NOW(),
           total_conferidas=?, total_itens=?, total_divergencias=?,
           divergencias=?, acuracidade=?
       WHERE id=?`,
      [stats.conferidos, stats.totalItens, stats.totalDivergencias, stats.totalDivergencias, stats.acuracidade, req.params.id]
    );
    await conn.commit();
    return res.json(await getInventario(req.params.id));
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
