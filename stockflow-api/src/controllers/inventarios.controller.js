const db = require('../config/database');
const logAudit = require('../middleware/audit');

const inventarios = {
  list: async (req, res) => {
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const filters = [];
    const params = [];
    if (req.query.status) { filters.push('i.status = ?'); params.push(req.query.status); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT i.id, i.corredor, i.status, i.acuracidade,
              i.total_posicoes AS total, i.total_conferidas AS conferidos, i.divergencias,
              i.iniciado_em  AS inicio,
              i.concluido_em AS fim,
              i.observacao,
              u.nome           AS usuario_nome
       FROM inventario i
       JOIN usuario u ON u.id = i.id_usuario
       ${where}
       ORDER BY i.iniciado_em DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM inventario i ${where}`,
      params
    );

    res.json({ data: rows, pagination: { page: pageNum, limit: limitNum, total } });
  },

  create: async (req, res) => {
    const { corredor, observacao } = req.body;
    if (!corredor?.trim()) {
      return res.status(400).json({ error: 'Corredor é obrigatório' });
    }

    const [result] = await db.query(
      `INSERT INTO inventario (corredor, id_usuario, observacao, status, iniciado_em)
       VALUES (?, ?, ?, 'em andamento', NOW())`,
      [corredor.trim(), req.user.id, observacao || null]
    );

    await logAudit({
      tabela: 'inventario',
      operacao: 'INSERT',
      valorNovo: JSON.stringify({ corredor: corredor.trim() }),
      idUsuario: req.user.id,
    });

    res.status(201).json({
      id: result.insertId,
      corredor: corredor.trim(),
      status: 'em andamento',
      acuracidade: 100.00,
      inicio: new Date().toISOString(),
      message: 'Inventário iniciado com sucesso',
    });
  },

  getById: async (req, res) => {
    const [rows] = await db.query(
      `SELECT i.*, i.iniciado_em AS inicio, i.concluido_em AS fim,
              u.nome AS usuario_nome
       FROM inventario i
       JOIN usuario u ON u.id = i.id_usuario
       WHERE i.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Inventário não encontrado' });
    res.json(rows[0]);
  },

  update: async (req, res) => {
    const { status, acuracidade, concluido_em } = req.body;
    const statusValidos = ['em andamento', 'concluido', 'pendente'];
    if (status && !statusValidos.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const sets = [];
    const params = [];
    if (status !== undefined)        { sets.push('status = ?');        params.push(status); }
    if (acuracidade !== undefined)    { sets.push('acuracidade = ?');    params.push(acuracidade); }
    if (concluido_em !== undefined)   { sets.push('concluido_em = ?');   params.push(concluido_em); }
    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    params.push(req.params.id);
    const [result] = await db.query(
      `UPDATE inventario SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Inventário não encontrado' });

    await logAudit({
      tabela: 'inventario',
      operacao: 'UPDATE',
      valorNovo: JSON.stringify({ status, acuracidade }),
      idUsuario: req.user.id,
    });

    res.json({ message: 'Inventário atualizado com sucesso' });
  },
};

module.exports = inventarios;
