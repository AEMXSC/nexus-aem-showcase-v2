/*
 * Customer Profile System — Dynamic org-specific context injection
 *
 * Each profile contains everything the AI needs to act as a customer-specific agent:
 * brand voice, segment names, approval chains, legal SLAs, DAM taxonomy, etc.
 *
 * This is Differentiator #1 — the native agents' biggest gap.
 * Princess Cruises has different rules than Wells Fargo than Ralph Lauren.
 * We inject it the same day. The native agent gets a product release — maybe in Q3.
 */

const STORAGE_KEY = 'ew-active-profile';

export const PROFILES = {

  /* ── AEM XSC Showcase (default demo) ── */
  'aem-xsc': {
    id: 'aem-xsc',
    name: 'AEM XSC Showcase',
    orgId: 'AEMXSC',
    repo: 'nexus-aem-showcase-v2',
    branch: 'main',
    tier: 'AEM CS + EDS',
    env: 'Prod (VA7)',
    services: ['EDS', 'Assets Content Hub', 'Sites', 'Forms'],
    vertical: 'Technology',

    brandVoice: {
      tone: 'Technical, confident, forward-looking',
      keywords: ['agentic', 'orchestration', 'content supply chain', 'experience production'],
      avoided: ['simple', 'easy', 'just'],
      style: 'Authoritative enterprise tech — short sentences, active voice, quantified claims',
    },

    segments: [
      { name: 'Enterprise AEM Customers', id: 'ent-aem', description: 'Existing AEM CS customers exploring EDS migration' },
      { name: 'Greenfield EDS', id: 'greenfield', description: 'New customers starting directly with Edge Delivery' },
      { name: 'Move-to-Cloud', id: 'mtc', description: 'AEM 6.5 customers migrating to Cloud Service' },
    ],

    approvalChain: [
      { role: 'Content Author', action: 'Create/edit content' },
      { role: 'Content Lead', action: 'Review & approve content' },
      { role: 'Brand Manager', action: 'Brand compliance sign-off' },
      { role: 'Legal', action: 'Legal review (if flagged)', sla: '48h' },
      { role: 'Publisher', action: 'Publish to .live' },
    ],

    legalSLA: { reviewTime: '48h', escalation: '72h', autoApprove: false },

    damTaxonomy: {
      root: '/content/dam/aem-xsc',
      folders: ['hero-images', 'icons', 'team-photos', 'logos'],
      namingConvention: 'kebab-case, descriptive, includes dimensions',
    },

    entitlements: {
      analytics: { name: 'Adobe Analytics', mcp: 'AA MCP', status: 'active', note: 'Needs report suite ID' },
      cja: { name: 'Customer Journey Analytics', mcp: 'CJA MCP', status: 'active', note: 'Needs data view ID' },
      aep: { name: 'Adobe Experience Platform', mcp: 'AEP MCP', status: 'active', note: 'Needs sandbox config' },
      ajo: { name: 'Adobe Journey Optimizer', mcp: 'Marketing Agent MCP', status: 'active', note: 'Authenticated and live' },
      target: { name: 'Adobe Target', mcp: 'Target MCP', status: 'active', note: 'Needs sandbox config' },
      aemContent: { name: 'AEM Content', mcp: 'AEM Content MCP', status: 'live', note: 'Working today' },
      aemLaunches: { name: 'AEM Launches', mcp: 'AEM Content MCP', status: 'live', note: 'Working today' },
      workfront: { name: 'Workfront', mcp: 'Workfront WOA', status: 'active', note: 'P1 skills integrated' },
    },

    mcpCapabilities: [
      { capability: 'AEM content read/write', mcp: 'AEM Content MCP', ready: true },
      { capability: 'AEM Launches', mcp: 'AEM Content MCP', ready: true },
      { capability: 'Analytics queries', mcp: 'AA MCP', ready: false, needs: 'Report suite ID' },
      { capability: 'CJA queries', mcp: 'CJA MCP', ready: false, needs: 'Data view ID' },
      { capability: 'AJO journey reporting', mcp: 'Marketing Agent MCP', ready: true },
      { capability: 'Audience creation/sharing', mcp: 'AEP + Target', ready: false, needs: 'Sandbox config' },
    ],

    systemPromptExtras: '',
  },

  /* ── Ralph Lauren Corporate ── */
  'ralph-lauren': {
    id: 'ralph-lauren',
    name: 'Ralph Lauren Corporation',
    orgId: 'ralphlauren',
    repo: 'corporate-site',
    branch: 'main',
    tier: 'AEM CS + EDS',
    env: 'Prod',
    services: ['EDS', 'Assets Content Hub', 'Sites'],
    vertical: 'Retail / Fashion',
    sourceUrl: 'https://corporate.ralphlauren.com',

    brandVoice: {
      tone: 'Refined, aspirational, heritage-driven, confident',
      keywords: ['timeless', 'craftsmanship', 'heritage', 'iconic', 'world of Ralph Lauren', 'American style'],
      avoided: ['cheap', 'discount', 'basic', 'trendy', 'fast fashion'],
      style: 'Premium luxury — elegant prose, restrained enthusiasm, let the brand speak through quality. Never oversell. Every word should feel curated.',
      colorPalette: {
        primary: '#041E42',    // Navy (RL Navy)
        secondary: '#8B6F4E',  // Gold
        accent: '#C41E3A',     // Polo Red
        background: '#FFFFFF',
        text: '#1A1A1A',
        muted: '#6B6B6B',
      },
      typography: {
        heading: 'Didot, Georgia, serif',
        body: 'Helvetica Neue, Arial, sans-serif',
        accent: 'Futura, sans-serif',
      },
    },

    segments: [
      { name: 'Investors & Analysts', id: 'investors', description: 'Wall Street analysts, institutional investors, financial media tracking RL performance' },
      { name: 'Prospective Employees', id: 'careers', description: 'Fashion industry professionals, creatives, MBAs seeking luxury brand careers' },
      { name: 'Media & Press', id: 'press', description: 'Fashion press, business journalists, lifestyle publications' },
      { name: 'Corporate Partners', id: 'partners', description: 'Licensees, wholesale partners, supplier relations' },
      { name: 'ESG Stakeholders', id: 'esg', description: 'Sustainability researchers, ESG analysts, conscious consumers tracking corporate responsibility' },
    ],

    approvalChain: [
      { role: 'Corporate Communications', action: 'Draft content for corporate site' },
      { role: 'Brand Stewardship', action: 'Brand voice & visual identity review', sla: '24h' },
      { role: 'Investor Relations', action: 'Financial content accuracy review (if investor-facing)', sla: '24h' },
      { role: 'Legal & Compliance', action: 'Legal review — SEC compliance for financial claims, trademark usage', sla: '48h' },
      { role: 'VP Corporate Communications', action: 'Final sign-off for public-facing content' },
      { role: 'Digital Publishing', action: 'Publish to corporate.ralphlauren.com' },
    ],

    legalSLA: {
      reviewTime: '48h',
      escalation: '72h',
      autoApprove: false,
      specialRules: [
        'All financial forward-looking statements require SEC safe harbor language',
        'Quarterly results must include standard disclaimer',
        'Executive quotes must be pre-approved by individual',
        'Brand imagery must follow RL Visual Standards v4.2',
        'No product pricing on corporate site',
      ],
    },

    damTaxonomy: {
      root: '/content/dam/ralph-lauren/corporate',
      folders: ['leadership', 'brand-imagery', 'press-releases', 'investor-presentations', 'sustainability', 'heritage'],
      namingConvention: 'rl-[category]-[description]-[year]. Example: rl-leadership-patrice-louvet-2024',
      brandAssets: {
        logos: ['rl-polo-player', 'rl-wordmark', 'rl-corporate-seal'],
        restrictedUsage: 'Polo Player logo: minimum 24px height, never rotate, never modify colors. RL Navy (#041E42) background only.',
      },
    },

    entitlements: {
      analytics: { name: 'Adobe Analytics', mcp: 'AA MCP', status: 'active', note: 'Report suite: rl-corporate-prod' },
      cja: { name: 'Customer Journey Analytics', mcp: 'CJA MCP', status: 'active', note: 'Data view: corporate-site' },
      aep: { name: 'Adobe Experience Platform', mcp: 'AEP MCP', status: 'active', note: 'Sandbox: rl-corporate' },
      target: { name: 'Adobe Target', mcp: 'Target MCP', status: 'active', note: 'Sandbox: rl-corporate' },
      aemContent: { name: 'AEM Content', mcp: 'AEM Content MCP', status: 'live', note: 'Working — connected to corporate site' },
      aemLaunches: { name: 'AEM Launches', mcp: 'AEM Content MCP', status: 'live', note: 'Active for quarterly earnings' },
      workfront: { name: 'Workfront', mcp: 'Workfront WOA', status: 'active', note: 'Integrated with brand review workflow' },
    },

    mcpCapabilities: [
      { capability: 'AEM content read/write', mcp: 'AEM Content MCP', ready: true },
      { capability: 'AEM Launches', mcp: 'AEM Content MCP', ready: true },
      { capability: 'Analytics queries', mcp: 'AA MCP', ready: true },
      { capability: 'CJA queries', mcp: 'CJA MCP', ready: true },
      { capability: 'AJO journey reporting', mcp: 'Marketing Agent MCP', ready: false, needs: 'License activation' },
      { capability: 'Audience creation/sharing', mcp: 'AEP + Target', ready: true },
      { capability: 'AI Data Insights', mcp: 'CJA Data Insights Agent', ready: true },
    ],

    systemPromptExtras: `
## Ralph Lauren Corporate — Customer-Specific Context

You are working with the **Ralph Lauren Corporation** corporate site (corporate.ralphlauren.com).
This is an assets-only customer today (very mature AEM Assets deployment) who is evaluating AEM Sites
for their corporate "About RL" site, which is currently hand-coded.

**Key Context:**
- RL is evaluating Sites after a competitive loss to Contentful
- The corporate site is NOT an e-commerce site — it's investor relations, careers, press, sustainability, brand heritage
- Audience is institutional investors, fashion press, prospective employees, and ESG analysts
- Content must reflect the premium luxury positioning — every word curated, never oversold
- Financial content has SEC compliance requirements (safe harbor language, forward-looking statement disclaimers)

**Brand Rules (enforced by Brand Stewardship):**
- RL Navy (#041E42) is the primary brand color — used for backgrounds, headers, key CTAs
- The Polo Player logo has strict usage rules: minimum 24px height, never rotated, never recolored
- Typography: Didot for headlines (premium serif), Helvetica Neue for body
- Imagery: aspirational lifestyle photography, never product-only shots on corporate site
- Tone: refined, heritage-driven, confident without being boastful

**Governance Specifics:**
- All financial content requires Legal & Compliance review (48h SLA)
- Executive quotes require individual pre-approval
- Brand imagery must follow RL Visual Standards v4.2
- No product pricing or promotional language on corporate site
- Quarterly earnings pages use a standardized template with SEC safe harbor boilerplate

**Current Site Structure (corporate.ralphlauren.com):**
- /about — Company overview, history, world of RL
- /brands — Portfolio: Ralph Lauren, Polo, Lauren, Club Monaco, RRL
- /investors — Quarterly results, SEC filings, stock info, events
- /careers — Job openings, culture, benefits, diversity & inclusion
- /press — Press releases, media contacts, image library
- /citizenship-sustainability — ESG reporting, environmental goals, community impact
- /contact — Corporate contacts, customer service

**What Success Looks Like for RL:**
Moving the corporate site from hand-coded to AEM Sites + EDS means:
1. Corporate comms team can update content without developer involvement
2. Quarterly earnings pages can be templated and published in minutes, not days
3. Brand compliance is built into the authoring workflow (governance scanning)
4. Analytics and CJA provide real insight into investor engagement
5. The corporate site becomes a showcase for what AEM can do — strengthening the relationship`,
  },

  /* ── Princess Cruises ── */
  'princess-cruises': {
    id: 'princess-cruises',
    name: 'Princess Cruises',
    orgId: 'princess',
    repo: 'princess-eds',
    branch: 'main',
    tier: 'AEM CS + EDS',
    env: 'Prod (VA7)',
    services: ['EDS', 'Assets Content Hub', 'Sites', 'Forms'],
    vertical: 'Travel & Hospitality',

    brandVoice: {
      tone: 'Warm, inviting, adventurous yet refined',
      keywords: ['MedallionClass', 'Ocean Ready', 'come back new', 'sail away', 'voyage'],
      avoided: ['cheap', 'budget', 'old'],
      style: 'Premium travel — evocative descriptions, emotional appeal, sense of discovery. Aspirational but accessible.',
      colorPalette: {
        primary: '#00263E',
        secondary: '#C4A35A',
        accent: '#0077C8',
        background: '#FFFFFF',
        text: '#333333',
      },
    },

    segments: [
      { name: 'Elite Voyager', id: 'elite-voyager', description: 'Platinum+ loyalty tier, 15+ sailings, highest LTV, expect white-glove service' },
      { name: 'Adventure Seeker', id: 'adventure-seeker', description: 'Active couples 35-55, interested in excursions, MedallionClass tech' },
      { name: 'Luxury Relaxer', id: 'luxury-relaxer', description: 'Premium suite guests, spa-focused, dining experiences, 55+' },
      { name: 'Family Explorer', id: 'family-explorer', description: 'Multi-generational families, kids club, connecting staterooms' },
      { name: 'First Timer', id: 'first-timer', description: 'Never cruised before, need reassurance, value-conscious, digital-first' },
    ],

    approvalChain: [
      { role: 'Content Marketing', action: 'Draft campaign content' },
      { role: 'Brand Manager', action: 'Brand voice & imagery review', sla: '24h' },
      { role: 'Revenue Management', action: 'Pricing accuracy check (if pricing shown)', sla: '12h' },
      { role: 'Legal', action: 'Legal review — FTC compliance, disclaimer language', sla: '48h' },
      { role: 'Digital Director', action: 'Final approval & publish' },
    ],

    legalSLA: {
      reviewTime: '48h',
      escalation: '72h',
      autoApprove: false,
      specialRules: [
        'All pricing must include "from" qualifier and link to full terms',
        'Cruise imagery must show current fleet (no retired ships)',
        'MedallionClass claims must be substantiated',
        'COVID/health protocols must reference current CDC guidance',
        'Loyalty tier benefits must match current program terms',
      ],
    },

    damTaxonomy: {
      root: '/content/dam/princess',
      folders: ['ships', 'destinations', 'dining', 'staterooms', 'excursions', 'medallionclass', 'lifestyle'],
      namingConvention: 'pcl-[ship]-[category]-[description]. Example: pcl-discovery-pool-aerial-2024',
    },

    entitlements: {
      analytics: { name: 'Adobe Analytics', mcp: 'AA MCP', status: 'active', note: 'Report suite: pcl-web-prod' },
      cja: { name: 'Customer Journey Analytics', mcp: 'CJA MCP', status: 'active', note: 'Data view: booking-funnel' },
      aep: { name: 'Adobe Experience Platform', mcp: 'AEP MCP', status: 'active', note: 'Sandbox: pcl-prod' },
      ajo: { name: 'Adobe Journey Optimizer', mcp: 'Marketing Agent MCP', status: 'active', note: 'Authenticated and live' },
      target: { name: 'Adobe Target', mcp: 'Target MCP', status: 'active', note: 'Active AB tests on booking flow' },
      aemContent: { name: 'AEM Content', mcp: 'AEM Content MCP', status: 'live', note: 'Working today' },
      workfront: { name: 'Workfront', mcp: 'Workfront WOA', status: 'active', note: 'Connected to campaign ops' },
    },

    mcpCapabilities: [
      { capability: 'AEM content read/write', mcp: 'AEM Content MCP', ready: true },
      { capability: 'AEM Launches', mcp: 'AEM Content MCP', ready: true },
      { capability: 'Analytics queries', mcp: 'AA MCP', ready: true },
      { capability: 'CJA queries', mcp: 'CJA MCP', ready: true },
      { capability: 'AJO journey reporting', mcp: 'Marketing Agent MCP', ready: true },
      { capability: 'Audience creation/sharing', mcp: 'AEP + Target', ready: true },
    ],

    systemPromptExtras: `
## Princess Cruises — Customer-Specific Context

You are working with **Princess Cruises** (princess.com).

**Key Segments (know these by name — the native agent doesn't):**
- **Elite Voyager**: Platinum+ loyalty, 15+ sailings, highest LTV
- **Adventure Seeker**: Active couples 35-55, excursion-focused
- **Luxury Relaxer**: Premium suite guests, spa & dining, 55+
- **Family Explorer**: Multi-generational, kids club
- **First Timer**: Never cruised, value-conscious, needs reassurance

**Brand Governance:**
- All pricing: "from $X" with link to full terms (FTC requirement)
- MedallionClass claims must be substantiated
- No retired ship imagery
- Legal review SLA: 48h (escalation at 72h)

**Current Active Campaigns:**
- Alaska 2025 Early Bird (targeting Adventure Seekers)
- Mediterranean Luxury (targeting Luxury Relaxers)
- First Cruise Guarantee (targeting First Timers)`,
  },
};

/* ── Profile Management ── */

export function getActiveProfileId() {
  return localStorage.getItem(STORAGE_KEY) || 'aem-xsc';
}

export function setActiveProfile(profileId) {
  if (!PROFILES[profileId]) throw new Error(`Unknown profile: ${profileId}`);
  localStorage.setItem(STORAGE_KEY, profileId);
}

export function getActiveProfile() {
  return PROFILES[getActiveProfileId()] || PROFILES['aem-xsc'];
}

export function listProfiles() {
  return Object.values(PROFILES).map((p) => ({
    id: p.id,
    name: p.name,
    vertical: p.vertical,
    tier: p.tier,
  }));
}

/* ── AEM_ORG compat — builds the old AEM_ORG shape from active profile ── */
export function getOrgConfig() {
  const p = getActiveProfile();
  return {
    name: p.name,
    orgId: p.orgId,
    repo: p.repo,
    branch: p.branch,
    get previewOrigin() { return `https://${this.branch}--${this.repo}--${this.orgId.toLowerCase()}.aem.page`; },
    get liveOrigin() { return `https://${this.branch}--${this.repo}--${this.orgId.toLowerCase()}.aem.live`; },
    get daOrg() { return this.orgId; },
    get daRepo() { return this.repo; },
    tier: p.tier,
    env: p.env,
    services: p.services,
    entitlements: p.entitlements,
    mcpCapabilities: p.mcpCapabilities,
  };
}

/* ── System Prompt Builder — the core of Differentiator #1 ── */
export function buildCustomerContext() {
  const p = getActiveProfile();
  const parts = [];

  parts.push(`\n## Customer Profile: ${p.name}`);
  parts.push(`- **Vertical**: ${p.vertical}`);
  parts.push(`- **Tier**: ${p.tier}`);
  parts.push(`- **Environment**: ${p.env}`);
  parts.push(`- **Repository**: ${p.orgId}/${p.repo} (branch: ${p.branch})`);
  parts.push(`- **Services**: ${p.services.join(', ')}`);

  // Brand voice
  if (p.brandVoice) {
    parts.push(`\n### Brand Voice`);
    parts.push(`- **Tone**: ${p.brandVoice.tone}`);
    parts.push(`- **Style**: ${p.brandVoice.style}`);
    parts.push(`- **Keywords**: ${p.brandVoice.keywords.join(', ')}`);
    parts.push(`- **Avoid**: ${p.brandVoice.avoided.join(', ')}`);
    if (p.brandVoice.colorPalette) {
      parts.push(`- **Colors**: Primary ${p.brandVoice.colorPalette.primary}, Secondary ${p.brandVoice.colorPalette.secondary}, Accent ${p.brandVoice.colorPalette.accent}`);
    }
    if (p.brandVoice.typography) {
      parts.push(`- **Typography**: Headings: ${p.brandVoice.typography.heading}, Body: ${p.brandVoice.typography.body}`);
    }
  }

  // Segments
  if (p.segments?.length) {
    parts.push(`\n### Audience Segments`);
    p.segments.forEach((s) => {
      parts.push(`- **${s.name}** (${s.id}): ${s.description}`);
    });
  }

  // Approval chain
  if (p.approvalChain?.length) {
    parts.push(`\n### Approval Workflow`);
    p.approvalChain.forEach((step, i) => {
      const sla = step.sla ? ` [SLA: ${step.sla}]` : '';
      parts.push(`${i + 1}. **${step.role}** — ${step.action}${sla}`);
    });
  }

  // Legal rules
  if (p.legalSLA?.specialRules?.length) {
    parts.push(`\n### Legal & Compliance Rules`);
    p.legalSLA.specialRules.forEach((rule) => {
      parts.push(`- ${rule}`);
    });
  }

  // DAM taxonomy
  if (p.damTaxonomy) {
    parts.push(`\n### DAM Taxonomy`);
    parts.push(`- **Root**: ${p.damTaxonomy.root}`);
    parts.push(`- **Folders**: ${p.damTaxonomy.folders.join(', ')}`);
    parts.push(`- **Naming**: ${p.damTaxonomy.namingConvention}`);
  }

  // Customer-specific extras
  if (p.systemPromptExtras) {
    parts.push(p.systemPromptExtras);
  }

  return parts.join('\n');
}
