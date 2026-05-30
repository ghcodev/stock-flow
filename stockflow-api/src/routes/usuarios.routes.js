const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/usuarios.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { checkPermission } = require('../middleware/permission');
const { validate } = require('../middlewares/validate');

const router = Router();
router.use(authMiddleware);

// /perfil não exige admin, deve vir antes de /:id
router.get('/perfil', ctrl.perfil);

router.use(adminMiddleware);

router.get('/', checkPermission('usuarios', 'ver'), ctrl.listar);
router.get('/:id', checkPermission('usuarios', 'ver'), ctrl.buscarPorId);

router.post('/',
  body('nome').trim().notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('senha').isLength({ min: 6 }).withMessage('Senha mínima de 6 caracteres'),
  body('perfil').optional().isIn(['administrador', 'operador']).withMessage('Perfil inválido'),
  checkPermission('usuarios', 'criar'),
  validate,
  ctrl.criar
);

router.put('/:id',
  body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio'),
  body('email').optional().isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('perfil').optional().isIn(['administrador', 'operador']).withMessage('Perfil inválido'),
  validate,
  ctrl.atualizar
);

router.patch('/:id/inativar', ctrl.inativar);

module.exports = router;
