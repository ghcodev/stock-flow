require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/v1/auth',           require('./routes/auth.routes'));
app.use('/api/v1/produtos',       require('./routes/produtos.routes'));
app.use('/api/v1/lotes',          require('./routes/lotes.routes'));
app.use('/api/v1/movimentacoes',  require('./routes/movimentacoes.routes'));
app.use('/api/v1/localizacoes',   require('./routes/localizacoes.routes'));
app.use('/api/v1/usuarios',       require('./routes/usuarios.routes'));
app.use('/api/v1/identificacoes', require('./routes/identificacoes.routes'));
app.use('/api/v1/auditoria',      require('./routes/auditoria.routes'));
app.use('/api/v1/dashboard',      require('./routes/dashboard.routes'));
app.use('/api/v1/inventarios',    require('./routes/inventarios.routes'));

// Health check
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: `Rota ${req.method} ${req.path} não encontrada` }));

// Error handler global
app.use((err, req, res, _next) => {
  console.error(`[${req.method} ${req.path}]`, err.message, err.stack?.split('\n')[1]);
  res.status(500).json({ error: 'Erro interno do servidor', detalhe: err.message, timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StockFlow API rodando em http://localhost:${PORT}/api/v1`));

module.exports = app;
