/* FreeTokenRouteCN UI 交互逻辑 */
(() => {
  'use strict';

  // ============ 状态 ============
  const state = {
    models: [],
    sessions: [],         // {id, title, messages: []}，仅前端展示用
    currentSessionId: null,
    currentModel: '',
    streaming: true,
    sending: false,
  };

  // ============ DOM ============
  const $ = (sel) => document.querySelector(sel);
  const el = {
    modelSelect: $('#model-select'),
    sessionList: $('#session-list'),
    messages: $('#messages'),
    input: $('#input'),
    send: $('#send'),
    newChat: $('#new-chat'),
    clearMsgs: $('#clear-msgs'),
    chatTitle: $('#chat-title'),
    chatMeta: $('#chat-meta'),
    convHint: $('#conv-hint'),
    statusIndicator: $('#status-indicator'),
    statusText: $('#status-indicator .status-text'),
    toggleStream: $('#toggle-stream'),
  };

  // ============ 工具 ============
  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 简易 markdown：代码块 / 行内代码 / 段落 / 列表
  function renderMarkdown(text) {
    let html = escapeHTML(text);
    // 代码块 ```lang\ncode\n```
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) =>
      `<pre><code>${code.replace(/\n$/, '')}</code></pre>`);
    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 段落
    const lines = html.split('\n');
    const out = [];
    let buf = [];
    let inList = false;
    const flush = () => {
      if (buf.length) {
        out.push(`<p>${buf.join('<br>')}</p>`);
        buf = [];
      }
    };
    for (const line of lines) {
      if (line.trim() === '') { flush(); continue; }
      // 不处理 pre 内的内容（已经被包了）
      if (line.startsWith('<pre>')) { flush(); out.push(line); continue; }
      if (line.startsWith('</pre>')) { out.push(line); continue; }
      const li = line.match(/^[-*]\s+(.*)/);
      if (li) {
        if (!inList) { flush(); out.push('<ul>'); inList = true; }
        out.push(`<li>${li[1]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        buf.push(line);
      }
    }
    if (inList) out.push('</ul>');
    flush();
    return out.join('');
  }

  function genConvId() {
    return 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function nowTime() {
    const d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }

  // ============ API ============
  async function loadModels() {
    try {
      const r = await fetch('/v1/models');
      const j = await r.json();
      state.models = (j.data || []).map(m => m);
      el.modelSelect.innerHTML = state.models.map(m =>
        `<option value="${m.id}">${m.id} · ${m.owned_by}</option>`).join('');
      if (state.models.length) {
        // 默认选第一个新接入的模型，否则第一个
        const preferred = state.models.find(m => m.id === 'agnes-2.5-flash') || state.models[0];
        state.currentModel = preferred.id;
        el.modelSelect.value = state.currentModel;
      }
      setStatus('ok', `${state.models.length} 个模型可用`);
    } catch (e) {
      setStatus('err', '模型加载失败');
    }
  }

  async function checkHealth() {
    try {
      const r = await fetch('/health');
      const j = await r.json();
      return j.status === 'ok';
    } catch (e) { return false; }
  }

  // 探测当前选中模型是否配置了 key：发一次极小请求看是否返回 500 "API key not configured"
  async function probeModelKey() {
    if (!state.currentModel) return;
    setStatus('loading', `检查 ${state.currentModel} 配置…`);
    try {
      const r = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: state.currentModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      const j = await r.json();
      if (r.ok && j.choices) {
        setStatus('ok', `${state.currentModel} 可用`);
      } else if (j?.error?.message?.includes('API key')) {
        setStatus('warn', `${state.currentModel} 未配置 Key`);
      } else {
        setStatus('warn', j?.error?.message || `状态 ${r.status}`);
      }
    } catch (e) {
      setStatus('err', '探测失败');
    }
  }

  function setStatus(level, text) {
    el.statusIndicator.className = 'status-indicator ' + level;
    el.statusText.textContent = text;
  }

  // ============ 会话管理（前端内存）============
  function newSession() {
    const s = { id: genConvId(), title: '新会话', messages: [], createdAt: Date.now() };
    state.sessions.unshift(s);
    state.currentSessionId = s.id;
    renderSessionList();
    renderMessages();
    updateHeader();
    el.input.focus();
  }

  function switchSession(id) {
    state.currentSessionId = id;
    renderSessionList();
    renderMessages();
    updateHeader();
  }

  function deleteSession(id, ev) {
    ev.stopPropagation();
    state.sessions = state.sessions.filter(s => s.id !== id);
    if (state.currentSessionId === id) {
      state.currentSessionId = state.sessions[0]?.id || null;
    }
    renderSessionList();
    renderMessages();
    updateHeader();
  }

  function getCurrentSession() {
    if (!state.currentSessionId) newSession();
    return state.sessions.find(s => s.id === state.currentSessionId);
  }

  // 服务端也会维护 conversation_id，前端记住服务端实际返回的 id
  function setSessionServerId(localId, serverId) {
    const s = state.sessions.find(x => x.id === localId);
    if (s) { s.serverId = serverId; s.id = serverId; state.currentSessionId = serverId; renderSessionList(); }
  }

  // ============ 渲染 ============
  function renderSessionList() {
    if (state.sessions.length === 0) {
      el.sessionList.innerHTML = '<div class="empty-hint">暂无会话</div>';
      return;
    }
    el.sessionList.innerHTML = state.sessions.map(s => `
      <div class="session-item ${s.id === state.currentSessionId ? 'active' : ''}" data-id="${s.id}">
        <span class="session-title">${escapeHTML(s.title)}</span>
        <button class="session-del" data-id="${s.id}" title="删除">×</button>
      </div>
    `).join('');
    el.sessionList.querySelectorAll('.session-item').forEach(node => {
      node.addEventListener('click', () => switchSession(node.dataset.id));
    });
    el.sessionList.querySelectorAll('.session-del').forEach(btn => {
      btn.addEventListener('click', (e) => deleteSession(btn.dataset.id, e));
    });
  }

  function renderMessages() {
    const s = getCurrentSession();
    if (!s || s.messages.length === 0) {
      el.messages.innerHTML = `
        <div class="welcome">
          <div class="welcome-logo">F</div>
          <h2>国内免费大模型统一入口</h2>
          <p>OpenAI 兼容代理，一次接入，统一调用。支持 DeepSeek / Agnes AI / 商汤 SenseNova 等免费模型。</p>
          <div class="welcome-hints">
            <div class="hint" data-prompt="用一句话介绍你自己"><span class="hint-icon">💬</span><span>介绍自己</span></div>
            <div class="hint" data-prompt="写一段 Python 快速排序代码"><span class="hint-icon">⚙️</span><span>写代码</span></div>
            <div class="hint" data-prompt="给我讲一个关于程序员的冷笑话"><span class="hint-icon">😄</span><span>讲笑话</span></div>
          </div>
        </div>`;
      el.messages.querySelectorAll('.hint').forEach(h =>
        h.addEventListener('click', () => {
          el.input.value = h.dataset.prompt;
          autoResize();
          el.input.focus();
        }));
      return;
    }
    el.messages.innerHTML = s.messages.map(m => renderMessage(m)).join('');
    scrollToBottom();
  }

  function renderMessage(m) {
    const avatar = m.role === 'user' ? '你' : 'AI';
    let body = '';
    if (m.error) {
      body = `<div class="error-bubble">${escapeHTML(m.error)}</div>`;
    } else {
      if (m.reasoning) {
        body += `<div class="msg-reasoning">${escapeHTML(m.reasoning)}</div>`;
      }
      body += `<div class="msg-body">${renderMarkdown(m.content || '')}</div>`;
    }
    const meta = m.time ? `<div class="msg-meta">${escapeHTML(m.time)} · ${escapeHTML(m.model || '')}</div>` : '';
    return `
      <div class="message ${m.role}">
        <div class="avatar">${avatar}</div>
        <div style="flex:1;min-width:0;">
          ${body}
          ${meta}
        </div>
      </div>`;
  }

  function appendStreamingAssistant(model) {
    const s = getCurrentSession();
    const m = { role: 'assistant', content: '', reasoning: '', model, time: nowTime(), streaming: true };
    s.messages.push(m);
    el.messages.insertAdjacentHTML('beforeend', renderMessage(m));
    const node = el.messages.lastElementChild;
    m._bodyNode = node.querySelector('.msg-body');
    m._reasoningNode = node.querySelector('.msg-reasoning');
    m._node = node;
    if (!m._reasoningNode) {
      // 没有 reasoning 容器时手动塞一个空 div
      const r = document.createElement('div');
      r.className = 'msg-reasoning';
      r.style.display = 'none';
      m._bodyNode.parentNode.insertBefore(r, m._bodyNode);
      m._reasoningNode = r;
    }
    m._bodyNode.innerHTML = '<span class="cursor"></span>';
    scrollToBottom();
    return m;
  }

  function updateStreamingMessage(m, delta) {
    if (delta.reasoning_content) {
      m.reasoning += delta.reasoning_content;
      m._reasoningNode.textContent = m.reasoning;
      m._reasoningNode.style.display = 'block';
    }
    if (delta.content) {
      m.content += delta.content;
      m._bodyNode.innerHTML = renderMarkdown(m.content) + '<span class="cursor"></span>';
    }
    scrollToBottom();
  }

  function finalizeStreamingMessage(m) {
    m.streaming = false;
    m._bodyNode.innerHTML = renderMarkdown(m.content || '*（无内容）*');
    if (m.reasoning) {
      m._reasoningNode.style.display = 'block';
    } else {
      m._reasoningNode.remove();
    }
  }

  function updateHeader() {
    const s = getCurrentSession();
    el.chatTitle.textContent = s ? s.title : '新会话';
    if (s?.serverId) {
      el.chatMeta.textContent = `会话 ID: ${s.serverId}`;
      el.convHint.textContent = `会话: ${s.serverId.slice(0, 16)}…`;
    } else {
      el.chatMeta.textContent = '';
      el.convHint.textContent = '未关联会话';
    }
  }

  function scrollToBottom() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function autoResize() {
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 200) + 'px';
  }

  // ============ 发送 ============
  async function send() {
    if (state.sending) return;
    const content = el.input.value.trim();
    if (!content) return;
    if (!state.currentModel) {
      setStatus('err', '请先选择模型');
      return;
    }

    const s = getCurrentSession();
    const isFirst = s.messages.length === 0;

    // 推入用户消息
    s.messages.push({ role: 'user', content, time: nowTime(), model: state.currentModel });
    if (isFirst) {
      s.title = content.length > 20 ? content.slice(0, 20) + '…' : content;
      renderSessionList();
    }
    el.input.value = '';
    autoResize();
    renderMessages();

    state.sending = true;
    el.send.classList.add('loading');
    el.send.disabled = true;

    const assistant = appendStreamingAssistant(state.currentModel);

    try {
      const body = {
        model: state.currentModel,
        messages: [{ role: 'user', content }],
        stream: state.streaming,
      };
      if (s.serverId) body.conversation_id = s.serverId;

      if (state.streaming) {
        await sendStream(body, assistant, s);
      } else {
        await sendOnce(body, assistant, s);
      }
    } catch (e) {
      assistant.error = e.message || '请求失败';
      if (assistant._node) {
        assistant._node.querySelector('.msg-body').innerHTML =
          `<div class="error-bubble">${escapeHTML(assistant.error)}</div>`;
        if (assistant._reasoningNode) assistant._reasoningNode.remove();
      }
    } finally {
      if (assistant.streaming) finalizeStreamingMessage(assistant);
      state.sending = false;
      el.send.classList.remove('loading');
      el.send.disabled = false;
      updateHeader();
    }
  }

  async function sendStream(body, assistant, session) {
    const r = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // 服务端可能在错误时也带 conversation_id 头
    const convId = r.headers.get('X-Conversation-Id');
    if (convId && !session.serverId) setSessionServerId(session.id, convId);

    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try { const j = await r.json(); msg = j?.error?.message || msg; } catch (_) {}
      throw new Error(msg);
    }

    if (!r.headers.get('content-type')?.includes('text/event-stream')) {
      // 服务端把流式降级为非流式返回 JSON
      const j = await r.json();
      if (session.serverId === undefined && j.conversation_id) {
        setSessionServerId(session.id, j.conversation_id);
      }
      const msg = j.choices?.[0]?.message || {};
      assistant.content = msg.content || '';
      assistant.reasoning = msg.reasoning_content || '';
      finalizeStreamingMessage(assistant);
      return;
    }

    // 真 SSE 流
    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta || {};
          updateStreamingMessage(assistant, delta);
        } catch (_) { /* ignore */ }
      }
    }
    finalizeStreamingMessage(assistant);
  }

  async function sendOnce(body, assistant, session) {
    const r = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const convId = r.headers.get('X-Conversation-Id');
    if (convId && !session.serverId) setSessionServerId(session.id, convId);

    const j = await r.json();
    if (!r.ok) {
      throw new Error(j?.error?.message || `HTTP ${r.status}`);
    }
    if (session.serverId === undefined && j.conversation_id) {
      setSessionServerId(session.id, j.conversation_id);
    }
    const msg = j.choices?.[0]?.message || {};
    assistant.content = msg.content || '';
    assistant.reasoning = msg.reasoning_content || '';
    finalizeStreamingMessage(assistant);
  }

  // ============ 事件 ============
  function bind() {
    el.send.addEventListener('click', send);
    el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    el.input.addEventListener('input', () => {
      autoResize();
      el.send.disabled = el.input.value.trim() === '';
    });
    el.newChat.addEventListener('click', newSession);
    el.clearMsgs.addEventListener('click', () => {
      const s = getCurrentSession();
      if (s) { s.messages = []; renderMessages(); }
    });
    el.modelSelect.addEventListener('change', () => {
      state.currentModel = el.modelSelect.value;
      probeModelKey();
    });
    el.toggleStream.addEventListener('click', () => {
      const on = el.toggleStream.dataset.on === 'true';
      el.toggleStream.dataset.on = String(!on);
      state.streaming = !on;
      el.toggleStream.querySelector('.stream-label').textContent = state.streaming ? '流式 ●' : '流式 ○';
    });
  }

  // ============ 启动 ============
  async function init() {
    bind();
    await loadModels();
    if (state.currentModel) await probeModelKey();
    newSession();
    el.input.focus();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
