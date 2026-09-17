const providers = require('./providers');

class ModelRouter {
  constructor(models, config, aliasManager = null) {
    this.models = models;
    this.config = config;
    this.providerInstances = new Map();
    this.aliasManager = aliasManager;
  }

  /**
   * 设置 aliasManager（用于运行时注入，避免构造时循环依赖）
   */
  setAliasManager(am) {
    this.aliasManager = am;
  }

  /**
   * 解析 modelId 为 { provider, model, isAlias, aliasName, resolvedModelId }
   * - 如果 modelId 是已注册别名，先解析出真实 model id
   * - 否则按原逻辑直接路由
   */
  resolve(modelId) {
    // 别名优先
    let resolvedId = modelId;
    let isAlias = false;
    let aliasName = null;
    if (this.aliasManager && this.aliasManager.isAlias(modelId)) {
      isAlias = true;
      aliasName = modelId;
      resolvedId = this.aliasManager.resolve(modelId);
      if (!resolvedId) return null;
    }

    const model = this.models.map.get(resolvedId);
    if (!model) return null;

    const providerName = model.provider;

    if (!this.providerInstances.has(providerName)) {
      const ProviderClass = providers[providerName];
      if (!ProviderClass) return null;

      const providerConfig = this.config.providers[providerName] || {};
      const instance = new ProviderClass(providerConfig);
      this.providerInstances.set(providerName, instance);
    }

    return {
      provider: this.providerInstances.get(providerName),
      model,
      isAlias,
      aliasName,
      resolvedModelId: resolvedId,
    };
  }
}

module.exports = ModelRouter;
