const OpenAICompatibleProvider = require('./openai-compatible');

/**
 * 商汤日日新 SenseNova。
 * Token Plan 公测期免费，覆盖 sensenova-6.8-flash-lite / deepseek-v4-flash / glm-5.2 等，
 * 每 5 小时 1500 次调用额度。OpenAI 兼容协议，直接透传。
 */
class SenseNovaProvider extends OpenAICompatibleProvider {
  get defaultApiBase() {
    return 'https://token.sensenova.cn/v1';
  }
}

module.exports = SenseNovaProvider;
