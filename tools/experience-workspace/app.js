/*
 * Experience Workspace — v3 (Phase 2: Real Services)
 * IMS auth + Claude AI + DA content API + real governance scanning
 * Falls back to demo mode when services unavailable
 */

import { loadIms, isSignedIn, signIn, signOut, getProfile, getToken } from './ims.js';
import * as ai from './ai.js';
import * as da from './da-client.js';
import * as gov from './governance.js';

const PREVIEW_URL = 'https://main--xscteamsite--aemxsc.aem.page/';

/* ── DOM refs ── */
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const previewFrame = document.getElementById('previewFrame');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const signalOverlay = document.getElementById('signalOverlay');
const governanceBar = document.getElementById('governanceBar');
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
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
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
      statusText.textContent = 'Demo Mode';
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
function getPageContext() {
  const ctx = { customerName: 'Princess Cruises', pageUrl: PREVIEW_URL };
  try {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow?.document;
    if (iframeDoc?.body) {
      ctx.pageHTML = iframeDoc.documentElement.outerHTML;
    }
  } catch { /* cross-origin */ }
  return ctx;
}

/* ── REAL: AI Chat ── */
async function handleRealChat(text) {
  conversationHistory.push({ role: 'user', content: text });

  const ctx = getPageContext();
  const streamEl = addStreamMessage('Experience Agent');

  try {
    await ai.streamChat(conversationHistory, ctx, (chunk, full) => {
      streamEl.innerHTML = md(full);
      scrollChat();
    });

    const finalText = streamEl.textContent;
    conversationHistory.push({ role: 'assistant', content: finalText });
  } catch (err) {
    streamEl.innerHTML = `<span style="color:var(--accent)">AI Error: ${err.message}</span><br>Check your API key in settings.`;
  }
}

/* ── REAL: Governance Scan ── */
async function runRealGovernance() {
  addMessage('user', 'Run governance scan on the current page');

  // Step 1: Client-side DOM scan
  addTyping();
  await sleep(500);
  removeTyping();

  let scanResult = null;
  try {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow?.document;
    if (iframeDoc) {
      const scanMsg = addRawHTML(`
        <div class="agent-badge">Governance Scanner</div>
        <div class="message-content">
          <strong>Scanning page DOM...</strong>
          <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
        </div>
      `);

      const fill = scanMsg.querySelector('.progress-fill');
      for (let i = 1; i <= 5; i++) {
        await sleep(300);
        fill.style.width = `${i * 20}%`;
      }

      scanResult = gov.scanPage(iframeDoc);
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
      updateGovernanceBar(scanResult.score, checks);
    } else {
      addMessage('assistant', '⚠ Cannot access iframe content (cross-origin). Loading page for analysis...', 'Governance Scanner');
    }
  } catch (err) {
    addMessage('assistant', `⚠ DOM scan error: ${err.message}`, 'Governance Scanner');
  }

  // Step 2: AI-powered deep analysis (if Claude key available)
  if (ai.hasApiKey()) {
    addTyping();
    await sleep(800);
    removeTyping();

    try {
      const ctx = getPageContext();
      if (ctx.pageHTML) {
        const analysis = await ai.analyzeGovernance(ctx.pageHTML, ctx.pageUrl);
        addMessage('assistant', md(analysis), 'AI Governance Agent');
      } else {
        addMessage('assistant', 'AI analysis requires page HTML access. Try loading the page in a same-origin iframe.', 'AI Governance Agent');
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

/* ── DEMO: Simulated Flows (fallback) ── */

async function runDemoBrief() {
  addMessage('user', 'Upload campaign brief and create landing page');
  addRawHTML(`<div class="upload-indicator"><span class="file-icon">📄</span><div><div style="font-weight:500">Q3-Mediterranean-Campaign-Brief.pdf</div><div style="font-size:10px;color:var(--text-muted)">2.4 MB — uploaded</div></div></div>`);

  addTyping(); await sleep(1400); removeTyping();
  addMessage('assistant', md('**Extracting campaign brief...**\n\nCampaign: Mediterranean Summer 2025\nTarget audience: Luxury travelers, 35-65\nKey message: "Sail into the extraordinary"\nRequired sections: Hero, Itinerary highlights, Pricing, CTA\nBrand assets referenced: 6 images, 2 icons'), 'Acrobat MCP');

  addTyping(); await sleep(1600); removeTyping();
  addMessage('assistant', md('**Pre-flight governance check**\n\n✓ Brand colors match Princess Cruises palette\n✓ Voice tone: sophisticated yet approachable\n✓ Legal disclaimers: pricing, cancellation policy present\n✓ Accessibility: heading hierarchy valid\n⚠ Note: "Limited time" urgency claim needs legal review date'), 'Governance Agent');

  addTyping(); await sleep(800); removeTyping();
  const progressMsg = addRawHTML(`<div class="agent-badge">Experience Production</div><div class="message-content"><strong>Building page structure...</strong><div style="margin-top:8px"><div class="agent-step"><span class="step-icon done">✓</span> Hero section with campaign headline</div><div class="agent-step"><span class="step-icon done">✓</span> Itinerary highlights cards (3 destinations)</div><div class="agent-step"><span class="step-icon active">⋯</span> Pricing table with cabin categories</div><div class="agent-step"><span class="step-icon pending">•</span> CTA with booking flow link</div><div class="agent-step"><span class="step-icon pending">•</span> Footer with legal disclaimers</div></div><div class="progress-bar"><div class="progress-fill" style="width:45%"></div></div></div>`);

  await sleep(1200);
  progressMsg.querySelector('.agent-step:nth-child(3) .step-icon').className = 'step-icon done';
  progressMsg.querySelector('.agent-step:nth-child(3) .step-icon').textContent = '✓';
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').className = 'step-icon active';
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').textContent = '⋯';
  progressMsg.querySelector('.progress-fill').style.width = '70%';

  await sleep(1000);
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').className = 'step-icon done';
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').textContent = '✓';
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').className = 'step-icon active';
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').textContent = '⋯';
  progressMsg.querySelector('.progress-fill').style.width = '90%';

  await sleep(800);
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').className = 'step-icon done';
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').textContent = '✓';
  progressMsg.querySelector('.progress-fill').style.width = '100%';

  await sleep(600);
  addMessage('assistant', md('**Found 4 approved assets in DAM:**\n\n✓ `med-hero-couple-sunset.jpg` — Rights cleared Dec 2026\n✓ `cruise-ship-aerial.jpg` — Brand approved\n✓ `couple-dining-deck.jpg` — Model release on file\n✓ `mediterranean-route-map.svg` — Brand asset library'), 'Discovery Agent');

  addTyping(); await sleep(1200); removeTyping();
  addMessage('assistant', md('**Renditions generated:**\nDesktop: 2048x1024 (WebP + AVIF)\nTablet: 1024x768\nMobile: 640x960\nDynamic Media: Smart Crop enabled'), 'Content Optimization');

  await sleep(800);
  loadPreview();
  addRawHTML(`<div class="agent-badge">Experience Production</div><div class="message-content"><strong>✓ Page created: Mediterranean Summer Campaign</strong><br><br><table class="gov-results"><tr><th>Check</th><th>Status</th></tr><tr><td>Governance</td><td class="count-pass">96% compliant</td></tr><tr><td>Assets</td><td class="count-pass">4 approved, 0 flagged</td></tr><tr><td>Workfront</td><td>Task PCL-2847 created</td></tr><tr><td>Launch</td><td>Ready for editorial review</td></tr></table><div class="money-line">That was 14 people and 3 weeks of work. You just watched it happen in one conversation.</div></div>`);
  updateGovernanceBar(96, { brand: true, legal: true, a11y: true, seo: 'warn' });
}

async function runDemoGovernance() {
  addMessage('user', 'Run a full governance check on all published pages');
  addTyping(); await sleep(1000); removeTyping();

  const scanMsg = addRawHTML(`<div class="agent-badge">Governance Agent</div><div class="message-content"><strong>Scanning published pages...</strong><div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div><div class="scan-count" style="font-size:11px;color:var(--text-muted);margin-top:4px">0 of 47 pages scanned</div></div>`);
  const fill = scanMsg.querySelector('.progress-fill');
  const count = scanMsg.querySelector('.scan-count');

  for (let i = 1; i <= 5; i++) {
    await sleep(500);
    fill.style.width = `${Math.min(i * 22, 100)}%`;
    count.textContent = `${Math.min(i * 10, 47)} of 47 pages scanned`;
  }
  await sleep(400);
  fill.style.width = '100%';
  count.textContent = '47 of 47 pages scanned';

  await sleep(800);
  addRawHTML(`<div class="agent-badge">Governance Agent</div><div class="message-content"><strong>Governance Report — Princess Cruises</strong><table class="gov-results" style="margin-top:10px"><tr><th>Category</th><th>Pass</th><th>Fail</th><th>Warn</th></tr><tr><td>Brand compliance</td><td class="count-pass">44</td><td class="count-fail">0</td><td class="count-warn">3</td></tr><tr><td>Legal review</td><td class="count-pass">42</td><td class="count-fail">2</td><td class="count-warn">3</td></tr><tr><td>Accessibility</td><td class="count-pass">41</td><td class="count-fail">1</td><td class="count-warn">5</td></tr><tr><td>SEO standards</td><td class="count-pass">38</td><td class="count-fail">3</td><td class="count-warn">6</td></tr><tr><td>Image rights</td><td class="count-pass">47</td><td class="count-fail">0</td><td class="count-warn">0</td></tr></table><div style="margin-top:10px"><strong style="color:var(--accent)">Critical issues requiring action:</strong><div class="issue-list"><div class="issue-item critical">❌ <code>/offers/black-friday</code> — Expired offer still live, legal flagged</div><div class="issue-item critical">❌ <code>/booking/family-suite</code> — Price disclaimer missing</div><div class="issue-item critical">❌ <code>/destinations/alaska</code> — Alt text missing on 3 hero images</div></div></div></div>`);

  addTyping(); await sleep(1800); removeTyping();
  addRawHTML(`<div class="agent-badge">Governance Agent</div><div class="message-content"><strong>Auto-fix available for 4 of 6 issues:</strong><div class="issue-list" style="margin-top:6px"><div class="issue-item fixable">✓ Add alt text to Alaska hero images — <strong>can fix now</strong></div><div class="issue-item fixable">✓ Add price disclaimer to family suite — <strong>template available</strong></div><div class="issue-item needs-review">⚠ Unpublish expired Black Friday offer — <strong>needs approval</strong></div><div class="issue-item fixable">✓ Generate missing SEO meta descriptions — <strong>can generate</strong></div></div><div style="margin-top:10px"><button class="chat-action-btn" onclick="applyGovernanceFixes()">Apply 3 Auto-Fixes</button><button class="chat-action-btn secondary" onclick="routeForReview()">Route 1 for Review</button></div></div>`);
  updateGovernanceBar(87, { brand: 'warn', legal: 'fail', a11y: 'fail', seo: 'fail' });
}

/* ── Governance fix actions (demo) ── */
window.applyGovernanceFixes = async function applyGovernanceFixes() {
  addMessage('user', 'Apply the 3 auto-fixes');
  addTyping(); await sleep(800); removeTyping();

  const fixMsg = addRawHTML(`<div class="agent-badge">Governance Agent</div><div class="message-content"><strong>Applying fixes...</strong><div style="margin-top:6px"><div class="agent-step"><span class="step-icon active">⋯</span> Adding alt text to Alaska images...</div><div class="agent-step"><span class="step-icon pending">•</span> Adding price disclaimer...</div><div class="agent-step"><span class="step-icon pending">•</span> Generating SEO meta descriptions...</div></div></div>`);

  await sleep(1200);
  fixMsg.querySelector('.agent-step:nth-child(1) .step-icon').className = 'step-icon done';
  fixMsg.querySelector('.agent-step:nth-child(1) .step-icon').textContent = '✓';
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').className = 'step-icon active';
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').textContent = '⋯';

  await sleep(1000);
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').className = 'step-icon done';
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').textContent = '✓';
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').className = 'step-icon active';
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').textContent = '⋯';

  await sleep(1400);
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').className = 'step-icon done';
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').textContent = '✓';

  await sleep(400);
  addRawHTML(`<div class="agent-badge">Governance Agent</div><div class="message-content"><strong>✓ 3 fixes applied and published</strong><br><br>✓ Alaska page: 3 alt texts added, WCAG 2.1 AA compliant<br>✓ Family suite: Price disclaimer from legal template applied<br>✓ 6 pages: SEO meta descriptions generated from content<br><br>⚠ Black Friday offer routed to <code>@legal-review</code> in Workfront (task PCL-2851)<div class="money-line">Compliance score: 87% → 94%. Three issues that would have taken a content team a full day were fixed in 12 seconds.</div></div>`);
  updateGovernanceBar(94, { brand: true, legal: true, a11y: true, seo: 'warn' });
};

window.routeForReview = async function routeForReview() {
  addMessage('user', 'Route the Black Friday issue for legal review');
  addTyping(); await sleep(1000); removeTyping();
  addMessage('assistant', md('✓ Workfront task **PCL-2851** created:\n\nAssignee: @legal-review\nPriority: High\nPage: `/offers/black-friday`\nAction required: Approve unpublish of expired Q4 offer\nSLA: 48h per Princess Cruises legal review policy'), 'Governance Agent');
};

/* ── Flow 2/3: Performance & Personalize (demo only for now) ── */
async function runPerformanceFlow() {
  addMessage('user', 'How is the Mediterranean landing page performing?');
  addTyping(); await sleep(1200); removeTyping();
  addMessage('assistant', md('**Mediterranean Landing Page — 7-day Performance**\n\nSessions: 34,218 (↑ 12%)\nBounce Rate: 47.3% (⚠ ↑ 23% mobile)\nConversion: 3.2% (↓ 0.4pp)\nAvg. Time: 2:14 (stable)\n\n⚠ **Issue**: Mobile bounce rate spiked 23% after last Tuesday\'s hero image change. New image loads 3.2s on mobile (target: <1.5s).'), 'Data Insights Agent');
  signalOverlay.style.display = 'block';
  addTyping(); await sleep(1800); removeTyping();
  addMessage('assistant', md('💡 **Suggested fix**: Swap hero to `med-hero-sunset-mobile.webp` (280KB vs 1.8MB). Predicted: -2.1s load, -15% bounce.\n\nWant me to apply?'), 'Content Optimization');
}

async function runPersonalizeFlow() {
  addMessage('user', 'Personalize hero for high-intent buyers who viewed 3+ itineraries');
  addTyping(); await sleep(1200); removeTyping();
  addMessage('assistant', md('**Segment: "High-Intent Browsers"**\n\nSize: 12,847 profiles\nAvg. booking: $4,280\nPipeline: **$54.9M**\nTop interest: Greek Islands'), 'Audience Agent');
  addTyping(); await sleep(2000); removeTyping();
  addMessage('assistant', md('**Variant generated:**\nHeadline: "Your Greek Islands Itinerary Is Waiting"\nCTA: "Complete Your Booking — Rate Ends Friday"\n\n✓ Governance cleared\n✓ Published to segment\nEst. revenue impact: **$770K – $1.03M**'), 'Content Optimization');
}

/* ── Governance Bar ── */
function updateGovernanceBar(score, checks) {
  const items = governanceBar.querySelectorAll('.gov-item');
  const labels = ['brand', 'legal', 'a11y', 'seo'];
  items.forEach((item, i) => {
    const val = checks[labels[i]];
    item.className = 'gov-item';
    const icon = item.querySelector('.gov-icon');
    if (val === true) { item.classList.add('gov-pass'); icon.textContent = '✓'; }
    else if (val === 'warn') { item.classList.add('gov-warn'); icon.textContent = '⚠'; }
    else if (val === 'fail' || val === false) { item.classList.add('gov-fail'); icon.textContent = '❌'; }
  });
  const scoreEl = governanceBar.querySelector('.gov-score');
  scoreEl.textContent = `Compliance: ${score}%`;
  scoreEl.style.color = score >= 90 ? 'var(--green)' : score >= 80 ? 'var(--yellow)' : 'var(--accent)';
}

/* ── Preview ── */
function loadPreview() {
  previewFrame.src = PREVIEW_URL;
  previewPlaceholder.classList.add('hidden');
}

/* ── Flow Router ── */
function runBrief() {
  if (ai.hasApiKey()) runRealBrief(); else runDemoBrief();
}

function runGovernance() {
  if (ai.hasApiKey() || isSignedIn()) runRealGovernance(); else runDemoGovernance();
}

const FLOWS = {
  brief: runBrief,
  governance: runGovernance,
  performance: runPerformanceFlow,
  personalize: runPersonalizeFlow,
};

/* ── User Input ── */
function handleUserInput() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  addMessage('user', text);

  if (ai.hasApiKey()) {
    handleRealChat(text);
    return;
  }

  // Fallback: keyword routing to demo flows
  const lower = text.toLowerCase();
  if (lower.includes('brief') || lower.includes('upload') || lower.includes('create page')) {
    setTimeout(() => runBrief(), 400);
  } else if (lower.includes('governance') || lower.includes('compliance') || lower.includes('scan')) {
    setTimeout(() => runGovernance(), 400);
  } else if (lower.includes('perform') || lower.includes('analytics') || lower.includes('bounce')) {
    setTimeout(() => runPerformanceFlow(), 400);
  } else if (lower.includes('personal') || lower.includes('segment') || lower.includes('variant')) {
    setTimeout(() => runPersonalizeFlow(), 400);
  } else {
    setTimeout(async () => {
      addTyping(); await sleep(1000); removeTyping();
      addMessage('assistant', md('Configure your Claude API key in ⚙ settings to enable real AI chat.\n\nOr try the demo flows:\n• **Upload Brief** — campaign → compliant page\n• **Governance** — scan all pages\n• **Performance** — analytics insights\n• **Personalize** — audience targeting'));
    }, 300);
  }
}

/* ── Event Listeners ── */
document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.mode === 'preview' && previewFrame.src === 'about:blank') loadPreview();
  });
});

document.querySelectorAll('.prompt-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fn = FLOWS[btn.dataset.flow];
    if (fn) fn();
  });
});

sendBtn.addEventListener('click', handleUserInput);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserInput(); }
});

signalOverlay.addEventListener('click', (e) => {
  if (e.target.classList.contains('signal-fix-btn')) {
    addMessage('user', 'Apply the suggested hero image fix');
    signalOverlay.style.display = 'none';
    setTimeout(async () => {
      addTyping(); await sleep(1200); removeTyping();
      addMessage('assistant', md('✓ Hero swapped to `med-hero-sunset-mobile.webp` (280KB). Governance cleared. Republished.\n\nExpected: -2.1s load, ~15% bounce reduction.'), 'Content Optimization');
    }, 300);
  }
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

/* ── Init ── */
async function init() {
  loadPreview();

  // Initialize IMS
  try {
    await loadIms();
  } catch (err) {
    console.warn('IMS init:', err.message);
  }

  updateAuthUI();

  // Check for existing Claude key
  if (ai.hasApiKey()) {
    console.log('Claude API key found in localStorage');
  }
}

init();
