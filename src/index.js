const express = require('express');
const path = require('path');
const { loadConfig } = require('./config');
const { loadModels } = require('./models');
const ModelRouter = require('./router');
const AliasManager = require('./aliases');
const SessionManager = require('./session/manager');
const Compression = require('./session/compression');
const Logger = require('./utils/logger');
const Metrics = require('./utils/metrics');
const CompressionHistory = require('./utils/compression-history');

const config = loadConfig();
const models = loadModels();
const logger = new Logger(config.logging.level);
const aliasManager = new AliasManager();
const modelRouter = new ModelRouter(models, config, aliasManager);
const sessionManager = new SessionManager();
const metrics = new Metrics();
const compressionHistory = new CompressionHistory();

const compression = new Compression({
  sessionManager,
  getProvider: (modelId) => modelRouter.resolve(modelId)?.provider,
  logger,
  recentRounds: config.compression?.recent_rounds,
  history: compressionHistory,
  metrics,
});

// 预置一些常用别名（仅内存，重启清空，可通过控制台修改）
const DEFAULT_ALIASES = [
  { name: 'fast', strategy: 'manual', models: ['agnes-2.5-flash', 'sensenova-6.8-flash-lite', 'deepseek-chat'] },
  { name: 'reasoning', strategy: 'manual', models: ['deepseek-reasoner', 'agnes-3.0-flash'] },
  { name: 'default', strategy: 'fallback', models: ['agnes-2.5-flash', 'sensenova-6.8-flash-lite', 'deepseek-chat'] },
];
for (const a of DEFAULT_ALIASES) {
  try { aliasManager.define(a.name, { strategy: a.strategy, models: a.models }); } catch (e) { /* ignore */ }
}

const app = express();

app.use(express.json({ limit: '10mb' }));

app.locals.config = config;
app.locals.models = models;
app.locals.router = modelRouter;
app.locals.aliasManager = aliasManager;
app.locals.logger = logger;
app.locals.sessionManager = sessionManager;
app.locals.compression = compression;
app.locals.metrics = metrics;
app.locals.compressionHistory = compressionHistory;

// 静态资源（Web UI 控制台）
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/v1', require('./routes/v1'));
app.use('/admin', require('./routes/admin'));
app.use('/health', require('./routes/health'));

app.listen(config.server.port, () => {
  logger.info(`FreeTokenRouteCN running on http://localhost:${config.server.port}`);
  logger.info(`Web Console: http://localhost:${config.server.port}/`);
  logger.info(`API: http://localhost:${config.server.port}/v1/chat/completions`);
  logger.info(`Admin API: http://localhost:${config.server.port}/admin/state`);
  logger.info(`Available models: ${[...models.map.keys()].join(', ')}`);
  logger.info(`Aliases: ${aliasManager.list().map(a => a.name).join(', ')}`);
  logger.info(`Session manager: in-memory (restart loses history)`);
  logger.info(`Compression: enabled (recent rounds: ${compression.recentRounds})`);
});
