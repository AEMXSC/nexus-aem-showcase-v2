/*
 * AI Client — Claude API (direct browser access)
 * API key stored in localStorage, entered by user in settings
 */

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const STORAGE_KEY = 'ew-claude-key';

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function removeApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasApiKey() {
  return !!getApiKey();
}

const AEM_SYSTEM_PROMPT = `You are an AI assistant embedded in the AEM Experience Workspace — an agent orchestration interface for Adobe Experience Manager Edge Delivery Services.

You help content authors with:
- Page creation and optimization
- Governance compliance (brand, legal, accessibility, SEO)
- Content performance analysis
- Personalization recommendations

You have context about the current AEM site being managed. When analyzing pages:
- Check accessibility (alt text, headings, ARIA labels, color contrast)
- Check SEO (meta descriptions, title tags, heading hierarchy, canonical URLs)
- Check brand compliance (consistent styling, approved language)
- Check legal (required disclaimers, terms links, privacy policy)

Be concise and actionable. Use checkmarks (✓) for passes, warnings (⚠) for issues, and ❌ for failures.
Format responses in clean markdown. Reference specific elements when pointing out issues.`;

export async function chat(userMessage, context = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Claude API key not configured');

  const systemParts = [AEM_SYSTEM_PROMPT];

  if (context.pageHTML) {
    systemParts.push(`\n\nCurrent page HTML (from iframe preview):\n\`\`\`html\n${context.pageHTML.slice(0, 15000)}\n\`\`\``);
  }

  if (context.pageUrl) {
    systemParts.push(`\nCurrent page URL: ${context.pageUrl}`);
  }

  if (context.customerName) {
    systemParts.push(`\nCustomer: ${context.customerName}`);
  }

  const messages = Array.isArray(userMessage)
    ? userMessage
    : [{ role: 'user', content: userMessage }];

  const resp = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: systemParts.join('\n'),
      messages,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.content[0].text;
}

export async function analyzeGovernance(pageHTML, pageUrl) {
  const prompt = `Analyze this AEM page for governance compliance. Check:

1. **Brand compliance** — consistent styling, proper use of brand elements
2. **Legal** — required disclaimers, privacy links, terms of service
3. **Accessibility (WCAG 2.1 AA)** — alt text, heading hierarchy, ARIA, color contrast indicators
4. **SEO** — meta description, title, heading structure, canonical URL, image optimization

Return a structured report with:
- Overall compliance score (0-100%)
- Category breakdown (Brand, Legal, A11y, SEO) with pass/warn/fail
- Specific issues found with severity and suggested fixes
- Which issues can be auto-fixed

Be specific — reference actual elements from the HTML.`;

  return chat(prompt, { pageHTML, pageUrl });
}

export async function analyzeBrief(briefText) {
  const prompt = `Analyze this campaign brief and extract structured requirements for creating an AEM page:

Brief content:
${briefText}

Extract and return:
1. **Campaign name** and description
2. **Target audience** details
3. **Required page sections** (hero, content blocks, CTAs, etc.)
4. **Key messages** and copy direction
5. **Brand assets** needed (images, icons, logos)
6. **Governance pre-check** — flag any potential brand/legal/a11y concerns
7. **Suggested AEM block structure** — map requirements to EDS blocks (hero, cards, columns, etc.)

Format as a clear, actionable checklist.`;

  return chat(prompt, {});
}

export async function generatePageContent(briefAnalysis, customerName) {
  const prompt = `Based on this campaign brief analysis, generate AEM Edge Delivery Services page content.

Brief Analysis:
${briefAnalysis}

Customer: ${customerName}

Generate:
1. Complete HTML content structure using EDS block patterns
2. Section-by-section content with placeholder text based on the brief
3. Metadata block with SEO title, description, and OG tags
4. Suggested image placements with alt text

Return the content as clean HTML that can be authored in DA (Document Authoring).
Use EDS block table format where appropriate.`;

  return chat(prompt, { customerName });
}

export async function streamChat(userMessage, context, onChunk) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Claude API key not configured');

  const systemParts = [AEM_SYSTEM_PROMPT];
  if (context.pageHTML) {
    systemParts.push(`\n\nCurrent page HTML:\n\`\`\`html\n${context.pageHTML.slice(0, 15000)}\n\`\`\``);
  }
  if (context.pageUrl) systemParts.push(`\nCurrent page URL: ${context.pageUrl}`);
  if (context.customerName) systemParts.push(`\nCustomer: ${context.customerName}`);

  const messages = Array.isArray(userMessage)
    ? userMessage
    : [{ role: 'user', content: userMessage }];

  const resp = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      stream: true,
      system: systemParts.join('\n'),
      messages,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error: ${resp.status}`);
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
            onChunk(parsed.delta.text, fullText);
          }
        } catch { /* skip parse errors in stream */ }
      }
    }
  }

  return fullText;
}
