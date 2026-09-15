/* FreeTokenRouteCN 控制台交互逻辑 */
(() => {
  'use strict';

  const state = { data: null, view: 'overview' };
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ============ 工具 ============
  function escapeHTML(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtNum(n) {
    if (n === null || n === undefined) return '-';
    return Number(n).toLocaleString('en-US');
  }

  function fmtTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getMonth()+1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function fmtDuration(sec) {
    if (!sec && sec !== 0) return '-';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d}天${h}小时`;
    if (h > 0) return `${h}小时${m}分`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  }

  function fmtCtx(len) {
    if (!len) return '-';
    if (len >= 1000000) return (len / 1000000) + 'M';
    if (len >= 1000) return (len / 1000) + 'K';
    return String(len);
  }

  // ============ API ============
  async function loadState() {
    try {
      const r = await fetch('/admin/state');
      state.data = await r.json();
      render();
    } catch (e) {
      console.error('loadState failed:', e);
    }
  }

  // ============ 渲染 ============
  function render() {
    if (!state.data) return;
    renderTopbar();
    renderOverview();
    renderEndpoints();
    renderModels();
    renderProviders();
    renderCompression();
    renderMetrics();
  }

  function renderTopbar() {
    $('#uptime').textContent = '运行 ' + fmtDuration(state.data.runtime.uptimeSec);
  }

  function renderOverview() {
    const d = state.data;
    const configuredProviders = d.providers.filter(p => p.configured).length;
    const totalProviders = d.providers.length;
    const modelsCount = d.models.length;
    const readyModels = d.models.filter(m => m.providerConfigured).length;
    const activeSessions = d.runtime.sessions.active;

    $('#overview-cards').innerHTML = `
      <div class="card accent">
        <div class="card-label">接入模型</div>
        <div class="card-value">${modelsCount}</div>
        <div class="card-sub">就绪 ${readyModels} / ${modelsCount}</div>
      </div>
      <div class="card green">
        <div class="card-label">Provider 已配置</div>
        <div class="card-value">${configuredProviders}</div>
        <div class="card-sub">共 ${totalProviders} 个</div>
      </div>
      <div class="card">
        <div class="card-label">活跃会话</div>
        <div class="card-value">${activeSessions}</div>
        <div class="card-sub">累计创建 ${d.runtime.sessions.created}</div>
      </div>
      <div class="card amber">
        <div class="card-label">压缩次数</div>
        <div class="card-value">${d.runtime.sessions.compressed}</div>
        <div class="card-sub">保留 ${d.compression.recentRounds} 轮</div>
      </div>
      <div class="card">
        <div class="card-label">总请求</div>
        <div class="card-value">${fmtNum(d.runtime.global.totalRequests)}</div>
        <div class="card-sub">失败 ${d.runtime.global.totalErrors}</div>
      </div>
    `;

    $('#overview-status').innerHTML = `
      <div class="status-row">
        <div class="status-item">
          <span class="status-item-label">服务端口</span>
          <span class="status-item-value">${d.server.port}</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">服务端鉴权</span>
          <span class="status-item-value">${d.server.auth ? '已启用' : '未启用'}</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">服务端 API Key</span>
          <span class="status-item-value">${d.server.apiKey || '（未配置）'}</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">启动时间</span>
          <span class="status-item-value">${fmtTime(d.runtime.startedAt)}</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">最近请求</span>
          <span class="status-item-value">${fmtTime(d.runtime.global.lastRequestAt)}</span>
        </div>
      </div>
    `;

    $('#overview-models').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>模型 ID</th><th>Provider</th><th>上下文</th><th>状态</th>
          </tr></thead>
          <tbody>
            ${d.models.map(m => `
              <tr>
                <td class="mono">${escapeHTML(m.id)}</td>
                <td class="muted">${escapeHTML(m.provider)}</td>
                <td>${fmtCtx(m.contextLength)}</td>
                <td>${m.providerConfigured
                  ? '<span class="badge green">就绪</span>'
                  : '<span class="badge amber">未配 Key</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEndpoints() {
    const d = state.data;
    const base = `${location.protocol}//${location.host}`;

    // 鉴权状态提示
    const authState = d.server.auth
      ? `<span class="notice-label">鉴权状态</span>
         <span class="notice-value"><span class="badge green">已启用</span> 客户端必须携带 <code>Authorization: Bearer ${escapeHTML(d.server.apiKey || 'YOUR_KEY')}</code></span>`
      : `<span class="notice-label">鉴权状态</span>
         <span class="notice-value"><span class="badge amber">未启用</span> 当前任意 Bearer 均可（生产部署建议在 config.yaml 开启 <code>server.auth: true</code>）</span>`;
    $('#endpoints-auth-state').innerHTML = authState;

    // 对外端点
    $('#endpoints-list').innerHTML = `
      <div class="status-row">
        <div class="status-item">
          <span class="status-item-label">对话端点（客户端调用）</span>
          <span class="status-item-value">${base}/v1/chat/completions</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">模型列表</span>
          <span class="status-item-value">${base}/v1/models</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">健康检查</span>
          <span class="status-item-value">${base}/health</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">管理接口（只读）</span>
          <span class="status-item-value">${base}/admin/state</span>
        </div>
      </div>
    `;

    // 可用模型列表（点击复制 model name）
    const readyModels = d.models.filter(m => m.providerConfigured);
    const modelChips = (readyModels.length > 0 ? readyModels : d.models).map(m => `
      <div class="model-chip ${m.providerConfigured ? '' : 'dim'}" data-model="${escapeHTML(m.id)}" title="点击复制 model name">
        <span class="model-chip-id mono">${escapeHTML(m.id)}</span>
        <span class="model-chip-provider muted">${escapeHTML(m.provider)}</span>
        ${m.providerConfigured ? '<span class="badge green">就绪</span>' : '<span class="badge amber">未配</span>'}
      </div>
    `).join('');
    $('#endpoints-models').innerHTML = modelChips
      || '<div class="empty">无可用模型</div>';
    $$('#endpoints-models .model-chip').forEach(c => {
      c.addEventListener('click', () => {
        navigator.clipboard?.writeText(c.dataset.model);
        const original = c.querySelector('.model-chip-id').textContent;
        c.querySelector('.model-chip-id').textContent = '已复制: ' + c.dataset.model;
        setTimeout(() => { c.querySelector('.model-chip-id').textContent = original; }, 1200);
      });
    });

    // curl 示例（带 API Key 占位）
    const sampleModel = readyModels[0] || d.models[0];
    const apiKeyPlaceholder = d.server.auth ? 'YOUR_API_KEY' : 'any';
    const authHeader = `-H "Authorization: Bearer ${apiKeyPlaceholder}" \\`;
    $('#endpoints-curl').innerHTML = `
      <div class="code-block">
        <button class="copy">复制</button>
        <span style="color:#5e6671;"># 1. 非流式对话（需要 API Key + model name）</span>
curl ${base}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  ${authHeader}
  -d '{
    "model": "${sampleModel.id}",
    "messages": [{"role": "user", "content": "你好"}]
  }'
      </div>
      <div class="code-block">
        <button class="copy">复制</button>
        <span style="color:#5e6671;"># 2. 流式 SSE 对话</span>
curl -N ${base}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  ${authHeader}
  -d '{
    "model": "${sampleModel.id}",
    "stream": true,
    "messages": [{"role": "user", "content": "写一首诗"}]
  }'
      </div>
      <div class="code-block">
        <button class="copy">复制</button>
        <span style="color:#5e6671;"># 3. 查看所有可用模型（model name 列表）</span>
curl ${base}/v1/models \\
  ${authHeader}
      </div>
      <div class="code-block">
        <button class="copy">复制</button>
        <span style="color:#5e6671;"># 4. Python OpenAI SDK（推荐客户端用法）</span>
from openai import OpenAI

client = OpenAI(
    base_url="${base}/v1",
    api_key="${apiKeyPlaceholder}",   # API Key
)

resp = client.chat.completions.create(
    model="${sampleModel.id}",        # model name
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)
      </div>
      <div class="code-block">
        <button class="copy">复制</button>
        <span style="color:#5e6671;"># 5. Node.js（openai 包）</span>
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${base}/v1",
  apiKey: "${apiKeyPlaceholder}",
});

const resp = await client.chat.completions.create({
  model: "${sampleModel.id}",
  messages: [{ role: "user", content: "你好" }],
});
console.log(resp.choices[0].message.content);
      </div>
    `;
    $$('#endpoints-curl .copy').forEach(b => {
      b.addEventListener('click', () => {
        const code = b.parentNode.cloneNode(true);
        code.querySelector('.copy')?.remove();
        const text = code.innerText.replace(/^#.*\n/, '').trim();
        navigator.clipboard?.writeText(text);
        b.textContent = '已复制';
        setTimeout(() => b.textContent = '复制', 1500);
      });
    });
  }

  function renderModels() {
    const d = state.data;
    const filter = ($('#model-filter').value || '').toLowerCase();
    const list = d.models.filter(m =>
      !filter || m.id.toLowerCase().includes(filter) || m.provider.toLowerCase().includes(filter));

    if (list.length === 0) {
      $('#models-tbody').innerHTML = '<tr><td colspan="8" class="empty">无匹配模型</td></tr>';
      return;
    }
    $('#models-tbody').innerHTML = list.map(m => `
      <tr>
        <td class="mono">${escapeHTML(m.id)}</td>
        <td>${escapeHTML(m.name || '-')}</td>
        <td class="muted">${escapeHTML(m.provider)}</td>
        <td><span class="badge ${m.type === 'free' ? 'green' : 'blue'}">${escapeHTML(m.type || '-')}</span></td>
        <td class="mono">${fmtCtx(m.contextLength)}</td>
        <td>${escapeHTML(m.auth || '-')}</td>
        <td>${m.providerConfigured
          ? '<span class="badge green">就绪</span>'
          : '<span class="badge amber">未配</span>'}</td>
        <td>${m.registrationUrl
          ? `<a href="${escapeHTML(m.registrationUrl)}" target="_blank" class="link">注册 →</a>`
          : '<span class="muted">-</span>'}</td>
      </tr>
    `).join('');
  }

  function renderProviders() {
    const d = state.data;
    $('#providers-grid').innerHTML = d.providers.map(p => `
      <div class="provider-card">
        <div class="provider-card-header">
          <span class="provider-name">${escapeHTML(p.name)}</span>
          ${p.configured
            ? '<span class="badge green">已配置</span>'
            : '<span class="badge amber">未配置</span>'}
        </div>
        <div class="provider-rows">
          <div class="provider-row">
            <span class="provider-row-label">认证方式</span>
            <span class="provider-row-value">${escapeHTML(p.authType || '-')}</span>
          </div>
          <div class="provider-row">
            <span class="provider-row-label">API Base</span>
            <span class="provider-row-value">${escapeHTML(p.apiBase || '-')}</span>
          </div>
          <div class="provider-row">
            <span class="provider-row-label">API Key</span>
            <span class="provider-row-value">${escapeHTML(p.apiKey || '-')}</span>
          </div>
          ${p.token ? `
          <div class="provider-row">
            <span class="provider-row-label">Token</span>
            <span class="provider-row-value">${escapeHTML(p.token || '-')}</span>
          </div>` : ''}
          ${p.apiBaseOverride ? `
          <div class="provider-row">
            <span class="provider-row-label">自定义 Base</span>
            <span class="provider-row-value">${escapeHTML(p.apiBaseOverride)}</span>
          </div>` : ''}
        </div>
      </div>
    `).join('') || '<div class="empty">无 Provider</div>';
  }

  function renderCompression() {
    const d = state.data;
    const c = d.compression;
    const h = c.history;

    $('#compression-config').innerHTML = `
      <div class="status-row">
        <div class="status-item">
          <span class="status-item-label">保留最近 N 轮</span>
          <span class="status-item-value">${c.recentRounds}</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">默认 max_tokens</span>
          <span class="status-item-value">${c.maxTokensDefault}</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">安全边界</span>
          <span class="status-item-value">${c.safetyMargin}</span>
        </div>
        <div class="status-item">
          <span class="status-item-label">触发阈值公式</span>
          <span class="status-item-value">${escapeHTML(c.thresholdFormula)}</span>
        </div>
      </div>
    `;

    if (h) {
      const t = h.totals;
      $('#compression-summary').innerHTML = `
        <div class="stat-item"><span class="stat-label">触发次数</span><span class="stat-value">${t.triggered}</span></div>
        <div class="stat-item"><span class="stat-label">成功</span><span class="stat-value">${t.succeeded}</span></div>
        <div class="stat-item"><span class="stat-label">失败</span><span class="stat-value">${t.failed}</span></div>
        <div class="stat-item"><span class="stat-label">平均压缩前</span><span class="stat-value">${fmtNum(t.avgBefore)}</span></div>
        <div class="stat-item"><span class="stat-label">平均压缩后</span><span class="stat-value">${fmtNum(t.avgAfter)}</span></div>
        <div class="stat-item"><span class="stat-label">平均降幅</span><span class="stat-value">${t.avgSavedPct}%</span></div>
      `;

      if (h.recent.length === 0) {
        $('#compression-history-tbody').innerHTML = '<tr><td colspan="7" class="empty">尚无压缩记录</td></tr>';
      } else {
        $('#compression-history-tbody').innerHTML = h.recent.map(e => `
          <tr>
            <td class="muted">${fmtTime(e.ts)}</td>
            <td class="mono">${escapeHTML(e.sessionId?.slice(0, 16))}…</td>
            <td class="mono">${escapeHTML(e.modelId)}</td>
            <td class="mono">${fmtNum(e.beforeTokens)}</td>
            <td class="mono">${e.afterTokens !== null ? fmtNum(e.afterTokens) : '-'}</td>
            <td>${e.savedPct !== null ? `<span class="badge green">${e.savedPct}%</span>` : '-'}</td>
            <td>${e.success
              ? '<span class="badge green">成功</span>'
              : `<span class="badge red" title="${escapeHTML(e.error || '')}">失败</span>`}</td>
          </tr>
        `).join('');
      }
    }
  }

  function renderMetrics() {
    const d = state.data;
    const r = d.runtime;

    $('#metrics-global').innerHTML = `
      <div class="stat-item"><span class="stat-label">总请求数</span><span class="stat-value">${fmtNum(r.global.totalRequests)}</span></div>
      <div class="stat-item"><span class="stat-label">失败数</span><span class="stat-value">${fmtNum(r.global.totalErrors)}</span></div>
      <div class="stat-item"><span class="stat-label">活跃会话</span><span class="stat-value">${r.sessions.active}</span></div>
      <div class="stat-item"><span class="stat-label">累计创建</span><span class="stat-value">${r.sessions.created}</span></div>
      <div class="stat-item"><span class="stat-label">压缩次数</span><span class="stat-value">${r.sessions.compressed}</span></div>
      <div class="stat-item"><span class="stat-label">运行时长</span><span class="stat-value">${fmtDuration(r.uptimeSec)}</span></div>
    `;

    // Provider 统计
    if (r.providerStats.length === 0) {
      $('#metrics-provider-tbody').innerHTML = '<tr><td colspan="8" class="empty">尚无调用记录</td></tr>';
    } else {
      $('#metrics-provider-tbody').innerHTML = r.providerStats.map(p => {
        const rate = p.calls > 0 ? ((p.success / p.calls) * 100).toFixed(1) + '%' : '-';
        const err = p.lastError
          ? `<span class="badge red" title="${escapeHTML(p.lastError)}">${escapeHTML(p.lastError.slice(0, 30))}${p.lastError.length > 30 ? '…' : ''}</span>`
          : '<span class="muted">-</span>';
        return `
          <tr>
            <td class="mono">${escapeHTML(p.name)}</td>
            <td>${fmtNum(p.calls)}</td>
            <td>${fmtNum(p.success)}</td>
            <td>${fmtNum(p.failed)}</td>
            <td>${rate}</td>
            <td class="mono">${fmtNum(p.promptTokens)}</td>
            <td class="mono">${fmtNum(p.completionTokens)}</td>
            <td>${err}</td>
          </tr>`;
      }).join('');
    }

    // Model 统计
    if (r.modelStats.length === 0) {
      $('#metrics-model-tbody').innerHTML = '<tr><td colspan="6" class="empty">尚无调用记录</td></tr>';
    } else {
      $('#metrics-model-tbody').innerHTML = r.modelStats.map(m => {
        const err = m.lastError
          ? `<span class="badge red" title="${escapeHTML(m.lastError)}">${escapeHTML(m.lastError.slice(0, 30))}${m.lastError.length > 30 ? '…' : ''}</span>`
          : '<span class="muted">-</span>';
        return `
          <tr>
            <td class="mono">${escapeHTML(m.id)}</td>
            <td>${fmtNum(m.calls)}</td>
            <td>${fmtNum(m.success)}</td>
            <td>${fmtNum(m.failed)}</td>
            <td class="mono">${fmtNum(m.totalTokens)}</td>
            <td>${err}</td>
          </tr>`;
      }).join('');
    }
  }

  // ============ 视图切换 ============
  function switchView(view) {
    state.view = view;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  }

  // ============ 事件 ============
  function bind() {
    $$('.nav-item').forEach(n =>
      n.addEventListener('click', () => switchView(n.dataset.view)));
    $$('.link[data-view]').forEach(l =>
      l.addEventListener('click', () => switchView(l.dataset.view)));
    $('#refresh').addEventListener('click', loadState);
    $('#model-filter').addEventListener('input', renderModels);
  }

  // ============ 启动 ============
  document.addEventListener('DOMContentLoaded', () => {
    bind();
    loadState();
    // 每 5 秒刷新运行时指标
    setInterval(loadState, 5000);
  });
})();
