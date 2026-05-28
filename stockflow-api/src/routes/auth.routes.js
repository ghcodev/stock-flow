const { Router } = require('express');
const { body } = require('express-validator');
const { login, logout, alterarSenha } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.post('/login',
  body('email').isEmail().withMessage('E-mail inválido'),
  body('senha').notEmpty().withMessage('Senha obrigatória'),
  login
);

router.get('/perfil', authMiddleware, (req, res) => res.json({ usuario: req.user }));

router.post('/logout', authMiddleware, logout);

router.patch('/senha',
  authMiddleware,
  body('senha_atual').notEmpty().withMessage('Senha atual obrigatória'),
  body('nova_senha').isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres'),
  alterarSenha
);

module.exports = router;
