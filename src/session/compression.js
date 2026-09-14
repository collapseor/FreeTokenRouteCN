const { estimateMessagesTokens } = require('../utils/token');

const DEFAULT_RECENT_ROUNDS = 8; // 保留最近 8 轮完整对话

class Compression {
  /**
   * @param {object} deps
   * @param {object} deps.sessionManager - SessionManager 实例
   * @param {function} deps.getProvider - (modelId) => provider 实例
   * @param {object} deps.logger - Logger 实例
   * @param {number} deps.recentRounds - 保留最近几轮完整对话
   */
  constructor({ sessionManager, getProvider, logger, recentRounds = DEFAULT_RECENT_ROUNDS }) {
    this.sessionManager = sessionManager;
    this.getProvider = getProvider;
    this.logger = logger;
    this.recentRounds = recentRounds;
  }

  /**
   * 检查是否需要压缩，如需要则执行压缩
   * @returns {Promise<boolean>} 是否执行了压缩
   */
  async compressIfNeeded(sessionId, modelId, contextLength, maxTokens = 4096) {
    const session = this.sessionManager.getOrCreate(sessionId);
    const { tokenCount, threshold } =
      this.sessionManager.getMessagesForModel(sessionId, contextLength, maxTokens);

    if (tokenCount <= threshold) return false;

    const messages = session.messages;
    const keepCount = this.recentRounds * 2; // 每轮 2 条消息

    if (messages.length <= keepCount) {
      this.logger.warn(`Token exceeded (${tokenCount} > ${threshold}) but not enough history to compress`);
      return false;
    }

    // 计算需要摘要的消息范围
    const summarizeEnd = messages.length - keepCount;
    const messagesToSummarize = messages.slice(0, summarizeEnd);

    this.logger.info(
      `Compressing: summarizing ${messagesToSummarize.length} messages, ` +
      `keeping last ${keepCount} messages`
    );

    try {
      const summary = await this._generateSummary(
        modelId,
        messagesToSummarize,
        session.summary
      );

      // 更新会话摘要
      this.sessionManager.setSummary(sessionId, summary, summarizeEnd - 1);

      const { tokenCount: newTokenCount } =
        this.sessionManager.getMessagesForModel(sessionId, contextLength, maxTokens);

      this.logger.info(
        `Compression done: ${tokenCount} -> ${newTokenCount} tokens ` +
        `(${(1 - newTokenCount / tokenCount) * 100 | 0}% saved)`
      );

      return true;
    } catch (err) {
      this.logger.error(`Compression failed: ${err.message}`);
      return false;
    }
  }

  /**
   * 调用模型生成对话摘要
   */
  async _generateSummary(modelId, messages, existingSummary) {
    const provider = this.getProvider(modelId);
    if (!provider) {
      throw new Error(`No provider for model ${modelId}`);
    }

    const prompt = existingSummary
      ? `以下是之前的对话摘要：\n${existingSummary}\n\n请结合以下新的对话内容，更新摘要。保留所有关键信息：用户身份、需求、已达成的结论、重要数据。摘要要简洁，用要点列出。`
      : `请将以下对话压缩为简洁的摘要。用要点列出关键信息：用户身份、需求、已达成的结论、重要数据。不要遗漏任何重要信息。`;

    const summaryMessages = [
      { role: 'system', content: prompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const result = await provider.chat({
      model: modelId,
      messages: summaryMessages,
      stream: false,
    });

    const content = result.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
      throw new Error('Summary model returned empty content');
    }
    return content.trim();
  }
}

module.exports = Compression;
