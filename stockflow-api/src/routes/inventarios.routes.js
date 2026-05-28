const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const pool = require('../config/database');

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT
      i.id,
      i.corredor,
      u.nome  AS usuario_nome,
      i.total_posicoes   AS total,
      i.total_conferidas AS conferidos,
      i.divergencias,
      i.acuracidade,
      i.status,
      i.observacao,
      i.iniciado_em  AS inicio,
      i.concluido_em AS fim
    FROM inventario i
    JOIN usuario u ON u.id = i.id_usuario
    ORDER BY i.iniciado_em DESC
  `);
  return res.json({ data: rows, total: rows.length });
});

router.post('/',
  body('corredor').notEmpty().withMessage('Corredor obrigatório'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { corredor, observacao } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO inventario (corredor, id_usuario, observacao, status, iniciado_em)
       VALUES (?, ?, ?, 'em andamento', NOW())`,
      [corredor, req.user.id, observacao || null]
    );
    return res.status(201).json({ id: result.insertId, mensagem: 'Inventário iniciado' });
  }
);

module.exports = router;
