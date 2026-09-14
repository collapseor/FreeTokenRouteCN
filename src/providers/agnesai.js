const OpenAICompatibleProvider = require('./openai-compatible');

/**
 * Agnes AI（新加坡 Sapiens AI）。
 * 文本模型 agnes-2.5-flash / agnes-3.0-flash 当前输入输出 Token 全免费，仅 RPM 限制。
 * 国内节点 .cn 链路更稳定，可在 config.api_base 切回国际站 .com。
 */
class AgnesProvider extends OpenAICompatibleProvider {
  get defaultApiBase() {
    return 'https://apihub.agnes-ai.cn/v1';
  }
}

module.exports = AgnesProvider;
