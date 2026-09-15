const express = require('express');
const providersModule = require('../providers');

const router = express.Router();

// 敏感字段脱敏
function maskSecret(s) {
  if (!s) return null;
  const str = String(s);
  if (str.length <= 8) return '*'.repeat(str.length);
  return str.slice(0, 4) + '****' + str.slice(-4);
}

// 只读管理端点（不暴露完整敏感字段）
router.get('/state', (req, res) => {
  const { config, models, router: modelRouter, sessionManager, compression, metrics, compressionHistory } = req.app.locals;

  // 服务端配置（脱敏）
  const server = {
    port: config.server.port,
    auth: !!config.server.auth,
    apiKey: config.server.auth ? maskSecret(config.server.apiKey) : null,
    apiKeyEnabled: !!(config.server.apiKey), // 是否配置了 key（即使 auth=false 也可能配了 key）
    // 用于客户端接入的说明：auth=false 时不强制鉴权，但仍建议带上任意 Bearer
    authRequirement: config.server.auth ? 'required' : 'optional',
  };

  // Providers 状态（脱敏）- 主动实例化以探测配置信息
  const providers = [];
  for (const [name, ProviderClass] of Object.entries(providersModule)) {
    const providerConfig = config.providers[name] || {};
    // 优先复用已缓存的实例，否则临时实例化仅用于读取元数据
    let instance = modelRouter.providerInstances.get(name);
    if (!instance) {
      try { instance = new ProviderClass(providerConfig); } catch (e) { instance = null; }
    }
    let apiBase = '';
    let authType = 'unknown';
    let configured = false;
    if (instance) {
      apiBase = instance.apiBase || instance.defaultApiBase || '';
      configured = !!(instance.apiKey || instance.token);
      authType = instance.token ? 'web-token' : 'api-key';
    }
    providers.push({
      name,
      authType,
      apiBase,
      configured,
      apiKey: maskSecret(providerConfig.api_key),
      token: maskSecret(providerConfig.token),
      apiBaseOverride: providerConfig.api_base || null,
    });
  }

  // 模型列表
  const modelList = models.data.models.map(m => {
    const r = modelRouter.resolve(m.id);
    return {
      id: m.id,
      provider: m.provider,
      name: m.name,
      type: m.type,
      contextLength: m.context_length,
      auth: m.endpoints?.auth || null,
      chatEndpoint: m.endpoints?.chat || null,
      registrationUrl: m.registration?.url || null,
      docsUrl: m.docs_url || null,
      providerConfigured: r ? !!(r.provider?.apiKey || r.provider?.token) : false,
    };
  });

  // 压缩配置
  const compressionCfg = {
    recentRounds: compression.recentRounds,
    maxTokensDefault: 4096,
    safetyMargin: 1024,
    thresholdFormula: 'context_length - max_tokens - 1024',
    history: compressionHistory ? compressionHistory.snapshot() : null,
  };

  // 运行时指标
  const runtime = {
    uptimeSec: Math.floor((Date.now() - metrics.startedAt) / 1000),
    startedAt: metrics.startedAt,
    sessions: {
      active: sessionManager.sessions.size,
      created: metrics.sessions.created,
      compressed: metrics.sessions.compressed,
    },
    global: metrics.global,
    providerStats: Array.from(metrics.providers.entries()).map(([name, s]) => ({ name, ...s })),
    modelStats: Array.from(metrics.models.entries()).map(([id, s]) => ({ id, ...s })),
  };

  res.json({
    server,
    providers,
    models: modelList,
    compression: compressionCfg,
    runtime,
    generatedAt: Date.now(),
  });
});

// 健康自检
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

module.exports = router;
