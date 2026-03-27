/*
 * Experience Workspace — EDS Block v2
 * Full-page takeover: builds the workspace UI dynamically
 */

const PREVIEW_URL = '/';
const SVG = {
  logo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  attach: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
  send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  code: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  split: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  publish: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>',
  placeholder: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
};

/* ── Utility ── */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function md(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

export default function decorate(block) {
  // Read customer info from authored content
  const rows = [...block.children];
  const customerName = rows[0]?.children[0]?.textContent?.trim() || 'Customer';
  const customerMeta = rows[0]?.children[1]?.textContent?.trim() || '';

  // Mark body for CSS takeover
  document.body.classList.add('experience-workspace-page');

  // Build entire UI
  block.innerHTML = `
    <aside class="ew-assistant">
      <div class="ew-header">
        <div class="ew-logo">${SVG.logo}<span>Experience Workspace</span></div>
        <div class="ew-status"><span class="ew-status-dot"></span><span>Connected</span></div>
      </div>
      <div class="ew-customer">
        <div class="ew-customer-name">${customerName}</div>
        <div class="ew-customer-meta">${customerMeta}</div>
      </div>
      <div class="ew-prompts">
        <button class="ew-prompt-btn primary" data-flow="brief">
          <span class="ew-prompt-icon">&#128196;</span>
          <span class="ew-prompt-label"><span class="ew-prompt-title">Upload Campaign Brief</span><span class="ew-prompt-desc">Brief to compliant page in one conversation</span></span>
        </button>
        <button class="ew-prompt-btn primary" data-flow="governance">
          <span class="ew-prompt-icon">&#128737;</span>
          <span class="ew-prompt-label"><span class="ew-prompt-title">Governance Check</span><span class="ew-prompt-desc">Scan all pages for brand, legal, a11y compliance</span></span>
        </button>
        <button class="ew-prompt-btn secondary" data-flow="performance">
          <span class="ew-prompt-icon">&#128200;</span><span>Check Performance</span>
        </button>
        <button class="ew-prompt-btn secondary" data-flow="personalize">
          <span class="ew-prompt-icon">&#128101;</span><span>Personalize for Segment</span>
        </button>
      </div>
      <div class="ew-messages" id="ewMessages">
        <div class="ew-msg assistant"><div class="ew-msg-content">Welcome! I'm connected to your AEM environment with CJA, Analytics, and Content MCPs active. What would you like to work on?</div></div>
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
          <span class="ew-breadcrumb-item">princess-cruises</span><span class="ew-breadcrumb-sep">&gt;</span>
          <span class="ew-breadcrumb-file">mediterranean-landing.html</span>
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
      <div class="ew-gov-bar" id="ewGovBar">
        <div class="ew-gov-check pass"><span class="ew-gov-check-icon">&#10003;</span> Brand</div>
        <div class="ew-gov-check pass"><span class="ew-gov-check-icon">&#10003;</span> Legal</div>
        <div class="ew-gov-check pass"><span class="ew-gov-check-icon">&#10003;</span> A11y</div>
        <div class="ew-gov-check warn"><span class="ew-gov-check-icon">&#9888;</span> SEO</div>
        <div class="ew-gov-score">Compliance: 94%</div>
      </div>
      <div class="ew-preview">
        <iframe id="ewFrame" src="about:blank" title="Preview"></iframe>
        <div class="ew-preview-placeholder" id="ewPlaceholder">
          <div>${SVG.placeholder}<p>Load a page to preview</p><p class="hint">Or use a suggested prompt to get started</p></div>
        </div>
      </div>
      <div class="ew-signal" id="ewSignal">
        <div class="ew-signal-card">
          <div class="ew-signal-badge">&#9888; Hero Section</div>
          <div class="ew-signal-detail">Bounce rate +23% on mobile (7 days)</div>
          <div><button class="ew-signal-fix">Apply Suggested Fix</button></div>
        </div>
      </div>
    </div>
  `;

  // Cache DOM refs
  const messages = block.querySelector('#ewMessages');
  const input = block.querySelector('#ewInput');
  const sendBtn = block.querySelector('#ewSend');
  const frame = block.querySelector('#ewFrame');
  const placeholder = block.querySelector('#ewPlaceholder');
  const signal = block.querySelector('#ewSignal');
  const govBar = block.querySelector('#ewGovBar');

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

  function addRaw(html) {
    const el = document.createElement('div');
    el.classList.add('ew-msg', 'assistant');
    el.innerHTML = html;
    messages.appendChild(el);
    scrollChat();
    return el;
  }

  function addTyping() {
    const el = document.createElement('div');
    el.classList.add('ew-msg', 'assistant');
    el.id = 'ewTyping';
    el.innerHTML = '<div class="ew-typing"><span></span><span></span><span></span></div>';
    messages.appendChild(el);
    scrollChat();
  }

  function removeTyping() { document.getElementById('ewTyping')?.remove(); }

  function loadPreview() {
    frame.src = PREVIEW_URL;
    placeholder.classList.add('hidden');
  }

  function updateGov(score, checks) {
    const items = govBar.querySelectorAll('.ew-gov-check');
    const labels = ['brand', 'legal', 'a11y', 'seo'];
    items.forEach((item, i) => {
      const v = checks[labels[i]];
      item.className = 'ew-gov-check';
      const icon = item.querySelector('.ew-gov-check-icon');
      if (v === true) { item.classList.add('pass'); icon.innerHTML = '&#10003;'; }
      else if (v === 'warn') { item.classList.add('warn'); icon.innerHTML = '&#9888;'; }
      else { item.classList.add('fail'); icon.innerHTML = '&#10060;'; }
    });
    const s = govBar.querySelector('.ew-gov-score');
    s.textContent = `Compliance: ${score}%`;
    s.style.color = score >= 90 ? 'var(--ew-green)' : score >= 80 ? 'var(--ew-yellow)' : 'var(--ew-accent)';
  }

  /* ── Flow 1: Upload Brief ── */
  async function runBrief() {
    addMsg('user', 'Upload campaign brief and create landing page');
    addRaw(`<div class="ew-upload"><span class="ew-file-icon">&#128196;</span><div><div style="font-weight:500">Q3-Mediterranean-Campaign-Brief.pdf</div><div style="font-size:10px;color:var(--ew-text-muted)">2.4 MB — uploaded</div></div></div>`);

    addTyping(); await sleep(1400); removeTyping();
    addMsg('assistant', md('**Extracting campaign brief...**\n\nCampaign: Mediterranean Summer 2025\nTarget audience: Luxury travelers, 35-65\nKey message: "Sail into the extraordinary"\nRequired sections: Hero, Itinerary highlights, Pricing, CTA\nBrand assets referenced: 6 images, 2 icons'), 'Acrobat MCP');

    addTyping(); await sleep(1600); removeTyping();
    addMsg('assistant', md('**Pre-flight governance check**\n\n&#10003; Brand colors match Princess Cruises palette\n&#10003; Voice tone: sophisticated yet approachable\n&#10003; Legal disclaimers: pricing, cancellation policy present\n&#10003; Accessibility: heading hierarchy valid\n&#9888; Note: "Limited time" urgency claim needs legal review date'), 'Governance Agent');

    addTyping(); await sleep(800); removeTyping();
    const pm = addRaw(`<div class="ew-agent-badge">Experience Production</div><div class="ew-msg-content"><strong>Building page structure...</strong><div style="margin-top:8px"><div class="ew-step"><span class="ew-step-icon done">&#10003;</span> Hero section with campaign headline</div><div class="ew-step"><span class="ew-step-icon done">&#10003;</span> Itinerary highlights cards (3 destinations)</div><div class="ew-step"><span class="ew-step-icon active">&#8943;</span> Pricing table with cabin categories</div><div class="ew-step"><span class="ew-step-icon pending">&#8226;</span> CTA with booking flow link</div><div class="ew-step"><span class="ew-step-icon pending">&#8226;</span> Footer with legal disclaimers</div></div><div class="ew-progress-bar"><div class="ew-progress-fill" style="width:45%"></div></div></div>`);

    await sleep(1200);
    pm.querySelector('.ew-step:nth-child(3) .ew-step-icon').className = 'ew-step-icon done'; pm.querySelector('.ew-step:nth-child(3) .ew-step-icon').innerHTML = '&#10003;';
    pm.querySelector('.ew-step:nth-child(4) .ew-step-icon').className = 'ew-step-icon active'; pm.querySelector('.ew-step:nth-child(4) .ew-step-icon').innerHTML = '&#8943;';
    pm.querySelector('.ew-progress-fill').style.width = '70%';

    await sleep(1000);
    pm.querySelector('.ew-step:nth-child(4) .ew-step-icon').className = 'ew-step-icon done'; pm.querySelector('.ew-step:nth-child(4) .ew-step-icon').innerHTML = '&#10003;';
    pm.querySelector('.ew-step:nth-child(5) .ew-step-icon').className = 'ew-step-icon active'; pm.querySelector('.ew-step:nth-child(5) .ew-step-icon').innerHTML = '&#8943;';
    pm.querySelector('.ew-progress-fill').style.width = '90%';

    await sleep(800);
    pm.querySelector('.ew-step:nth-child(5) .ew-step-icon').className = 'ew-step-icon done'; pm.querySelector('.ew-step:nth-child(5) .ew-step-icon').innerHTML = '&#10003;';
    pm.querySelector('.ew-progress-fill').style.width = '100%';

    await sleep(600);
    addMsg('assistant', md('**Found 4 approved assets in DAM:**\n\n&#10003; `med-hero-couple-sunset.jpg` — Rights cleared Dec 2026\n&#10003; `cruise-ship-aerial.jpg` — Brand approved\n&#10003; `couple-dining-deck.jpg` — Model release on file\n&#10003; `mediterranean-route-map.svg` — Brand asset library'), 'Discovery Agent');

    addTyping(); await sleep(1200); removeTyping();
    addMsg('assistant', md('**Renditions generated:**\nDesktop: 2048x1024 (WebP + AVIF)\nTablet: 1024x768\nMobile: 640x960\nDynamic Media: Smart Crop enabled'), 'Content Optimization');

    await sleep(800);
    loadPreview();
    addRaw(`<div class="ew-agent-badge">Experience Production</div><div class="ew-msg-content"><strong>&#10003; Page created: Mediterranean Summer Campaign</strong><br><br><table class="ew-gov-results"><tr><th>Check</th><th>Status</th></tr><tr><td>Governance</td><td class="count-pass">96% compliant</td></tr><tr><td>Assets</td><td class="count-pass">4 approved, 0 flagged</td></tr><tr><td>Workfront</td><td>Task PCL-2847 created</td></tr><tr><td>Launch</td><td>Ready for editorial review</td></tr></table><div class="ew-money-line">That was 14 people and 3 weeks of work. You just watched it happen in one conversation.</div></div>`);
    updateGov(96, { brand: true, legal: true, a11y: true, seo: 'warn' });
  }

  /* ── Flow 4: Governance Check ── */
  async function runGov() {
    addMsg('user', 'Run a full governance check on all published pages');
    addTyping(); await sleep(1000); removeTyping();

    const sm = addRaw(`<div class="ew-agent-badge">Governance Agent</div><div class="ew-msg-content"><strong>Scanning published pages...</strong><div class="ew-progress-bar"><div class="ew-progress-fill" style="width:0%"></div></div><div class="ew-scan-count" style="font-size:11px;color:var(--ew-text-muted);margin-top:4px">0 of 47 pages scanned</div></div>`);
    const fill = sm.querySelector('.ew-progress-fill');
    const cnt = sm.querySelector('.ew-scan-count');
    for (let i = 1; i <= 5; i++) {
      await sleep(500);
      fill.style.width = `${Math.min(i * 22, 100)}%`;
      cnt.textContent = `${Math.min(i * 10, 47)} of 47 pages scanned`;
    }
    await sleep(400); fill.style.width = '100%'; cnt.textContent = '47 of 47 pages scanned';

    await sleep(800);
    addRaw(`<div class="ew-agent-badge">Governance Agent</div><div class="ew-msg-content"><strong>Governance Report — ${customerName}</strong><table class="ew-gov-results" style="margin-top:10px"><tr><th>Category</th><th>Pass</th><th>Fail</th><th>Warn</th></tr><tr><td>Brand compliance</td><td class="count-pass">44</td><td class="count-fail">0</td><td class="count-warn">3</td></tr><tr><td>Legal review</td><td class="count-pass">42</td><td class="count-fail">2</td><td class="count-warn">3</td></tr><tr><td>Accessibility</td><td class="count-pass">41</td><td class="count-fail">1</td><td class="count-warn">5</td></tr><tr><td>SEO standards</td><td class="count-pass">38</td><td class="count-fail">3</td><td class="count-warn">6</td></tr><tr><td>Image rights</td><td class="count-pass">47</td><td class="count-fail">0</td><td class="count-warn">0</td></tr></table><div style="margin-top:10px"><strong style="color:var(--ew-accent)">Critical issues requiring action:</strong><div class="ew-issue-list"><div class="ew-issue-item critical">&#10060; <code>/offers/black-friday</code> — Expired offer still live, legal flagged</div><div class="ew-issue-item critical">&#10060; <code>/booking/family-suite</code> — Price disclaimer missing</div><div class="ew-issue-item critical">&#10060; <code>/destinations/alaska</code> — Alt text missing on 3 hero images</div></div></div></div>`);

    addTyping(); await sleep(1800); removeTyping();
    const fixEl = addRaw(`<div class="ew-agent-badge">Governance Agent</div><div class="ew-msg-content"><strong>Auto-fix available for 4 of 6 issues:</strong><div class="ew-issue-list" style="margin-top:6px"><div class="ew-issue-item fixable">&#10003; Add alt text to Alaska hero images — <strong>can fix now</strong></div><div class="ew-issue-item fixable">&#10003; Add price disclaimer to family suite — <strong>template available</strong></div><div class="ew-issue-item needs-review">&#9888; Unpublish expired Black Friday offer — <strong>needs approval</strong></div><div class="ew-issue-item fixable">&#10003; Generate missing SEO meta descriptions — <strong>can generate</strong></div></div><div style="margin-top:10px"><button class="ew-action-btn" id="ewAutoFix">Apply 3 Auto-Fixes</button> <button class="ew-action-btn secondary" id="ewRoute">Route 1 for Review</button></div></div>`);

    fixEl.querySelector('#ewAutoFix').addEventListener('click', applyFixes);
    fixEl.querySelector('#ewRoute').addEventListener('click', routeReview);
    updateGov(87, { brand: 'warn', legal: 'fail', a11y: 'fail', seo: 'fail' });
  }

  async function applyFixes() {
    addMsg('user', 'Apply the 3 auto-fixes');
    addTyping(); await sleep(800); removeTyping();
    const fm = addRaw(`<div class="ew-agent-badge">Governance Agent</div><div class="ew-msg-content"><strong>Applying fixes...</strong><div style="margin-top:6px"><div class="ew-step"><span class="ew-step-icon active">&#8943;</span> Adding alt text to Alaska images...</div><div class="ew-step"><span class="ew-step-icon pending">&#8226;</span> Adding price disclaimer...</div><div class="ew-step"><span class="ew-step-icon pending">&#8226;</span> Generating SEO meta descriptions...</div></div></div>`);

    await sleep(1200);
    fm.querySelector('.ew-step:nth-child(1) .ew-step-icon').className = 'ew-step-icon done'; fm.querySelector('.ew-step:nth-child(1) .ew-step-icon').innerHTML = '&#10003;';
    fm.querySelector('.ew-step:nth-child(2) .ew-step-icon').className = 'ew-step-icon active'; fm.querySelector('.ew-step:nth-child(2) .ew-step-icon').innerHTML = '&#8943;';
    await sleep(1000);
    fm.querySelector('.ew-step:nth-child(2) .ew-step-icon').className = 'ew-step-icon done'; fm.querySelector('.ew-step:nth-child(2) .ew-step-icon').innerHTML = '&#10003;';
    fm.querySelector('.ew-step:nth-child(3) .ew-step-icon').className = 'ew-step-icon active'; fm.querySelector('.ew-step:nth-child(3) .ew-step-icon').innerHTML = '&#8943;';
    await sleep(1400);
    fm.querySelector('.ew-step:nth-child(3) .ew-step-icon').className = 'ew-step-icon done'; fm.querySelector('.ew-step:nth-child(3) .ew-step-icon').innerHTML = '&#10003;';

    await sleep(400);
    addRaw(`<div class="ew-agent-badge">Governance Agent</div><div class="ew-msg-content"><strong>&#10003; 3 fixes applied and published</strong><br><br>&#10003; Alaska page: 3 alt texts added, WCAG 2.1 AA compliant<br>&#10003; Family suite: Price disclaimer from legal template applied<br>&#10003; 6 pages: SEO meta descriptions generated from content<br><br>&#9888; Black Friday offer routed to <code>@legal-review</code> in Workfront (task PCL-2851)<div class="ew-money-line">Compliance score: 87% &#8594; 94%. Three issues that would have taken a content team a full day were fixed in 12 seconds.</div></div>`);
    updateGov(94, { brand: true, legal: true, a11y: true, seo: 'warn' });
  }

  async function routeReview() {
    addMsg('user', 'Route the Black Friday issue for legal review');
    addTyping(); await sleep(1000); removeTyping();
    addMsg('assistant', md('&#10003; Workfront task **PCL-2851** created:\n\nAssignee: @legal-review\nPriority: High\nPage: `/offers/black-friday`\nAction required: Approve unpublish of expired Q4 offer\nSLA: 48h per Princess Cruises legal review policy'), 'Governance Agent');
  }

  /* ── Flow 2: Performance (secondary) ── */
  async function runPerf() {
    addMsg('user', 'How is the Mediterranean landing page performing?');
    addTyping(); await sleep(1200); removeTyping();
    addMsg('assistant', md('**Mediterranean Landing Page — 7-day Performance**\n\nSessions: 34,218 (&#8593; 12%)\nBounce Rate: 47.3% (&#9888; &#8593; 23% mobile)\nConversion: 3.2% (&#8595; 0.4pp)\nAvg. Time: 2:14 (stable)\n\n&#9888; **Issue**: Mobile bounce rate spiked 23% after last Tuesday\'s hero image change. New image loads 3.2s on mobile (target: <1.5s).'), 'Data Insights Agent');
    signal.style.display = 'block';
    addTyping(); await sleep(1800); removeTyping();
    addMsg('assistant', md('&#128161; **Suggested fix**: Swap hero to `med-hero-sunset-mobile.webp` (280KB vs 1.8MB). Predicted: -2.1s load, -15% bounce.\n\nWant me to apply?'), 'Content Optimization');
  }

  /* ── Flow 3: Personalize (secondary) ── */
  async function runPersonalize() {
    addMsg('user', 'Personalize hero for high-intent buyers who viewed 3+ itineraries');
    addTyping(); await sleep(1200); removeTyping();
    addMsg('assistant', md('**Segment: "High-Intent Browsers"**\n\nSize: 12,847 profiles\nAvg. booking: $4,280\nPipeline: **$54.9M**\nTop interest: Greek Islands'), 'Audience Agent');
    addTyping(); await sleep(2000); removeTyping();
    addMsg('assistant', md('**Variant generated:**\nHeadline: "Your Greek Islands Itinerary Is Waiting"\nCTA: "Complete Your Booking — Rate Ends Friday"\n\n&#10003; Governance cleared\n&#10003; Published to segment\nEst. revenue impact: **$770K – $1.03M**'), 'Content Optimization');
  }

  /* ── Flow Router ── */
  const FLOWS = { brief: runBrief, governance: runGov, performance: runPerf, personalize: runPersonalize };

  function handleInput() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg('user', text);
    const lower = text.toLowerCase();
    if (lower.includes('brief') || lower.includes('upload') || lower.includes('create page')) setTimeout(runBrief, 400);
    else if (lower.includes('governance') || lower.includes('compliance') || lower.includes('scan')) setTimeout(runGov, 400);
    else if (lower.includes('perform') || lower.includes('analytics') || lower.includes('bounce')) setTimeout(runPerf, 400);
    else if (lower.includes('personal') || lower.includes('segment') || lower.includes('variant')) setTimeout(runPersonalize, 400);
    else if (lower.includes('apply') || lower.includes('fix')) {
      setTimeout(async () => { addTyping(); await sleep(1200); removeTyping(); addMsg('assistant', '&#10003; Fix applied and published. Governance cleared.', 'Content Optimization'); }, 300);
    } else {
      setTimeout(async () => { addTyping(); await sleep(1000); removeTyping(); addMsg('assistant', md('I have access to your AEM content, CJA analytics, audience data, and governance rules via MCP. Try one of the suggested actions above, or ask me about:\n\n&#8226; **Page performance** — "How is [page] performing?"\n&#8226; **Content creation** — "Create a page from this brief"\n&#8226; **Governance** — "Check compliance across all pages"\n&#8226; **Personalization** — "Personalize for [segment]"')); }, 300);
    }
  }

  /* ── Events ── */
  block.querySelectorAll('.ew-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      block.querySelectorAll('.ew-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.mode === 'preview' && frame.src === 'about:blank') loadPreview();
    });
  });

  block.querySelectorAll('.ew-prompt-btn').forEach((btn) => {
    btn.addEventListener('click', () => { const fn = FLOWS[btn.dataset.flow]; if (fn) fn(); });
  });

  sendBtn.addEventListener('click', handleInput);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInput(); } });

  signal.querySelector('.ew-signal-fix').addEventListener('click', () => {
    addMsg('user', 'Apply the suggested hero image fix');
    signal.style.display = 'none';
    setTimeout(async () => { addTyping(); await sleep(1200); removeTyping(); addMsg('assistant', md('&#10003; Hero swapped to `med-hero-sunset-mobile.webp` (280KB). Governance cleared. Republished.\n\nExpected: -2.1s load, ~15% bounce reduction.'), 'Content Optimization'); }, 300);
  });

  /* ── Init ── */
  loadPreview();
}
