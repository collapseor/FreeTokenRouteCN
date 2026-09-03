const axios = require('axios');
const BaseProvider = require('./base');
const { ProviderError } = require('../utils/errors');

class DeepSeekProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.apiBase = config.api_base || 'https://api.deepseek.com/v1';
  }

  async chat(body) {
    this._checkKey();

    const url = `${this.apiBase}/chat/completions`;
    const isStream = body.stream === true;

    try {
      const response = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: isStream ? 'stream' : 'json',
        timeout: 120000,
      });
      return response;
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        let message = 'Upstream error';
        if (err.response.data && typeof err.response.data === 'object') {
          message = err.response.data.error?.message || err.response.data.message || message;
        }
        throw new ProviderError(message, status, err.response.data);
      }
      throw new ProviderError(err.message, 502);
    }
  }
}

module.exports = DeepSeekProvider;
