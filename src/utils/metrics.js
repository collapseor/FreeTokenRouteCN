/**
 * 运行时指标计数器（内存）。
 * 按 provider 维度统计：调用次数 / 成功失败数 / token 用量 / 最近错误。
 * 按 model 维度统计：调用次数 / 成功失败数 / token 用量。
 * 全局统计：总请求数 / 会话数 / 最近一次请求时间。
 */
class Metrics {
  constructor() {
    this.startedAt = Date.now();
    this.global = { totalRequests: 0, totalErrors: 0, lastRequestAt: null };
    this.providers = new Map(); // providerName -> stats
    this.models = new Map();    // modelId -> stats
    this.sessions = { created: 0, active: 0, compressed: 0 };
  }

  _newStatEntry() {
    return {
      calls: 0,
      success: 0,
      failed: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      lastError: null,
      lastErrorAt: null,
      lastCallAt: null,
    };
  }

  _getOrCreate(map, key) {
    if (!map.has(key)) map.set(key, this._newStatEntry());
    return map.get(key);
  }

  /**
   * 记录一次调用开始（无论后续成功失败）
   */
  recordStart(providerName, modelId) {
    this.global.totalRequests += 1;
    this.global.lastRequestAt = Date.now();
    const p = this._getOrCreate(this.providers, providerName);
    p.calls += 1; p.lastCallAt = Date.now();
    const m = this._getOrCreate(this.models, modelId);
    m.calls += 1; m.lastCallAt = Date.now();
  }

  /**
   * 记录调用成功
   */
  recordSuccess(providerName, modelId, usage = {}) {
    const p = this._getOrCreate(this.providers, providerName);
    p.success += 1;
    const m = this._getOrCreate(this.models, modelId);
    m.success += 1;

    const pt = usage.prompt_tokens || 0;
    const ct = usage.completion_tokens || 0;
    const tt = usage.total_tokens || (pt + ct);
    p.promptTokens += pt; p.completionTokens += ct; p.totalTokens += tt;
    m.promptTokens += pt; m.completionTokens += ct; m.totalTokens += tt;
  }

  /**
   * 记录调用失败
   */
  recordError(providerName, modelId, err) {
    this.global.totalErrors += 1;
    const p = this._getOrCreate(this.providers, providerName);
    p.failed += 1;
    p.lastError = err?.message || String(err);
    p.lastErrorAt = Date.now();
    const m = this._getOrCreate(this.models, modelId);
    m.failed += 1;
    m.lastError = err?.message || String(err);
    m.lastErrorAt = Date.now();
  }

  recordSessionCreated() { this.sessions.created += 1; this.sessions.active += 1; }
  recordSessionDeleted() { this.sessions.active = Math.max(0, this.sessions.active - 1); }
  recordCompression() { this.sessions.compressed += 1; }

  /**
   * 返回快照（用于 admin 接口）
   */
  snapshot() {
    const uptimeSec = Math.floor((Date.now() - this.startedAt) / 1000);
    return {
      uptimeSec,
      startedAt: this.startedAt,
      global: {
        ...this.global,
        lastRequestAt: this.global.lastRequestAt,
      },
      sessions: { ...this.sessions },
      providers: Array.from(this.providers.entries()).map(([name, s]) => ({ name, ...s })),
      models: Array.from(this.models.entries()).map(([id, s]) => ({ id, ...s })),
    };
  }
}

module.exports = Metrics;
