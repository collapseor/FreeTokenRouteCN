const providers = require('./providers');

class ModelRouter {
  constructor(models, config) {
    this.models = models;
    this.config = config;
    this.providerInstances = new Map();
  }

  resolve(modelId) {
    const model = this.models.map.get(modelId);
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
    };
  }
}

module.exports = ModelRouter;
