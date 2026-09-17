/**
 * 模型别名管理器（内存）。
 *
 * 支持定义多个别名，每个别名绑定一组候选真实模型 + 一种路由策略：
 *   - manual：始终路由到 current 指向的模型，需通过 setManualTarget 切换
 *   - round-robin：每次成功后轮询下一个，分散负载
 *   - fallback：优先用 current 指向的，连续失败 N 次后自动切换到下一个
 *   - random：每次随机选一个
 *
 * 客户端只需用固定的别名（如 "fast"、"reasoning"）作为 model name，
 * 即可在多个真实模型间无缝切换，开发工具代码无需改动。
 */
const VALID_STRATEGIES = new Set(['manual', 'round-robin', 'fallback', 'random']);
const FALLBACK_THRESHOLD = 3; // fallback 策略下连续失败次数阈值

class AliasManager {
  constructor() {
    // name -> { strategy, models: [], current: 0, failCount: 0 }
    this.aliases = new Map();
  }

  /**
   * 定义或覆盖别名
   * @param {string} name 别名（用作 model name）
   * @param {object} opts
   * @param {string} opts.strategy 路由策略
   * @param {string[]} opts.models 候选真实模型 id 列表（至少 1 个）
   */
  define(name, { strategy = 'manual', models = [] }) {
    if (!name || typeof name !== 'string') throw new Error('alias name required');
    if (!VALID_STRATEGIES.has(strategy)) {
      throw new Error(`invalid strategy: ${strategy}`);
    }
    if (!Array.isArray(models) || models.length === 0) {
      throw new Error('at least one candidate model required');
    }
    this.aliases.set(name, {
      strategy,
      models: [...models],
      current: 0,
      failCount: 0,
    });
  }

  /**
   * 删除别名
   */
  remove(name) {
    return this.aliases.delete(name);
  }

  /**
   * 判断给定 modelId 是否为已注册别名
   */
  isAlias(name) {
    return this.aliases.has(name);
  }

  /**
   * 解析别名为真实模型 id（不修改内部状态）
   * @returns {string|null} 真实模型 id，未注册返回 null
   */
  resolve(name) {
    const a = this.aliases.get(name);
    if (!a) return null;
    if (a.strategy === 'manual') {
      return a.models[a.current] || null;
    }
    if (a.strategy === 'round-robin') {
      return a.models[a.current % a.models.length] || null;
    }
    if (a.strategy === 'fallback') {
      return a.models[a.current] || a.models[0] || null;
    }
    if (a.strategy === 'random') {
      return a.models[Math.floor(Math.random() * a.models.length)];
    }
    return null;
  }

  /**
   * 调用成功后调用（按策略更新内部状态）
   */
  recordSuccess(name) {
    const a = this.aliases.get(name);
    if (!a) return;
    if (a.strategy === 'round-robin') {
      a.current = (a.current + 1) % a.models.length;
    } else if (a.strategy === 'fallback') {
      a.failCount = 0; // 成功后清零
    }
  }

  /**
   * 调用失败后调用（按策略更新内部状态）
   */
  recordFailure(name) {
    const a = this.aliases.get(name);
    if (!a) return;
    if (a.strategy === 'fallback') {
      a.failCount += 1;
      if (a.failCount >= FALLBACK_THRESHOLD) {
        a.current = (a.current + 1) % a.models.length;
        a.failCount = 0;
      }
    }
    // round-robin 失败也算"使用过一次"，避免一直打到坏节点
    if (a.strategy === 'round-robin') {
      a.current = (a.current + 1) % a.models.length;
    }
  }

  /**
   * manual / fallback 策略下，手动设置当前指向的模型
   */
  setManualTarget(name, modelId) {
    const a = this.aliases.get(name);
    if (!a) return false;
    const idx = a.models.indexOf(modelId);
    if (idx === -1) return false;
    a.current = idx;
    a.failCount = 0;
    return true;
  }

  /**
   * 返回所有别名配置快照（用于 admin 接口）
   */
  list() {
    return Array.from(this.aliases.entries()).map(([name, a]) => ({
      name,
      strategy: a.strategy,
      models: [...a.models],
      currentModel: a.models[a.current] || null,
      currentIndex: a.current,
      failCount: a.failCount,
    }));
  }
}

module.exports = AliasManager;
