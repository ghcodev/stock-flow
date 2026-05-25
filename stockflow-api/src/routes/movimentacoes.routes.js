const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/movimentacoes.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.listar);

router.post('/entrada',
  body('id_lote').isInt({ min: 1 }).withMessage('Lote inválido'),
  body('quantidade').isFloat({ min: 0.001 }).withMessage('Quantidade deve ser maior que zero'),
  ctrl.entrada
);

router.post('/saida',
  body('id_lote').isInt({ min: 1 }).withMessage('Lote inválido'),
  body('quantidade').isFloat({ min: 0.001 }).withMessage('Quantidade deve ser maior que zero'),
  ctrl.saida
);

router.post('/transferencia',
  body('id_lote').isInt({ min: 1 }).withMessage('Lote inválido'),
  body('id_localizacao_destino').isInt({ min: 1 }).withMessage('Localização destino inválida'),
  body('motivo_movimentacao').isLength({ min: 10 }).withMessage('Motivo obrigatório (mínimo 10 caracteres) — RN17'),
  ctrl.transferencia
);

router.post('/ajuste',
  adminMiddleware,
  body('id_lote').isInt({ min: 1 }).withMessage('Lote inválido'),
  body('nova_quantidade').isFloat({ min: 0 }).withMessage('Nova quantidade deve ser >= 0'),
  body('justificativa').isLength({ min: 10 }).withMessage('Justificativa obrigatória (mínimo 10 caracteres) — RN17'),
  ctrl.ajuste
);

router.post('/inventario',
  body('contagens').isArray({ min: 1 }).withMessage('Contagens deve ser uma lista não vazia'),
  body('contagens.*.id_lote').isInt({ min: 1 }).withMessage('id_lote inválido na lista'),
  body('contagens.*.quantidade_contada').isFloat({ min: 0 }).withMessage('quantidade_contada inválida'),
  ctrl.inventario
);

module.exports = router;
