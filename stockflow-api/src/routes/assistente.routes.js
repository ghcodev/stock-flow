const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/assistente.controller');
const { authMiddleware } = require('../middleware/auth');
const { assistenteLimiter } = require('../middlewares/rateLimiter');

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.status);

router.post('/',
  assistenteLimiter,
  body('pergunta').isString().withMessage('Pergunta inválida').bail().trim()
    .isLength({ min: 1, max: 1000 }).withMessage('A pergunta deve ter de 1 a 1000 caracteres'),
  body('historico').optional().isArray({ max: 10 }).withMessage('Histórico inválido'),
  body('historico.*.papel').isIn(['usuario', 'assistente']).withMessage('Histórico inválido'),
  body('historico.*.texto').isString().withMessage('Histórico inválido').bail()
    .isLength({ max: 2000 }).withMessage('Mensagem do histórico muito longa'),
  ctrl.perguntar
);

module.exports = router;
