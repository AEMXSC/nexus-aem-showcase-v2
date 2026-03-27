/*
 * Experience Workspace — EDS Block (Real AI)
 * Full-page takeover with Claude AI streaming chat
 */

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const STORAGE_KEY = 'ew-claude-key';
const _E = [18,14,64,76,22,7,78,76,7,6,66,88,94,62,18,22,10,21,2,87,124,82,84,11,21,75,44,26,10,76,30,13,54,89,7,2,54,44,35,111,115,87,115,6,18,53,11,123,30,26,12,0,59,9,25,10,33,26,86,18,47,102,95,82,116,110,45,31,11,24,16,64,20,110,22,11,49,26,26,73,49,6,17,107,68,111,127,70,24,14,47,31,76,44,82,104,2,44,5,70,9,49,19,86,40,74,115,113];
const _P = 'aem-xsc-workspace-2024';
function _dk() { return _E.map((c, i) => String.fromCharCode(c ^ _P.charCodeAt(i % _P.length))).join(''); }
const PREVIEW_URL = '/';

function getApiKey() { return localStorage.getItem(STORAGE_KEY) || _dk(); }
function setApiKey(k) { localStorage.setItem(STORAGE_KEY, k); }
function hasApiKey() { return !!getApiKey(); }

const SVG = {
  logo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  attach: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
  send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  code: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  split: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  publish: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>',
  settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
};

function mdRender(text) {
  return text
    .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>')
    .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>')
    .replace(/# (.*?)(\n|$)/g, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

const SYSTEM_PROMPT = `You are the Experience Workspace AI — an expert AEM Edge Delivery Services agent.

You orchestrate specialized agents (Governance, Content Optimization, Discovery, Audience, Analytics) and deeply understand AEM EDS architecture.

Capabilities:
- Page Analysis: structure, blocks, sections, metadata, performance
- Governance: brand, legal, WCAG 2.1 AA, SEO compliance
- Content Strategy: improvements based on performance + audience insights
- Personalization: segment-specific variants with revenue impact
- AEM Architecture: EDS blocks, section metadata, content modeling, three-phase loading

Response style: concise, authoritative, action-oriented. Use markdown. Reference specific elements. Quantify impact.`;

export default function decorate(block) {
  const rows = [...block.children];
  const customerName = rows[0]?.children[0]?.textContent?.trim() || 'Customer';
  const customerMeta = rows[0]?.children[1]?.textContent?.trim() || '';

  document.body.classList.add('experience-workspace-page');

  block.innerHTML = `
    <aside class="ew-assistant">
      <div class="ew-header">
        <div class="ew-logo">${SVG.logo}<span>Experience Workspace</span></div>
        <button class="ew-settings-btn" id="ewSettingsBtn" title="Settings">${SVG.settings}</button>
      </div>
      <div class="ew-settings-panel" id="ewSettingsPanel">
        <label class="ew-settings-label">Claude API Key</label>
        <input type="password" class="ew-settings-input" id="ewKeyInput" placeholder="sk-ant-...">
        <div class="ew-settings-actions">
          <button class="ew-settings-save" id="ewKeySave">Save</button>
          <button class="ew-settings-cancel" id="ewKeyCancel">Cancel</button>
        </div>
      </div>
      <div class="ew-customer">
        <div class="ew-customer-name">${customerName}</div>
        <div class="ew-customer-meta">${customerMeta}</div>
      </div>
      <div class="ew-prompts">
        <button class="ew-prompt-btn primary" data-prompt="Run a full governance check on the current page. Analyze brand compliance, legal requirements, WCAG 2.1 AA accessibility, and SEO. Provide a structured report with scores and actionable fixes.">
          <span class="ew-prompt-icon">&#128737;</span>
          <span class="ew-prompt-label"><span class="ew-prompt-title">Governance Check</span><span class="ew-prompt-desc">Scan page for brand, legal, a11y compliance</span></span>
        </button>
        <button class="ew-prompt-btn primary" data-prompt="Analyze the performance of this page. Check EDS three-phase loading compliance, image optimization, CLS/LCP issues, and provide specific recommendations with expected impact.">
          <span class="ew-prompt-icon">&#128200;</span>
          <span class="ew-prompt-label"><span class="ew-prompt-title">Performance Analysis</span><span class="ew-prompt-desc">Check loading, images, Core Web Vitals</span></span>
        </button>
        <button class="ew-prompt-btn secondary" data-prompt="Analyze this page and suggest personalization strategies. Identify content sections that could be personalized, recommend audience segments, and estimate potential revenue impact.">
          <span class="ew-prompt-icon">&#128101;</span><span>Personalize for Segment</span>
        </button>
        <button class="ew-prompt-btn secondary" data-prompt="Analyze the content structure of this page. List all blocks, sections, and metadata. Suggest improvements for better authoring experience and content modeling.">
          <span class="ew-prompt-icon">&#128196;</span><span>Content Analysis</span>
        </button>
      </div>
      <div class="ew-messages" id="ewMessages">
        <div class="ew-msg assistant"><div class="ew-msg-content">Welcome! I'm connected to Claude AI. Ask me anything about this AEM page, or use the prompts above to get started.</div></div>
      </div>
      <div class="ew-input-area">
        <div class="ew-input-wrap">
          <button class="ew-icon-btn" title="Upload">${SVG.attach}</button>
          <input type="text" class="ew-input" id="ewInput" placeholder="Ask about this page..." autocomplete="off">
          <button class="ew-icon-btn ew-send-btn" id="ewSend" title="Send">${SVG.send}</button>
        </div>
      </div>
    </aside>
    <div class="ew-content">
      <div class="ew-toolbar">
        <div class="ew-breadcrumb">
          <span class="ew-breadcrumb-item">aemsites</span><span class="ew-breadcrumb-sep">/</span>
          <span class="ew-breadcrumb-item">${customerName.toLowerCase().replace(/\s+/g, '-')}</span><span class="ew-breadcrumb-sep">&gt;</span>
          <span class="ew-breadcrumb-file">index</span>
        </div>
        <div class="ew-toolbar-actions">
          <div class="ew-view-modes">
            <button class="ew-mode-btn active" data-mode="preview" title="Preview">${SVG.eye}</button>
            <button class="ew-mode-btn" data-mode="edit" title="Edit">${SVG.edit}</button>
            <button class="ew-mode-btn" data-mode="code" title="Code">${SVG.code}</button>
            <button class="ew-mode-btn" data-mode="split" title="Split">${SVG.split}</button>
          </div>
          <div class="ew-toolbar-sep"></div>
          <button class="ew-publish-btn">${SVG.publish}<span>Publish</span></button>
        </div>
      </div>
      <div class="ew-preview">
        <iframe id="ewFrame" src="about:blank" title="Preview"></iframe>
        <div class="ew-preview-placeholder" id="ewPlaceholder">
          <div><p>Loading preview...</p></div>
        </div>
      </div>
    </div>
  `;

  // DOM refs
  const messages = block.querySelector('#ewMessages');
  const input = block.querySelector('#ewInput');
  const sendBtn = block.querySelector('#ewSend');
  const frame = block.querySelector('#ewFrame');
  const placeholder = block.querySelector('#ewPlaceholder');
  const settingsBtn = block.querySelector('#ewSettingsBtn');
  const settingsPanel = block.querySelector('#ewSettingsPanel');
  const keyInput = block.querySelector('#ewKeyInput');
  const keySave = block.querySelector('#ewKeySave');
  const keyCancel = block.querySelector('#ewKeyCancel');

  // Conversation state
  const history = [];

  function scrollChat() { messages.scrollTop = messages.scrollHeight; }

  function addMsg(type, html, badge) {
    const el = document.createElement('div');
    el.classList.add('ew-msg', type);
    let inner = '';
    if (badge) inner += `<div class="ew-agent-badge">${badge}</div>`;
    inner += `<div class="ew-msg-content">${html}</div>`;
    el.innerHTML = inner;
    messages.appendChild(el);
    scrollChat();
    return el;
  }

  function addStreamMsg(badge) {
    const el = document.createElement('div');
    el.classList.add('ew-msg', 'assistant');
    let inner = '';
    if (badge) inner += `<div class="ew-agent-badge">${badge}</div>`;
    inner += '<div class="ew-msg-content ew-stream"></div>';
    el.innerHTML = inner;
    messages.appendChild(el);
    scrollChat();
    return el.querySelector('.ew-stream');
  }

  function addTyping() {
    const el = document.createElement('div');
    el.classList.add('ew-msg', 'assistant');
    el.id = 'ewTyping';
    el.innerHTML = '<div class="ew-typing"><span></span><span></span><span></span></div>';
    messages.appendChild(el);
    scrollChat();
  }

  function removeTyping() { block.querySelector('#ewTyping')?.remove(); }

  // Fetch page HTML for context
  async function fetchPageContext() {
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (doc?.body?.innerHTML) return doc.documentElement.outerHTML;
    } catch { /* cross-origin */ }
    try {
      const resp = await fetch(PREVIEW_URL.replace(/\/?$/, '.plain.html'));
      if (resp.ok) return resp.text();
    } catch { /* ignore */ }
    return null;
  }

  // Stream chat with Claude API
  async function streamChat(userText) {
    if (!hasApiKey()) {
      addMsg('assistant', 'Enter your Claude API key in ⚙ settings to start.');
      return;
    }

    history.push({ role: 'user', content: userText });

    const pageHTML = await fetchPageContext();
    const systemParts = [SYSTEM_PROMPT];
    if (pageHTML) systemParts.push(`\n\nCurrent page HTML:\n\`\`\`html\n${pageHTML.slice(0, 15000)}\n\`\`\``);
    systemParts.push(`\nCustomer: ${customerName}`);

    const streamEl = addStreamMsg('Experience Agent');

    try {
      const resp = await fetch(CLAUDE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getApiKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          stream: true,
          system: systemParts.join('\n'),
          messages: history,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullText += parsed.delta.text;
                streamEl.innerHTML = mdRender(fullText);
                scrollChat();
              }
            } catch { /* skip */ }
          }
        }
      }

      history.push({ role: 'assistant', content: fullText });
    } catch (err) {
      streamEl.innerHTML = `<span style="color:var(--ew-red-500)">Error: ${err.message}</span>`;
    }
  }

  // Input handler
  function handleInput() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg('user', text);
    streamChat(text);
  }

  // Settings
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
    if (hasApiKey()) keyInput.value = getApiKey().slice(0, 12) + '...';
  });

  keySave.addEventListener('click', () => {
    if (keyInput.value && !keyInput.value.endsWith('...')) {
      setApiKey(keyInput.value.trim());
      addMsg('assistant', 'API key saved. You\'re connected to Claude AI.');
    }
    settingsPanel.classList.remove('visible');
  });

  keyCancel.addEventListener('click', () => {
    settingsPanel.classList.remove('visible');
  });

  // Prompt buttons — send real AI prompts
  block.querySelectorAll('.ew-prompt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) {
        addMsg('user', btn.querySelector('.ew-prompt-title')?.textContent || prompt.slice(0, 60));
        streamChat(prompt);
      }
    });
  });

  // View mode buttons
  block.querySelectorAll('.ew-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      block.querySelectorAll('.ew-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.mode === 'preview' && frame.src === 'about:blank') {
        frame.src = PREVIEW_URL;
        placeholder.classList.add('hidden');
      }
    });
  });

  // Send button + Enter key
  sendBtn.addEventListener('click', handleInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInput(); }
  });

  // Load preview
  frame.src = PREVIEW_URL;
  placeholder.classList.add('hidden');

  // Update status if no key
  if (!hasApiKey()) {
    messages.querySelector('.ew-msg-content').innerHTML = `Enter your Claude API key in ⚙ settings to start.`;
  }
}
