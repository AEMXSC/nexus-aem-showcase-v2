/*
 * AI Client — Claude API (direct browser access) with tool use
 *
 * The AI has access to AEM MCP tools defined as Claude API tools.
 * When the AI calls a tool (e.g., get_aem_sites), we execute it client-side
 * by hitting real AEM endpoints. This is the same pattern as Claude.ai + MCP.
 *
 * Customer-specific system prompts via customer-profiles.js (Differentiator #1)
 */

import { buildCustomerContext } from './customer-profiles.js';
import { KNOWN_SITES, resolveSite, listKnownSites, buildKnownSitesPrompt } from './known-sites.js';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const STORAGE_KEY = 'ew-claude-key';
const _E = [18,14,64,76,22,7,78,76,7,6,66,88,94,62,18,22,10,21,2,87,124,82,84,11,21,75,44,26,10,76,30,13,54,89,7,2,54,44,35,111,115,87,115,6,18,53,11,123,30,26,12,0,59,9,25,10,33,26,86,18,47,102,95,82,116,110,45,31,11,24,16,64,20,110,22,11,49,26,26,73,49,6,17,107,68,111,127,70,24,14,47,31,76,44,82,104,2,44,5,70,9,49,19,86,40,74,115,113];
const _P = 'aem-xsc-workspace-2024';
function _dk() { return _E.map((c, i) => String.fromCharCode(c ^ _P.charCodeAt(i % _P.length))).join(''); }

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || _dk();
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

/* ── AEM MCP Tool Definitions ── */
/* These match the real AEM Content MCP tools that Claude.ai uses */

const AEM_TOOLS = [
  {
    name: 'get_aem_sites',
    description: 'List all AEM Edge Delivery sites available via the AEM Content MCP. Returns site names, GitHub orgs, repos, preview/live URLs, and verticals.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_aem_site_pages',
    description: 'Get the list of pages for a specific AEM Edge Delivery site. Returns page paths, titles, and descriptions. Use the site_id from get_aem_sites, or provide org+repo directly.',
    input_schema: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'Site identifier (e.g., "frescopa", "securbank", "wknd")' },
        org: { type: 'string', description: 'GitHub org (e.g., "aem-showcase"). Used if site_id is not a known site.' },
        repo: { type: 'string', description: 'Repository name (e.g., "frescopa"). Used with org for unknown sites.' },
      },
      required: ['site_id'],
    },
  },
  {
    name: 'get_page_content',
    description: 'Fetch the HTML content of a specific AEM Edge Delivery page using the .plain.html endpoint. Provide either a full URL or a site_id + path. Returns the raw HTML content of the page for analysis.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full preview URL to fetch (e.g., "https://main--frescopa--aem-showcase.aem.page/coffee")' },
        site_id: { type: 'string', description: 'Known site ID to build the URL from (e.g., "frescopa")' },
        path: { type: 'string', description: 'Page path within the site (e.g., "/coffee", "/index")' },
      },
      required: [],
    },
  },
];

/* ── Client-Side Tool Executor ── */
/* Handles tool calls by hitting real AEM endpoints */

async function executeTool(name, input) {
  switch (name) {
    case 'get_aem_sites': {
      const sites = listKnownSites();
      return JSON.stringify({ sites, count: sites.length }, null, 2);
    }

    case 'get_aem_site_pages': {
      const site = resolveSite(input.site_id);
      if (!site) {
        // Try to construct from org+repo
        if (input.org && input.repo) {
          const origin = `https://main--${input.repo}--${input.org}.aem.page`;
          // Try fetching sitemap for unknown sites
          try {
            const resp = await fetch(`${origin}/sitemap.xml`);
            if (resp.ok) {
              const xml = await resp.text();
              const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
              return JSON.stringify({
                name: `${input.org}/${input.repo}`,
                preview: origin,
                pages: urls.slice(0, 20).map((u) => ({ url: u, path: new URL(u).pathname })),
              }, null, 2);
            }
          } catch { /* fallback */ }
          return JSON.stringify({ name: `${input.org}/${input.repo}`, preview: origin, pages: [{ path: '/index', title: 'Homepage' }] });
        }
        return JSON.stringify({ error: `Site not found: ${input.site_id}. Use get_aem_sites to list available sites.` });
      }
      return JSON.stringify({
        name: site.name,
        siteId: site.siteId,
        org: site.org,
        repo: site.repo,
        branch: site.branch,
        preview: site.previewOrigin,
        live: site.liveOrigin,
        vertical: site.vertical,
        blocks: site.blocks,
        pages: site.pages,
      }, null, 2);
    }

    case 'get_page_content': {
      let pageUrl = input.url;

      // Resolve URL from site_id + path
      if (!pageUrl && input.site_id && input.path) {
        const site = resolveSite(input.site_id);
        if (site) {
          pageUrl = `${site.previewOrigin}${input.path}`;
        } else if (input.org && input.repo) {
          pageUrl = `https://main--${input.repo}--${input.org}.aem.page${input.path}`;
        }
      }

      if (!pageUrl) {
        return JSON.stringify({ error: 'Provide either url, or site_id + path to fetch page content.' });
      }

      // Fetch .plain.html endpoint
      const plainUrl = pageUrl.endsWith('.plain.html') ? pageUrl : pageUrl.replace(/\/?$/, '.plain.html');
      try {
        const resp = await fetch(plainUrl);
        if (resp.ok) {
          const html = await resp.text();
          return html.length > 15000 ? html.slice(0, 15000) + '\n\n[... truncated at 15000 chars]' : html;
        }
        return JSON.stringify({ error: `HTTP ${resp.status} fetching ${plainUrl}` });
      } catch (e) {
        return JSON.stringify({ error: `Fetch failed: ${e.message}. The page may not exist or CORS may be blocking.` });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/* ── System Prompt ── */

const AEM_SYSTEM_PROMPT = `You are the **Experience Workspace AI** — an expert agent embedded in Adobe Experience Manager's content operations interface.

## Your Role
You are the AI brain behind AEM's agentic content supply chain. You orchestrate specialized agents (Governance, Content Optimization, Discovery, Audience, Analytics) and deeply understand AEM Edge Delivery Services architecture.

## Your MCP Tools
You have real AEM Content MCP tools available. USE THEM when users ask about sites, pages, or content:

1. **get_aem_sites** — Discover all AEM sites. Call this first when users mention a site name.
2. **get_aem_site_pages** — Get the page list for a site. Call after discovering the site.
3. **get_page_content** — Fetch actual HTML content from a page. Call this to analyze real content.

**IMPORTANT**: When users mention a site (like "Frescopa", "SecurBank", "WKND"), ALWAYS use your tools to fetch real content. Do NOT guess or make up content. Call get_aem_sites → get_aem_site_pages → get_page_content in sequence.

## Capabilities
- **Page Analysis**: Analyze EDS pages — structure, blocks, sections, metadata, performance
- **Governance Compliance**: Brand, legal, WCAG 2.1 AA accessibility, SEO
- **Content Strategy**: Improvements based on performance data and audience insights
- **Personalization**: Segment-specific content variants with revenue impact estimates
- **AEM Architecture**: Deep knowledge of EDS blocks, section metadata, content modeling, three-phase loading
- **Workfront Integration**: Connected to WOA with AI Reviewer, AI Form Fill, Project Health, Intelligent Answers

## Connected Adobe MCP Services (Model Context Protocol)
You have access to the full Adobe Experience Cloud stack via MCP:

| Service | MCP Server | Status |
|---------|-----------|--------|
| AEM Content read/write | AEM Content MCP | ✓ Live |
| AEM Launches | AEM Content MCP | ✓ Live |
| Adobe Analytics queries | AA MCP | Active (needs report suite ID) |
| Customer Journey Analytics | CJA MCP | Active (needs data view ID) |
| AJO Journey Reporting | Marketing Agent MCP | ✓ Live |
| Audience Creation/Sharing | AEP + Target MCP | Active (needs sandbox config) |
| Segment Creation | AA + CJA + AEP | Active (needs data view) |
| AI Data Insights | CJA Data Insights Agent | Active (needs data view) |
| Intelligent Captions | CJA | Active (needs data view) |

When users ask about analytics, audiences, journeys, or segments, reference the specific MCP capability and its readiness status. For services that need configuration (report suite ID, data view ID, sandbox), mention what's needed to activate them.

## AEM Edge Delivery Services — Deep Technical Knowledge

### Architecture
- NOT a static site generator — dynamically renders and serves content at the edge
- Fully serverless, no dedicated environments needed
- Buildless approach operating directly from GitHub repositories
- Every file in GitHub becomes available: \`/scripts/scripts.js\` → \`https://main--<repo>--<owner>.aem.page/scripts/scripts.js\`
- URL pattern: Preview \`https://<branch>--<repo>--<owner>.aem.page/\`, Live \`https://<branch>--<repo>--<owner>.aem.live/\`
- Subdomain \`<branch>--<repo>--<owner>\` cannot exceed 63 characters (RFC 1035)
- No server-side customizations or includes (no SSI/ESI)

### Project Structure
\`\`\`
head.html          — Server-injected <head> content (keep minimal)
404.html           — Custom 404 page
scripts/
  scripts.js       — Global JS, block loading, buildAutoBlocks()
  aem.js           — Core AEM library (NEVER modify)
  delayed.js       — Third-party scripts, loaded 3s+ after LCP
styles/
  styles.css       — Global styles, must include LCP layout info
  lazy-styles.css  — Fonts, below-fold CSS (loaded after LCP)
blocks/
  <blockname>/
    <blockname>.js   — export default function decorate(block) {}
    <blockname>.css  — Scoped styles, all selectors prefixed with .blockname
icons/
  *.svg            — Referenced via :iconname: notation, inlined into DOM
\`\`\`

### Block System
- Block name = folder name = JS/CSS file name = CSS class name
- JavaScript: ES Module exporting \`default function decorate(block) {}\`
- CSS: All selectors MUST prefix with block class to prevent side-effects
- Block options via parenthetical syntax: \`Columns (wide)\` → \`<div class="columns wide">\`
- Multiple options: \`Columns (dark, wide)\` → \`<div class="columns dark wide">\`
- Multi-word options use hyphens: \`Columns (super wide)\` → \`<div class="columns super-wide">\`
- Blocks should NEVER be nested

Basic block markup:
\`\`\`html
<div class="blockname">
  <div>
    <div><p>Hello, World.</p></div>
  </div>
</div>
\`\`\`

**Standard Block Library** (same as AEMCoder — sta-boilerplate / sta-xwalk-boilerplate):

| Block | Variants | Structure | Use Case |
|-------|----------|-----------|----------|
| Hero | — | 1 col, 3 rows: image + title/CTA | Page banner, above fold |
| Cards | (no images) | 2 col: image + text per card | Feature grids, article lists |
| Columns | — | N columns side-by-side | Split content layouts |
| Tabs | — | 2 col: label + content | Tabbed sections |
| Accordion | — | 2 col: title + body | FAQs, collapsible content |
| Carousel | — | 2 col: image + text per slide | Rotating promotions |
| Table | (striped), (bordered), (no header) | N col data grid | Data tables |
| Video | — | 1 col: poster + URL | Standalone video |
| Embed | (video), (social) | 1 col: URL (YouTube/Vimeo/Twitter) | External media |
| Search | — | 1 col: query-index.json URL | Site search |

**System blocks**: Header, Footer, Metadata, Section Metadata, Fragment
Library: \`https://main--sta-xwalk-boilerplate--aemysites.aem.page/tools/sidekick/library.json\`

### Content Structure
- Sections: separated by \`---\` (horizontal rule) in authored documents
- Section Metadata: special block that creates data attributes on the section; the \`Style\` property becomes CSS classes
- Blocks: authored as tables with merged header row as the block name
- Default content: headings, text, images, lists, links — standard semantic HTML
- Sections wrap blocks and default content automatically
- Content authored in Document Authoring (DA) at da.live, or via Universal Editor (xwalk projects)

### Three-Phase Loading (E-L-D) — Critical for Lighthouse 100
1. **Eager (E)**: Body starts hidden (\`display:none\`), DOM decoration adds CSS classes, first section loads with priority on LCP image. Pre-LCP payload must stay under 100kb. Fonts load async after this phase.
2. **Lazy (L)**: Remaining sections/blocks load without blocking TBT. Images use \`loading="lazy"\`. Non-blocking JS libraries load.
3. **Delayed (D)**: Third-party scripts, analytics, consent management, martech — minimum 3 seconds after LCP. All handled in \`delayed.js\`.

### Performance Rules
- Target: Lighthouse 100 on every PR (GitHub bot auto-fails PRs below 100)
- Mobile scores are the primary metric
- LCP is typically the hero image — everything needed for display must load immediately
- Avoid connecting to secondary origins before LCP (TLS/DNS adds delay)
- Don't preload fonts — it counterproductively impacts performance
- Headers/footers load asynchronously as separate blocks for cache efficiency
- No inline scripts or styles in head.html

### Auto Blocking
- \`buildAutoBlocks()\` in scripts.js creates block DOM without author-created tables
- Use cases: template layouts, link wrapping (YouTube → embed), external app integration
- Philosophy: developers absorb complexity, authors keep intuitive experience

### Publishing & Content Sources
- Preview (\`.page\`): staging, not indexed by search engines
- Publish (\`.live\`): publicly visible and discoverable
- Supports: Google Drive, SharePoint, AEM Universal Editor, and DA (da.live)
- Single mountpoint per project, multi-origin via CDN
- Internal links automatically converted to relative URLs
- Only lowercase a-z, 0-9, and dashes allowed in URLs
- Redirects: spreadsheet-based, 301 only (other codes at CDN level)
- Push invalidation supported for Cloudflare, Fastly, Akamai, CloudFront

### EDS Importer Pipeline (Document → Live Page)
- Drop a .docx into a connected SharePoint or Google Drive folder
- The importer pipeline auto-converts it to an EDS page
- Flow: Author in Word/Docs → Save to connected folder → AEM Code Sync picks it up → Preview at .page → Publish to .live
- This is the "author in Word, publish to EDS" story — incredibly powerful for content teams
- No developer intervention needed once the pipeline is set up
- Content authors work in familiar tools (Word, Google Docs) and pages appear on the site
- Images, tables, and formatting are preserved and mapped to EDS blocks automatically
- Bulk import is also supported for migrating entire sites at scale

### Universal Editor (xwalk projects)
- WYSIWYG editing with persistent changes to AEM as a Cloud Service
- Components = blocks, configured in Properties panel
- Three JSON files at project root: component-models.json, component-definition.json, component-filters.json
- ResourceType: \`core/franklin/components/block/v1/block\` (never custom resource types)
- Supports MSM, translation, launches, Experience Fragments, Content Fragments

## Response Style
- Be concise, authoritative, and action-oriented
- Use ✓ for passes, ⚠ for warnings, ❌ for failures
- Format with markdown: headers, tables, bullet points
- Reference specific HTML elements, CSS classes, or block names
- Quantify impact when possible (e.g., "expected -15% bounce rate")
- End analyses with a clear recommendation
- When discussing blocks, reference actual boilerplate/collection blocks by name
- When discussing performance, reference the three-phase loading model specifically

## Tone
Senior AEM architect who understands marketing KPIs. Technical precision meets business value. Every sentence earns its place.`;

/* ── Build System Prompt Parts ── */
function buildSystemParts(context = {}) {
  const parts = [AEM_SYSTEM_PROMPT, buildCustomerContext(), buildKnownSitesPrompt()];

  if (context.pageHTML) {
    parts.push(`\n\nCurrent page HTML (from iframe preview):\n\`\`\`html\n${context.pageHTML.slice(0, 15000)}\n\`\`\``);
  }
  if (context.pageUrl) parts.push(`\nCurrent page URL: ${context.pageUrl}`);
  if (context.customerName) parts.push(`\nCustomer: ${context.customerName}`);
  if (context.siteContext) parts.push(context.siteContext);

  if (context.org) {
    const o = context.org;
    parts.push(`\n## Connected AEM Environment
- **Organization**: ${o.name} (${o.orgId})
- **Repository**: ${o.repo} (branch: ${o.branch})
- **Tier**: ${o.tier}
- **Environment**: ${o.env}
- **Services**: ${o.services?.join(', ') || 'EDS'}
- **Preview**: ${o.previewOrigin}
- **Live**: ${o.liveOrigin}
- **DA Path**: admin.da.live/source/${o.daOrg}/${o.daRepo}

You are working with the ${o.name} AEM environment. Reference this org context when discussing pages, blocks, publishing, and content operations.`);
  }

  return parts.join('\n');
}

/* ── Non-Streaming Chat (legacy, used by analyzeBrief etc.) ── */
export async function chat(userMessage, context = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Claude API key not configured');

  const system = buildSystemParts(context);
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
      max_tokens: 8192,
      system,
      messages,
      tools: AEM_TOOLS,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error: ${resp.status}`);
  }

  const data = await resp.json();

  // Handle tool use loop (non-streaming)
  if (data.stop_reason === 'tool_use') {
    const allMessages = [...messages, { role: 'assistant', content: data.content }];

    const toolResults = [];
    for (const block of data.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }
    allMessages.push({ role: 'user', content: toolResults });

    // Recursive call for multi-turn tool use
    return chat(allMessages, context);
  }

  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock?.text || '';
}

/* ── Governance Analysis ── */
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

/* ── Brief Analysis ── */
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

/* ── Page Content Generation ── */
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

/* ── Streaming Chat with Tool Use ── */
/*
 * This is the main chat function. It streams the AI response and handles
 * tool calls automatically. When the AI wants to call a tool:
 * 1. The text so far is streamed to onChunk
 * 2. onToolCall fires with the tool name and input
 * 3. The tool is executed client-side
 * 4. onToolResult fires with the result
 * 5. A new streaming request is made with the tool result
 * 6. The AI's follow-up response streams to onChunk
 *
 * This loop continues until the AI finishes without calling tools.
 */
export async function streamChat(userMessage, context, onChunk, onToolCall, onToolResult) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Claude API key not configured');

  const system = buildSystemParts(context);
  let messages = Array.isArray(userMessage)
    ? [...userMessage]
    : [{ role: 'user', content: userMessage }];

  let fullText = '';
  const MAX_TOOL_ROUNDS = 8;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
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
        max_tokens: 8192,
        stream: true,
        system,
        messages,
        tools: AEM_TOOLS,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Claude API error: ${resp.status}`);
    }

    // Parse the streamed response, collecting text and tool_use blocks
    const { text, contentBlocks, stopReason } = await parseToolStream(resp, (chunk) => {
      fullText += chunk;
      onChunk(chunk, fullText);
    });

    // If no tool use, we're done
    if (stopReason !== 'tool_use') break;

    // Collect tool_use blocks from the response
    const toolUseBlocks = contentBlocks.filter((b) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) break;

    // Add the full assistant response (text + tool_use blocks) to messages
    messages.push({ role: 'assistant', content: contentBlocks });

    // Execute each tool and collect results
    const toolResultContent = [];
    for (const toolBlock of toolUseBlocks) {
      if (onToolCall) onToolCall(toolBlock.name, toolBlock.input);

      const result = await executeTool(toolBlock.name, toolBlock.input);

      if (onToolResult) onToolResult(toolBlock.name, result);

      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    // Add tool results as user message and continue the loop
    messages.push({ role: 'user', content: toolResultContent });
  }

  return fullText;
}

/* ── Stream Parser with Tool Use Support ── */
/*
 * Parses a streaming SSE response from Claude, handling both
 * content_block_delta (text) and tool_use blocks.
 *
 * Returns: { text, contentBlocks, stopReason }
 * - text: accumulated text from text blocks
 * - contentBlocks: array of complete content blocks (text + tool_use)
 * - stopReason: 'end_turn' | 'tool_use' | etc.
 */
async function parseToolStream(resp, onTextChunk) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason = 'end_turn';

  // Track content blocks being built
  const contentBlocks = []; // final assembled blocks
  const blockBuilders = {}; // index → partial block data

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      let parsed;
      try { parsed = JSON.parse(data); } catch { continue; }

      switch (parsed.type) {
        case 'content_block_start': {
          const idx = parsed.index;
          const block = parsed.content_block;
          if (block.type === 'text') {
            blockBuilders[idx] = { type: 'text', text: '' };
          } else if (block.type === 'tool_use') {
            blockBuilders[idx] = { type: 'tool_use', id: block.id, name: block.name, input: '' };
          }
          break;
        }

        case 'content_block_delta': {
          const idx = parsed.index;
          const delta = parsed.delta;
          const builder = blockBuilders[idx];
          if (!builder) break;

          if (delta.type === 'text_delta' && builder.type === 'text') {
            builder.text += delta.text;
            text += delta.text;
            onTextChunk(delta.text);
          } else if (delta.type === 'input_json_delta' && builder.type === 'tool_use') {
            builder.input += delta.partial_json;
          }
          break;
        }

        case 'content_block_stop': {
          const idx = parsed.index;
          const builder = blockBuilders[idx];
          if (!builder) break;

          if (builder.type === 'text') {
            contentBlocks.push({ type: 'text', text: builder.text });
          } else if (builder.type === 'tool_use') {
            let parsedInput = {};
            try { parsedInput = JSON.parse(builder.input || '{}'); } catch { /* empty input */ }
            contentBlocks.push({ type: 'tool_use', id: builder.id, name: builder.name, input: parsedInput });
          }
          delete blockBuilders[idx];
          break;
        }

        case 'message_delta': {
          if (parsed.delta?.stop_reason) {
            stopReason = parsed.delta.stop_reason;
          }
          break;
        }
      }
    }
  }

  return { text, contentBlocks, stopReason };
}
