const express = require('express');
const { loadConfig } = require('./config');
const { loadModels } = require('./models');
const ModelRouter = require('./router');
const Logger = require('./utils/logger');

const config = loadConfig();
const models = loadModels();
const logger = new Logger(config.logging.level);
const modelRouter = new ModelRouter(models, config);

const app = express();

app.use(express.json({ limit: '10mb' }));

app.locals.config = config;
app.locals.models = models;
app.locals.router = modelRouter;
app.locals.logger = logger;

app.use('/v1', require('./routes/v1'));
app.use('/health', require('./routes/health'));

app.listen(config.server.port, () => {
  logger.info(`FreeTokenRouteCN running on http://localhost:${config.server.port}`);
  logger.info(`Available models: ${[...models.map.keys()].join(', ')}`);
});
