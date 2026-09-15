const express = require('express');
const { loadConfig } = require('./config');
const { loadModels } = require('./models');
const ModelRouter = require('./router');
const SessionManager = require('./session/manager');
const Compression = require('./session/compression');
const Logger = require('./utils/logger');

const config = loadConfig();
const models = loadModels();
const logger = new Logger(config.logging.level);
const modelRouter = new ModelRouter(models, config);
const sessionManager = new SessionManager();

const compression = new Compression({
  sessionManager,
  getProvider: (modelId) => modelRouter.resolve(modelId)?.provider,
  logger,
});

const app = express();
const path = require('path');

app.use(express.json({ limit: '10mb' }));

app.locals.config = config;
app.locals.models = models;
app.locals.router = modelRouter;
app.locals.logger = logger;
app.locals.sessionManager = sessionManager;
app.locals.compression = compression;

// 静态资源（Web UI）
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/v1', require('./routes/v1'));
app.use('/health', require('./routes/health'));

app.listen(config.server.port, () => {
  logger.info(`FreeTokenRouteCN running on http://localhost:${config.server.port}`);
  logger.info(`Web UI: http://localhost:${config.server.port}/`);
  logger.info(`API: http://localhost:${config.server.port}/v1/chat/completions`);
  logger.info(`Available models: ${[...models.map.keys()].join(', ')}`);
  logger.info(`Session manager: in-memory (restart loses history)`);
  logger.info(`Compression: enabled (recent rounds: 8)`);
});
