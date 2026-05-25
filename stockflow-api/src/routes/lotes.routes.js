const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/lotes.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = Router();
router.use(authMiddleware);

// rotas estáticas antes das dinâmicas (:id)
router.get('/vencendo', ctrl.vencendo);
router.get('/abaixo-minimo', ctrl.abaixoMinimo);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.buscarPorId);
router.get('/:id/timeline', ctrl.timeline);

router.post('/',
  body('numero_lote').notEmpty().withMessage('Número do lote obrigatório'),
  body('id_produto').isInt({ min: 1 }).withMessage('Produto inválido'),
  body('id_localizacao').isInt({ min: 1 }).withMessage('Localização inválida'),
  body('quantidade').optional().isFloat({ min: 0 }).withMessage('Quantidade deve ser >= 0'),
  ctrl.criar
);

router.put('/:id',
  body('numero_lote').optional().notEmpty(),
  ctrl.atualizar
);

router.patch('/:id/bloquear',
  adminMiddleware,
  body('motivo').isLength({ min: 5 }).withMessage('Motivo obrigatório (mínimo 5 caracteres)'),
  ctrl.bloquear
);

router.patch('/:id/desbloquear', adminMiddleware, ctrl.desbloquear);

module.exports = router;
