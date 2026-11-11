const { validationResult } = require('express-validator');
const { AssistenteIndisponivel, disponivel, responder } = require('../services/assistente');

const INDISPONIVEL = { error: 'Assistente indisponível' };

async function status(req, res) {
  if (!(await disponivel())) return res.status(503).json(INDISPONIVEL);
  return res.json({ disponivel: true });
}

async function perguntar(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { pergunta, historico = [] } = req.body;
  try {
    return res.json(await responder(pergunta, historico));
  } catch (error) {
    if (error instanceof AssistenteIndisponivel) return res.status(503).json(INDISPONIVEL);
    return next(error);
  }
}

module.exports = { status, perguntar };
