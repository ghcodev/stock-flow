const { Router } = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/localizacoes.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { TIPOS_ARMAZENAGEM } = require('../services/sugestaoPosicao');

const router = Router();
router.use(authMiddleware);
const camposArmazenagem = [
  body('capacidade').optional({ values: 'null' }).isFloat({ gt: 0 }).withMessage('Capacidade deve ser maior que zero'),
  body('tipo_zona').optional().isIn(TIPOS_ARMAZENAGEM).withMessage('Tipo de zona inválido'),
  body('distancia_expedicao').optional().isInt({ min: 0 }).withMessage('Distância até a expedição deve ser um inteiro >= 0'),
];

router.get('/', ctrl.listar);
const sugestao = [
  query('id_produto').isString().withMessage('Produto inválido').bail().isInt({ min: 1, max: 2147483647 }).withMessage('Produto inválido').toInt(),
  query('quantidade').isString().withMessage('Quantidade inválida').bail().matches(/^\d{1,9}(?:\.\d{1,3})?$/).isFloat({ gt: 0 })
    .withMessage('Quantidade deve ser positiva e ter até três casas decimais').toFloat(),
  query('data_validade').optional().isString().withMessage('Validade inválida').bail().matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true })
    .withMessage('Validade inválida, use AAAA-MM-DD'),
  ctrl.sugestao,
];

router.get('/sugestao', sugestao);
router.get('/:id/lotes', ctrl.lotesPorLocalizacao);

router.post('/',
  adminMiddleware,
  body('corredor').notEmpty().withMessage('Corredor obrigatório'),
  body('nivel').isInt({ min: 1 }).withMessage('Nível inválido'),
  body('posicao').isInt({ min: 1 }).withMessage('Posição inválida'),
  ...camposArmazenagem,
  ctrl.criar
);

router.put('/:id',
  adminMiddleware,
  param('id').isInt({ min: 1 }).withMessage('Localização inválida'),
  body('corredor').optional().notEmpty().withMessage('Corredor obrigatório'),
  body('nivel').optional().isInt({ min: 1 }).withMessage('Nível inválido'),
  body('posicao').optional().isInt({ min: 1 }).withMessage('Posição inválida'),
  ...camposArmazenagem,
  ctrl.atualizar
);

module.exports = router;
module.exports.sugestao = [authMiddleware, ...sugestao];
