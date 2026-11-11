const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/produtos.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { checkPermission } = require('../middleware/permission');
const { validate } = require('../middlewares/validate');
const { TIPOS_ARMAZENAGEM } = require('../services/sugestaoPosicao');

const router = Router();
const camposArmazenagem = [
  body('tipo_armazenagem').optional().isIn(TIPOS_ARMAZENAGEM).withMessage('Tipo de armazenagem inválido'),
  body('peso_unitario_kg').optional({ values: 'null' }).isFloat({ gt: 0 }).withMessage('Peso por unidade deve ser maior que zero'),
];
router.use(authMiddleware);

router.get('/', checkPermission('produtos', 'ver'), ctrl.listar);
router.get('/:id', checkPermission('produtos', 'ver'), ctrl.buscarPorId);

router.post('/',
  body('nome').trim().notEmpty().withMessage('Nome obrigatório'),
  body('categoria').trim().notEmpty().withMessage('Categoria obrigatória'),
  body('unidade_medida').trim().notEmpty().withMessage('Unidade de medida obrigatória'),
  body('estoque_minimo').optional().isFloat({ min: 0 }).withMessage('Estoque mínimo deve ser >= 0'),
  ...camposArmazenagem,
  checkPermission('produtos', 'criar'),
  validate,
  ctrl.criar
);

router.put('/:id',
  body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio'),
  body('estoque_minimo').optional().isFloat({ min: 0 }).withMessage('Estoque mínimo deve ser >= 0'),
  ...camposArmazenagem,
  checkPermission('produtos', 'editar'),
  validate,
  ctrl.atualizar
);

router.patch('/:id/inativar', adminMiddleware, checkPermission('produtos', 'inativar'), ctrl.inativar);

module.exports = router;
