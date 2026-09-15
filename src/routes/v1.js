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
  const sessionManager = req.app.locals.sessionManager;
  const compression = req.app.locals.compression;
  const metrics = req.app.locals.metrics;
  const { models: modelsData } = req.app.locals;

  const { model: modelId, stream, conversation_id } = req.body;
  const userMessages = req.body.messages || [];

  if (!modelId) {
    return res.status(400).json({ error: { message: 'model is required' } });
  }

  const modelMeta = modelsData.map.get(modelId);
  if (!modelMeta) {
    return res.status(404).json({ error: { message: `Model '${modelId}' not found` } });
  }

  const result = modelRouter.resolve(modelId);
  if (!result) {
    return res.status(404).json({ error: { message: `Model '${modelId}' not found` } });
  }

  const { provider } = result;
  const contextLength = modelMeta.context_length || 32000;

  // 1. 获取或创建会话，追加用户消息
  const isNewSession = !conversation_id || !sessionManager.sessions.has(conversation_id);
  const session = sessionManager.getOrCreate(conversation_id);
  if (isNewSession) metrics.recordSessionCreated();
  for (const msg of userMessages) {
    session.messages.push({ role: msg.role || 'user', content: msg.content });
  }
  session.updatedAt = Date.now();

  // 2. 获取发送给模型的消息 + token 估算
  let { messages: modelMessages, tokenCount, threshold, exceeded } =
    sessionManager.getMessagesForModel(session.id, contextLength);

  if (exceeded) {
    logger.warn(
      `Token exceeded: ${tokenCount} > threshold ${threshold}. ` +
      `Attempting compression...`
    );
    // 3. 执行压缩（摘要旧消息，保留最近 N 轮）
    const compressed = await compression.compressIfNeeded(
      session.id,
      modelId,
      contextLength
    );
    if (compressed) {
      // 压缩后重新获取消息
      const recheck = sessionManager.getMessagesForModel(session.id, contextLength);
      modelMessages = recheck.messages;
      tokenCount = recheck.tokenCount;
      exceeded = recheck.exceeded;
    }
  } else {
    logger.info(`Token estimate: ${tokenCount} / threshold ${threshold}`);
  }

  if (exceeded) {
    logger.warn(
      `Still over threshold after compression (${tokenCount} > ${threshold}). ` +
      `Proceeding anyway, may hit context limit.`
    );
  }

  // 4. 构造请求体
  const requestBody = { ...req.body, messages: modelMessages };

  try {
    logger.info(`-> ${modelId} (stream=${!!stream}, conv=${session.id})`);
    metrics.recordStart(modelMeta.provider, modelId);
    const providerResult = await provider.chat(requestBody);

    // 返回 conversation_id 给客户端
    res.setHeader('X-Conversation-Id', session.id);

    if (stream && typeof providerResult?.pipe === 'function') {
      // 流式：透传 SSE，同时累积内容存入会话
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const collectPromise = _collectAndPipe(providerResult, res);
      collectPromise.then(({ content, reasoning, usage }) => {
        metrics.recordSuccess(modelMeta.provider, modelId, usage || {});
        if (content) {
          sessionManager.appendAssistantMessage(session.id, content, reasoning);
          logger.info(`Stored assistant reply (${content.length} chars) for ${session.id}`);
        }
      }).catch((err) => {
        metrics.recordError(modelMeta.provider, modelId, err);
        logger.error(`Stream collect error: ${err.message}`);
      });

    } else if (providerResult?.data && typeof providerResult.data.pipe === 'function') {
      // 兼容旧的 axios stream 返回
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      providerResult.data.pipe(res);
      metrics.recordSuccess(modelMeta.provider, modelId, {});

    } else {
      // 非流式：直接返回 JSON，并存储回复
      const message = providerResult.choices?.[0]?.message;
      if (message) {
        sessionManager.appendAssistantMessage(
          session.id,
          message.content || '',
          message.reasoning_content
        );
      }
      metrics.recordSuccess(modelMeta.provider, modelId, providerResult.usage || {});
      // 在返回中附带 conversation_id
      providerResult.conversation_id = session.id;
      res.json(providerResult);
    }
  } catch (err) {
    const status = err instanceof ProviderError ? err.statusCode : 500;
    logger.error(`Upstream error: ${err.message}`);
    metrics.recordError(modelMeta.provider, modelId, err);
    // 即使失败也返回 conversation_id，方便客户端重试时复用会话
    res.setHeader('X-Conversation-Id', session.id);
    res.status(status).json({ error: { message: err.message, conversation_id: session.id } });
  }
});

/**
 * 从 SSE 流中提取 content / reasoning_content / usage，同时透传给客户端
 * 返回 Promise<{ content: string, reasoning: string, usage: object }>
 */
function _collectAndPipe(sourceStream, res) {
  return new Promise((resolve) => {
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    let usage = {};

    const flushLine = (line) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (delta) {
          if (delta.content) fullContent += delta.content;
          if (delta.reasoning_content) fullReasoning += delta.reasoning_content;
        }
        // OpenAI 流式末尾会带 usage 字段
        if (parsed.usage) usage = parsed.usage;
      } catch (e) {
        // ignore parse errors
      }
    };

    sourceStream.on('data', (chunk) => {
      res.write(chunk);
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) flushLine(line);
    });

    sourceStream.on('end', () => {
      if (buffer.trim()) flushLine(buffer);
      res.end();
      resolve({ content: fullContent, reasoning: fullReasoning, usage });
    });

    sourceStream.on('error', () => {
      res.end();
      resolve({ content: fullContent, reasoning: fullReasoning, usage });
    });
  });
}

module.exports = router;
