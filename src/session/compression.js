const { estimateMessagesTokens } = require('../utils/token');

const DEFAULT_RECENT_ROUNDS = 8; // 保留最近 8 轮完整对话
const DEFAULT_MAX_TOKENS = 4096;
const SAFETY_MARGIN = 1024;

class Compression {
  /**
   * @param {object} deps
   * @param {object} deps.sessionManager - SessionManager 实例
   * @param {function} deps.getProvider - (modelId) => provider 实例
   * @param {object} deps.logger - Logger 实例
   * @param {number} deps.recentRounds - 保留最近几轮完整对话
   * @param {object} deps.history - CompressionHistory 实例（可选）
   * @param {object} deps.metrics - Metrics 实例（可选）
   */
  constructor({ sessionManager, getProvider, logger, recentRounds = DEFAULT_RECENT_ROUNDS, history = null, metrics = null }) {
    this.sessionManager = sessionManager;
    this.getProvider = getProvider;
    this.logger = logger;
    this.recentRounds = recentRounds;
    this.history = history;
    this.metrics = metrics;
  }

  /**
   * 动态调整保留轮数
   */
  setRecentRounds(n) {
    const v = Math.max(1, Math.min(50, parseInt(n, 10) || DEFAULT_RECENT_ROUNDS));
    this.recentRounds = v;
    return v;
  }

  /**
   * 检查是否需要压缩，如需要则执行压缩
   * @returns {Promise<boolean>} 是否执行了压缩
   */
  async compressIfNeeded(sessionId, modelId, contextLength, maxTokens = DEFAULT_MAX_TOKENS) {
    const session = this.sessionManager.getOrCreate(sessionId);
    const { tokenCount, threshold } =
      this.sessionManager.getMessagesForModel(sessionId, contextLength, maxTokens);

    if (tokenCount <= threshold) return false;

    const messages = session.messages;
    const keepCount = this.recentRounds * 2; // 每轮 2 条消息

    if (messages.length <= keepCount) {
      this.logger.warn(`Token exceeded (${tokenCount} > ${threshold}) but not enough history to compress`);
      if (this.history) this.history.record({
        sessionId, modelId, beforeTokens: tokenCount, afterTokens: tokenCount,
        success: false, error: 'not enough history', threshold, contextLength,
      });
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

      const savedPct = (1 - newTokenCount / tokenCount) * 100 | 0;
      this.logger.info(
        `Compression done: ${tokenCount} -> ${newTokenCount} tokens (${savedPct}% saved)`
      );

      if (this.history) this.history.record({
        sessionId, modelId,
        beforeTokens: tokenCount, afterTokens: newTokenCount,
        success: true, threshold, contextLength,
      });
      if (this.metrics) this.metrics.recordCompression();

      return true;
    } catch (err) {
      this.logger.error(`Compression failed: ${err.message}`);
      if (this.history) this.history.record({
        sessionId, modelId, beforeTokens: tokenCount, afterTokens: tokenCount,
        success: false, error: err.message, threshold, contextLength,
      });
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
