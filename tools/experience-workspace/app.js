/*
 * Experience Workspace — Demo App v2
 * Polished agent orchestration for XSC pre-sales demos
 * Primary flows: Upload Brief (#1) and Governance Check (#4)
 */

const PREVIEW_URL = window.location.origin + '/';
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const previewFrame = document.getElementById('previewFrame');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const signalOverlay = document.getElementById('signalOverlay');
const governanceBar = document.getElementById('governanceBar');

/* ── Utility ── */

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function scrollChat() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ── Chat Primitives ── */

function addMessage(type, html, agentBadge) {
  const msg = document.createElement('div');
  msg.classList.add('message', type);

  let inner = '';
  if (agentBadge) {
    inner += `<div class="agent-badge">${agentBadge}</div>`;
  }
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
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function md(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/* ── Flow 1: Upload Brief (PRIMARY) ── */

async function runBriefFlow() {
  // User message with file indicator
  addMessage('user', 'Upload campaign brief and create landing page');
  addRawHTML(`
    <div class="upload-indicator">
      <span class="file-icon">&#128196;</span>
      <div>
        <div style="font-weight:500">Q3-Mediterranean-Campaign-Brief.pdf</div>
        <div style="font-size:10px;color:var(--text-muted)">2.4 MB — uploaded</div>
      </div>
    </div>
  `);

  // Step 1: Acrobat extraction
  addTyping();
  await sleep(1400);
  removeTyping();
  addMessage('assistant', md(
    '**Extracting campaign brief...**\n\n'
    + 'Campaign: Mediterranean Summer 2025\n'
    + 'Target audience: Luxury travelers, 35-65\n'
    + 'Key message: "Sail into the extraordinary"\n'
    + 'Required sections: Hero, Itinerary highlights, Pricing, CTA\n'
    + 'Brand assets referenced: 6 images, 2 icons',
  ), 'Acrobat MCP');

  // Step 2: Governance pre-check
  addTyping();
  await sleep(1600);
  removeTyping();
  addMessage('assistant', md(
    '**Pre-flight governance check**\n\n'
    + '&#10003; Brand colors match Princess Cruises palette\n'
    + '&#10003; Voice tone: sophisticated yet approachable\n'
    + '&#10003; Legal disclaimers: pricing, cancellation policy present\n'
    + '&#10003; Accessibility: heading hierarchy valid\n'
    + '&#9888; Note: "Limited time" urgency claim needs legal review date',
  ), 'Governance Agent');

  // Step 3: Page creation with progress
  addTyping();
  await sleep(800);
  removeTyping();

  const progressMsg = addRawHTML(`
    <div class="agent-badge">Experience Production</div>
    <div class="message-content">
      <strong>Building page structure...</strong>
      <div style="margin-top:8px">
        <div class="agent-step"><span class="step-icon done">&#10003;</span> Hero section with campaign headline</div>
        <div class="agent-step"><span class="step-icon done">&#10003;</span> Itinerary highlights cards (3 destinations)</div>
        <div class="agent-step"><span class="step-icon active">&#8943;</span> Pricing table with cabin categories</div>
        <div class="agent-step"><span class="step-icon pending">&#8226;</span> CTA with booking flow link</div>
        <div class="agent-step"><span class="step-icon pending">&#8226;</span> Footer with legal disclaimers</div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:45%"></div></div>
    </div>
  `);

  await sleep(1200);
  progressMsg.querySelector('.agent-step:nth-child(3) .step-icon').className = 'step-icon done';
  progressMsg.querySelector('.agent-step:nth-child(3) .step-icon').innerHTML = '&#10003;';
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').className = 'step-icon active';
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').innerHTML = '&#8943;';
  progressMsg.querySelector('.progress-fill').style.width = '70%';

  await sleep(1000);
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').className = 'step-icon done';
  progressMsg.querySelector('.agent-step:nth-child(4) .step-icon').innerHTML = '&#10003;';
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').className = 'step-icon active';
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').innerHTML = '&#8943;';
  progressMsg.querySelector('.progress-fill').style.width = '90%';

  await sleep(800);
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').className = 'step-icon done';
  progressMsg.querySelector('.agent-step:nth-child(5) .step-icon').innerHTML = '&#10003;';
  progressMsg.querySelector('.progress-fill').style.width = '100%';

  // Step 4: Asset discovery
  await sleep(600);
  addMessage('assistant', md(
    '**Found 4 approved assets in DAM:**\n\n'
    + '&#10003; `med-hero-couple-sunset.jpg` — Rights cleared Dec 2026\n'
    + '&#10003; `cruise-ship-aerial.jpg` — Brand approved\n'
    + '&#10003; `couple-dining-deck.jpg` — Model release on file\n'
    + '&#10003; `mediterranean-route-map.svg` — Brand asset library',
  ), 'Discovery Agent');

  // Step 5: Renditions
  addTyping();
  await sleep(1200);
  removeTyping();
  addMessage('assistant', md(
    '**Renditions generated:**\n'
    + 'Desktop: 2048x1024 (WebP + AVIF)\n'
    + 'Tablet: 1024x768\n'
    + 'Mobile: 640x960\n'
    + 'Dynamic Media: Smart Crop enabled',
  ), 'Content Optimization');

  // Step 6: Final result with money line
  await sleep(800);
  loadPreview();

  addRawHTML(`
    <div class="agent-badge">Experience Production</div>
    <div class="message-content">
      <strong>&#10003; Page created: Mediterranean Summer Campaign</strong><br><br>
      <table class="gov-results">
        <tr><th>Check</th><th>Status</th></tr>
        <tr><td>Governance</td><td class="count-pass">96% compliant</td></tr>
        <tr><td>Assets</td><td class="count-pass">4 approved, 0 flagged</td></tr>
        <tr><td>Workfront</td><td>Task PCL-2847 created</td></tr>
        <tr><td>Launch</td><td>Ready for editorial review</td></tr>
      </table>
      <div class="money-line">
        That was 14 people and 3 weeks of work. You just watched it happen in one conversation.
      </div>
    </div>
  `);

  // Update governance bar
  updateGovernanceBar(96, { brand: true, legal: true, a11y: true, seo: 'warn' });
}

/* ── Flow 4: Governance Check (PRIMARY) ── */

async function runGovernanceFlow() {
  addMessage('user', 'Run a full governance check on all published pages');

  // Step 1: Scanning animation
  addTyping();
  await sleep(1000);
  removeTyping();

  const scanMsg = addRawHTML(`
    <div class="agent-badge">Governance Agent</div>
    <div class="message-content">
      <strong>Scanning published pages...</strong>
      <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
      <div class="scan-count" style="font-size:11px;color:var(--text-muted);margin-top:4px">0 of 47 pages scanned</div>
    </div>
  `);

  const fill = scanMsg.querySelector('.progress-fill');
  const count = scanMsg.querySelector('.scan-count');

  for (let i = 1; i <= 5; i++) {
    await sleep(500);
    const pct = Math.min(i * 22, 100);
    const pages = Math.min(i * 10, 47);
    fill.style.width = `${pct}%`;
    count.textContent = `${pages} of 47 pages scanned`;
  }

  await sleep(400);
  fill.style.width = '100%';
  count.textContent = '47 of 47 pages scanned';

  // Step 2: Results table
  await sleep(800);
  addRawHTML(`
    <div class="agent-badge">Governance Agent</div>
    <div class="message-content">
      <strong>Governance Report — Princess Cruises</strong>
      <table class="gov-results" style="margin-top:10px">
        <tr><th>Category</th><th>Pass</th><th>Fail</th><th>Warn</th></tr>
        <tr><td>Brand compliance</td><td class="count-pass">44</td><td class="count-fail">0</td><td class="count-warn">3</td></tr>
        <tr><td>Legal review</td><td class="count-pass">42</td><td class="count-fail">2</td><td class="count-warn">3</td></tr>
        <tr><td>Accessibility</td><td class="count-pass">41</td><td class="count-fail">1</td><td class="count-warn">5</td></tr>
        <tr><td>SEO standards</td><td class="count-pass">38</td><td class="count-fail">3</td><td class="count-warn">6</td></tr>
        <tr><td>Image rights</td><td class="count-pass">47</td><td class="count-fail">0</td><td class="count-warn">0</td></tr>
      </table>
      <div style="margin-top:10px">
        <strong style="color:var(--accent)">Critical issues requiring action:</strong>
        <div class="issue-list">
          <div class="issue-item critical">&#10060; <code>/offers/black-friday</code> — Expired offer still live, legal flagged</div>
          <div class="issue-item critical">&#10060; <code>/booking/family-suite</code> — Price disclaimer missing</div>
          <div class="issue-item critical">&#10060; <code>/destinations/alaska</code> — Alt text missing on 3 hero images</div>
        </div>
      </div>
    </div>
  `);

  // Step 3: Auto-fix options
  addTyping();
  await sleep(1800);
  removeTyping();

  addRawHTML(`
    <div class="agent-badge">Governance Agent</div>
    <div class="message-content">
      <strong>Auto-fix available for 4 of 6 issues:</strong>
      <div class="issue-list" style="margin-top:6px">
        <div class="issue-item fixable">&#10003; Add alt text to Alaska hero images — <strong>can fix now</strong></div>
        <div class="issue-item fixable">&#10003; Add price disclaimer to family suite — <strong>template available</strong></div>
        <div class="issue-item needs-review">&#9888; Unpublish expired Black Friday offer — <strong>needs approval</strong></div>
        <div class="issue-item fixable">&#10003; Generate missing SEO meta descriptions — <strong>can generate</strong></div>
      </div>
      <div style="margin-top:10px">
        <button class="chat-action-btn" onclick="applyGovernanceFixes()">Apply 3 Auto-Fixes</button>
        <button class="chat-action-btn secondary" onclick="routeForReview()">Route 1 for Review</button>
      </div>
    </div>
  `);

  // Update governance bar to show issues
  updateGovernanceBar(87, { brand: 'warn', legal: 'fail', a11y: 'fail', seo: 'fail' });
}

/* ── Governance fix actions ── */

window.applyGovernanceFixes = async function applyGovernanceFixes() {
  addMessage('user', 'Apply the 3 auto-fixes');

  addTyping();
  await sleep(800);
  removeTyping();

  const fixMsg = addRawHTML(`
    <div class="agent-badge">Governance Agent</div>
    <div class="message-content">
      <strong>Applying fixes...</strong>
      <div style="margin-top:6px">
        <div class="agent-step"><span class="step-icon active">&#8943;</span> Adding alt text to Alaska images...</div>
        <div class="agent-step"><span class="step-icon pending">&#8226;</span> Adding price disclaimer...</div>
        <div class="agent-step"><span class="step-icon pending">&#8226;</span> Generating SEO meta descriptions...</div>
      </div>
    </div>
  `);

  await sleep(1200);
  fixMsg.querySelector('.agent-step:nth-child(1) .step-icon').className = 'step-icon done';
  fixMsg.querySelector('.agent-step:nth-child(1) .step-icon').innerHTML = '&#10003;';
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').className = 'step-icon active';
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').innerHTML = '&#8943;';

  await sleep(1000);
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').className = 'step-icon done';
  fixMsg.querySelector('.agent-step:nth-child(2) .step-icon').innerHTML = '&#10003;';
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').className = 'step-icon active';
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').innerHTML = '&#8943;';

  await sleep(1400);
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').className = 'step-icon done';
  fixMsg.querySelector('.agent-step:nth-child(3) .step-icon').innerHTML = '&#10003;';

  await sleep(400);
  addRawHTML(`
    <div class="agent-badge">Governance Agent</div>
    <div class="message-content">
      <strong>&#10003; 3 fixes applied and published</strong><br><br>
      &#10003; Alaska page: 3 alt texts added, WCAG 2.1 AA compliant<br>
      &#10003; Family suite: Price disclaimer from legal template applied<br>
      &#10003; 6 pages: SEO meta descriptions generated from content<br><br>
      &#9888; Black Friday offer routed to <code>@legal-review</code> in Workfront (task PCL-2851)
      <div class="money-line">
        Compliance score: 87% &#8594; 94%. Three issues that would have taken a content team a full day were fixed in 12 seconds.
      </div>
    </div>
  `);

  updateGovernanceBar(94, { brand: true, legal: true, a11y: true, seo: 'warn' });
};

window.routeForReview = async function routeForReview() {
  addMessage('user', 'Route the Black Friday issue for legal review');
  addTyping();
  await sleep(1000);
  removeTyping();
  addMessage('assistant', md(
    '&#10003; Workfront task **PCL-2851** created:\n\n'
    + 'Assignee: @legal-review\n'
    + 'Priority: High\n'
    + 'Page: `/offers/black-friday`\n'
    + 'Action required: Approve unpublish of expired Q4 offer\n'
    + 'SLA: 48h per Princess Cruises legal review policy',
  ), 'Governance Agent');
};

/* ── Flow 2: Performance (secondary) ── */

async function runPerformanceFlow() {
  addMessage('user', 'How is the Mediterranean landing page performing?');
  addTyping();
  await sleep(1200);
  removeTyping();
  addMessage('assistant', md(
    '**Mediterranean Landing Page — 7-day Performance**\n\n'
    + 'Sessions: 34,218 (&#8593; 12%)\n'
    + 'Bounce Rate: 47.3% (&#9888; &#8593; 23% mobile)\n'
    + 'Conversion: 3.2% (&#8595; 0.4pp)\n'
    + 'Avg. Time: 2:14 (stable)\n\n'
    + '&#9888; **Issue**: Mobile bounce rate spiked 23% after last Tuesday\'s hero image change. New image loads 3.2s on mobile (target: <1.5s).',
  ), 'Data Insights Agent');

  signalOverlay.style.display = 'block';

  addTyping();
  await sleep(1800);
  removeTyping();
  addMessage('assistant', md(
    '&#128161; **Suggested fix**: Swap hero to `med-hero-sunset-mobile.webp` (280KB vs 1.8MB). Predicted: -2.1s load, -15% bounce.\n\nWant me to apply?',
  ), 'Content Optimization');
}

/* ── Flow 3: Personalize (secondary) ── */

async function runPersonalizeFlow() {
  addMessage('user', 'Personalize hero for high-intent buyers who viewed 3+ itineraries');
  addTyping();
  await sleep(1200);
  removeTyping();
  addMessage('assistant', md(
    '**Segment: "High-Intent Browsers"**\n\n'
    + 'Size: 12,847 profiles\n'
    + 'Avg. booking: $4,280\n'
    + 'Pipeline: **$54.9M**\n'
    + 'Top interest: Greek Islands',
  ), 'Audience Agent');

  addTyping();
  await sleep(2000);
  removeTyping();
  addMessage('assistant', md(
    '**Variant generated:**\n'
    + 'Headline: "Your Greek Islands Itinerary Is Waiting"\n'
    + 'CTA: "Complete Your Booking — Rate Ends Friday"\n\n'
    + '&#10003; Governance cleared\n'
    + '&#10003; Published to segment\n'
    + 'Est. revenue impact: **$770K – $1.03M**',
  ), 'Content Optimization');
}

/* ── Governance Bar Update ── */

function updateGovernanceBar(score, checks) {
  const items = governanceBar.querySelectorAll('.gov-item');
  const labels = ['brand', 'legal', 'a11y', 'seo'];

  items.forEach((item, i) => {
    const key = labels[i];
    const val = checks[key];
    item.className = 'gov-item';
    const icon = item.querySelector('.gov-icon');

    if (val === true) {
      item.classList.add('gov-pass');
      icon.innerHTML = '&#10003;';
    } else if (val === 'warn') {
      item.classList.add('gov-warn');
      icon.innerHTML = '&#9888;';
    } else if (val === 'fail' || val === false) {
      item.classList.add('gov-fail');
      icon.innerHTML = '&#10060;';
    }
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

const FLOWS = {
  brief: runBriefFlow,
  governance: runGovernanceFlow,
  performance: runPerformanceFlow,
  personalize: runPersonalizeFlow,
};

function handleUserInput() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  addMessage('user', text);

  const lower = text.toLowerCase();
  if (lower.includes('brief') || lower.includes('upload') || lower.includes('create page')) {
    setTimeout(() => runBriefFlow(), 400);
  } else if (lower.includes('governance') || lower.includes('compliance') || lower.includes('brand check') || lower.includes('scan')) {
    setTimeout(() => runGovernanceFlow(), 400);
  } else if (lower.includes('perform') || lower.includes('analytics') || lower.includes('bounce') || lower.includes('how is')) {
    setTimeout(() => runPerformanceFlow(), 400);
  } else if (lower.includes('personal') || lower.includes('segment') || lower.includes('high-intent') || lower.includes('variant')) {
    setTimeout(() => runPersonalizeFlow(), 400);
  } else if (lower.includes('apply') || lower.includes('fix')) {
    setTimeout(async () => {
      addTyping();
      await sleep(1200);
      removeTyping();
      addMessage('assistant', '&#10003; Fix applied and published. Governance cleared.', 'Content Optimization');
    }, 300);
  } else {
    setTimeout(async () => {
      addTyping();
      await sleep(1000);
      removeTyping();
      addMessage('assistant', md(
        'I have access to your AEM content, CJA analytics, audience data, and governance rules via MCP. Try one of the suggested actions above, or ask me about:\n\n'
        + '&#8226; **Page performance** — "How is [page] performing?"\n'
        + '&#8226; **Content creation** — "Create a page from this brief"\n'
        + '&#8226; **Governance** — "Check compliance across all pages"\n'
        + '&#8226; **Personalization** — "Personalize for [segment]"',
      ));
    }, 300);
  }
}

/* ── Event Listeners ── */

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.mode === 'preview' && previewFrame.src === 'about:blank') {
      loadPreview();
    }
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
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleUserInput();
  }
});

signalOverlay.addEventListener('click', (e) => {
  if (e.target.classList.contains('signal-fix-btn')) {
    addMessage('user', 'Apply the suggested hero image fix');
    signalOverlay.style.display = 'none';
    setTimeout(async () => {
      addTyping();
      await sleep(1200);
      removeTyping();
      addMessage('assistant', md(
        '&#10003; Hero swapped to `med-hero-sunset-mobile.webp` (280KB). Governance cleared. Republished.\n\nExpected: -2.1s load, ~15% bounce reduction.',
      ), 'Content Optimization');
    }, 300);
  }
});

/* ── Init ── */
loadPreview();
