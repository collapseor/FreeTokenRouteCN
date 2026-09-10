const crypto = require('crypto');
const { estimateMessagesTokens } = require('../utils/token');

const DEFAULT_MAX_TOKENS = 4096;
const SAFETY_MARGIN = 1024;

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * 获取或创建会话
   * conversationId 可选，不传则自动生成
   */
  getOrCreate(conversationId) {
    const id = conversationId || this._generateId();
    if (!this.sessions.has(id)) {
      this.sessions.set(id, {
        id,
        messages: [],
        summary: null,
        summaryUpToIndex: -1, // 摘要覆盖到 messages 的哪个索引
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return this.sessions.get(id);
  }

  /**
   * 追加用户消息
   */
  appendUserMessage(conversationId, content) {
    const session = this.getOrCreate(conversationId);
    session.messages.push({ role: 'user', content });
    session.updatedAt = Date.now();
    return session;
  }

  /**
   * 追加助手回复
   */
  appendAssistantMessage(conversationId, content, reasoningContent) {
    const session = this.getOrCreate(conversationId);
    const msg = { role: 'assistant', content };
    if (reasoningContent) {
      msg.reasoning_content = reasoningContent;
    }
    session.messages.push(msg);
    session.updatedAt = Date.now();
    return session;
  }

  /**
   * 设置对话摘要（压缩后使用）
   */
  setSummary(conversationId, summary, upToIndex) {
    const session = this.getOrCreate(conversationId);
    session.summary = summary;
    session.summaryUpToIndex = upToIndex;
    session.updatedAt = Date.now();
  }

  /**
   * 获取发送给模型的消息列表
   * - 如果有摘要，以 system 消息形式注入
   * - 只发送摘要之后的完整消息
   * - 返回 { messages, tokenCount, exceeded }
   */
  getMessagesForModel(conversationId, contextLength, maxTokens = DEFAULT_MAX_TOKENS) {
    const session = this.getOrCreate(conversationId);
    const messages = [];

    // 注入摘要（如果有）
    if (session.summary) {
      messages.push({
        role: 'system',
        content: `[对话摘要]\n${session.summary}`,
      });
    }

    // 只取摘要之后的消息
    const startIndex = session.summaryUpToIndex + 1;
    for (let i = startIndex; i < session.messages.length; i++) {
      const msg = session.messages[i];
      // 不把 reasoning_content 发给模型，节省 token
      const cleanMsg = { role: msg.role, content: msg.content };
      messages.push(cleanMsg);
    }

    const tokenCount = estimateMessagesTokens(messages);
    const threshold = contextLength - maxTokens - SAFETY_MARGIN;
    const exceeded = tokenCount > threshold;

    return { messages, tokenCount, threshold, exceeded, session };
  }

  /**
   * 获取完整消息历史（调试用）
   */
  getFullMessages(conversationId) {
    const session = this.getOrCreate(conversationId);
    return session.messages.slice();
  }

  /**
   * 删除会话
   */
  delete(conversationId) {
    return this.sessions.delete(conversationId);
  }

  _generateId() {
    return `conv_${crypto.randomBytes(8).toString('hex')}`;
  }
}

module.exports = SessionManager;
