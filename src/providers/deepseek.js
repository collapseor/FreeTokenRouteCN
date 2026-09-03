const { Readable } = require('stream');
const axios = require('axios');
const BaseProvider = require('./base');
const { solveChallenge } = require('./deepseek-pow');
const { ProviderError } = require('../utils/errors');

const BASE_URL = 'https://chat.deepseek.com/api/v0';

class DeepSeekProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.token = config.token || '';
  }

  _checkToken() {
    if (!this.token) {
      throw new ProviderError('DeepSeek token not configured. Get it from chat.deepseek.com LocalStorage userToken', 500);
    }
  }

  _getHeaders(powResponse) {
    const headers = {
      'accept': '*/*',
      'authorization': `Bearer ${this.token}`,
      'content-type': 'application/json',
      'origin': 'https://chat.deepseek.com',
      'referer': 'https://chat.deepseek.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      'x-app-version': '20241129.1',
      'x-client-locale': 'en_US',
      'x-client-platform': 'web',
      'x-client-version': '1.0.0-always',
    };
    if (powResponse) {
      headers['x-ds-pow-response'] = powResponse;
    }
    return headers;
  }

  async _createSession() {
    let resp;
    try {
      resp = await axios.post(`${BASE_URL}/chat_session/create`, {
        character_id: null,
      }, { headers: this._getHeaders(), timeout: 30000 });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      throw new ProviderError(`Session creation failed: ${msg}`, err.response?.status || 502);
    }

    if (resp.status !== 200 || !resp.data?.data?.biz_data?.id) {
      const detail = JSON.stringify(resp.data?.data || resp.data).slice(0, 200);
      throw new ProviderError(`Session creation failed (${resp.status}): ${detail}`, resp.status);
    }
    return resp.data.data.biz_data.id;
  }

  async _getPowChallenge() {
    let resp;
    try {
      resp = await axios.post(`${BASE_URL}/chat/create_pow_challenge`, {
        target_path: '/api/v0/chat/completion',
      }, { headers: this._getHeaders(), timeout: 30000 });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      throw new ProviderError(`PoW challenge failed: ${msg}`, err.response?.status || 502);
    }

    if (resp.status !== 200 || !resp.data?.data?.biz_data?.challenge) {
      throw new ProviderError('Failed to get PoW challenge', resp.status);
    }
    return resp.data.data.biz_data.challenge;
  }

  _messagesToPrompt(messages) {
    if (messages.length === 1) {
      return messages[0].content;
    }
    const parts = [];
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'User' :
                   msg.role === 'assistant' ? 'Assistant' :
                   msg.role === 'system' ? 'System' : msg.role;
      parts.push(`${role}: ${msg.content}`);
    }
    return parts.join('\n\n');
  }

  async chat(body) {
    this._checkToken();

    const model = body.model;
    const thinkingEnabled = model === 'deepseek-reasoner';
    const prompt = this._messagesToPrompt(body.messages || []);
    const isStream = body.stream === true;

    // 1. 创建会话
    const sessionId = await this._createSession();

    // 2. 获取并求解 PoW
    const challenge = await this._getPowChallenge();
    const powResponse = solveChallenge(challenge);
    if (!powResponse) {
      throw new ProviderError('Failed to solve PoW challenge', 500);
    }

    // 3. 发送对话请求
    const requestBody = {
      chat_session_id: sessionId,
      parent_message_id: null,
      prompt,
      ref_file_ids: [],
      thinking_enabled: thinkingEnabled,
      search_enabled: false,
    };

    const resp = await axios.post(`${BASE_URL}/chat/completion`, requestBody, {
      headers: this._getHeaders(powResponse),
      responseType: 'stream',
      validateStatus: null,
      timeout: 120000,
    });

    if (resp.status !== 200) {
      const errorText = await _readStreamError(resp.data);
      let message = 'DeepSeek web API error';
      try {
        const parsed = JSON.parse(errorText);
        message = parsed.message || parsed.error?.message || message;
      } catch (e) {
        if (errorText.includes('Authentication Fails')) message = 'Invalid or expired token';
      }
      throw new ProviderError(message, resp.status === 401 ? 401 : 502);
    }

    // 4. 转换响应为 OpenAI 格式
    if (isStream) {
      return new SSEConverter(resp.data, model);
    } else {
      return await _accumulateStream(resp.data, model);
    }
  }
}

function _readStreamError(stream) {
  return new Promise((resolve) => {
    let data = '';
    stream.on('data', (chunk) => { data += chunk.toString(); });
    stream.on('end', () => resolve(data));
    stream.on('error', () => resolve(data));
  });
}

function _accumulateStream(stream, model) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let content = '';
    let reasoningContent = '';
    const id = `chatcmpl-${Date.now()}`;

    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const parsed = _parseSSELine(line);
        if (!parsed) continue;
        if (parsed.content) {
          if (parsed.type === 'thinking') {
            reasoningContent += parsed.content;
          } else {
            content += parsed.content;
          }
        }
      }
    });

    stream.on('end', () => {
      if (buffer.trim()) {
        const parsed = _parseSSELine(buffer);
        if (parsed?.content) {
          if (parsed.type === 'thinking') reasoningContent += parsed.content;
          else content += parsed.content;
        }
      }

      const message = { role: 'assistant', content };
      if (reasoningContent) message.reasoning_content = reasoningContent;

      resolve({
        id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    });

    stream.on('error', reject);
  });
}

function _parseSSELine(line) {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6);
  if (data === '[DONE]') return null;
  try {
    const parsed = JSON.parse(data);
    const choice = parsed.choices?.[0];
    if (!choice) return null;
    const delta = choice.delta;
    if (!delta) return null;
    return {
      content: delta.content || '',
      type: delta.type || 'text',
      finishReason: choice.finish_reason,
    };
  } catch (e) {
    return null;
  }
}

class SSEConverter extends Readable {
  constructor(sourceStream, model) {
    super();
    this.model = model;
    this.id = `chatcmpl-${Date.now()}`;
    this.created = Math.floor(Date.now() / 1000);
    this.buffer = '';

    sourceStream.on('data', (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        this._processLine(line);
      }
    });
    sourceStream.on('end', () => {
      if (this.buffer.trim()) this._processLine(this.buffer);
      this.push('data: [DONE]\n\n');
      this.push(null);
    });
    sourceStream.on('error', (err) => {
      this.destroy(err);
    });
  }

  _processLine(line) {
    const parsed = _parseSSELine(line);
    if (!parsed) return;

    const chunk = {
      id: this.id,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: parsed.finishReason || null,
      }],
    };

    if (parsed.content) {
      if (parsed.type === 'thinking') {
        chunk.choices[0].delta.reasoning_content = parsed.content;
      } else {
        chunk.choices[0].delta.content = parsed.content;
      }
    }

    this.push(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  _read() {}
}

module.exports = DeepSeekProvider;
