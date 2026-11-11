const { Router } = require('express');
const { body, query } = require('express-validator');
const ctrl = require('../controllers/localizacoes.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.listar);
const sugestao = [
  query('id_produto').isString().withMessage('Produto inv?lido').bail().isInt({ min: 1, max: 2147483647 }).withMessage('Produto inv?lido').toInt(),
  query('quantidade').isString().withMessage('Quantidade inv?lida').bail().matches(/^\d{1,9}(?:\.\d{1,3})?$/).isFloat({ gt: 0 })
    .withMessage('Quantidade deve ser positiva e ter at? tr?s casas decimais').toFloat(),
  query('data_validade').optional().isString().withMessage('Validade inv?lida').bail().matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true })
    .withMessage('Validade inv?lida, use AAAA-MM-DD'),
  ctrl.sugestao,
];

router.get('/sugestao', sugestao);
router.get('/:id/lotes', ctrl.lotesPorLocalizacao);

router.post('/',
  adminMiddleware,
  body('corredor').notEmpty().withMessage('Corredor obrigatório'),
  body('nivel').isInt({ min: 1 }).withMessage('Nível inválido'),
  body('posicao').isInt({ min: 1 }).withMessage('Posição inválida'),
  ctrl.criar
);

module.exports = router;
module.exports.sugestao = [authMiddleware, ...sugestao];
