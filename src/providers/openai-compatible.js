const axios = require('axios');
const BaseProvider = require('./base');
const { ProviderError } = require('../utils/errors');

/**
 * 适配原生即 OpenAI 兼容的厂商（Agnes AI / 商汤 SenseNova 等）。
 * 仅做请求透传 + 流式/非流式响应归一化，无需格式转换。
 *
 * 子类需覆盖 defaultApiBase 返回厂商默认 Base URL（不含尾部 /）。
 * 可通过 config.api_base 覆盖默认地址。
 */
class OpenAICompatibleProvider extends BaseProvider {
  get defaultApiBase() {
    throw new Error('subclass must override defaultApiBase');
  }

  constructor(config) {
    super(config);
    this.apiBase = (config.api_base || this.defaultApiBase).replace(/\/+$/, '');
  }

  _getHeaders() {
    this._checkKey();
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async chat(body) {
    this._checkKey();
    const isStream = body.stream === true;
    const url = `${this.apiBase}/chat/completions`;

    const reqConfig = {
      headers: this._getHeaders(),
      timeout: 120000,
      validateStatus: null,
    };
    if (isStream) reqConfig.responseType = 'stream';

    let resp;
    try {
      resp = await axios.post(url, body, reqConfig);
    } catch (err) {
      // 网络层错误（DNS/超时/连接重置）
      const msg = err.response?.data?.error?.message || err.message;
      throw new ProviderError(
        `Upstream request failed: ${msg}`,
        err.response?.status || 502,
        err
      );
    }

    if (resp.status !== 200) {
      // 上游非 200：尝试从响应体提取错误信息
      let detail;
      if (isStream) {
        const errText = await _readStream(resp.data);
        detail = _extractErrorMessage(errText) || errText.slice(0, 200);
      } else {
        detail = _extractErrorMessage(resp.data) ||
          (typeof resp.data === 'string' ? resp.data.slice(0, 200) : JSON.stringify(resp.data).slice(0, 200));
      }
      throw new ProviderError(
        detail || `Upstream error (status ${resp.status})`,
        resp.status === 401 ? 401 : 502
      );
    }

    // 流式：返回原始 SSE 流（已是 OpenAI 格式，由 route 层透传+累积）
    // 非流式：返回解析后的 OpenAI 响应对象
    return resp.data;
  }
}

function _readStream(stream) {
  return new Promise((resolve) => {
    let data = '';
    stream.on('data', (chunk) => { data += chunk.toString(); });
    stream.on('end', () => resolve(data));
    stream.on('error', () => resolve(data));
  });
}

function _extractErrorMessage(data) {
  if (!data) return null;
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return parsed?.error?.message || parsed?.message || null;
  } catch (e) {
    return null;
  }
}

module.exports = OpenAICompatibleProvider;
