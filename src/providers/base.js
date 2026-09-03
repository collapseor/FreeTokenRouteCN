const { ProviderError } = require('../utils/errors');

class BaseProvider {
  constructor(config) {
    this.apiKey = config.api_key || '';
    this.apiBase = config.api_base || '';
  }

  async chat(body) {
    throw new Error('chat() must be implemented by subclass');
  }

  _checkKey() {
    if (!this.apiKey) {
      throw new ProviderError('API key not configured', 500);
    }
  }
}

module.exports = BaseProvider;
