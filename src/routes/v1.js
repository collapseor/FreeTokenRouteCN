const express = require('express');
const { ProviderError } = require('../utils/errors');

const router = express.Router();

// 鉴权中间件
router.use((req, res, next) => {
  const config = req.app.locals.config;
  if (!config.server.auth) return next();

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== config.server.apiKey) {
    return res.status(401).json({ error: { message: 'Invalid API key' } });
  }
  next();
});

// GET /v1/models
router.get('/models', (req, res) => {
  const { models } = req.app.locals;
  const modelList = models.data.models.map((m) => ({
    id: m.id,
    object: 'model',
    owned_by: m.provider,
  }));
  res.json({ object: 'list', data: modelList });
});

// POST /v1/chat/completions
router.post('/chat/completions', async (req, res) => {
  const logger = req.app.locals.logger;
  const modelRouter = req.app.locals.router;
  const { model: modelId, stream } = req.body;

  if (!modelId) {
    return res.status(400).json({ error: { message: 'model is required' } });
  }

  const result = modelRouter.resolve(modelId);
  if (!result) {
    return res.status(404).json({ error: { message: `Model '${modelId}' not found` } });
  }

  const { provider } = result;

  try {
    logger.info(`-> ${modelId} (stream=${!!stream})`);
    const result = await provider.chat(req.body);

    if (stream && typeof result?.pipe === 'function') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      result.pipe(res);
    } else if (result?.data && typeof result.data.pipe === 'function') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      result.data.pipe(res);
    } else {
      res.json(result);
    }
  } catch (err) {
    const status = err instanceof ProviderError ? err.statusCode : 500;
    logger.error(`Upstream error: ${err.message}`);
    res.status(status).json({ error: { message: err.message } });
  }
});

module.exports = router;
