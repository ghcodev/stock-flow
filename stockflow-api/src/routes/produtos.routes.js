const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/produtos.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.buscarPorId);

router.post('/',
  body('nome').notEmpty().withMessage('Nome obrigatório'),
  body('categoria').notEmpty().withMessage('Categoria obrigatória'),
  body('unidade_medida').notEmpty().withMessage('Unidade de medida obrigatória'),
  ctrl.criar
);

router.put('/:id',
  body('nome').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  ctrl.atualizar
);

router.patch('/:id/inativar', adminMiddleware, ctrl.inativar);

module.exports = router;
