const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/identificacoes.controller');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/:codigo', ctrl.buscarPorCodigo);

router.post('/',
  body('tipo').isIn(['QR Code','RFID']).withMessage('Tipo deve ser QR Code ou RFID'),
  body('codigo').notEmpty().withMessage('Código obrigatório'),
  body('id_lote').isInt({ min: 1 }).withMessage('Lote inválido'),
  ctrl.criar
);

module.exports = router;
