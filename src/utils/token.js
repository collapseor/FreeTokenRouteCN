const { encode } = require('gpt-tokenizer');

/**
 * 从 message.content 中提取纯文本
 * 兼容 string / string[] / {type, text}[] 等格式
 */
function extractText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if (typeof part.text === 'string') return part.text;
          if (typeof part.content === 'string') return part.content;
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  return String(content);
}

/**
 * 估算单条消息的 token 数
 * 参考 OpenAI 计费：每条消息约 4 tokens 开销
 */
function estimateMessageTokens(message) {
  const text = extractText(message.content);
  const roleText = message.role || '';
  const nameText = message.name || '';

  // content + role + name + 消息开销
  const total = `${roleText} ${nameText} ${text}`.trim();
  return encode(total).length + 4;
}

/**
 * 估算消息列表的总 token 数
 * 包含系统消息开销
 */
function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  // 每条回复的起始 token 开销
  total += 2;
  return total;
}

module.exports = { extractText, estimateMessageTokens, estimateMessagesTokens };
