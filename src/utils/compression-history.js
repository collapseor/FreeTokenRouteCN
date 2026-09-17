/**
 * 压缩历史记录器（内存，环形缓冲）。
 * 记录每次压缩的会话ID/模型/前后token/降幅/时间。
 */
const MAX_ENTRIES = 100;

class CompressionHistory {
  constructor(maxEntries = MAX_ENTRIES) {
    this.entries = [];
    this.maxEntries = maxEntries;
    this.totals = {
      triggered: 0,    // 触发压缩次数
      succeeded: 0,     // 成功压缩次数
      failed: 0,        // 失败次数
      totalBefore: 0,   // 累计压缩前 token
      totalAfter: 0,    // 累计压缩后 token
    };
  }

  record({ sessionId, modelId, beforeTokens, afterTokens, success, error, threshold, contextLength }) {
    const ts = Date.now();
    const saved = success ? Math.max(0, beforeTokens - afterTokens) : 0;
    const savedPct = (success && beforeTokens > 0) ? Math.round((saved / beforeTokens) * 100) : 0;

    this.entries.unshift({
      ts,
      sessionId,
      modelId,
      beforeTokens,
      afterTokens: success ? afterTokens : null,
      saved,
      savedPct,
      success,
      error: error || null,
      threshold,
      contextLength,
    });
    if (this.entries.length > this.maxEntries) this.entries.length = this.maxEntries;

    this.totals.triggered += 1;
    if (success) {
      this.totals.succeeded += 1;
      this.totals.totalBefore += beforeTokens;
      this.totals.totalAfter += afterTokens;
    } else {
      this.totals.failed += 1;
    }
  }

  snapshot() {
    const avgBefore = this.totals.succeeded ? Math.round(this.totals.totalBefore / this.totals.succeeded) : 0;
    const avgAfter = this.totals.succeeded ? Math.round(this.totals.totalAfter / this.totals.succeeded) : 0;
    const avgSavedPct = (this.totals.succeeded && this.totals.totalBefore > 0)
      ? Math.round((1 - this.totals.totalAfter / this.totals.totalBefore) * 100)
      : 0;
    return {
      totals: { ...this.totals, avgBefore, avgAfter, avgSavedPct },
      recent: this.entries.slice(0, 20),
    };
  }
}

module.exports = CompressionHistory;
