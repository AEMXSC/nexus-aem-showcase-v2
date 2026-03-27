/*
 * Experience Workspace — v3 (Phase 2: Real Services)
 * IMS auth + Claude AI + DA content API + real governance scanning
 * Falls back to demo mode when services unavailable
 */

import { loadIms, isSignedIn, signIn, signOut, getProfile, getToken } from './ims.js';
import * as ai from './ai.js';
import * as da from './da-client.js';
import * as gov from './governance.js';
// workfront.js no longer used — all WOA flows use real AI via handleRealChat

/* ── AEM Org Configuration ── */
const AEM_ORG = {
  name: 'AEM XSC Showcase',
  orgId: 'AEMXSC',
  repo: 'nexus-aem-showcase-v2',
  branch: 'main',
  get previewOrigin() { return `https://${this.branch}--${this.repo}--${this.orgId.toLowerCase()}.aem.page`; },
  get liveOrigin() { return `https://${this.branch}--${this.repo}--${this.orgId.toLowerCase()}.aem.live`; },
  get daOrg() { return this.orgId; },
  get daRepo() { return this.repo; },
  tier: 'AEM CS + EDS',
  env: 'Prod (VA7)',
  services: ['EDS', 'Assets Content Hub', 'Sites', 'Forms'],

  // Full Adobe entitlement stack — confirmed via MCP
  entitlements: {
    analytics:  { name: 'Adobe Analytics', mcp: 'AA MCP', status: 'active', note: 'Needs report suite ID' },
    cja:        { name: 'Customer Journey Analytics', mcp: 'CJA MCP', status: 'active', note: 'Needs data view ID' },
    aep:        { name: 'Adobe Experience Platform', mcp: 'AEP MCP', status: 'active', note: 'Needs sandbox config' },
    ajo:        { name: 'Adobe Journey Optimizer', mcp: 'Marketing Agent MCP', status: 'active', note: 'Authenticated and live' },
    target:     { name: 'Adobe Target', mcp: 'Target MCP', status: 'active', note: 'Needs sandbox config' },
    aemContent: { name: 'AEM Content', mcp: 'AEM Content MCP', status: 'live', note: 'Working today' },
    aemLaunches: { name: 'AEM Launches', mcp: 'AEM Content MCP', status: 'live', note: 'Working today' },
    workfront:  { name: 'Workfront', mcp: 'Workfront WOA', status: 'active', note: 'P1 skills integrated' },
  },

  // MCP capability matrix
  mcpCapabilities: [
    { capability: 'AEM content read/write', mcp: 'AEM Content MCP', ready: true },
    { capability: 'AEM Launches', mcp: 'AEM Content MCP', ready: true },
    { capability: 'Analytics queries', mcp: 'AA MCP', ready: false, needs: 'Report suite ID' },
    { capability: 'CJA queries', mcp: 'CJA MCP', ready: false, needs: 'Data view ID' },
    { capability: 'AJO journey reporting', mcp: 'Marketing Agent MCP', ready: true },
    { capability: 'Audience creation/sharing', mcp: 'AEP + Target', ready: false, needs: 'Sandbox config' },
    { capability: 'Segment creation', mcp: 'AA + CJA + AEP', ready: false, needs: 'Data view set' },
    { capability: 'AI-driven data insights', mcp: 'CJA Data Insights Agent', ready: false, needs: 'Data view' },
    { capability: 'Intelligent captions', mcp: 'CJA', ready: false, needs: 'Data view' },
  ],
};

const PREVIEW_URL = AEM_ORG.previewOrigin + '/';

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

/* ── REAL: AI Chat ── */
async function handleRealChat(text) {
  conversationHistory.push({ role: 'user', content: text });

  await ensurePageContext();
  const ctx = getPageContext();
  const streamEl = addStreamMessage('Experience Agent');

  try {
    const rawResponse = await ai.streamChat(conversationHistory, ctx, (chunk, full) => {
      streamEl.innerHTML = md(full);
      scrollChat();
    });

    conversationHistory.push({ role: 'assistant', content: rawResponse });
  } catch (err) {
    streamEl.innerHTML = `<span style="color:var(--accent)">AI Error: ${err.message}</span><br>Check your API key in settings.`;
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

/* ── REAL: Upload Brief ── */
async function runRealBrief() {
  // Check for file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,.txt,.doc,.docx';

  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

    // Extract text from file
    addTyping();
    let briefText = '';
    try {
      if (file.type === 'application/pdf') {
        briefText = await extractPdfText(file);
      } else {
        briefText = await file.text();
      }
      removeTyping();

      if (!briefText.trim()) {
        addMessage('assistant', '⚠ Could not extract text from file. Please try a .txt or .pdf file.', 'Acrobat MCP');
        return;
      }

      addMessage('assistant', md(
        `**Extracted ${briefText.split(/\s+/).length} words from brief**\n\n`
        + `Preview: "${briefText.slice(0, 200)}..."`,
      ), 'Acrobat MCP');

    } catch (err) {
      removeTyping();
      addMessage('assistant', `⚠ File extraction error: ${err.message}`, 'Acrobat MCP');
      return;
    }

    // Analyze with AI
    if (ai.hasApiKey()) {
      addTyping();
      try {
        const analysis = await ai.analyzeBrief(briefText);
        removeTyping();
        addMessage('assistant', md(analysis), 'Brief Analysis Agent');

        // Generate page content
        addTyping();
        const pageContent = await ai.generatePageContent(analysis, 'Princess Cruises');
        removeTyping();
        addMessage('assistant', md(pageContent), 'Experience Production');

        // Create in DA if authenticated
        if (isSignedIn()) {
          addTyping();
          try {
            const pageName = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '-');
            await da.createPage(`/${pageName}.html`, pageContent);
            await da.previewPage(`/${pageName}`);
            removeTyping();

            const previewUrl = da.getPreviewUrl(`/${pageName}`);
            addRawHTML(`
              <div class="agent-badge">Experience Production</div>
              <div class="message-content">
                <strong>✓ Page created in DA</strong><br><br>
                Path: <code>/${pageName}</code><br>
                Preview: <a href="${previewUrl}" target="_blank">${previewUrl}</a>
                <div class="money-line">
                  Brief → analyzed → page generated → published. All in one conversation.
                </div>
              </div>
            `);

            previewFrame.src = previewUrl;
          } catch (err) {
            removeTyping();
            addMessage('assistant', `⚠ DA create error: ${err.message}. Page content generated but not saved.`, 'Experience Production');
          }
        } else {
          addMessage('assistant', md('**Sign in with Adobe** to auto-create this page in DA and publish it.'), 'Experience Production');
        }
      } catch (err) {
        removeTyping();
        addMessage('assistant', `AI analysis error: ${err.message}`, 'Brief Analysis Agent');
      }
    } else {
      addMessage('assistant', 'Configure your Claude API key in settings to enable AI-powered brief analysis.', 'Brief Analysis Agent');
    }
  };

  fileInput.click();
}

async function extractPdfText(file) {
  // Simple PDF text extraction using browser FileReader
  // For full PDF support, we'd use PDF.js
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  // Extract readable text between PDF stream markers
  const readable = text
    .replace(/[\x00-\x1f\x80-\xff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Try to find text content in PDF
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

/* ── (Demo governance fix/route removed — real AI handles all interactions) ── */

/* ── MCP Services Status ── */
async function runServicesPanel() {
  addMessage('user', 'Show connected MCP services and entitlements');

  const caps = AEM_ORG.mcpCapabilities;
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

  const ents = AEM_ORG.entitlements;
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
};

/* ── User Input ── */
function matchSpecializedFlow(text) {
  const lower = text.toLowerCase();
  if (lower.includes('brief') || lower.includes('upload') || lower.includes('create page')) return runBrief;
  if (lower.includes('governance') || lower.includes('compliance') || lower.includes('scan all')
      || lower.includes('scan page') || lower.includes('run scan')) return runGovernance;
  if (lower.includes('perform') || lower.includes('analytics') || lower.includes('bounce')) return runPerformanceFlow;
  if (lower.includes('personal') || lower.includes('segment') || lower.includes('variant')) return runPersonalizeFlow;
  if (lower.includes('workfront') || lower.includes('project health') || lower.includes('project status')) return runWorkfrontPanel;
  if (lower.includes('mcp') || lower.includes('services') || lower.includes('entitlement') || lower.includes('connected services')) return runServicesPanel;
  if (lower.includes('block') || lower.includes('library') || lower.includes('catalog') || lower.includes('component')) return runBlockLibrary;
  if (lower.includes('review asset') || lower.includes('brand review') || lower.includes('brand check')) return runAIReviewer;
  if (lower.includes('overdue') || lower.includes('pending approval') || lower.includes('capacity') || lower.includes('workload')) {
    return () => runWorkfrontQuery(text);
  }
  return null;
}

function handleUserInput() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  // Always check for specialized flows first — even in AI mode
  const specializedFlow = matchSpecializedFlow(text);
  if (specializedFlow) {
    addMessage('user', text);
    setTimeout(() => specializedFlow(), 400);
    return;
  }

  // AI chat (with conversation history)
  if (ai.hasApiKey()) {
    addMessage('user', text);
    handleRealChat(text);
    return;
  }

  // No API key — prompt to configure
  addMessage('user', text);
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

/* ── Init ── */
async function init() {
  // Configure DA client from org config
  da.configure({ org: AEM_ORG.orgId, repo: AEM_ORG.repo, branch: AEM_ORG.branch });

  // Set org context in UI
  const customerNameEl = document.querySelector('.customer-name');
  const customerMetaEl = document.querySelector('.customer-meta');
  if (customerNameEl) customerNameEl.textContent = AEM_ORG.name;
  if (customerMetaEl) customerMetaEl.innerHTML = `&bull; ${AEM_ORG.tier} &bull; ${AEM_ORG.env}`;

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
