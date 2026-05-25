const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/localizacoes.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.listar);
router.get('/:id/lotes', ctrl.lotesPorLocalizacao);

router.post('/',
  adminMiddleware,
  body('corredor').notEmpty().withMessage('Corredor obrigatório'),
  body('nivel').isInt({ min: 1 }).withMessage('Nível inválido'),
  body('posicao').isInt({ min: 1 }).withMessage('Posição inválida'),
  ctrl.criar
);

module.exports = router;
