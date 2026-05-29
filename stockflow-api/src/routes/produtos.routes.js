const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/produtos.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { checkPermission } = require('../middleware/permission');

const router = Router();
router.use(authMiddleware);

router.get('/', checkPermission('produtos', 'ver'), ctrl.listar);
router.get('/:id', checkPermission('produtos', 'ver'), ctrl.buscarPorId);

router.post('/',
  body('nome').notEmpty().withMessage('Nome obrigatório'),
  body('categoria').notEmpty().withMessage('Categoria obrigatória'),
  body('unidade_medida').notEmpty().withMessage('Unidade de medida obrigatória'),
  checkPermission('produtos', 'criar'),
  ctrl.criar
);

router.put('/:id',
  body('nome').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  checkPermission('produtos', 'editar'),
  ctrl.atualizar
);

router.patch('/:id/inativar', adminMiddleware, checkPermission('produtos', 'inativar'), ctrl.inativar);

module.exports = router;
