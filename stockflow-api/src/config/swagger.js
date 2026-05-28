const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'StockFlow API',
      version: '1.3.0',
      description: 'API REST do sistema de gerenciamento de estoque StockFlow',
      contact: {
        name: 'Equipe StockFlow',
        email: 'admin@stockflow.com',
      },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Desenvolvimento' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Produto: {
          type: 'object',
          properties: {
            id:             { type: 'integer', example: 1 },
            nome:           { type: 'string',  example: 'Pão Francês' },
            categoria:      { type: 'string',  example: 'Pães' },
            unidade_medida: { type: 'string',  example: 'unidade' },
            estoque_minimo: { type: 'number',  example: 50 },
            ativo:          { type: 'boolean', example: true },
          },
        },
        Lote: {
          type: 'object',
          properties: {
            id:              { type: 'integer', example: 1 },
            numero_lote:     { type: 'string',  example: 'LOT-AT-001' },
            produto_nome:    { type: 'string',  example: 'Pão Francês' },
            data_fabricacao: { type: 'string',  example: '2026-05-27' },
            data_validade:   { type: 'string',  example: '2026-05-29' },
            quantidade:      { type: 'number',  example: 200 },
            status_lote:     { type: 'string',  enum: ['ativo','vencido','bloqueado','quarentena','finalizado'], example: 'ativo' },
          },
        },
        Movimentacao: {
          type: 'object',
          properties: {
            id:               { type: 'integer', example: 1 },
            tipo:             { type: 'string',  enum: ['entrada','saida','transferencia','ajuste','inventario'], example: 'entrada' },
            quantidade:       { type: 'number',  example: 100 },
            data_movimentacao:{ type: 'string',  example: '2026-05-27T08:00:00Z' },
            produto_nome:     { type: 'string',  example: 'Pão Francês' },
            codigo_lote:      { type: 'string',  example: 'LOT-AT-001' },
            usuario_nome:     { type: 'string',  example: 'Carlos Eduardo' },
            status:           { type: 'string',  enum: ['pendente','concluida','cancelada'], example: 'concluida' },
          },
        },
        Localizacao: {
          type: 'object',
          properties: {
            id:       { type: 'integer', example: 1 },
            corredor: { type: 'string',  example: 'CF01-A' },
            nivel:    { type: 'integer', example: 1 },
            posicao:  { type: 'integer', example: 1 },
            descricao:{ type: 'string',  example: 'CF-01 Câmara Fria · Corredor A · Nível 1 · Posição 1' },
          },
        },
        Usuario: {
          type: 'object',
          properties: {
            id:     { type: 'integer', example: 1 },
            nome:   { type: 'string',  example: 'Carlos Eduardo Matos' },
            email:  { type: 'string',  example: 'carlos@stockflow.com' },
            perfil: { type: 'string',  enum: ['administrador','operador'], example: 'administrador' },
            ativo:  { type: 'boolean', example: true },
          },
        },
        Inventario: {
          type: 'object',
          properties: {
            id:               { type: 'integer', example: 1 },
            corredor:         { type: 'string',  example: 'CF-01' },
            usuario_nome:     { type: 'string',  example: 'Carlos Eduardo' },
            total:            { type: 'integer', example: 96 },
            conferidos:       { type: 'integer', example: 96 },
            divergencias:     { type: 'integer', example: 2 },
            acuracidade:      { type: 'number',  example: 97.92 },
            status:           { type: 'string',  enum: ['em andamento','concluido','cancelado'], example: 'concluido' },
            inicio:           { type: 'string',  example: '2026-05-06T20:00:00Z' },
            fim:              { type: 'string',  example: '2026-05-06T22:00:00Z' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'senha'],
          properties: {
            email: { type: 'string', example: 'admin@stockflow.com' },
            senha: { type: 'string', example: 'Admin@1234' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGci...' },
            usuario: {
              type: 'object',
              properties: {
                id:     { type: 'integer', example: 1 },
                nome:   { type: 'string',  example: 'Carlos Eduardo Matos' },
                email:  { type: 'string',  example: 'carlos@stockflow.com' },
                perfil: { type: 'string',  example: 'administrador' },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error:     { type: 'string', example: 'Mensagem de erro' },
            codigo:    { type: 'string', example: 'RN11' },
            timestamp: { type: 'string', example: '2026-05-27T14:30:00Z' },
          },
        },
        Paginado: {
          type: 'object',
          properties: {
            data:  { type: 'array', items: {} },
            total: { type: 'integer', example: 42 },
            page:  { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',          description: 'Autenticação e sessão' },
      { name: 'Dashboard',     description: 'Indicadores e KPIs em tempo real' },
      { name: 'Produtos',      description: 'Cadastro e gestão de produtos' },
      { name: 'Lotes',         description: 'Gestão de lotes, RFID e rastreabilidade' },
      { name: 'Movimentações', description: 'Entrada, saída, transferência e ajuste' },
      { name: 'Localizações',  description: 'Posições do armazém' },
      { name: 'Identificações',description: 'QR Code e RFID' },
      { name: 'Auditoria',     description: 'Trilha imutável de operações' },
      { name: 'Usuários',      description: 'Gestão de usuários e perfis' },
      { name: 'Inventários',   description: 'Inventário rotativo' },
    ],
    paths: {
      /* ── AUTH ── */
      '/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Autenticar usuário', security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
          responses: {
            200: { description: 'Token JWT gerado', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
            400: { description: 'Dados inválidos' },
            401: { description: 'Credenciais inválidas' },
          },
        },
      },
      '/auth/perfil': {
        get: {
          tags: ['Auth'], summary: 'Retorna dados do usuário logado via token',
          responses: { 200: { description: 'Dados do usuário autenticado' }, 401: { description: 'Token inválido ou expirado' } },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'], summary: 'Invalidar token (blacklist)',
          responses: { 200: { description: 'Logout realizado' } },
        },
      },
      '/auth/senha': {
        patch: {
          tags: ['Auth'], summary: 'Alterar senha do usuário logado',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['senha_atual','nova_senha'], properties: { senha_atual: { type: 'string' }, nova_senha: { type: 'string', minLength: 6 } } } } } },
          responses: { 200: { description: 'Senha alterada' }, 401: { description: 'Senha atual incorreta' } },
        },
      },

      /* ── DASHBOARD ── */
      '/dashboard/kpis': {
        get: {
          tags: ['Dashboard'], summary: 'KPIs em tempo real',
          responses: { 200: { description: 'movimentacoes_hoje, total_produtos, lotes_vencendo, lotes_bloqueados' } },
        },
      },
      '/dashboard/movimentacoes': {
        get: {
          tags: ['Dashboard'], summary: 'Movimentações dos últimos 30 dias (dados para gráfico)',
          responses: { 200: { description: 'Array com dia e total por dia' } },
        },
      },
      '/dashboard/alertas': {
        get: {
          tags: ['Dashboard'], summary: 'Alertas críticos de estoque e vencimento',
          responses: { 200: { description: 'Lista de alertas com nível e produto' } },
        },
      },

      /* ── PRODUTOS ── */
      '/produtos': {
        get: {
          tags: ['Produtos'], summary: 'Listar produtos',
          parameters: [
            { name: 'busca',     in: 'query', schema: { type: 'string' }, description: 'Filtrar por nome' },
            { name: 'categoria', in: 'query', schema: { type: 'string' } },
            { name: 'page',      in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',     in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Lista paginada de produtos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Paginado' } } } } },
        },
        post: {
          tags: ['Produtos'], summary: 'Cadastrar produto',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nome','categoria','unidade_medida'], properties: { nome: { type: 'string' }, categoria: { type: 'string' }, unidade_medida: { type: 'string' }, estoque_minimo: { type: 'number' } } } } } },
          responses: { 201: { description: 'Produto criado' }, 400: { description: 'Dados inválidos' }, 409: { description: 'Nome já cadastrado' } },
        },
      },
      '/produtos/{id}': {
        get: {
          tags: ['Produtos'], summary: 'Buscar produto por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Produto encontrado' }, 404: { description: 'Não encontrado' } },
        },
        put: {
          tags: ['Produtos'], summary: 'Atualizar produto',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Produto' } } } },
          responses: { 200: { description: 'Produto atualizado' } },
        },
      },

      /* ── LOTES ── */
      '/lotes': {
        get: {
          tags: ['Lotes'], summary: 'Listar lotes',
          parameters: [
            { name: 'status',  in: 'query', schema: { type: 'string', enum: ['ativo','vencido','bloqueado','quarentena','finalizado'] } },
            { name: 'produto', in: 'query', schema: { type: 'string' } },
            { name: 'page',    in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',   in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Lista paginada de lotes' } },
        },
      },
      '/lotes/vencendo': {
        get: {
          tags: ['Lotes'], summary: 'Lotes com vencimento próximo',
          parameters: [{ name: 'dias', in: 'query', schema: { type: 'integer', default: 7 }, description: 'Janela em dias (default 7)' }],
          responses: { 200: { description: 'Lotes vencendo dentro do período' } },
        },
      },
      '/lotes/abaixo-minimo': {
        get: {
          tags: ['Lotes'], summary: 'Lotes com estoque abaixo do mínimo',
          responses: { 200: { description: 'Lotes que precisam de reposição' } },
        },
      },
      '/lotes/{id}': {
        get: {
          tags: ['Lotes'], summary: 'Buscar lote por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Lote encontrado' }, 404: { description: 'Não encontrado' } },
        },
      },
      '/lotes/{id}/timeline': {
        get: {
          tags: ['Lotes'], summary: 'Timeline completa de movimentações do lote',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Histórico cronológico' } },
        },
      },

      /* ── MOVIMENTAÇÕES ── */
      '/movimentacoes': {
        get: {
          tags: ['Movimentações'], summary: 'Histórico de movimentações',
          parameters: [
            { name: 'tipo',    in: 'query', schema: { type: 'string', enum: ['entrada','saida','transferencia','ajuste'] } },
            { name: 'search',  in: 'query', schema: { type: 'string' }, description: 'Buscar por produto ou lote' },
            { name: 'page',    in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',   in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Lista paginada com produto_nome, codigo_lote e localizações' } },
        },
      },
      '/movimentacoes/entrada': {
        post: {
          tags: ['Movimentações'], summary: 'Registrar entrada de lote',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['id_lote','quantidade'], properties: { id_lote: { type: 'integer', example: 1 }, quantidade: { type: 'number', example: 100 }, id_localizacao_destino: { type: 'integer', example: 1 }, observacao: { type: 'string' } } } } } },
          responses: { 201: { description: 'Entrada registrada — lote.quantidade incrementado' }, 404: { description: 'Lote não encontrado' } },
        },
      },
      '/movimentacoes/saida': {
        post: {
          tags: ['Movimentações'], summary: 'Registrar saída (valida RN11 e RN16)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['id_lote','quantidade'], properties: { id_lote: { type: 'integer', example: 1 }, quantidade: { type: 'number', example: 50 }, observacao: { type: 'string' } } } } } },
          responses: {
            201: { description: 'Saída registrada' },
            422: { description: 'RN11 — Estoque insuficiente | RN16 — Lote bloqueado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/movimentacoes/transferencia': {
        post: {
          tags: ['Movimentações'], summary: 'Transferir lote entre localizações (valida RN16, exige motivo)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['id_lote','id_localizacao_destino','motivo_movimentacao'], properties: { id_lote: { type: 'integer', example: 1 }, id_localizacao_destino: { type: 'integer', example: 2 }, motivo_movimentacao: { type: 'string', minLength: 10, example: 'Reorganização câmara fria' } } } } } },
          responses: { 201: { description: 'Transferência registrada — lote.id_localizacao atualizado' }, 422: { description: 'Lote bloqueado (RN16)' } },
        },
      },
      '/movimentacoes/ajuste': {
        post: {
          tags: ['Movimentações'], summary: 'Ajuste de estoque — apenas administradores',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['id_lote','nova_quantidade','justificativa'], properties: { id_lote: { type: 'integer', example: 1 }, nova_quantidade: { type: 'number', example: 150 }, justificativa: { type: 'string', minLength: 10 } } } } } },
          responses: { 201: { description: 'Ajuste realizado com diff registrado em auditoria' } },
        },
      },
      '/movimentacoes/inventario': {
        post: {
          tags: ['Movimentações'], summary: 'Processar contagem de inventário e retornar divergências',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['contagens'], properties: { contagens: { type: 'array', items: { type: 'object', properties: { id_lote: { type: 'integer' }, quantidade_contada: { type: 'number' } } } } } } } } },
          responses: { 200: { description: 'Lista de divergências entre sistema e contagem física' } },
        },
      },

      /* ── LOCALIZAÇÕES ── */
      '/localizacoes': {
        get: {
          tags: ['Localizações'], summary: 'Listar posições do armazém',
          responses: { 200: { description: 'Array de localizações' } },
        },
      },
      '/localizacoes/{id}/lotes': {
        get: {
          tags: ['Localizações'], summary: 'Lotes alocados em uma posição',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Lotes na posição' } },
        },
      },

      /* ── IDENTIFICAÇÕES ── */
      '/identificacoes/{codigo}': {
        get: {
          tags: ['Identificações'], summary: 'Buscar lote por QR Code ou RFID',
          parameters: [{ name: 'codigo', in: 'path', required: true, schema: { type: 'string' }, example: 'RF-AT-001' }],
          responses: { 200: { description: 'Lote com produto e localização' }, 404: { description: 'Código não encontrado' } },
        },
      },
      '/identificacoes': {
        post: {
          tags: ['Identificações'], summary: 'Gerar identificação para lote',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tipo','codigo','id_lote'], properties: { tipo: { type: 'string', enum: ['QR Code','RFID'] }, codigo: { type: 'string' }, id_lote: { type: 'integer' } } } } } },
          responses: { 201: { description: 'Identificação criada' }, 409: { description: 'Lote ou código já possui identificação' } },
        },
      },

      /* ── AUDITORIA ── */
      '/auditoria': {
        get: {
          tags: ['Auditoria'], summary: 'Trilha de auditoria — apenas administradores',
          parameters: [
            { name: 'operacao', in: 'query', schema: { type: 'string', enum: ['INSERT','UPDATE','DELETE','LOGIN','AJUSTE','BLOQUEIO'] } },
            { name: 'page',     in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',    in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: { 200: { description: 'Registros imutáveis de auditoria' } },
        },
      },
      '/auditoria/lote/{id}': {
        get: {
          tags: ['Auditoria'], summary: 'Auditoria de um lote específico',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Histórico de operações no lote' } },
        },
      },
      '/auditoria/usuario/{id}': {
        get: {
          tags: ['Auditoria'], summary: 'Auditoria por usuário',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Operações realizadas pelo usuário' } },
        },
      },

      /* ── USUÁRIOS ── */
      '/usuarios/perfil': {
        get: {
          tags: ['Usuários'], summary: 'Dados do usuário logado',
          responses: { 200: { description: 'Perfil do usuário autenticado' } },
        },
      },
      '/usuarios': {
        get: {
          tags: ['Usuários'], summary: 'Listar usuários — apenas administradores',
          responses: { 200: { description: 'Lista de usuários ativos' } },
        },
        post: {
          tags: ['Usuários'], summary: 'Criar usuário',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nome','email','senha'], properties: { nome: { type: 'string' }, email: { type: 'string', format: 'email' }, senha: { type: 'string', minLength: 6 }, perfil: { type: 'string', enum: ['administrador','operador'] } } } } } },
          responses: { 201: { description: 'Usuário criado' }, 409: { description: 'E-mail já cadastrado' } },
        },
      },
      '/usuarios/{id}': {
        get: {
          tags: ['Usuários'], summary: 'Buscar usuário por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Usuário encontrado' }, 404: { description: 'Não encontrado' } },
        },
      },

      /* ── INVENTÁRIOS ── */
      '/inventarios': {
        get: {
          tags: ['Inventários'], summary: 'Listar sessões de inventário rotativo',
          responses: { 200: { description: 'Lista de inventários com acuracidade e status' } },
        },
        post: {
          tags: ['Inventários'], summary: 'Iniciar nova sessão de inventário',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['corredor'], properties: { corredor: { type: 'string', example: 'CF-01' }, observacao: { type: 'string' } } } } } },
          responses: { 201: { description: 'Inventário iniciado com status "em andamento"' } },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
}

module.exports = swaggerJsdoc(options)
