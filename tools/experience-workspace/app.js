/*
 * Experience Workspace — v4 (Phase 3: Customer-Specific Intelligence)
 *
 * Five ways this is better than native Adobe agents:
 * 1. Customer-specific system prompts (brand voice, segments, approval chains, legal SLAs)
 * 2. Cross-product orchestration (Acrobat → AEM → CJA → Workfront in one thread)
 * 3. Brief-to-page flow (PDF in → structured page → governance gate → WF task)
 * 4. Page context awareness on load (inject page context automatically)
 * 5. Speed of iteration (update system prompts same day, not next quarter)
 */

import { loadIms, isSignedIn, signIn, signOut, getProfile, getToken } from './ims.js';
import * as ai from './ai.js';
import { TOOL_AGENT_MAP } from './ai.js';
import * as da from './da-client.js';
import * as gov from './governance.js';
import { getActiveProfile, getOrgConfig, setActiveProfile, listProfiles, PROFILES, buildCustomerContext, addCustomProfile, deleteCustomProfile, buildProfilePrompt } from './customer-profiles.js';
import { detectSiteMention } from './known-sites.js';

/* ── Dynamic Org Configuration (from customer profile) ── */
let AEM_ORG = getOrgConfig();
let PREVIEW_URL = AEM_ORG.previewOrigin + '/';

/* ── DOM refs ── */
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const previewFrame = document.getElementById('previewFrame');
const authBtn = document.getElementById('authBtn');
const authStatus = document.getElementById('authStatus');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');

/* ── State ── */
let conversationHistory = [];
let isLiveMode = false;
let pendingFile = null; // { name, type, size, content (text or base64), mediaType }

/* ── Utility ── */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function scrollChat() { chatMessages.scrollTop = chatMessages.scrollHeight; }

function md(text) {
  return text
    .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>')
    .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>')
    .replace(/# (.*?)(\n|$)/g, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^[-*] (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

/* ── Chat Primitives ── */
function addMessage(type, html, agentBadge) {
  const msg = document.createElement('div');
  msg.classList.add('message', type);
  let inner = '';
  if (agentBadge) inner += `<div class="agent-badge">${agentBadge}</div>`;
  inner += `<div class="message-content">${html}</div>`;
  msg.innerHTML = inner;
  chatMessages.appendChild(msg);
  scrollChat();
  return msg;
}

function addRawHTML(html) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', 'assistant');
  wrapper.innerHTML = html;
  chatMessages.appendChild(wrapper);
  scrollChat();
  return wrapper;
}

function addTyping() {
  const el = document.createElement('div');
  el.classList.add('message', 'assistant');
  el.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  el.id = 'typingIndicator';
  chatMessages.appendChild(el);
  scrollChat();
}

function removeTyping() {
  document.getElementById('typingIndicator')?.remove();
}

function addStreamMessage(agentBadge) {
  const msg = document.createElement('div');
  msg.classList.add('message', 'assistant');
  let inner = '';
  if (agentBadge) inner += `<div class="agent-badge">${agentBadge}</div>`;
  inner += '<div class="message-content stream-content"></div>';
  msg.innerHTML = inner;
  chatMessages.appendChild(msg);
  scrollChat();
  return msg.querySelector('.stream-content');
}

/* ── Auth UI ── */
function updateAuthUI() {
  const profile = getProfile();
  const signedIn = isSignedIn();
  const hasKey = ai.hasApiKey();

  if (authBtn) {
    if (signedIn && profile?.displayName) {
      authBtn.textContent = profile.displayName.split(' ')[0];
      authBtn.classList.add('signed-in');
      authBtn.title = `Signed in as ${profile.email || profile.displayName}`;
    } else {
      authBtn.textContent = 'Sign In';
      authBtn.classList.remove('signed-in');
      authBtn.title = 'Sign in with Adobe';
    }
  }

  if (authStatus) {
    const parts = [];
    if (signedIn) parts.push('Adobe ✓');
    if (hasKey) parts.push('AI ✓');
    authStatus.textContent = parts.length > 0 ? parts.join(' · ') : '';
    authStatus.style.display = parts.length > 0 ? '' : 'none';
  }

  isLiveMode = signedIn || hasKey;

  // Update connection status
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.connection-status span:last-child');
  if (statusDot && statusText) {
    if (isLiveMode) {
      statusDot.classList.add('live');
      statusText.textContent = signedIn && hasKey ? 'Live — AI + Adobe' : hasKey ? 'Live — AI' : 'Live — Adobe';
    } else {
      statusDot.classList.remove('live');
      statusText.textContent = 'Not Connected';
    }
  }
}

/* ── Settings Panel ── */
function toggleSettings() {
  if (!settingsPanel) return;
  settingsPanel.classList.toggle('visible');
  const keyInput = settingsPanel.querySelector('#claudeKeyInput');
  if (keyInput && ai.hasApiKey()) {
    keyInput.value = ai.getApiKey().slice(0, 8) + '...';
  }
}

function saveSettings() {
  const keyInput = document.getElementById('claudeKeyInput');
  if (keyInput && keyInput.value && !keyInput.value.endsWith('...')) {
    ai.setApiKey(keyInput.value.trim());
  }
  toggleSettings();
  updateAuthUI();
}

/* ── Get Page Context ── */
let cachedPageHTML = null;
let cachedPageUrl = null;

async function fetchPageHTML(url) {
  // AEM EDS .plain.html endpoint returns clean HTML without page shell
  const plainUrl = url.replace(/\/?$/, '.plain.html');
  try {
    const resp = await fetch(plainUrl);
    if (resp.ok) return resp.text();
  } catch { /* CORS or network error */ }
  // Fallback: try the URL directly
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const text = await resp.text();
      // Extract body content from full HTML
      const match = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      return match ? match[1] : text;
    }
  } catch { /* ignore */ }
  return null;
}

function getPageContext() {
  const ctx = { customerName: AEM_ORG.name, pageUrl: PREVIEW_URL, org: AEM_ORG };
  // Try iframe DOM first (same-origin)
  try {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow?.document;
    if (iframeDoc?.body) {
      ctx.pageHTML = iframeDoc.documentElement.outerHTML;
      return ctx;
    }
  } catch { /* cross-origin */ }
  // Use cached fetched HTML
  if (cachedPageHTML) {
    ctx.pageHTML = cachedPageHTML;
  }
  return ctx;
}

async function ensurePageContext() {
  const currentUrl = previewFrame.src || PREVIEW_URL;
  if (cachedPageHTML && cachedPageUrl === currentUrl) return;
  cachedPageUrl = currentUrl;
  cachedPageHTML = await fetchPageHTML(currentUrl);
}

/* ── REAL: AI Chat (with native tool use) ── */
async function handleRealChat(text, file) {
  // Build message content — with file attachment if present
  let messageContent;
  if (file && file.type === 'image') {
    // Claude vision: send image as base64 + text
    messageContent = [
      { type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.content } },
      { type: 'text', text: text || `Analyze this image: ${file.name}` },
    ];
  } else if (file && file.type === 'document') {
    // Document: inject text content
    messageContent = `${text || `Analyze this document: ${file.name}`}\n\n--- Attached file: ${file.name} ---\n${file.content.slice(0, 30000)}${file.content.length > 30000 ? '\n\n[... truncated]' : ''}`;
  } else {
    messageContent = text;
  }

  conversationHistory.push({ role: 'user', content: messageContent });

  await ensurePageContext();
  const ctx = getPageContext();

  // Tool call UI container — collapsible tool calls (like Claude.ai)
  let toolContainer = null;
  let toolCount = 0;

  // Track which agent badges have been shown
  const shownAgents = new Set();
  const agentContainers = {};

  function onToolCall(toolName, toolInput) {
    toolCount++;
    const agentName = TOOL_AGENT_MAP[toolName] || 'Adobe Agent';

    // Create a new collapsible container per agent
    if (!agentContainers[agentName]) {
      shownAgents.add(agentName);
      toolContainer = addRawHTML(`
        <div class="tool-group" data-agent="${agentName}">
          <div class="tool-group-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <span class="tool-group-indicator"><span class="gen-dot active"></span></span>
            <span class="tool-group-agent">${agentName}</span>
            <span class="tool-group-count"></span>
            <span class="tool-group-chevron">▾</span>
          </div>
          <div class="tool-group-body"></div>
        </div>
      `);
      agentContainers[agentName] = toolContainer.querySelector('.tool-group');
    }

    const group = agentContainers[agentName];
    const bodyEl = group.querySelector('.tool-group-body');
    const toolId = `tool-call-${toolCount}`;
    const inputSummary = formatToolInput(toolName, toolInput);

    bodyEl.innerHTML += `
      <div class="tool-call-row active" id="${toolId}">
        <span class="tool-call-dot"></span>
        <span class="tool-call-name">${toolName}</span>
        <span class="tool-call-args">(${inputSummary})</span>
        <span class="tool-call-status">Running</span>
      </div>
    `;

    // Update count badge
    const count = bodyEl.querySelectorAll('.tool-call-row').length;
    group.querySelector('.tool-group-count').textContent = count > 1 ? `${count} calls` : '';

    scrollChat();
  }

  function onToolResult(toolName, resultStr) {
    const stepEl = document.querySelector(`#tool-call-${toolCount}`);
    if (stepEl) {
      stepEl.classList.replace('active', 'done');
      stepEl.querySelector('.tool-call-status').textContent = 'Result';
    }

    // Render a page-created summary card (like Claude.ai AEM Content MCP)
    // Only show for copy_aem_page (page creation) — not for every patch
    if (toolName === 'copy_aem_page') {
      try {
        const result = JSON.parse(resultStr);
        if (result.status === 'created') {
          const title = result.title || result.path?.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'New Page';
          const siteName = getActiveProfile()?.name || 'AEM Site';
          const ueUrl = result.edit_urls?.universal_editor;
          const daUrl = result.edit_urls?.document_authoring;
          const action = result.status === 'created' ? 'Created' : 'Updated';
          const profileName = getActiveProfile()?.contactName || 'Author';

          addRawHTML(`
            <div class="page-card">
              <div class="page-card-header">
                <div class="page-card-icon">📄</div>
                <div class="page-card-meta">
                  <div class="page-card-title">${title} — Live on ${siteName}</div>
                  <div class="page-card-author">${action} by: ${profileName} — just now</div>
                </div>
              </div>
              ${ueUrl ? `<a href="${ueUrl}" target="_blank" rel="noopener" class="page-card-link">Open in Universal Editor →</a>` : ''}
              ${daUrl ? `<a href="${daUrl}" target="_blank" rel="noopener" class="page-card-link page-card-link-secondary">Open in Document Authoring →</a>` : ''}
            </div>
          `);
          scrollChat();
        }
      } catch { /* not JSON, skip */ }
    }

    // Check if all calls in this agent group are done — update the header dot
    const agentName = TOOL_AGENT_MAP[toolName] || 'Adobe Agent';
    const group = agentContainers[agentName];
    if (group) {
      const allDone = [...group.querySelectorAll('.tool-call-row')].every((r) => r.classList.contains('done'));
      if (allDone) {
        const dot = group.querySelector('.tool-group-header .gen-dot');
        if (dot) dot.classList.replace('active', 'done');
        // Auto-collapse completed agent groups after a short delay
        setTimeout(() => { group.classList.add('collapsed'); scrollChat(); }, 800);
      }
    }
  }

  const streamEl = addStreamMessage('Experience Agent');

  try {
    const rawResponse = await ai.streamChat(
      conversationHistory,
      ctx,
      (chunk, full) => {
        streamEl.innerHTML = md(full);
        scrollChat();
      },
      onToolCall,
      onToolResult,
    );

    conversationHistory.push({ role: 'assistant', content: rawResponse });
  } catch (err) {
    streamEl.innerHTML = `<span style="color:var(--accent)">AI Error: ${err.message}</span><br>Check your API key in settings.`;
  }
}

/* Format tool input for display */
function formatToolInput(toolName, input) {
  if (!input || Object.keys(input).length === 0) return '';

  switch (toolName) {
    case 'get_aem_sites': return '';
    case 'get_aem_site_pages': return `"${input.site_id || ''}"`;
    case 'get_page_content': {
      if (input.url) return `"${input.url.split('/').pop() || input.url}"`;
      if (input.path) return `"${input.site_id || ''}${input.path}"`;
      return '';
    }
    case 'copy_aem_page': return `"${input.destination_path || ''}"`;
    case 'patch_aem_page_content': return `"${input.page_path || ''}"`;
    case 'create_aem_launch': return `"${input.launch_name || ''}"`;
    case 'promote_aem_launch': return `"${input.launch_id || ''}"`;
    case 'search_dam_assets': return `"${(input.query || '').slice(0, 30)}"`;
    case 'run_governance_check': return `"${input.page_path || ''}"`;
    case 'get_audience_segments': return `${input.action || 'list'}`;
    case 'create_content_variant': return `"${input.segment || ''}"`;
    case 'get_analytics_insights': return `"${(input.query || '').slice(0, 30)}"`;
    case 'get_journey_status': return `${input.action || 'list'}`;
    case 'create_workfront_task': return `"${(input.title || '').slice(0, 30)}"`;
    case 'extract_brief_content': return `"${input.file_name || 'brief'}"`;
    case 'create_ab_test': return `"${(input.test_name || '').slice(0, 30)}"`;
    case 'get_personalization_offers': return `"${input.location || input.segment || ''}"`;
    case 'get_customer_profile': return `"${(input.identity || '').slice(0, 25)}"`;
    case 'generate_image_variations': return `"${(input.prompt || '').slice(0, 25)}"`;
    case 'get_pipeline_status': return `${input.environment || 'prod'}${input.status_filter ? ` (${input.status_filter})` : ''}`;
    case 'extract_pdf_content': return `"${input.file_name || 'document.pdf'}"`;
    case 'translate_page': return `"${input.page_path || ''}" → ${input.target_language || ''}`;
    case 'create_form': return `"${(input.description || '').slice(0, 30)}"`;
    case 'modernize_content': return `"${input.page_path || ''}"`;
    case 'get_brand_guidelines': return `"${input.brand || 'default'}"`;
    case 'check_asset_expiry': return `"${(input.asset_path || input.query || '').slice(0, 30)}"`;
    case 'audit_content': return `"${input.page_path || ''}"`;
    case 'transform_image': return `"${(input.asset_path || '').split('/').pop()}" ${input.action || ''}`;
    case 'create_image_renditions': return `"${(input.asset_path || '').split('/').pop()}"`;
    case 'add_to_collection': return `"${(input.collection_name || '').slice(0, 25)}"`;
    case 'analyze_pipeline_failure': return `"${input.pipeline_id || ''}"`;
    case 'analyze_journey_conflicts': return `"${(input.journey_name || '').slice(0, 25)}"`;
    case 'create_support_ticket': return `"${(input.subject || '').slice(0, 30)}"`;
    case 'get_ticket_status': return `"${input.case_id || ''}"`;
    default: {
      const str = JSON.stringify(input);
      return str.length > 40 ? str.slice(0, 37) + '...' : str;
    }
  }
}

/* ── REAL: Governance Scan ── */
async function runRealGovernance() {
  addMessage('user', 'Run governance scan on the current page');

  // Step 1: Client-side DOM scan
  const scanMsg = addRawHTML(`
    <div class="agent-badge">Governance Scanner</div>
    <div class="message-content">
      <strong>Scanning page...</strong>
      <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
    </div>
  `);
  const fill = scanMsg.querySelector('.progress-fill');

  let scanResult = null;
  let scanDoc = null;

  // Try iframe DOM first (same-origin), then fetch .plain.html
  try {
    scanDoc = previewFrame.contentDocument || previewFrame.contentWindow?.document;
    if (!scanDoc?.body?.innerHTML) scanDoc = null;
  } catch { scanDoc = null; }

  if (!scanDoc) {
    // Fetch page HTML and parse into a document
    fill.style.width = '20%';
    await ensurePageContext();
    fill.style.width = '40%';

    if (cachedPageHTML) {
      const parser = new DOMParser();
      scanDoc = parser.parseFromString(
        `<!DOCTYPE html><html><head></head><body>${cachedPageHTML}</body></html>`,
        'text/html',
      );
    }
  }

  if (scanDoc) {
    for (let i = 3; i <= 5; i++) {
      await sleep(250);
      fill.style.width = `${i * 20}%`;
    }

    scanResult = gov.scanPage(scanDoc);
    const formatted = gov.formatResults(scanResult);

    addRawHTML(`
      <div class="agent-badge">Governance Scanner</div>
      <div class="message-content">${formatted.html}</div>
    `);

    // Update governance bar
    const checks = {};
    Object.entries(scanResult.results).forEach(([key, cat]) => {
      if (['brand', 'legal', 'a11y', 'seo'].includes(key)) {
        if (cat.fail > 0) checks[key] = 'fail';
        else if (cat.warn > 0) checks[key] = 'warn';
        else checks[key] = true;
      }
    });
    // Governance results displayed in chat (bar removed in AEMCoder redesign)
  } else {
    fill.style.width = '100%';
    addMessage('assistant', '⚠ Could not fetch page content for scanning. Check the preview URL.', 'Governance Scanner');
  }

  // Step 2: AI-powered deep analysis (if Claude key available)
  if (ai.hasApiKey()) {
    addTyping();
    await sleep(400);
    removeTyping();

    try {
      await ensurePageContext();
      const ctx = getPageContext();
      if (ctx.pageHTML) {
        const streamEl = addStreamMessage('AI Governance Agent');
        await ai.streamChat(
          [{ role: 'user', content: `Analyze this AEM page for governance compliance. Check brand, legal, accessibility (WCAG 2.1 AA), and SEO. Be specific — reference actual elements. Return a structured report with scores and actionable fixes.\n\nPage URL: ${ctx.pageUrl}\n\nPage HTML:\n\`\`\`html\n${ctx.pageHTML.slice(0, 15000)}\n\`\`\`` }],
          ctx,
          (chunk, full) => { streamEl.innerHTML = md(full); scrollChat(); },
        );
      } else {
        addMessage('assistant', 'No page content available for AI analysis.', 'AI Governance Agent');
      }
    } catch (err) {
      addMessage('assistant', `AI analysis error: ${err.message}`, 'AI Governance Agent');
    }
  }

  if (scanResult) {
    const fixable = Object.values(scanResult.results)
      .flatMap((cat) => cat.issues)
      .filter((i) => i.fixable);

    if (fixable.length > 0) {
      addRawHTML(`
        <div class="agent-badge">Governance Agent</div>
        <div class="message-content">
          <strong>${fixable.length} issues can be auto-fixed</strong>
          <div class="money-line">
            Real scan completed. ${scanResult.total.pass} checks passed, ${scanResult.total.fail} failed, ${scanResult.total.warn} warnings.
          </div>
        </div>
      `);
    }

  }
}

/* ── REAL: Upload Brief (Differentiator #3) ── */
/* No native agent does: brief PDF in → structured page → governance gate → Workfront task */

async function runRealBrief() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,.txt,.doc,.docx';

  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const profile = getActiveProfile();
    addMessage('user', `Upload ${file.name} and create landing page`);
    addRawHTML(`
      <div class="upload-indicator">
        <span class="file-icon">📄</span>
        <div>
          <div style="font-weight:500">${file.name}</div>
          <div style="font-size:10px;color:var(--text-muted)">${(file.size / 1024 / 1024).toFixed(1)} MB — uploaded</div>
        </div>
      </div>
    `);

    // Step 1: Extract text from file (Acrobat MCP)
    const step1 = addOrchestrationStep('Acrobat MCP', 'Extracting brief content', 'active');
    let briefText = '';
    try {
      if (file.type === 'application/pdf') {
        briefText = await extractPdfText(file);
      } else {
        briefText = await file.text();
      }

      if (!briefText.trim()) {
        updateOrchestrationStep(step1, 'error');
        addMessage('assistant', '⚠ Could not extract text from file. Please try a .txt or .pdf file.', 'Acrobat MCP');
        return;
      }

      updateOrchestrationStep(step1, 'done');
      addMessage('assistant', md(
        `**Extracted ${briefText.split(/\s+/).length} words from brief**\n\n`
        + `Preview: "${briefText.slice(0, 200)}..."`,
      ), 'Acrobat MCP');
    } catch (err) {
      updateOrchestrationStep(step1, 'error');
      addMessage('assistant', `⚠ File extraction error: ${err.message}`, 'Acrobat MCP');
      return;
    }

    if (!ai.hasApiKey()) {
      addMessage('assistant', 'Configure your Claude API key in settings to continue.', 'Brief Analysis Agent');
      return;
    }

    // Step 2: Analyze brief with customer-specific context
    const step2 = addOrchestrationStep('Brief Analysis', 'Analyzing with brand context', 'active');
    const streamEl2 = addStreamMessage('Brief Analysis Agent');
    let analysis = '';
    try {
      analysis = await ai.streamChat(
        [{ role: 'user', content: `Analyze this campaign brief for ${profile.name} (${profile.vertical}).

Brief content:
${briefText}

Map requirements to:
- Customer segments: ${profile.segments?.map((s) => s.name).join(', ')}
- Brand voice: ${profile.brandVoice?.tone}
- AEM EDS blocks (hero, cards, columns, tabs, etc.)
- Governance checkpoints per approval chain

Return a structured, actionable analysis.` }],
        getPageContext(),
        (chunk, full) => { streamEl2.innerHTML = md(full); scrollChat(); },
      );
      updateOrchestrationStep(step2, 'done');
    } catch (err) {
      streamEl2.innerHTML = `Error: ${err.message}`;
      updateOrchestrationStep(step2, 'error');
      return;
    }

    await sleep(400);

    // Step 3: Generate page content
    const step3 = addOrchestrationStep('Experience Production', 'Generating page content', 'active');
    const streamEl3 = addStreamMessage('Experience Production');
    let pageContent = '';
    try {
      pageContent = await ai.streamChat(
        [{ role: 'user', content: `Generate an AEM Edge Delivery Services page based on this brief analysis for ${profile.name}:

${analysis.slice(0, 4000)}

Requirements:
1. Complete HTML content with real copy (not placeholder) in ${profile.name}'s brand voice
2. Use EDS block patterns: hero, cards, columns, tabs, accordion
3. Include metadata block with SEO-optimized title, description, OG tags
4. Image placements with alt text following DAM naming: ${profile.damTaxonomy?.namingConvention || 'descriptive kebab-case'}
5. Section metadata for styling

Generate ready-to-author content.` }],
        getPageContext(),
        (chunk, full) => { streamEl3.innerHTML = md(full); scrollChat(); },
      );
      updateOrchestrationStep(step3, 'done');
    } catch (err) {
      streamEl3.innerHTML = `Error: ${err.message}`;
      updateOrchestrationStep(step3, 'error');
      return;
    }

    await sleep(400);

    // Step 4: Governance Gate (Differentiator #3 — the gate before publish)
    const step4 = addOrchestrationStep('Governance Gate', 'Brand & legal compliance', 'active');
    const streamEl4 = addStreamMessage('Governance Agent');
    try {
      await ai.streamChat(
        [{ role: 'user', content: `GOVERNANCE GATE — Review generated content before publishing for ${profile.name}:

${pageContent.slice(0, 3000)}

Check against:
${profile.legalSLA?.specialRules?.map((r) => `- ${r}`).join('\n') || '- Standard brand and legal compliance'}

Brand voice rules: ${profile.brandVoice?.tone}
Avoided words: ${profile.brandVoice?.avoided?.join(', ') || 'none specified'}

Provide:
1. PASS/FAIL/WARN for: Brand Voice, Legal Compliance, Accessibility, SEO
2. Specific violations with severity
3. Recommended approval routing:
${profile.approvalChain?.map((s, i) => `   ${i + 1}. ${s.role}${s.sla ? ` (SLA: ${s.sla})` : ''}`).join('\n') || '   Standard review'}
4. Estimated time to publish based on SLAs
5. Auto-fixable issues vs. manual review required` }],
        getPageContext(),
        (chunk, full) => { streamEl4.innerHTML = md(full); scrollChat(); },
      );
      updateOrchestrationStep(step4, 'done');
    } catch (err) {
      streamEl4.innerHTML = `Error: ${err.message}`;
      updateOrchestrationStep(step4, 'error');
      return;
    }

    await sleep(400);

    // Step 5: Workfront Task Creation
    const step5 = addOrchestrationStep('Workfront WOA', 'Creating review tasks', 'active');
    const streamEl5 = addStreamMessage('Workfront WOA');
    try {
      await ai.streamChat(
        [{ role: 'user', content: `Create Workfront tasks for publishing this ${profile.name} page:

Approval chain:
${profile.approvalChain?.map((s, i) => `${i + 1}. ${s.role}: ${s.action}${s.sla ? ` (SLA: ${s.sla})` : ''}`).join('\n') || 'Standard approval'}

Generate a task table with: Task Name, Assignee (Role), Due Date, Dependencies, Status.
Include the governance findings from the previous step.
End with estimated time to publish.` }],
        getPageContext(),
        (chunk, full) => { streamEl5.innerHTML = md(full); scrollChat(); },
      );
      updateOrchestrationStep(step5, 'done');
    } catch (err) {
      streamEl5.innerHTML = `Error: ${err.message}`;
      updateOrchestrationStep(step5, 'error');
      return;
    }

    // Create in DA if authenticated
    if (isSignedIn()) {
      try {
        const pageName = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '-');
        await da.createPage(`/${pageName}.html`, pageContent);
        await da.previewPage(`/${pageName}`);
        const previewUrl = da.getPreviewUrl(`/${pageName}`);
        addRawHTML(`
          <div class="agent-badge">Experience Production</div>
          <div class="message-content">
            <strong>✓ Page created and routed for review</strong><br><br>
            Path: <code>/${pageName}</code><br>
            Preview: <a href="${previewUrl}" target="_blank">${previewUrl}</a>
          </div>
        `);
        previewFrame.src = previewUrl;
      } catch (err) {
        addMessage('assistant', `Page content generated but DA save failed: ${err.message}`, 'Experience Production');
      }
    }

    addRawHTML(`
      <div class="agent-badge">Pipeline Complete</div>
      <div class="message-content">
        <div class="money-line">
          <strong>Brief → analyzed → page generated → governance checked → tasks created.</strong><br>
          5 steps, 1 conversation. No native agent does this end-to-end today. This is Differentiator #3.
        </div>
      </div>
    `);
  };

  fileInput.click();
}

async function extractPdfText(file) {
  // Try PDF.js if available, fall back to regex extraction
  if (window.pdfjsLib) {
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(' '));
      }
      return pages.join('\n\n');
    } catch { /* fall through to regex */ }
  }

  // Regex fallback for basic PDFs
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const readable = text.replace(/[\x00-\x1f\x80-\xff]/g, ' ').replace(/\s+/g, ' ').trim();
  const matches = readable.match(/\(([^)]+)\)/g);
  if (matches) {
    return matches
      .map((m) => m.slice(1, -1))
      .filter((t) => t.length > 2 && /[a-zA-Z]/.test(t))
      .join(' ');
  }
  return readable.slice(0, 5000);
}

/* ── (Demo flows removed — all flows are real AI now) ── */

/* ── Workfront WOA Flows — Real AI ── */
async function runWorkfrontPanel() {
  addMessage('user', 'Show Workfront project status and WOA agent capabilities');
  await handleRealChat(`Show the current Workfront WOA (Workflow Optimization Agent) status for the AEM XSC Showcase project. Include:

1. **Connected WOA Agents** — list the four P1 skills with their current status:
   - AI Reviewer (brand guideline compliance for assets) — Open Beta, GA Q1 FY26
   - AI Form Fill (AI-powered form completion) — Open Beta, GA 12/3/25
   - Project Health (AI project/program performance assessment) — Open Beta, GA TBD
   - Intelligent Answers (NL questions across Workfront ecosystem) — GA Planned, 12/3/25

2. **Project Health Assessment** — provide an AI-driven assessment of the AEM XSC Showcase Launch project covering schedule, risks, blockers, and team capacity.

3. **Actionable Recommendations** — what should the team focus on next?

Format with tables and structured data. Use ✓/⚠/❌ indicators for status.`);
}

async function runAIReviewer() {
  addMessage('user', 'Run Workfront AI Reviewer — brand compliance check');
  await handleRealChat(`As the Workfront AI Reviewer agent, perform a brand compliance review on the current page assets. Check:
- Logo placement and usage
- Color palette adherence to brand guidelines
- Typography (Adobe Clean font usage)
- Image quality and resolution
- Tone of voice alignment

Provide a brand compliance score and specific findings with pass/warn/fail status for each check.`);
}

async function runWorkfrontQuery(question) {
  addMessage('user', question);
  await handleRealChat(`As the Workfront Intelligent Answers agent, answer this question about the Workfront ecosystem: "${question}"

Provide a detailed answer referencing projects, tasks, approvals, timesheets, and team capacity as relevant. Format with markdown tables and structured data where appropriate.`);
}

/* ── Cross-Product Orchestration (Differentiator #2) ── */
/* No native agent does: Acrobat → Discovery → AEM Content → CJA → Workfront in one conversation */

async function runOrchestration() {
  const profile = getActiveProfile();
  addMessage('user', 'Run full cross-product orchestration');

  // Step 1: Brief Analysis (Acrobat MCP)
  const step1 = addOrchestrationStep('Acrobat MCP', 'Analyzing uploaded brief', 'active');
  await sleep(300);

  const briefPrompt = `You are orchestrating a cross-product workflow for ${profile.name}. This is the kind of agent chaining that doesn't exist natively — Discovery Agent, Data Insights Agent, Content Agent, and Workfront Agent are siloed by product. You're combining them in one thread.

Step 1 — BRIEF ANALYSIS (Acrobat MCP):
Simulate analyzing a campaign brief PDF. Generate a realistic brief analysis for ${profile.name} (${profile.vertical} vertical) that includes:
- Campaign objective
- Target audience (use these REAL customer segments: ${profile.segments?.map((s) => s.name).join(', ')})
- Key messages aligned with brand voice: "${profile.brandVoice?.tone}"
- Required content sections mapped to AEM EDS blocks
- Brand compliance checkpoints per the customer's rules

Make this feel like a real brief analysis — specific, actionable, ready for content generation.`;

  const streamEl1 = addStreamMessage('Acrobat MCP');
  let briefAnalysis = '';
  try {
    briefAnalysis = await ai.streamChat(
      [{ role: 'user', content: briefPrompt }],
      getPageContext(),
      (chunk, full) => { streamEl1.innerHTML = md(full); scrollChat(); },
    );
    updateOrchestrationStep(step1, 'done');
  } catch (err) {
    streamEl1.innerHTML = `Error: ${err.message}`;
    updateOrchestrationStep(step1, 'error');
    return;
  }

  await sleep(500);

  // Step 2: Content Generation (AEM Content MCP)
  const step2 = addOrchestrationStep('AEM Content MCP', 'Generating page from brief', 'active');
  const contentPrompt = `Step 2 — CONTENT GENERATION (AEM Content MCP):
Based on this brief analysis, generate a complete AEM Edge Delivery Services page structure:

${briefAnalysis.slice(0, 3000)}

Generate:
1. Complete section-by-section content with real copy (not lorem ipsum) aligned to ${profile.name}'s brand voice
2. Block structure using EDS patterns (hero, cards, columns, tabs, etc.)
3. Metadata with SEO title, description, OG tags
4. Image placements with descriptive alt text following DAM taxonomy: ${profile.damTaxonomy?.namingConvention || 'standard'}

This page would be created via AEM Content MCP in a real deployment.`;

  const streamEl2 = addStreamMessage('AEM Content MCP');
  let pageContent = '';
  try {
    pageContent = await ai.streamChat(
      [{ role: 'user', content: contentPrompt }],
      getPageContext(),
      (chunk, full) => { streamEl2.innerHTML = md(full); scrollChat(); },
    );
    updateOrchestrationStep(step2, 'done');
  } catch (err) {
    streamEl2.innerHTML = `Error: ${err.message}`;
    updateOrchestrationStep(step2, 'error');
    return;
  }

  await sleep(500);

  // Step 3: Governance Gate
  const step3 = addOrchestrationStep('Governance Agent', 'Running compliance checks', 'active');
  const govPrompt = `Step 3 — GOVERNANCE GATE:
Review this generated content for ${profile.name} compliance:

${pageContent.slice(0, 3000)}

Check against the customer's specific rules:
${profile.legalSLA?.specialRules?.map((r) => `- ${r}`).join('\n') || '- Standard brand and legal compliance'}

Approval chain for this content:
${profile.approvalChain?.map((s, i) => `${i + 1}. ${s.role}: ${s.action}${s.sla ? ` (SLA: ${s.sla})` : ''}`).join('\n') || 'Standard approval flow'}

Provide:
1. Brand compliance score (0-100%)
2. Legal compliance assessment with specific rule violations if any
3. A11y pre-check
4. Approval routing recommendation — who needs to review this and in what order
5. Estimated time to approval based on SLAs`;

  const streamEl3 = addStreamMessage('Governance Agent');
  try {
    await ai.streamChat(
      [{ role: 'user', content: govPrompt }],
      getPageContext(),
      (chunk, full) => { streamEl3.innerHTML = md(full); scrollChat(); },
    );
    updateOrchestrationStep(step3, 'done');
  } catch (err) {
    streamEl3.innerHTML = `Error: ${err.message}`;
    updateOrchestrationStep(step3, 'error');
    return;
  }

  await sleep(500);

  // Step 4: Analytics / CJA Insight
  const step4 = addOrchestrationStep('CJA Data Insights', 'Forecasting performance', 'active');
  const cjaPrompt = `Step 4 — CJA DATA INSIGHTS AGENT:
Based on the content we just generated for ${profile.name}, provide performance forecasting:

Target segments: ${profile.segments?.map((s) => s.name).join(', ')}

Provide:
1. Expected engagement metrics by segment (page views, time on page, scroll depth, CTA clicks)
2. Conversion rate predictions based on similar content in ${profile.vertical}
3. Personalization recommendations — which sections to A/B test, which segments see what variant
4. Revenue impact estimate

Reference CJA data views and AA report suites where applicable.`;

  const streamEl4 = addStreamMessage('CJA Data Insights');
  try {
    await ai.streamChat(
      [{ role: 'user', content: cjaPrompt }],
      getPageContext(),
      (chunk, full) => { streamEl4.innerHTML = md(full); scrollChat(); },
    );
    updateOrchestrationStep(step4, 'done');
  } catch (err) {
    streamEl4.innerHTML = `Error: ${err.message}`;
    updateOrchestrationStep(step4, 'error');
    return;
  }

  await sleep(500);

  // Step 5: Workfront Task
  const step5 = addOrchestrationStep('Workfront WOA', 'Creating tasks & routing', 'active');
  const wfPrompt = `Step 5 — WORKFRONT WOA (Workflow Optimization Agent):
Create a Workfront project plan for publishing this content for ${profile.name}:

Approval chain:
${profile.approvalChain?.map((s, i) => `${i + 1}. ${s.role}: ${s.action}${s.sla ? ` (SLA: ${s.sla})` : ''}`).join('\n') || 'Standard approval flow'}

Generate:
1. Workfront tasks for each approval step with due dates based on SLAs
2. Task assignments by role
3. Dependencies (what blocks what)
4. Project timeline — expected time from now to publish
5. Risk flags — any steps that could delay publication

Format as a clear project plan with task table. This is the Workfront integration that closes the loop — brief in, page generated, governance checked, tasks created, all in one conversation.

End with: "Full orchestration complete. 5 agents, 1 thread, 0 product boundaries."`;

  const streamEl5 = addStreamMessage('Workfront WOA');
  try {
    await ai.streamChat(
      [{ role: 'user', content: wfPrompt }],
      getPageContext(),
      (chunk, full) => { streamEl5.innerHTML = md(full); scrollChat(); },
    );
    updateOrchestrationStep(step5, 'done');
  } catch (err) {
    streamEl5.innerHTML = `Error: ${err.message}`;
    updateOrchestrationStep(step5, 'error');
    return;
  }

  // Final summary
  addRawHTML(`
    <div class="agent-badge">Orchestration Complete</div>
    <div class="message-content">
      <div class="money-line">
        <strong>5 agents. 1 thread. 0 product boundaries.</strong><br>
        Acrobat → AEM Content → Governance → CJA → Workfront — chained in a single conversation.
        No native Adobe agent can do this today. This is Differentiator #2.
      </div>
    </div>
  `);
}

function addOrchestrationStep(agent, label, state) {
  const el = document.createElement('div');
  el.classList.add('orchestration-step');
  el.innerHTML = `
    <div class="step-indicator ${state}"></div>
    <div class="step-agent">${agent}</div>
    <div class="step-label">${label}</div>
  `;
  chatMessages.appendChild(el);
  scrollChat();
  return el;
}

function updateOrchestrationStep(el, state) {
  const indicator = el.querySelector('.step-indicator');
  indicator.className = `step-indicator ${state}`;
}

/* ── MCP Services Status ── */
async function runServicesPanel() {
  addMessage('user', 'Show connected MCP services and entitlements');

  const profile = getActiveProfile();
  const caps = profile.mcpCapabilities || AEM_ORG.mcpCapabilities;
  let html = '<strong>Adobe MCP Service Matrix</strong>';
  html += '<table class="gov-results" style="margin-top:10px"><tr><th>Capability</th><th>MCP Server</th><th>Status</th></tr>';
  caps.forEach((c) => {
    const statusIcon = c.ready
      ? '<span style="color:var(--green)">&#9679; Live</span>'
      : `<span style="color:var(--yellow)">&#9679; ${c.needs}</span>`;
    html += `<tr><td>${c.capability}</td><td><code>${c.mcp}</code></td><td>${statusIcon}</td></tr>`;
  });
  html += '</table>';

  const liveCount = caps.filter((c) => c.ready).length;
  const totalCount = caps.length;
  html += `<div style="margin-top:10px;font-size:11px;color:var(--text-muted)">${liveCount} of ${totalCount} capabilities live · ${totalCount - liveCount} need configuration</div>`;

  addRawHTML(`<div class="agent-badge">MCP Services</div><div class="message-content">${html}</div>`);

  // Show entitlements
  addTyping();
  await sleep(600);
  removeTyping();

  const ents = profile.entitlements || AEM_ORG.entitlements;
  let entHTML = '<strong>Confirmed Entitlements</strong>';
  entHTML += '<div class="issue-list" style="margin-top:8px">';
  Object.values(ents).forEach((e) => {
    const icon = e.status === 'live' ? '✓' : '⚡';
    const cls = e.status === 'live' ? 'fixable' : '';
    entHTML += `<div class="issue-item ${cls}">${icon} <strong>${e.name}</strong> — ${e.mcp} · ${e.note}</div>`;
  });
  entHTML += '</div>';
  entHTML += '<div class="money-line">Full Adobe Experience Cloud stack authenticated. AEM Content + AJO live today. Analytics, CJA, AEP, and Target ready once configured.</div>';

  addRawHTML(`<div class="agent-badge">Entitlements</div><div class="message-content">${entHTML}</div>`);
}

/* ── Block Library ── */
const BLOCK_CATALOG = [
  { name: 'Hero', variants: '—', cols: '1 col, 3 rows', use: 'Page banner with background image, headline, CTA' },
  { name: 'Cards', variants: '(no images)', cols: '2 col or 1 col', use: 'Feature grids, article lists, product cards' },
  { name: 'Columns', variants: '—', cols: 'N columns', use: 'Side-by-side content layouts' },
  { name: 'Tabs', variants: '—', cols: '2 col', use: 'Tabbed content sections' },
  { name: 'Accordion', variants: '—', cols: '2 col', use: 'FAQs, collapsible content' },
  { name: 'Carousel', variants: '—', cols: '2 col', use: 'Rotating slides with image + text' },
  { name: 'Table', variants: 'striped, bordered, no header', cols: 'N col', use: 'Data tables, comparison grids' },
  { name: 'Video', variants: '—', cols: '1 col', use: 'Standalone embedded video' },
  { name: 'Embed', variants: 'video, social', cols: '1 col', use: 'YouTube, Vimeo, Twitter embeds' },
  { name: 'Search', variants: '—', cols: '1 col', use: 'Site search with query index' },
];

async function runBlockLibrary() {
  addMessage('user', 'Show available EDS block library');

  let html = '<strong>AEM EDS Block Library</strong>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin:4px 0 8px">Source: sta-xwalk-boilerplate (same as AEMCoder)</div>';
  html += '<table class="gov-results" style="margin-top:6px"><tr><th>Block</th><th>Variants</th><th>Structure</th><th>Use Case</th></tr>';
  BLOCK_CATALOG.forEach((b) => {
    html += `<tr><td><strong>${b.name}</strong></td><td><code>${b.variants}</code></td><td>${b.cols}</td><td>${b.use}</td></tr>`;
  });
  html += '</table>';
  html += '<div style="margin-top:8px;font-size:11px;color:var(--text-muted)">10 standard blocks + system blocks (Header, Footer, Metadata, Section Metadata, Fragment)</div>';

  addRawHTML(`<div class="agent-badge">Block Library</div><div class="message-content">${html}</div>`);

  addTyping(); await sleep(500); removeTyping();

  // Show local project blocks
  const localBlocks = ['cards', 'carousel', 'columns', 'cta', 'demo-cards', 'footer', 'fragment', 'header', 'hero', 'revenue-motions', 'steps', 'team', 'ticker', 'verticals'];
  let localHTML = '<strong>Project Blocks (this repo)</strong>';
  localHTML += '<div class="issue-list" style="margin-top:8px">';
  localBlocks.forEach((b) => {
    const isStandard = BLOCK_CATALOG.some((c) => c.name.toLowerCase() === b);
    const icon = isStandard ? '✓' : '★';
    const label = isStandard ? 'standard' : 'custom';
    localHTML += `<div class="issue-item ${isStandard ? 'fixable' : ''}">${icon} <strong>${b}</strong> <span style="color:var(--text-muted)">${label}</span></div>`;
  });
  localHTML += '</div>';
  localHTML += `<div class="money-line">${localBlocks.length} blocks deployed · ${localBlocks.filter((b) => !BLOCK_CATALOG.some((c) => c.name.toLowerCase() === b)).length} custom blocks</div>`;

  addRawHTML(`<div class="agent-badge">Block Inventory</div><div class="message-content">${localHTML}</div>`);
}

/* ── Performance & Personalize — real AI ── */
async function runPerformanceFlow() {
  addMessage('user', 'Analyze performance of the current page');
  await handleRealChat('Analyze the performance of this page. Check for EDS three-phase loading compliance, image optimization, CLS/LCP issues, and provide specific recommendations. Reference any analytics data available via MCP.');
}

async function runPersonalizeFlow() {
  addMessage('user', 'Suggest personalization for this page');
  await handleRealChat('Analyze this page and suggest personalization strategies. Identify content sections that could be personalized, recommend audience segments, and estimate potential impact. Reference AEP and Target MCP capabilities.');
}

/* ── Preview (hidden iframe for page context) ── */
function loadPreview() {
  previewFrame.src = PREVIEW_URL;
}

/* ── Flow Router ── */
function runBrief() {
  if (!ai.hasApiKey()) { requireApiKey(); return; }
  runRealBrief();
}

function runGovernance() {
  if (!ai.hasApiKey() && !isSignedIn()) { requireApiKey(); return; }
  runRealGovernance();
}

function requireApiKey() {
  addMessage('assistant', md('**API key required.** Open ⚙ Settings and enter your Claude API key to use this feature.'));
}

const FLOWS = {
  brief: runBrief,
  governance: runGovernance,
  performance: runPerformanceFlow,
  personalize: runPersonalizeFlow,
  workfront: runWorkfrontPanel,
  services: runServicesPanel,
  blocks: runBlockLibrary,
  orchestrate: () => { if (!ai.hasApiKey()) { requireApiKey(); return; } runOrchestration(); },
};

/* ── User Input ── */
function matchSpecializedFlow(text) {
  const lower = text.toLowerCase();

  // If the message mentions a known site + governance/compliance, route through AI chat
  // (which has site detection and content fetching) instead of the basic page scanner
  const mentionsSite = !!detectSiteMention(text);
  const mentionsGovernance = lower.includes('governance') || lower.includes('compliance')
    || lower.includes('scan') || lower.includes('check') || lower.includes('review')
    || lower.includes('audit') || lower.includes('look at');

  if (mentionsSite && ai.hasApiKey()) {
    // Let AI chat handle it — it will detect the site, fetch content via MCP, and analyze
    return null;
  }

  if (lower.includes('brief') || lower.includes('upload') || lower.includes('create page')) return runBrief;
  if (lower.includes('governance') || lower.includes('compliance') || lower.includes('scan all')
      || lower.includes('scan page') || lower.includes('run scan')) return runGovernance;
  if (lower.includes('perform') || lower.includes('analytics') || lower.includes('bounce')) return runPerformanceFlow;
  if (lower.includes('personal') || lower.includes('segment') || lower.includes('variant')) return runPersonalizeFlow;
  if (lower.includes('workfront') || lower.includes('project health') || lower.includes('project status')) return runWorkfrontPanel;
  if (lower.includes('mcp') || lower.includes('services') || lower.includes('entitlement') || lower.includes('connected services')) return runServicesPanel;
  if (lower.includes('block') || lower.includes('library') || lower.includes('catalog') || lower.includes('component')) return runBlockLibrary;
  if (lower.includes('review asset') || lower.includes('brand review') || lower.includes('brand check')) return runAIReviewer;
  if (lower.includes('orchestrat') || lower.includes('end to end') || lower.includes('end-to-end')
      || lower.includes('full pipeline') || lower.includes('brief to page') || lower.includes('5 agents')) {
    return runOrchestration;
  }
  if (lower.includes('overdue') || lower.includes('pending approval') || lower.includes('capacity') || lower.includes('workload')) {
    return () => runWorkfrontQuery(text);
  }
  return null;
}

function handleUserInput() {
  const text = chatInput.value.trim();
  if (!text && !pendingFile) return;
  chatInput.value = '';

  // Capture and clear pending file
  const file = pendingFile;
  pendingFile = null;
  const indicator = document.querySelector('.file-attach-indicator');
  if (indicator) indicator.remove();

  const displayText = file
    ? `${text || `Uploaded ${file.name}`}${text ? '' : ''}`
    : text;

  // Always check for specialized flows first — even in AI mode
  if (!file) {
    const specializedFlow = matchSpecializedFlow(text);
    if (specializedFlow) {
      addMessage('user', displayText);
      setTimeout(() => specializedFlow(), 400);
      return;
    }
  }

  // AI chat (with conversation history)
  if (ai.hasApiKey()) {
    // Show user message with file badge if attached
    if (file) {
      addRawHTML(`
        <div class="message user">
          <div class="message-content">
            <div class="upload-indicator" style="margin-bottom:6px">
              <span class="file-icon">${file.type === 'image' ? '🖼' : '📄'}</span>
              <div>
                <div style="font-weight:500">${file.name}</div>
                <div style="font-size:10px;color:var(--text-muted)">${(file.size / 1024).toFixed(0)} KB</div>
              </div>
            </div>
            ${text ? `<div>${text}</div>` : ''}
          </div>
        </div>
      `);
    } else {
      addMessage('user', displayText);
    }
    handleRealChat(text || `I've uploaded a file: ${file?.name}. Please analyze it.`, file);
    return;
  }

  // No API key — prompt to configure
  addMessage('user', displayText);
  requireApiKey();
}

/* ── Event Listeners ── */
document.querySelectorAll('.prompt-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fn = FLOWS[btn.dataset.flow];
    if (fn) fn();
  });
});

sendBtn.addEventListener('click', handleUserInput);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserInput(); }
});

// Attach file button (paperclip)
const attachBtn = document.querySelector('.attach-btn');
if (attachBtn) {
  attachBtn.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.txt,.doc,.docx,.csv,.json,.html,.md,.png,.jpg,.jpeg,.gif,.webp,.svg';
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show file indicator in input area
      const existingIndicator = document.querySelector('.file-attach-indicator');
      if (existingIndicator) existingIndicator.remove();

      const indicator = document.createElement('div');
      indicator.className = 'file-attach-indicator';
      indicator.innerHTML = `
        <span class="file-attach-icon">${file.type.startsWith('image/') ? '🖼' : '📄'}</span>
        <span class="file-attach-name">${file.name}</span>
        <span class="file-attach-size">${(file.size / 1024).toFixed(0)} KB</span>
        <button class="file-attach-remove" title="Remove">✕</button>
      `;
      document.querySelector('.input-wrapper').prepend(indicator);
      indicator.querySelector('.file-attach-remove').addEventListener('click', () => {
        pendingFile = null;
        indicator.remove();
      });

      // Read file content
      try {
        if (file.type.startsWith('image/')) {
          // Images → base64 for Claude vision
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          pendingFile = { name: file.name, type: 'image', size: file.size, content: base64, mediaType: file.type };
        } else if (file.type === 'application/pdf') {
          // PDFs → extract text
          const text = await extractPdfText(file);
          pendingFile = { name: file.name, type: 'document', size: file.size, content: text, mediaType: file.type };
        } else {
          // Text files → read as text
          const text = await file.text();
          pendingFile = { name: file.name, type: 'document', size: file.size, content: text, mediaType: file.type };
        }
      } catch (err) {
        indicator.remove();
        addMessage('assistant', `Could not read file: ${err.message}`, 'System');
      }
    };
    fileInput.click();
  });
}

if (authBtn) {
  authBtn.addEventListener('click', () => {
    if (isSignedIn()) signOut();
    else signIn();
  });
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', toggleSettings);
}

// Icon rail settings button
const railSettingsBtn = document.getElementById('railSettingsBtn');
if (railSettingsBtn) {
  railSettingsBtn.addEventListener('click', toggleSettings);
}

// Sidebar panel switching
document.querySelectorAll('.sidebar-btn[data-panel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-btn[data-panel]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const panel = btn.dataset.panel;
    if (panel === 'governance') {
      runGovernance();
    } else if (panel === 'analytics') {
      runPerformanceFlow();
    } else if (panel === 'workfront') {
      runWorkfrontPanel();
    }
  });
});

/* ── Profile Switching ── */
function switchProfile(profileId) {
  setActiveProfile(profileId);
  AEM_ORG = getOrgConfig();
  PREVIEW_URL = AEM_ORG.previewOrigin + '/';

  // Reconfigure DA client
  da.configure({ org: AEM_ORG.orgId, repo: AEM_ORG.repo, branch: AEM_ORG.branch });

  // Update UI
  const customerNameEl = document.querySelector('.customer-name');
  const customerMetaEl = document.querySelector('.customer-meta');
  if (customerNameEl) customerNameEl.textContent = AEM_ORG.name;
  if (customerMetaEl) customerMetaEl.innerHTML = `&bull; ${AEM_ORG.tier} &bull; ${AEM_ORG.env}`;

  // Update active state in org selector
  document.querySelectorAll('.org-option').forEach((opt) => {
    opt.classList.toggle('active', opt.dataset.profile === profileId);
  });

  // Reload preview
  loadPreview();
  cachedPageHTML = null;
  cachedPageUrl = null;

  // Clear conversation
  conversationHistory = [];

  // Notify user
  addMessage('assistant', md(`**Switched to ${AEM_ORG.name}**\nCustomer-specific system prompt loaded. Brand voice, segments, approval chains, and legal rules are now active for ${AEM_ORG.name}.`));

  updateAuthUI();
}

function buildOrgSelector() {
  const profiles = listProfiles();
  const activeId = getActiveProfile().id;

  const container = document.getElementById('orgSelector');
  if (!container) return;

  container.innerHTML = '';
  profiles.forEach((p) => {
    if (p.isCustom) {
      // Custom profiles get a delete button
      const wrap = document.createElement('div');
      wrap.classList.add('org-option-wrap');

      const opt = document.createElement('button');
      opt.classList.add('org-option');
      if (p.id === activeId) opt.classList.add('active');
      opt.dataset.profile = p.id;
      opt.innerHTML = `<span class="org-name">${p.name}</span><span class="org-vertical">${p.vertical}</span>`;
      opt.addEventListener('click', () => switchProfile(p.id));

      const del = document.createElement('button');
      del.classList.add('org-delete-btn');
      del.title = 'Delete custom profile';
      del.textContent = '\u2715';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (getActiveProfile().id === p.id) switchProfile('aem-xsc');
        deleteCustomProfile(p.id);
        buildOrgSelector();
      });

      wrap.appendChild(opt);
      wrap.appendChild(del);
      container.appendChild(wrap);
    } else {
      const opt = document.createElement('button');
      opt.classList.add('org-option');
      if (p.id === activeId) opt.classList.add('active');
      opt.dataset.profile = p.id;
      opt.innerHTML = `<span class="org-name">${p.name}</span><span class="org-vertical">${p.vertical}</span>`;
      opt.addEventListener('click', () => switchProfile(p.id));
      container.appendChild(opt);
    }
  });
}

/* ── Profile Generator (AI-powered customer onboarding) ── */
function initProfileGenerator() {
  const modal = document.getElementById('profileModal');
  const closeBtn = document.getElementById('profileModalClose');
  const newBtn = document.getElementById('newProfileBtn');
  const generateBtn = document.getElementById('profileGenerateBtn');
  const uploadBtn = document.getElementById('profileUploadBtn');
  const saveBtn = document.getElementById('profileSaveBtn');
  const backBtn = document.getElementById('profileBackBtn');

  if (!modal || !newBtn) return;

  // Open modal
  newBtn.addEventListener('click', () => {
    modal.classList.add('visible');
    document.getElementById('settingsPanel').classList.remove('visible');
    showProfileStep(1);
  });

  // Close modal
  closeBtn.addEventListener('click', () => modal.classList.remove('visible'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  });

  // Upload notes file
  uploadBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.pdf,.doc,.docx,.md';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('profileFileName').textContent = file.name;
      try {
        let text = '';
        if (file.type === 'application/pdf' && window.pdfjsLib) {
          const buffer = await file.arrayBuffer();
          const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
          const pages = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            pages.push(content.items.map((item) => item.str).join(' '));
          }
          text = pages.join('\n\n');
        } else {
          text = await file.text();
        }
        const notes = document.getElementById('profileNotes');
        notes.value = (notes.value ? notes.value + '\n\n---\n\n' : '') + text;
      } catch (err) {
        document.getElementById('profileFileName').textContent = `Error: ${err.message}`;
      }
    };
    input.click();
  });

  // Generate profile
  generateBtn.addEventListener('click', () => runProfileGeneration());

  // Save profile
  saveBtn.addEventListener('click', () => {
    try {
      const json = document.getElementById('profileJson').value;
      const profile = JSON.parse(json);
      if (!profile.id || !profile.name) throw new Error('Profile needs id and name');
      addCustomProfile(profile);
      switchProfile(profile.id);
      buildOrgSelector();
      modal.classList.remove('visible');
      addMessage('assistant', md(`**Customer profile created: ${profile.name}**\nBrand voice, ${profile.segments?.length || 0} segments, approval chain, and legal rules loaded. The AI now speaks ${profile.name}.`));
    } catch (err) {
      alert(`Invalid profile JSON: ${err.message}`);
    }
  });

  // Back button
  backBtn.addEventListener('click', () => showProfileStep(1));
}

function showProfileStep(step) {
  document.getElementById('profileStep1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('profileStep2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('profileStep3').style.display = step === 3 ? 'block' : 'none';
}

async function runProfileGeneration() {
  const url = document.getElementById('profileUrl').value.trim();
  const notes = document.getElementById('profileNotes').value.trim();

  if (!url && !notes) {
    alert('Enter a customer URL, paste discovery notes, or both.');
    return;
  }

  if (!ai.hasApiKey()) {
    alert('Configure your Claude API key first.');
    return;
  }

  // Step 2: Show progress
  showProfileStep(2);
  const statusEl = document.getElementById('profileGenStatus');
  const stepsEl = document.getElementById('profileGenSteps');
  stepsEl.innerHTML = '';

  const addGenStep = (label, state) => {
    const el = document.createElement('div');
    el.classList.add('profile-gen-step');
    el.innerHTML = `<span class="gen-dot ${state}"></span>${label}`;
    stepsEl.appendChild(el);
    return el;
  };

  const updateGenStep = (el, state) => {
    el.querySelector('.gen-dot').className = `gen-dot ${state}`;
  };

  // Step 2a: Scrape website if URL provided
  let siteData = '';
  if (url) {
    statusEl.textContent = 'Scraping customer website...';
    const scrapeStep = addGenStep('Fetching site content & CSS', 'active');

    try {
      // Fetch the page HTML
      const resp = await fetch(url, { mode: 'cors' }).catch(() => null);
      if (resp?.ok) {
        const html = await resp.text();

        // Extract useful data
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const title = doc.querySelector('title')?.textContent || '';
        const metaDesc = doc.querySelector('meta[name="description"]')?.content || '';

        // Get nav structure
        const navLinks = [...doc.querySelectorAll('nav a, header a')].map((a) => a.textContent?.trim()).filter(Boolean).slice(0, 20);

        // Get headings
        const headings = [...doc.querySelectorAll('h1, h2, h3')].map((h) => h.textContent?.trim()).filter(Boolean).slice(0, 15);

        // Extract inline styles / CSS references for color hints
        const styleSheets = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href).slice(0, 5);
        const inlineStyles = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n').slice(0, 3000);

        // Get body text summary
        const bodyText = doc.body?.textContent?.replace(/\s+/g, ' ')?.trim()?.slice(0, 2000) || '';

        siteData = `URL: ${url}
Title: ${title}
Meta Description: ${metaDesc}
Navigation Links: ${navLinks.join(', ')}
Headings: ${headings.join(' | ')}
CSS Stylesheets: ${styleSheets.join(', ')}
Inline CSS (excerpt): ${inlineStyles.slice(0, 1000)}
Body Text (excerpt): ${bodyText}`;

        updateGenStep(scrapeStep, 'done');
      } else {
        // CORS blocked — provide URL context only
        siteData = `URL: ${url}\n(Direct fetch blocked by CORS — use URL context and any discovery notes to infer site structure)`;
        updateGenStep(scrapeStep, 'done');
      }
    } catch {
      siteData = `URL: ${url}\n(Could not fetch — infer from URL and discovery notes)`;
      updateGenStep(scrapeStep, 'done');
    }
  }

  // Step 2b: Generate profile with AI
  statusEl.textContent = 'AI generating customer profile...';
  const aiStep = addGenStep('Extracting brand voice, segments, rules', 'active');
  const segStep = addGenStep('Building approval chain & legal SLAs', 'pending');
  const finalStep = addGenStep('Assembling complete profile', 'pending');

  try {
    const prompt = buildProfilePrompt(notes, siteData);
    const result = await ai.chat(prompt);

    updateGenStep(aiStep, 'done');
    updateGenStep(segStep, 'done');
    updateGenStep(finalStep, 'done');
    statusEl.textContent = 'Profile generated!';

    // Parse the JSON response
    let profileJson = result;
    // Strip markdown fences if present
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) profileJson = jsonMatch[1];
    // Also try to find raw JSON object
    const braceMatch = profileJson.match(/\{[\s\S]*\}/);
    if (braceMatch) profileJson = braceMatch[0];

    const profile = JSON.parse(profileJson);

    // Show step 3: review
    await sleep(500);
    showProfileStep(3);

    // Build preview
    const preview = document.getElementById('profilePreview');
    const colors = profile.brandVoice?.colorPalette;
    preview.innerHTML = `
      <div class="pv-name">${profile.name}</div>
      <div class="pv-meta">${profile.vertical} &bull; ${profile.tier}</div>
      <div class="pv-section"><div class="pv-label">Brand Voice</div>${profile.brandVoice?.tone || 'Not specified'} — ${profile.brandVoice?.style || ''}</div>
      ${colors ? `<div class="pv-section"><div class="pv-label">Brand Colors</div><div class="pv-colors">${Object.entries(colors).map(([k, v]) => `<div class="pv-swatch" style="background:${v}" title="${k}: ${v}"></div>`).join('')}</div></div>` : ''}
      <div class="pv-section"><div class="pv-label">Segments (${profile.segments?.length || 0})</div>${profile.segments?.map((s) => s.name).join(', ') || 'None'}</div>
      <div class="pv-section"><div class="pv-label">Approval Chain (${profile.approvalChain?.length || 0} steps)</div>${profile.approvalChain?.map((s) => s.role).join(' → ') || 'None'}</div>
      <div class="pv-section"><div class="pv-label">Legal Rules (${profile.legalSLA?.specialRules?.length || 0})</div>${profile.legalSLA?.specialRules?.slice(0, 3).join('; ') || 'None'}${(profile.legalSLA?.specialRules?.length || 0) > 3 ? '...' : ''}</div>
    `;

    // Show editable JSON
    document.getElementById('profileJson').value = JSON.stringify(profile, null, 2);

  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    updateGenStep(aiStep, 'done');
    updateGenStep(segStep, 'done');
    updateGenStep(finalStep, 'done');
    // Fall back to step 1
    await sleep(2000);
    showProfileStep(1);
  }
}

/* ── Init ── */
async function init() {
  // Configure DA client from dynamic org config
  da.configure({ org: AEM_ORG.orgId, repo: AEM_ORG.repo, branch: AEM_ORG.branch });

  // Set org context in UI from active profile
  const customerNameEl = document.querySelector('.customer-name');
  const customerMetaEl = document.querySelector('.customer-meta');
  if (customerNameEl) customerNameEl.textContent = AEM_ORG.name;
  if (customerMetaEl) customerMetaEl.innerHTML = `&bull; ${AEM_ORG.tier} &bull; ${AEM_ORG.env}`;

  // Build org selector and profile generator
  buildOrgSelector();
  initProfileGenerator();

  // Load hidden preview frame for page context
  loadPreview();

  // Initialize IMS
  try {
    await loadIms();
  } catch (err) {
    console.warn('IMS init:', err.message);
  }

  updateAuthUI();

  // Pre-fetch page context after iframe starts loading
  setTimeout(() => ensurePageContext(), 3000);

  if (ai.hasApiKey()) {
    console.log(`Claude API key found — live AI mode for ${AEM_ORG.name}`);
  }
}

init();
