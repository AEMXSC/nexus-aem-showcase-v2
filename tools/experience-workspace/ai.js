/*
 * AI Client — Claude API (direct browser access) with tool use
 *
 * The AI has access to AEM MCP tools defined as Claude API tools.
 * When the AI calls a tool (e.g., get_aem_sites), we execute it client-side
 * by hitting real AEM endpoints. This is the same pattern as Claude.ai + MCP.
 *
 * Customer-specific system prompts via customer-profiles.js (Differentiator #1)
 */

import { buildCustomerContext, getActiveProfile } from './customer-profiles.js';
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

/* ── Adobe Agent Tool Definitions ── */
/* Each tool maps to a real Adobe AI Agent or MCP service. */
/* Tools with real endpoints execute live; others return contextual simulated data. */

const AEM_TOOLS = [

  /* ─── AEM Content MCP ─── */

  {
    name: 'get_aem_sites',
    description: 'List all AEM Edge Delivery sites available via AEM Content MCP.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_aem_site_pages',
    description: 'Get pages for an AEM site. Returns paths, titles, descriptions.',
    input_schema: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'Site identifier (e.g., "frescopa")' },
        org: { type: 'string', description: 'GitHub org' },
        repo: { type: 'string', description: 'Repository name' },
      },
      required: ['site_id'],
    },
  },
  {
    name: 'get_page_content',
    description: 'Fetch HTML content of an AEM EDS page via .plain.html endpoint.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full preview URL' },
        site_id: { type: 'string', description: 'Known site ID' },
        path: { type: 'string', description: 'Page path (e.g., "/coffee")' },
      },
      required: [],
    },
  },
  {
    name: 'copy_aem_page',
    description: 'AEM Content MCP — Copy an existing page to create a new one from a template. Returns the new page path and preview URL.',
    input_schema: {
      type: 'object',
      properties: {
        source_path: { type: 'string', description: 'Source page path to copy from (template)' },
        destination_path: { type: 'string', description: 'New page path' },
        title: { type: 'string', description: 'New page title' },
        site_id: { type: 'string', description: 'Target site' },
      },
      required: ['source_path', 'destination_path', 'title'],
    },
  },
  {
    name: 'patch_aem_page_content',
    description: 'AEM Content MCP — Update specific content on an AEM page. Patches hero image, headline, body copy, CTA, metadata, or any block content.',
    input_schema: {
      type: 'object',
      properties: {
        page_path: { type: 'string', description: 'Page path to update' },
        site_id: { type: 'string', description: 'Target site' },
        updates: {
          type: 'object',
          description: 'Content updates — keys are field names (hero_image, headline, body, cta_text, cta_url, metadata)',
        },
      },
      required: ['page_path', 'updates'],
    },
  },
  {
    name: 'create_aem_launch',
    description: 'AEM Content MCP — Create a Launch (review branch) for a page. Content goes to a staging launch, not live. Used as governance gate before publishing.',
    input_schema: {
      type: 'object',
      properties: {
        page_path: { type: 'string', description: 'Page to include in launch' },
        launch_name: { type: 'string', description: 'Launch name (e.g., "Q2 Wellness Campaign Review")' },
        site_id: { type: 'string', description: 'Target site' },
      },
      required: ['page_path', 'launch_name'],
    },
  },
  {
    name: 'promote_aem_launch',
    description: 'AEM Content MCP — Promote a Launch to publish the page live. Only call after governance approval.',
    input_schema: {
      type: 'object',
      properties: {
        launch_id: { type: 'string', description: 'Launch ID to promote' },
        site_id: { type: 'string', description: 'Target site' },
      },
      required: ['launch_id'],
    },
  },

  /* ─── Discovery Agent ─── */

  {
    name: 'search_dam_assets',
    description: 'Discovery Agent — Natural language search across AEM Assets (DAM). Finds approved images, videos, content fragments matching a query. Supports date filters, tags, folder paths, and exclusions. Returns asset paths, Dynamic Media delivery URLs, metadata, and approval status.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search (e.g., "approved lifestyle images of people enjoying coffee")' },
        asset_type: { type: 'string', description: 'Filter: image, video, document, content-fragment', enum: ['image', 'video', 'document', 'content-fragment', 'any'] },
        approved_only: { type: 'boolean', description: 'Only return approved/rights-safe assets (default true)' },
        limit: { type: 'number', description: 'Max results (default 6)' },
        date_range: { type: 'string', description: 'Date filter (e.g., "last 6 months", "last 12 months", "2025")' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (e.g., ["mountain", "hiking", "spring-campaign"])' },
        folder: { type: 'string', description: 'DAM folder path to search within (e.g., "/content/dam/frescopa")' },
        exclude: { type: 'string', description: 'Natural language exclusion (e.g., "exclude coffee machines", "no city backgrounds")' },
      },
      required: ['query'],
    },
  },

  /* ─── Governance Agent ─── */

  {
    name: 'run_governance_check',
    description: 'Governance Agent — Run brand compliance, metadata enforcement, accessibility (WCAG 2.1 AA), and DRM checks on a page or content. Returns pass/fail with detailed findings. Use before publishing.',
    input_schema: {
      type: 'object',
      properties: {
        page_path: { type: 'string', description: 'Page path to check' },
        site_id: { type: 'string', description: 'Site to check' },
        checks: {
          type: 'array',
          items: { type: 'string', enum: ['brand', 'accessibility', 'metadata', 'legal', 'seo', 'drm'] },
          description: 'Which checks to run (default: all)',
        },
      },
      required: ['page_path'],
    },
  },

  /* ─── Audience Agent ─── */

  {
    name: 'get_audience_segments',
    description: 'Audience Agent — List or create audience segments via AEP. Returns segment definitions, size estimates, and activation status.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'get'], description: 'Action to perform' },
        query: { type: 'string', description: 'Natural language segment description (for create) or segment name (for get)' },
      },
      required: ['action'],
    },
  },

  /* ─── Content Optimization Agent ─── */

  {
    name: 'create_content_variant',
    description: 'Content Optimization Agent — Generate a content variant for a specific audience segment. Uses Dynamic Media + OpenAPI for image transformations and AI for copy adaptation.',
    input_schema: {
      type: 'object',
      properties: {
        page_path: { type: 'string', description: 'Source page to create variant from' },
        segment: { type: 'string', description: 'Target audience segment' },
        changes: { type: 'string', description: 'Natural language description of desired changes' },
        site_id: { type: 'string', description: 'Target site' },
      },
      required: ['page_path', 'segment'],
    },
  },

  /* ─── Data Insights Agent (CJA) ─── */

  {
    name: 'get_analytics_insights',
    description: 'Data Insights Agent — Query CJA for page performance, audience behavior, conversion data. Returns metrics and AI-generated insights.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language analytics question (e.g., "what is the bounce rate for the homepage this month?")' },
        page_path: { type: 'string', description: 'Specific page to analyze (optional)' },
        date_range: { type: 'string', description: 'Date range (e.g., "last 30 days", "Q2 2025")' },
      },
      required: ['query'],
    },
  },

  /* ─── Journey Agent (AJO) ─── */

  {
    name: 'get_journey_status',
    description: 'Journey Agent — Get or create AJO journeys. Returns journey status, performance metrics, and activation details.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'status'], description: 'Action to perform' },
        journey_name: { type: 'string', description: 'Journey name to look up or create' },
        description: { type: 'string', description: 'Journey description (for create)' },
      },
      required: ['action'],
    },
  },

  /* ─── Workfront (WOA) ─── */

  {
    name: 'create_workfront_task',
    description: 'Workfront WOA — Create a review/approval task in Workfront. Attaches preview URL and governance report. Assigns to approval chain from customer profile.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description with governance findings' },
        preview_url: { type: 'string', description: 'Preview URL for the reviewer' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Task priority' },
        assignee: { type: 'string', description: 'Role or person to assign to (from approval chain)' },
      },
      required: ['title', 'description'],
    },
  },

  /* ─── Experience Production Agent ─── */

  {
    name: 'extract_brief_content',
    description: 'Experience Production Agent (via Acrobat MCP) — Extract structured content from an uploaded brief (PDF/Word). Returns campaign name, headline, body copy, CTA, target audience, key messages, tone, and deadline.',
    input_schema: {
      type: 'object',
      properties: {
        brief_text: { type: 'string', description: 'Raw text content from the brief document' },
        file_name: { type: 'string', description: 'Original file name' },
      },
      required: ['brief_text'],
    },
  },

  /* ─── Target Agent (A/B Testing & Personalization) ─── */

  {
    name: 'create_ab_test',
    description: 'Target Agent — Create an A/B test (Experience Targeting activity) for a page. Defines control and variant experiences, allocates traffic, and sets success metrics.',
    input_schema: {
      type: 'object',
      properties: {
        page_path: { type: 'string', description: 'Page to test' },
        test_name: { type: 'string', description: 'Activity name' },
        variants: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of variant objects: { name, changes, traffic_pct }',
        },
        success_metric: { type: 'string', description: 'Primary goal (e.g., "click", "conversion", "revenue")', enum: ['click', 'conversion', 'revenue', 'engagement', 'page_views'] },
        duration_days: { type: 'number', description: 'Test duration in days (default 14)' },
      },
      required: ['page_path', 'test_name'],
    },
  },
  {
    name: 'get_personalization_offers',
    description: 'Target Agent — Retrieve personalization offers (JSON/HTML) for a visitor based on audience segment, location, and context. Returns the decisioned offer with fallback.',
    input_schema: {
      type: 'object',
      properties: {
        page_path: { type: 'string', description: 'Page requesting personalization' },
        segment: { type: 'string', description: 'Visitor audience segment' },
        location: { type: 'string', description: 'Mbox/location name on the page (e.g., "hero-cta", "promo-banner")' },
      },
      required: ['page_path'],
    },
  },

  /* ─── AEP Real-time Profile Agent ─── */

  {
    name: 'get_customer_profile',
    description: 'AEP Agent — Look up a real-time customer profile from Adobe Experience Platform. Returns merged profile with identity graph, segment memberships, recent events, and consent status.',
    input_schema: {
      type: 'object',
      properties: {
        identity: { type: 'string', description: 'Customer identity value (email, ECID, CRM ID)' },
        identity_namespace: { type: 'string', description: 'Namespace (e.g., "email", "ecid", "crmId")', enum: ['email', 'ecid', 'crmId', 'phone', 'loyaltyId'] },
        include: {
          type: 'array',
          items: { type: 'string', enum: ['segments', 'events', 'consent', 'identity_graph'] },
          description: 'What to include in response (default: all)',
        },
      },
      required: ['identity'],
    },
  },

  /* ─── Firefly Agent (Generative AI for Assets) ─── */

  {
    name: 'generate_image_variations',
    description: 'Firefly Agent — Generate image variations using Adobe Firefly generative AI. Creates alternate versions of a source image with style, mood, or composition changes. Returns delivery URLs for generated assets.',
    input_schema: {
      type: 'object',
      properties: {
        source_asset: { type: 'string', description: 'Source image path in DAM or delivery URL' },
        prompt: { type: 'string', description: 'Natural language description of desired variations (e.g., "warmer tones, lifestyle setting, morning light")' },
        count: { type: 'number', description: 'Number of variations to generate (1-4, default 3)' },
        style: { type: 'string', description: 'Style preset', enum: ['photo', 'art', 'graphic', 'none'] },
        aspect_ratio: { type: 'string', description: 'Output aspect ratio', enum: ['1:1', '4:3', '16:9', '9:16', 'original'] },
      },
      required: ['prompt'],
    },
  },

  /* ─── Development Agent (Cloud Manager) ─── */

  {
    name: 'get_pipeline_status',
    description: 'Development Agent (Cloud Manager) — Get deployment pipeline status for an AEM environment. Returns pipeline runs, build status, deployment targets, and environment health. Include failed pipelines and error details.',
    input_schema: {
      type: 'object',
      properties: {
        environment: { type: 'string', description: 'Environment name', enum: ['dev', 'stage', 'prod', 'all'] },
        pipeline_id: { type: 'string', description: 'Specific pipeline ID (optional)' },
        status_filter: { type: 'string', description: 'Filter by status', enum: ['all', 'failed', 'running', 'completed'] },
        program_name: { type: 'string', description: 'Cloud Manager program name (e.g., "Main Program")' },
      },
      required: [],
    },
  },
  {
    name: 'analyze_pipeline_failure',
    description: 'Development Agent — Analyze the most recent failed Cloud Manager pipeline. Identifies root cause, surfaces relevant logs, and proposes remediations.',
    input_schema: {
      type: 'object',
      properties: {
        pipeline_id: { type: 'string', description: 'Pipeline ID to analyze (default: most recent failed)' },
        program_name: { type: 'string', description: 'Cloud Manager program name' },
        include_logs: { type: 'boolean', description: 'Include build/deploy log excerpts (default true)' },
      },
      required: [],
    },
  },

  /* ─── Acrobat MCP (PDF Services) ─── */

  {
    name: 'extract_pdf_content',
    description: 'Acrobat MCP — Extract structured content from a PDF document. Returns text, tables, images, and document structure. Uses Adobe PDF Services API for high-fidelity extraction.',
    input_schema: {
      type: 'object',
      properties: {
        file_name: { type: 'string', description: 'PDF file name' },
        content_text: { type: 'string', description: 'Raw text content from PDF (pre-extracted client-side)' },
        extract_tables: { type: 'boolean', description: 'Extract tables as structured data (default true)' },
        extract_images: { type: 'boolean', description: 'Extract image metadata and alt text (default true)' },
      },
      required: ['file_name'],
    },
  },

  /* ─── Experience Production Agent (extended) ─── */

  {
    name: 'translate_page',
    description: 'Experience Production Agent — Translate a page to a target language and place it in the correct language tree. Uses AEM translation framework with AI-assisted translation.',
    input_schema: {
      type: 'object',
      properties: {
        page_url: { type: 'string', description: 'Source page URL or path to translate' },
        target_language: { type: 'string', description: 'Target language code (e.g., "es", "fr", "de", "ja", "pt-br")' },
        language_tree_path: { type: 'string', description: 'Target path in language tree (e.g., "/content/site/es/")' },
        site_id: { type: 'string', description: 'Site identifier' },
      },
      required: ['page_url', 'target_language'],
    },
  },
  {
    name: 'create_form',
    description: 'Experience Production Agent — Create or import a form using generative AI. Generates an AEM Edge Delivery form with fields, validation, and submit action based on a natural language description.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Natural language description of the form (e.g., "contact form with name, email, phone, and message fields")' },
        form_type: { type: 'string', description: 'Form type', enum: ['contact', 'lead-gen', 'survey', 'registration', 'newsletter', 'custom'] },
        fields: {
          type: 'array',
          items: { type: 'object' },
          description: 'Optional explicit field definitions: [{ name, type, label, required, options }]',
        },
        submit_action: { type: 'string', description: 'Form submit destination (e.g., "email", "spreadsheet", "api-endpoint")' },
        page_path: { type: 'string', description: 'Page to place the form on' },
      },
      required: ['description'],
    },
  },
  {
    name: 'modernize_content',
    description: 'Experience Production Agent — Audit and modernize pages to match the latest design system. Returns a modernization report with affected components, suggested updates, and compliance status. Supports dry-run mode.',
    input_schema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Site base URL or path prefix to audit' },
        design_system: { type: 'string', description: 'Target design system name (e.g., "Frescopa design system")' },
        scope: { type: 'string', description: 'Scope of audit', enum: ['single-page', 'section', 'full-site'] },
        dry_run: { type: 'boolean', description: 'If true, returns report only without making changes (default true)' },
      },
      required: ['site_url'],
    },
  },

  /* ─── Governance Agent (extended) ─── */

  {
    name: 'get_brand_guidelines',
    description: 'Governance Agent — Retrieve brand guidelines for the current customer/site. Returns brand voice, color palette, typography rules, logo usage, imagery guidelines, and tone requirements.',
    input_schema: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'Site to get guidelines for' },
        category: { type: 'string', description: 'Specific guideline category', enum: ['all', 'voice', 'colors', 'typography', 'imagery', 'logo', 'tone'] },
      },
      required: [],
    },
  },
  {
    name: 'check_asset_expiry',
    description: 'Governance Agent — Check for assets nearing or past their expiration dates. Returns assets with expiry status, DRM flags, and recommended actions.',
    input_schema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'DAM folder path to check (e.g., "/content/dam/2026/09/fleetraven71517")' },
        days_until_expiry: { type: 'number', description: 'Show assets expiring within N days (default 30)' },
        include_expired: { type: 'boolean', description: 'Include already-expired assets (default true)' },
      },
      required: [],
    },
  },
  {
    name: 'audit_content',
    description: 'Governance Agent — Audit content for staleness, compliance, and publishing status. Finds content fragments, pages, or assets that have not been updated within a specified period. Reports publishing status, last modified dates, and ownership.',
    input_schema: {
      type: 'object',
      properties: {
        content_type: { type: 'string', description: 'What to audit', enum: ['content-fragments', 'pages', 'assets', 'all'] },
        stale_days: { type: 'number', description: 'Content not updated in N days (default 90)' },
        status_filter: { type: 'string', description: 'Filter by publishing status', enum: ['published', 'unpublished', 'all'] },
        path: { type: 'string', description: 'Content path to scope the audit' },
      },
      required: ['content_type'],
    },
  },

  /* ─── Content Optimization Agent (extended) ─── */

  {
    name: 'transform_image',
    description: 'Content Optimization Agent — Transform an image with crop, mirror, resize, rotate, format conversion, or quality adjustment. Uses Dynamic Media + OpenAPI for non-destructive transforms.',
    input_schema: {
      type: 'object',
      properties: {
        asset_path: { type: 'string', description: 'Source asset DAM path or delivery URL' },
        operations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Operations to apply in order: "crop:1080x1080", "mirror:horizontal", "mirror:vertical", "rotate:90", "resize:1920x1080", "format:webp", "quality:90"',
        },
        smart_crop: { type: 'string', description: 'Named smart crop profile (e.g., "square", "portrait", "landscape", "vertical")' },
        output_format: { type: 'string', description: 'Output format', enum: ['jpeg', 'png', 'webp', 'tiff', 'original'] },
        quality: { type: 'number', description: 'Output quality 1-100 (default 85)' },
      },
      required: ['asset_path'],
    },
  },
  {
    name: 'create_image_renditions',
    description: 'Content Optimization Agent — Generate multiple image renditions for different channels and formats in batch. Creates social media, web, mobile, and print renditions from a single source asset.',
    input_schema: {
      type: 'object',
      properties: {
        asset_path: { type: 'string', description: 'Source asset DAM path or delivery URL' },
        renditions: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of rendition specs: [{ name, width, height, format, quality, channel }]',
        },
        channels: {
          type: 'array',
          items: { type: 'string', enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'web-banner', 'mobile', 'print', 'email'] },
          description: 'Auto-generate standard sizes for these channels',
        },
      },
      required: ['asset_path'],
    },
  },

  /* ─── Discovery Agent (extended) ─── */

  {
    name: 'add_to_collection',
    description: 'Discovery Agent — Add assets to a DAM collection for campaign organization. Creates the collection if it does not exist.',
    input_schema: {
      type: 'object',
      properties: {
        collection_name: { type: 'string', description: 'Collection name (e.g., "Spring 2026 Campaign")' },
        asset_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of asset paths to add to the collection',
        },
        create_if_missing: { type: 'boolean', description: 'Create collection if it does not exist (default true)' },
      },
      required: ['collection_name', 'asset_paths'],
    },
  },
];

/* ── Tool → Agent Name Mapping (for UI badges) ── */
export const TOOL_AGENT_MAP = {
  // AEM Content MCP
  get_aem_sites: 'AEM Content MCP',
  get_aem_site_pages: 'AEM Content MCP',
  get_page_content: 'AEM Content MCP',
  copy_aem_page: 'AEM Content MCP',
  patch_aem_page_content: 'AEM Content MCP',
  create_aem_launch: 'AEM Content MCP',
  promote_aem_launch: 'AEM Content MCP',
  // Adobe AI Agents
  search_dam_assets: 'Discovery Agent',
  run_governance_check: 'Governance Agent',
  get_audience_segments: 'Audience Agent',
  create_content_variant: 'Content Optimization Agent',
  get_analytics_insights: 'Data Insights Agent',
  get_journey_status: 'Journey Agent',
  create_workfront_task: 'Workfront WOA',
  extract_brief_content: 'Experience Production Agent',
  // Target Agent
  create_ab_test: 'Target Agent',
  get_personalization_offers: 'Target Agent',
  // AEP Real-time Profile
  get_customer_profile: 'AEP Agent',
  // Firefly
  generate_image_variations: 'Firefly Agent',
  // Development / Cloud Manager
  get_pipeline_status: 'Development Agent',
  analyze_pipeline_failure: 'Development Agent',
  // Acrobat MCP
  extract_pdf_content: 'Acrobat MCP',
  // Experience Production Agent (extended)
  translate_page: 'Experience Production Agent',
  create_form: 'Experience Production Agent',
  modernize_content: 'Experience Production Agent',
  // Governance Agent (extended)
  get_brand_guidelines: 'Governance Agent',
  check_asset_expiry: 'Governance Agent',
  audit_content: 'Governance Agent',
  // Content Optimization Agent (extended)
  transform_image: 'Content Optimization Agent',
  create_image_renditions: 'Content Optimization Agent',
  // Discovery Agent (extended)
  add_to_collection: 'Discovery Agent',
};

/* ── Client-Side Tool Executor ── */
/* Real endpoints for AEM Content MCP; contextual simulated data for other agents */

async function executeTool(name, input) {
  const profile = getActiveProfile();

  switch (name) {

    /* ─── AEM Content MCP (real endpoints) ─── */

    case 'get_aem_sites': {
      const sites = listKnownSites();
      return JSON.stringify({ sites, count: sites.length }, null, 2);
    }

    case 'get_aem_site_pages': {
      const site = resolveSite(input.site_id);
      if (!site) {
        if (input.org && input.repo) {
          const origin = `https://main--${input.repo}--${input.org}.aem.page`;
          try {
            const resp = await fetch(`${origin}/sitemap.xml`);
            if (resp.ok) {
              const xml = await resp.text();
              const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
              return JSON.stringify({ name: `${input.org}/${input.repo}`, preview: origin, pages: urls.slice(0, 20).map((u) => ({ url: u, path: new URL(u).pathname })) }, null, 2);
            }
          } catch { /* fallback */ }
          return JSON.stringify({ name: `${input.org}/${input.repo}`, preview: origin, pages: [{ path: '/index', title: 'Homepage' }] });
        }
        return JSON.stringify({ error: `Site not found: ${input.site_id}. Use get_aem_sites to list available sites.` });
      }
      return JSON.stringify({ name: site.name, siteId: site.siteId, org: site.org, repo: site.repo, preview: site.previewOrigin, live: site.liveOrigin, vertical: site.vertical, blocks: site.blocks, pages: site.pages }, null, 2);
    }

    case 'get_page_content': {
      let pageUrl = input.url;
      if (!pageUrl && input.site_id && input.path) {
        const site = resolveSite(input.site_id);
        if (site) pageUrl = `${site.previewOrigin}${input.path}`;
      }
      if (!pageUrl) return JSON.stringify({ error: 'Provide url, or site_id + path.' });

      const plainUrl = pageUrl.endsWith('.plain.html') ? pageUrl : pageUrl.replace(/\/?$/, '.plain.html');
      try {
        const resp = await fetch(plainUrl);
        if (resp.ok) {
          const html = await resp.text();
          return html.length > 15000 ? html.slice(0, 15000) + '\n\n[... truncated]' : html;
        }
        return JSON.stringify({ error: `HTTP ${resp.status} fetching ${plainUrl}` });
      } catch (e) {
        return JSON.stringify({ error: `Fetch failed: ${e.message}` });
      }
    }

    case 'copy_aem_page': {
      const pageId = `page-${Date.now().toString(36)}`;
      const previewBase = profile.orgId ? `https://main--${profile.repo}--${profile.orgId.toLowerCase()}.aem.page` : 'https://main--site--org.aem.page';
      return JSON.stringify({
        status: 'created',
        page_id: pageId,
        path: input.destination_path,
        title: input.title,
        copied_from: input.source_path,
        preview_url: `${previewBase}${input.destination_path}`,
        message: `Page created at ${input.destination_path} from template ${input.source_path}`,
      }, null, 2);
    }

    case 'patch_aem_page_content': {
      const fields = Object.keys(input.updates || {});
      return JSON.stringify({
        status: 'updated',
        page_path: input.page_path,
        updated_fields: fields,
        field_count: fields.length,
        message: `Updated ${fields.length} field(s) on ${input.page_path}: ${fields.join(', ')}`,
      }, null, 2);
    }

    case 'create_aem_launch': {
      const launchId = `launch-${Date.now().toString(36)}`;
      const previewBase = profile.orgId ? `https://main--${profile.repo}--${profile.orgId.toLowerCase()}.aem.page` : 'https://main--site--org.aem.page';
      return JSON.stringify({
        status: 'created',
        launch_id: launchId,
        launch_name: input.launch_name,
        pages: [input.page_path],
        preview_url: `${previewBase}${input.page_path}?launch=${launchId}`,
        state: 'open',
        message: `Launch "${input.launch_name}" created. Page is in review, not live. Send for governance check before promoting.`,
      }, null, 2);
    }

    case 'promote_aem_launch': {
      return JSON.stringify({
        status: 'promoted',
        launch_id: input.launch_id,
        message: `Launch ${input.launch_id} promoted. Page is now live.`,
        published_at: new Date().toISOString(),
      }, null, 2);
    }

    /* ─── Discovery Agent ─── */

    case 'search_dam_assets': {
      const dam = profile.damTaxonomy || { root: '/content/dam', folders: ['images', 'brand'], namingConvention: 'asset-name' };
      const limit = input.limit || 6;
      const query = input.query || '';
      const type = input.asset_type || 'image';
      const searchFolder = input.folder || dam.root;
      const tags = input.tags || [];
      const dateRange = input.date_range || '';
      const exclude = input.exclude || '';

      // Generate contextual asset results based on the query and customer DAM
      const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      // Remove excluded keywords from results
      const excludeWords = exclude.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const filteredKeywords = keywords.filter((k) => !excludeWords.some((e) => k.includes(e)));
      const useKeywords = filteredKeywords.length > 0 ? filteredKeywords : (keywords.length > 0 ? keywords : ['asset']);

      const assets = [];
      for (let i = 0; i < limit; i++) {
        const folder = dam.folders[i % dam.folders.length];
        const keyword = useKeywords[i % useKeywords.length] || 'asset';
        const tagSuffix = tags.length > 0 ? `-${tags[i % tags.length]}` : '';
        const assetName = `${keyword}-${folder}${tagSuffix}-${String(i + 1).padStart(2, '0')}`;
        const dmDeliveryUrl = `https://delivery-p12345-e67890.adobeaemcloud.com/adobe/dynamicmedia/deliver/${assetName}/asset-${i + 1}.webp?width=1200&quality=85`;

        // Date within range
        const maxAge = dateRange.includes('6 month') ? 180 : dateRange.includes('12 month') ? 365 : 90;
        const uploadDate = new Date(Date.now() - Math.random() * maxAge * 86400000);

        assets.push({
          path: `${searchFolder}/${folder}/${assetName}.jpg`,
          name: `${assetName}.jpg`,
          title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} — ${folder}`,
          type,
          format: 'image/jpeg',
          dimensions: { width: 2400, height: 1600 },
          delivery_url: dmDeliveryUrl,
          dynamic_media_url: dmDeliveryUrl,
          status: 'approved',
          rights_safe: true,
          tags: [...tags, keyword, folder],
          metadata: {
            dc_title: `${keyword} ${folder} asset`,
            dc_description: `Approved ${type} asset matching: ${query.slice(0, 80)}`,
            dam_status: 'approved',
            dam_expiry: 'none',
            upload_date: uploadDate.toISOString().split('T')[0],
          },
          last_modified: uploadDate.toISOString().split('T')[0],
        });
      }

      return JSON.stringify({
        query: input.query,
        total_results: assets.length,
        filter: {
          type,
          approved_only: input.approved_only !== false,
          folder: searchFolder,
          tags: tags.length > 0 ? tags : undefined,
          date_range: dateRange || undefined,
          excluded: exclude || undefined,
        },
        assets,
        message: `Found ${assets.length} approved ${type}(s) matching "${query.slice(0, 50)}"${tags.length > 0 ? ` tagged [${tags.join(', ')}]` : ''}${dateRange ? ` from ${dateRange}` : ''}${exclude ? ` (excluding: ${exclude})` : ''}`,
      }, null, 2);
    }

    /* ─── Governance Agent ─── */

    case 'run_governance_check': {
      const checks = input.checks || ['brand', 'accessibility', 'metadata', 'legal', 'seo', 'drm'];
      const legalRules = profile.legalSLA?.specialRules || [];
      const brandVoice = profile.brandVoice || {};

      const results = {};
      const findings = [];

      checks.forEach((check) => {
        switch (check) {
          case 'brand':
            results.brand = { status: 'pass', score: 92 };
            if (brandVoice.colorPalette) findings.push({ check: 'brand', severity: 'info', message: `Brand colors verified: ${brandVoice.colorPalette.primary}, ${brandVoice.colorPalette.secondary}` });
            findings.push({ check: 'brand', severity: 'pass', message: 'Brand voice tone matches profile guidelines' });
            break;
          case 'accessibility':
            results.accessibility = { status: 'warn', score: 78 };
            findings.push({ check: 'accessibility', severity: 'warn', message: 'Verify all images have descriptive alt text' });
            findings.push({ check: 'accessibility', severity: 'warn', message: 'Check color contrast ratios meet 4.5:1 minimum' });
            findings.push({ check: 'accessibility', severity: 'pass', message: 'Heading hierarchy is correct (H1→H2→H3)' });
            break;
          case 'metadata':
            results.metadata = { status: 'pass', score: 95 };
            findings.push({ check: 'metadata', severity: 'pass', message: 'Page title, description, and OG tags present' });
            findings.push({ check: 'metadata', severity: 'pass', message: 'Canonical URL configured' });
            break;
          case 'legal':
            results.legal = { status: legalRules.length > 0 ? 'review' : 'pass', score: 85 };
            if (legalRules.length > 0) {
              findings.push({ check: 'legal', severity: 'review', message: `${legalRules.length} customer-specific legal rules require manual review` });
              legalRules.slice(0, 3).forEach((rule) => findings.push({ check: 'legal', severity: 'info', message: `Rule: ${rule}` }));
            }
            findings.push({ check: 'legal', severity: 'pass', message: 'Privacy policy and terms links present' });
            break;
          case 'seo':
            results.seo = { status: 'pass', score: 90 };
            findings.push({ check: 'seo', severity: 'pass', message: 'Meta description within 160 chars' });
            findings.push({ check: 'seo', severity: 'pass', message: 'Image optimization (WebP with fallbacks)' });
            break;
          case 'drm':
            results.drm = { status: 'pass', score: 100 };
            findings.push({ check: 'drm', severity: 'pass', message: 'All assets from approved DAM sources' });
            break;
        }
      });

      const overallScore = Math.round(Object.values(results).reduce((sum, r) => sum + r.score, 0) / Object.values(results).length);
      const hasBlocking = Object.values(results).some((r) => r.status === 'fail');

      return JSON.stringify({
        page_path: input.page_path,
        overall_score: overallScore,
        overall_status: hasBlocking ? 'blocked' : overallScore >= 90 ? 'approved' : 'approved_with_warnings',
        checks: results,
        findings,
        approval_chain: profile.approvalChain?.map((a) => a.role) || [],
        recommendation: hasBlocking
          ? 'Governance check BLOCKED. Fix critical issues before promoting launch.'
          : `Governance score ${overallScore}/100. Safe to proceed with review.`,
      }, null, 2);
    }

    /* ─── Audience Agent ─── */

    case 'get_audience_segments': {
      const segments = profile.segments || [];

      if (input.action === 'list') {
        return JSON.stringify({
          segments: segments.map((s, i) => ({
            ...s,
            size_estimate: Math.floor(50000 + Math.random() * 200000),
            status: 'active',
            activation: i < 2 ? 'AEP + Target' : 'AEP only',
          })),
          total: segments.length,
        }, null, 2);
      }

      if (input.action === 'create') {
        const segId = `seg-${Date.now().toString(36)}`;
        return JSON.stringify({
          status: 'created',
          segment: {
            id: segId,
            name: input.query || 'New Segment',
            description: `AI-generated segment: ${input.query}`,
            estimated_size: Math.floor(30000 + Math.random() * 100000),
            status: 'processing',
            activation: 'AEP (ready for Target sharing)',
          },
          message: `Segment "${input.query}" created in AEP. Processing audience data...`,
        }, null, 2);
      }

      // 'get' — return matching segment
      const match = segments.find((s) => s.name.toLowerCase().includes((input.query || '').toLowerCase()) || s.id === input.query);
      if (match) {
        return JSON.stringify({ segment: { ...match, size_estimate: Math.floor(50000 + Math.random() * 200000), status: 'active' } }, null, 2);
      }
      return JSON.stringify({ error: `Segment not found: "${input.query}". Use action "list" to see available segments.` });
    }

    /* ─── Content Optimization Agent ─── */

    case 'create_content_variant': {
      const variantId = `variant-${Date.now().toString(36)}`;
      return JSON.stringify({
        status: 'created',
        variant_id: variantId,
        source_page: input.page_path,
        target_segment: input.segment,
        changes_applied: input.changes || 'Segment-optimized hero image, CTA copy, and content priority',
        dynamic_media: {
          hero_rendition: `https://delivery-p12345-e67890.adobeaemcloud.com/adobe/dynamicmedia/deliver/variant-hero/optimized.webp?width=1440&crop=16:9&quality=85`,
          note: 'Image resized and cropped via Dynamic Media + OpenAPI for segment-specific visual language',
        },
        preview_url: `https://main--${profile.repo || 'site'}--${(profile.orgId || 'org').toLowerCase()}.aem.page${input.page_path}?variant=${variantId}`,
        message: `Content variant created for "${input.segment}" segment. Hero image transformed via Dynamic Media, copy optimized for segment preferences.`,
      }, null, 2);
    }

    /* ─── Data Insights Agent (CJA) ─── */

    case 'get_analytics_insights': {
      const dateRange = input.date_range || 'last 30 days';
      return JSON.stringify({
        query: input.query,
        date_range: dateRange,
        page: input.page_path || 'site-wide',
        metrics: {
          page_views: Math.floor(10000 + Math.random() * 50000),
          unique_visitors: Math.floor(5000 + Math.random() * 25000),
          bounce_rate: `${(25 + Math.random() * 20).toFixed(1)}%`,
          avg_time_on_page: `${(45 + Math.random() * 120).toFixed(0)}s`,
          conversion_rate: `${(1.5 + Math.random() * 4).toFixed(2)}%`,
          top_entry_source: 'organic search',
        },
        ai_insights: [
          `Traffic is ${Math.random() > 0.5 ? 'up' : 'stable'} compared to previous period`,
          `Mobile accounts for ${(55 + Math.random() * 15).toFixed(0)}% of visits`,
          `Hero CTA click-through rate is ${(8 + Math.random() * 7).toFixed(1)}% — ${Math.random() > 0.5 ? 'above' : 'near'} industry average`,
        ],
        data_view: profile.entitlements?.cja?.note || 'default data view',
        source: 'CJA Data Insights Agent',
      }, null, 2);
    }

    /* ─── Journey Agent (AJO) ─── */

    case 'get_journey_status': {
      if (input.action === 'list') {
        return JSON.stringify({
          journeys: [
            { name: 'Welcome Series', status: 'active', messages_sent: 12450, open_rate: '34.2%', conversion: '8.1%' },
            { name: 'Re-engagement Campaign', status: 'active', messages_sent: 8200, open_rate: '28.7%', conversion: '5.3%' },
            { name: 'Post-Purchase Follow-up', status: 'draft', messages_sent: 0, open_rate: 'N/A', conversion: 'N/A' },
          ],
          source: 'AJO via Marketing Agent MCP',
        }, null, 2);
      }

      if (input.action === 'create') {
        return JSON.stringify({
          status: 'created',
          journey: {
            id: `journey-${Date.now().toString(36)}`,
            name: input.journey_name || 'New Journey',
            description: input.description || '',
            state: 'draft',
            estimated_audience: Math.floor(5000 + Math.random() * 50000),
          },
          message: `Journey "${input.journey_name}" created in draft. Configure triggers and messages, then activate.`,
        }, null, 2);
      }

      return JSON.stringify({
        journey: { name: input.journey_name || 'Unknown', status: 'active', messages_sent: Math.floor(1000 + Math.random() * 20000) },
      }, null, 2);
    }

    /* ─── Workfront WOA ─── */

    case 'create_workfront_task': {
      const taskId = `WF-${Date.now().toString(36).toUpperCase()}`;
      const chain = profile.approvalChain || [];
      const assignee = input.assignee || chain[0]?.role || 'Content Reviewer';
      const sla = chain.find((c) => c.role === assignee)?.sla || '24h';

      return JSON.stringify({
        status: 'created',
        task_id: taskId,
        title: input.title,
        assignee,
        priority: input.priority || 'normal',
        sla,
        preview_url: input.preview_url || '',
        project: `${profile.name} — Content Operations`,
        approval_chain: chain.map((c) => c.role),
        message: `Workfront task ${taskId} created: "${input.title}" — assigned to ${assignee} (SLA: ${sla})`,
      }, null, 2);
    }

    /* ─── Experience Production Agent ─── */

    case 'extract_brief_content': {
      const text = input.brief_text || '';
      return JSON.stringify({
        status: 'extracted',
        source: input.file_name || 'uploaded brief',
        char_count: text.length,
        structure: {
          campaign_name: '(extracted by AI from brief content)',
          headline: '(extracted by AI)',
          body_copy: '(extracted by AI)',
          cta: '(extracted by AI)',
          target_audience: '(extracted by AI)',
          key_messages: '(extracted by AI)',
          tone: '(extracted by AI)',
          deadline: '(extracted by AI)',
        },
        brief_text: text.slice(0, 10000),
        message: `Brief content extracted (${text.length} characters). AI will parse structured fields from the content.`,
      }, null, 2);
    }

    /* ─── Target Agent (A/B Testing & Personalization) ─── */

    case 'create_ab_test': {
      const activityId = `XT-${Date.now().toString(36).toUpperCase()}`;
      const variants = input.variants || [
        { name: 'Control', changes: 'Original content', traffic_pct: 50 },
        { name: 'Variant B', changes: 'Modified hero CTA and headline', traffic_pct: 50 },
      ];
      const duration = input.duration_days || 14;
      const metric = input.success_metric || 'conversion';

      return JSON.stringify({
        status: 'created',
        activity_id: activityId,
        activity_type: 'A/B Test',
        name: input.test_name,
        page: input.page_path,
        variants: variants.map((v, i) => ({
          ...v,
          experience_id: `exp-${i}`,
          traffic_allocation: v.traffic_pct || Math.round(100 / variants.length),
        })),
        success_metric: metric,
        duration_days: duration,
        estimated_visitors: Math.floor(2000 + Math.random() * 15000),
        statistical_significance_target: '95%',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + duration * 86400000).toISOString().split('T')[0],
        reporting_source: 'CJA (Customer Journey Analytics)',
        message: `A/B test "${input.test_name}" created with ${variants.length} variants. Traffic split active. Results in ~${duration} days at 95% significance.`,
      }, null, 2);
    }

    case 'get_personalization_offers': {
      const segment = input.segment || 'all-visitors';
      const location = input.location || 'hero-cta';
      const offers = [
        {
          offer_id: `offer-${Date.now().toString(36)}`,
          name: `${segment} — ${location} personalization`,
          type: 'html',
          content: `Personalized ${location} content for "${segment}" segment`,
          priority: 1,
          segment_match: segment,
          dynamic_media_asset: `https://delivery-p12345-e67890.adobeaemcloud.com/adobe/dynamicmedia/deliver/personalized-${location}/offer.webp?width=1200&quality=85`,
        },
        {
          offer_id: 'offer-fallback',
          name: 'Default fallback',
          type: 'html',
          content: `Default ${location} content (no segment match)`,
          priority: 0,
          segment_match: 'all-visitors',
        },
      ];

      return JSON.stringify({
        page: input.page_path,
        location,
        decisioned_offer: offers[0],
        fallback: offers[1],
        decision_reason: `Visitor matched segment "${segment}" — serving personalized offer`,
        response_time_ms: Math.floor(15 + Math.random() * 30),
        source: 'Adobe Target — Experience Decisioning',
      }, null, 2);
    }

    /* ─── AEP Real-time Profile Agent ─── */

    case 'get_customer_profile': {
      const namespace = input.identity_namespace || 'email';
      const segments = profile.segments || [];
      const includeSet = new Set(input.include || ['segments', 'events', 'consent', 'identity_graph']);

      const profileData = {
        identity: input.identity,
        namespace,
        profile_id: `prof-${Date.now().toString(36)}`,
        merge_policy: 'timestamp-ordered',
        last_updated: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
        attributes: {
          firstName: 'Sample',
          lastName: 'Customer',
          email: namespace === 'email' ? input.identity : 'sample@example.com',
          lifetime_value: `$${(500 + Math.random() * 5000).toFixed(2)}`,
          loyalty_tier: ['Bronze', 'Silver', 'Gold', 'Platinum'][Math.floor(Math.random() * 4)],
          preferred_channel: ['email', 'push', 'sms', 'web'][Math.floor(Math.random() * 4)],
        },
      };

      if (includeSet.has('segments')) {
        profileData.segment_memberships = segments.slice(0, 4).map((s) => ({
          segment_id: s.id,
          name: s.name,
          status: 'realized',
          realized_at: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
        }));
      }

      if (includeSet.has('events')) {
        profileData.recent_events = [
          { event: 'page_view', page: '/index', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { event: 'product_view', page: '/products/featured', timestamp: new Date(Date.now() - 7200000).toISOString() },
          { event: 'email_open', campaign: 'Welcome Series', timestamp: new Date(Date.now() - 86400000).toISOString() },
        ];
      }

      if (includeSet.has('consent')) {
        profileData.consent = {
          marketing_email: 'opt-in',
          marketing_push: 'opt-in',
          marketing_sms: 'opt-out',
          analytics: 'opt-in',
          personalization: 'opt-in',
        };
      }

      if (includeSet.has('identity_graph')) {
        profileData.identity_graph = {
          identities: [
            { namespace: 'email', value: profileData.attributes.email },
            { namespace: 'ecid', value: `ECID-${Math.random().toString(36).slice(2, 14)}` },
            { namespace: 'crmId', value: `CRM-${Math.floor(100000 + Math.random() * 900000)}` },
          ],
          link_count: 3,
        };
      }

      return JSON.stringify({
        profile: profileData,
        source: 'AEP Real-time Customer Data Platform',
        sandbox: 'prod',
      }, null, 2);
    }

    /* ─── Firefly Agent (Generative AI) ─── */

    case 'generate_image_variations': {
      const count = Math.min(input.count || 3, 4);
      const style = input.style || 'photo';
      const ratio = input.aspect_ratio || 'original';
      const variations = [];

      for (let i = 0; i < count; i++) {
        const varId = `ff-${Date.now().toString(36)}-${i}`;
        variations.push({
          variation_id: varId,
          delivery_url: `https://delivery-p12345-e67890.adobeaemcloud.com/adobe/dynamicmedia/deliver/firefly-${varId}/generated.webp?width=1440&quality=90`,
          thumbnail_url: `https://delivery-p12345-e67890.adobeaemcloud.com/adobe/dynamicmedia/deliver/firefly-${varId}/thumb.webp?width=400&quality=80`,
          style_preset: style,
          aspect_ratio: ratio,
          prompt_used: input.prompt,
          confidence_score: (0.85 + Math.random() * 0.14).toFixed(2),
          dam_path: `/content/dam/generated/firefly/${varId}.webp`,
          status: 'approved_for_review',
        });
      }

      return JSON.stringify({
        status: 'generated',
        source_asset: input.source_asset || '(generated from prompt)',
        prompt: input.prompt,
        variations,
        total_generated: count,
        credits_used: count,
        message: `${count} Firefly variation(s) generated. Assets saved to DAM for review. Use search_dam_assets to find them or patch_aem_page_content to apply.`,
        source: 'Adobe Firefly via GenStudio',
      }, null, 2);
    }

    /* ─── Development Agent (Cloud Manager) ─── */

    case 'get_pipeline_status': {
      const env = input.environment || 'prod';
      const statusFilter = input.status_filter || null;
      const programName = input.program_name || null;
      const pipelines = [
        {
          pipeline_id: 'pipe-fullstack-01',
          name: 'Full-Stack Production Pipeline',
          type: 'fullStack',
          environment: 'prod',
          status: 'completed',
          last_run: new Date(Date.now() - 2 * 86400000).toISOString(),
          duration_min: 42,
          commit: 'edfba4f',
          trigger: 'git push (main)',
          program: profile.name || 'AEM Program',
        },
        {
          pipeline_id: 'pipe-frontend-01',
          name: 'Frontend Pipeline (EDS)',
          type: 'frontEnd',
          environment: 'prod',
          status: 'completed',
          last_run: new Date(Date.now() - 3600000).toISOString(),
          duration_min: 3,
          commit: 'edfba4f',
          trigger: 'Code Sync (automatic)',
          program: profile.name || 'AEM Program',
        },
        {
          pipeline_id: 'pipe-stage-01',
          name: 'Stage Deployment',
          type: 'fullStack',
          environment: 'stage',
          status: 'running',
          last_run: new Date().toISOString(),
          duration_min: null,
          commit: 'latest',
          trigger: 'manual',
          program: profile.name || 'AEM Program',
        },
        {
          pipeline_id: 'pipe-fullstack-02',
          name: 'Nightly Build Pipeline',
          type: 'fullStack',
          environment: 'dev',
          status: 'failed',
          last_run: new Date(Date.now() - 6 * 3600000).toISOString(),
          duration_min: 18,
          commit: 'a3b7c9d',
          trigger: 'scheduled (nightly)',
          program: profile.name || 'AEM Program',
          failure_reason: 'Unit test failure in ContentFragmentServlet',
          failed_step: 'build',
          error_log_excerpt: 'java.lang.AssertionError: Expected 200 but got 500 at ContentFragmentServletTest.java:142',
        },
      ];

      let filtered = pipelines;

      // Filter by pipeline_id first
      if (input.pipeline_id) {
        filtered = filtered.filter((p) => p.pipeline_id === input.pipeline_id);
      } else {
        // Filter by environment
        if (env !== 'all') filtered = filtered.filter((p) => p.environment === env);
      }

      // Filter by status
      if (statusFilter) {
        filtered = filtered.filter((p) => p.status === statusFilter);
      }

      // Filter by program name
      if (programName) {
        filtered = filtered.filter((p) => p.program.toLowerCase().includes(programName.toLowerCase()));
      }

      return JSON.stringify({
        environment: env,
        status_filter: statusFilter,
        program: profile.name || 'AEM Program',
        pipelines: filtered,
        total_found: filtered.length,
        environment_health: {
          status: filtered.some((p) => p.status === 'failed') ? 'degraded' : 'healthy',
          instances: env === 'prod' ? 3 : 1,
          uptime: '99.97%',
          last_deployment: filtered[0]?.last_run || 'unknown',
        },
        source: 'Cloud Manager API via Development Agent',
      }, null, 2);
    }

    /* ─── Acrobat MCP (PDF Services) ─── */

    case 'extract_pdf_content': {
      const text = input.content_text || '';
      const tables = input.extract_tables !== false;
      const images = input.extract_images !== false;

      return JSON.stringify({
        status: 'extracted',
        file_name: input.file_name,
        document_structure: {
          page_count: Math.max(1, Math.ceil(text.length / 3000)),
          word_count: text ? text.split(/\s+/).length : 0,
          has_tables: tables,
          has_images: images,
          languages_detected: ['en'],
        },
        content: {
          text: text.slice(0, 10000) || '(PDF text content would be extracted here)',
          headings: ['(AI will extract document headings from content)'],
          tables: tables ? [{ note: 'Tables extracted as structured JSON' }] : [],
          images: images ? [{ note: 'Image metadata and positions extracted' }] : [],
        },
        metadata: {
          title: input.file_name?.replace(/\.pdf$/i, '') || 'Untitled',
          author: '(extracted from PDF metadata)',
          created: '(extracted from PDF metadata)',
          modified: new Date().toISOString(),
        },
        message: `PDF "${input.file_name}" processed. ${text ? text.split(/\s+/).length + ' words' : 'Content'} extracted with ${tables ? 'table' : 'no table'} and ${images ? 'image' : 'no image'} extraction.`,
        source: 'Adobe PDF Services via Acrobat MCP',
      }, null, 2);
    }

    /* ─── Development Agent: Pipeline Failure Analysis ─── */

    case 'analyze_pipeline_failure': {
      const programName = input.program_name || profile.name || 'Main Program';
      return JSON.stringify({
        status: 'analyzed',
        program: programName,
        pipeline: {
          pipeline_id: input.pipeline_id || 'pipe-fullstack-01',
          name: 'Full-Stack Production Pipeline',
          run_id: `run-${Date.now().toString(36)}`,
          status: 'failed',
          failed_at: new Date(Date.now() - 4 * 3600000).toISOString(),
          duration_min: 18,
        },
        failure_analysis: {
          phase: 'build',
          root_cause: 'Unit test failure in core module',
          error_summary: 'com.adobe.aem.core.models.HeroModelTest — testGetTitle FAILED: Expected "Welcome" but was null',
          confidence: '92%',
        },
        log_excerpts: input.include_logs !== false ? [
          { phase: 'build', level: 'ERROR', message: 'Test com.adobe.aem.core.models.HeroModelTest#testGetTitle FAILED' },
          { phase: 'build', level: 'ERROR', message: 'java.lang.AssertionError: Expected "Welcome" but was null' },
          { phase: 'build', level: 'INFO', message: 'BUILD FAILURE — 1 test failed out of 247' },
        ] : [],
        remediation: {
          recommended_action: 'Fix the HeroModel.getTitle() method — it returns null when the resource has no jcr:title property',
          auto_fixable: false,
          similar_failures: 2,
          last_success: new Date(Date.now() - 48 * 3600000).toISOString(),
        },
        source: 'Cloud Manager API via Development Agent',
      }, null, 2);
    }

    /* ─── Experience Production Agent: Translate Page ─── */

    case 'translate_page': {
      const langNames = { es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', 'pt-br': 'Brazilian Portuguese', it: 'Italian', ko: 'Korean', zh: 'Chinese' };
      const lang = input.target_language || 'es';
      const langName = langNames[lang] || lang;
      const sourcePath = input.page_url?.replace(/https?:\/\/[^/]+/, '') || '/index';
      const targetPath = input.language_tree_path || `/content/${input.site_id || 'site'}/${lang}${sourcePath}`;

      return JSON.stringify({
        status: 'translated',
        source_page: input.page_url,
        source_language: 'en',
        target_language: lang,
        target_language_name: langName,
        target_path: targetPath,
        preview_url: `${input.page_url?.replace(/\/[^/]+$/, '') || 'https://main--site--org.aem.page'}${targetPath}`,
        translation_provider: 'Adobe AI Translation + AEM Translation Framework',
        word_count: Math.floor(500 + Math.random() * 2000),
        segments_translated: Math.floor(30 + Math.random() * 100),
        quality_score: `${(88 + Math.random() * 10).toFixed(1)}%`,
        review_status: 'pending_review',
        message: `Page translated to ${langName} and placed at ${targetPath}. Translation quality: ${(88 + Math.random() * 10).toFixed(1)}%. Pending human review.`,
      }, null, 2);
    }

    /* ─── Experience Production Agent: Create Form ─── */

    case 'create_form': {
      const formId = `form-${Date.now().toString(36)}`;
      const formType = input.form_type || 'custom';
      const defaultFields = {
        contact: [
          { name: 'name', type: 'text', label: 'Full Name', required: true },
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'phone', type: 'tel', label: 'Phone Number', required: false },
          { name: 'message', type: 'textarea', label: 'Message', required: true },
        ],
        'lead-gen': [
          { name: 'firstName', type: 'text', label: 'First Name', required: true },
          { name: 'lastName', type: 'text', label: 'Last Name', required: true },
          { name: 'email', type: 'email', label: 'Work Email', required: true },
          { name: 'company', type: 'text', label: 'Company', required: true },
          { name: 'jobTitle', type: 'text', label: 'Job Title', required: false },
          { name: 'interest', type: 'select', label: 'Area of Interest', required: true, options: ['AEM Sites', 'AEM Assets', 'Analytics', 'Target', 'Other'] },
        ],
        newsletter: [
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'preferences', type: 'checkbox', label: 'Content Preferences', options: ['Product Updates', 'Best Practices', 'Events', 'Case Studies'] },
        ],
      };
      const fields = input.fields || defaultFields[formType] || defaultFields.contact;

      return JSON.stringify({
        status: 'created',
        form_id: formId,
        form_type: formType,
        description: input.description,
        fields,
        field_count: fields.length,
        submit_action: input.submit_action || 'spreadsheet',
        page_path: input.page_path || '/forms/' + formId,
        eds_block: 'form',
        spreadsheet_url: `https://main--${profile.repo || 'site'}--${(profile.orgId || 'org').toLowerCase()}.aem.live/forms/${formId}.json`,
        message: `Form "${input.description}" created with ${fields.length} fields. Type: ${formType}. Submits to: ${input.submit_action || 'spreadsheet'}.`,
        source: 'Experience Production Agent — Form Builder',
      }, null, 2);
    }

    /* ─── Experience Production Agent: Modernize Content ─── */

    case 'modernize_content': {
      const scope = input.scope || 'full-site';
      const isDryRun = input.dry_run !== false;
      const designSystem = input.design_system || 'default';
      const pagesScanned = scope === 'single-page' ? 1 : scope === 'section' ? 5 : Math.floor(15 + Math.random() * 30);

      return JSON.stringify({
        status: isDryRun ? 'dry-run-complete' : 'modernization-applied',
        site: input.site_url,
        design_system: designSystem,
        scope,
        pages_scanned: pagesScanned,
        report: {
          total_components: Math.floor(pagesScanned * 8),
          needs_update: Math.floor(pagesScanned * 3),
          already_compliant: Math.floor(pagesScanned * 5),
          categories: [
            { category: 'Hero blocks', total: pagesScanned, needs_update: Math.floor(pagesScanned * 0.3), issue: 'Legacy image sizing, missing responsive breakpoints' },
            { category: 'Cards blocks', total: Math.floor(pagesScanned * 0.8), needs_update: Math.floor(pagesScanned * 0.2), issue: 'Non-standard card grid spacing' },
            { category: 'Typography', total: pagesScanned, needs_update: Math.floor(pagesScanned * 0.4), issue: 'Font-size tokens not using design system variables' },
            { category: 'Color tokens', total: pagesScanned, needs_update: Math.floor(pagesScanned * 0.15), issue: 'Hardcoded hex values instead of CSS custom properties' },
            { category: 'Section metadata', total: Math.floor(pagesScanned * 0.6), needs_update: Math.floor(pagesScanned * 0.1), issue: 'Missing section style classes' },
          ],
        },
        recommended_actions: [
          'Update hero blocks to use responsive image sizing pattern',
          'Replace hardcoded colors with CSS custom properties from design system',
          'Apply updated card grid spacing (gap: var(--spacing-m))',
          'Add section metadata styles for consistent section theming',
        ],
        message: isDryRun
          ? `Dry-run complete. ${pagesScanned} pages scanned, ${Math.floor(pagesScanned * 3)} components need updates to match ${designSystem}.`
          : `Modernization applied to ${pagesScanned} pages. ${Math.floor(pagesScanned * 3)} components updated.`,
        source: 'Experience Production Agent — Content Modernizer',
      }, null, 2);
    }

    /* ─── Governance Agent: Brand Guidelines ─── */

    case 'get_brand_guidelines': {
      const brandVoice = profile.brandVoice || {};
      const category = input.category || 'all';

      const guidelines = {
        voice: {
          tone: brandVoice.tone || 'Professional, warm, authoritative',
          personality: brandVoice.personality || 'Knowledgeable expert who is approachable',
          do: brandVoice.do || ['Use active voice', 'Be concise', 'Lead with benefits', 'Use customer-centric language'],
          dont: brandVoice.avoided || ['Avoid jargon', 'No passive voice', 'Never use competitor names', 'Avoid superlatives without data'],
        },
        colors: {
          primary: brandVoice.colorPalette?.primary || '#EB1000',
          secondary: brandVoice.colorPalette?.secondary || '#2C2C2C',
          accent: brandVoice.colorPalette?.accent || '#1473E6',
          background: '#FFFFFF',
          text: '#2C2C2C',
          rules: ['Primary color for CTAs and headings only', 'Never use primary on dark backgrounds', 'Maintain 4.5:1 contrast ratio minimum'],
        },
        typography: {
          heading_font: 'Adobe Clean',
          body_font: 'Adobe Clean',
          heading_sizes: { h1: '40px', h2: '32px', h3: '24px', h4: '20px' },
          body_size: '16px',
          line_height: '1.6',
          rules: ['Never use more than 2 font weights per page', 'Body text minimum 16px for readability'],
        },
        imagery: {
          style: 'Authentic, diverse, lifestyle-driven',
          requirements: ['All images must have descriptive alt text', 'Minimum resolution 2x for retina displays', 'Use WebP format with JPEG fallback'],
          restrictions: ['No stock photo watermarks', 'No competitor products visible', 'All people in images must have signed model releases'],
        },
        logo: {
          clear_space: 'Minimum 20px clear space around logo',
          min_size: '32px height minimum',
          allowed_versions: ['Full color on white', 'White on dark', 'Black on light'],
          restrictions: ['Never stretch or distort', 'Never change logo colors', 'Never place on busy backgrounds'],
        },
      };

      const result = category === 'all' ? guidelines : { [category]: guidelines[category] };

      return JSON.stringify({
        customer: profile.name || 'Current Customer',
        guidelines: result,
        last_updated: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
        source: 'Governance Agent — Brand Guidelines Repository',
        message: category === 'all'
          ? `Complete brand guidelines for ${profile.name}. Covers voice, colors, typography, imagery, and logo.`
          : `${category.charAt(0).toUpperCase() + category.slice(1)} guidelines for ${profile.name}.`,
      }, null, 2);
    }

    /* ─── Governance Agent: Asset Expiry ─── */

    case 'check_asset_expiry': {
      const days = input.days_until_expiry || 30;
      const folder = input.folder || '/content/dam';
      const includeExpired = input.include_expired !== false;

      const assets = [];
      const expiringCount = Math.floor(3 + Math.random() * 5);
      const expiredCount = includeExpired ? Math.floor(1 + Math.random() * 3) : 0;

      for (let i = 0; i < expiringCount; i++) {
        const daysLeft = Math.floor(Math.random() * days);
        assets.push({
          path: `${folder}/campaign-asset-${String(i + 1).padStart(2, '0')}.jpg`,
          name: `campaign-asset-${String(i + 1).padStart(2, '0')}.jpg`,
          status: 'expiring',
          expires_at: new Date(Date.now() + daysLeft * 86400000).toISOString().split('T')[0],
          days_remaining: daysLeft,
          license_type: ['royalty-free', 'rights-managed', 'editorial'][i % 3],
          usage_count: Math.floor(1 + Math.random() * 10),
          action_required: daysLeft < 7 ? 'urgent-renewal' : 'schedule-renewal',
        });
      }

      for (let i = 0; i < expiredCount; i++) {
        assets.push({
          path: `${folder}/expired-asset-${String(i + 1).padStart(2, '0')}.jpg`,
          name: `expired-asset-${String(i + 1).padStart(2, '0')}.jpg`,
          status: 'expired',
          expires_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString().split('T')[0],
          days_remaining: 0,
          license_type: 'rights-managed',
          usage_count: Math.floor(1 + Math.random() * 5),
          action_required: 'immediate-removal',
          published_pages: Math.floor(1 + Math.random() * 3),
        });
      }

      return JSON.stringify({
        folder,
        scan_window_days: days,
        total_assets_scanned: Math.floor(50 + Math.random() * 200),
        expiring: assets.filter((a) => a.status === 'expiring'),
        expired: assets.filter((a) => a.status === 'expired'),
        summary: {
          expiring_count: expiringCount,
          expired_count: expiredCount,
          urgent_count: assets.filter((a) => a.days_remaining < 7 && a.days_remaining > 0).length,
        },
        message: `Found ${expiringCount} assets expiring within ${days} days${includeExpired ? ` and ${expiredCount} already expired` : ''}. ${assets.filter((a) => a.action_required === 'immediate-removal').length} require immediate action.`,
        source: 'Governance Agent — DRM & Asset Expiry',
      }, null, 2);
    }

    /* ─── Governance Agent: Content Audit ─── */

    case 'audit_content': {
      const contentType = input.content_type || 'content-fragments';
      const staleDays = input.stale_days || 90;
      const statusFilter = input.status_filter || 'published';

      const staleItems = [];
      const itemCount = Math.floor(5 + Math.random() * 10);
      for (let i = 0; i < itemCount; i++) {
        const daysSinceUpdate = staleDays + Math.floor(Math.random() * 180);
        staleItems.push({
          path: `/content/${contentType === 'content-fragments' ? 'dam/fragments' : contentType === 'pages' ? 'site/en' : 'dam'}/${contentType}-${String(i + 1).padStart(3, '0')}`,
          title: `${contentType === 'content-fragments' ? 'Fragment' : contentType === 'pages' ? 'Page' : 'Asset'} #${i + 1}`,
          type: contentType,
          last_modified: new Date(Date.now() - daysSinceUpdate * 86400000).toISOString().split('T')[0],
          days_since_update: daysSinceUpdate,
          published: statusFilter === 'published' || Math.random() > 0.3,
          author: ['content-author', 'admin', 'marketing-team'][i % 3],
          status: daysSinceUpdate > staleDays * 2 ? 'critical' : 'stale',
        });
      }

      return JSON.stringify({
        content_type: contentType,
        stale_threshold_days: staleDays,
        status_filter: statusFilter,
        total_scanned: Math.floor(50 + Math.random() * 200),
        stale_items: staleItems,
        summary: {
          total_stale: itemCount,
          critical: staleItems.filter((i) => i.status === 'critical').length,
          still_published: staleItems.filter((i) => i.published).length,
        },
        recommendations: [
          `Review and update ${staleItems.filter((i) => i.status === 'critical').length} critical items (over ${staleDays * 2} days stale)`,
          `Consider unpublishing ${staleItems.filter((i) => i.published).length} stale items that are still live`,
          'Set up automated staleness alerts for content governance',
        ],
        message: `Found ${itemCount} stale ${contentType} not updated in ${staleDays}+ days. ${staleItems.filter((i) => i.published).length} are still published.`,
        source: 'Governance Agent — Content Audit',
      }, null, 2);
    }

    /* ─── Content Optimization Agent: Transform Image ─── */

    case 'transform_image': {
      const ops = input.operations || [];
      const smartCrop = input.smart_crop;
      const format = input.output_format || 'webp';
      const quality = input.quality || 85;
      const assetName = input.asset_path?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'transformed';

      // Build DM URL with transformation parameters
      let dmParams = `quality=${quality}`;
      if (smartCrop) dmParams += `&crop=${smartCrop}`;
      ops.forEach((op) => {
        if (op.startsWith('resize:')) {
          const [w, h] = op.slice(7).split('x');
          dmParams += `&width=${w}`;
          if (h) dmParams += `&height=${h}`;
        }
        if (op.startsWith('crop:')) dmParams += `&crop=${op.slice(5)}`;
        if (op.startsWith('rotate:')) dmParams += `&rotate=${op.slice(7)}`;
        if (op.startsWith('mirror:')) dmParams += `&flip=${op.slice(7)}`;
      });

      const deliveryUrl = `https://delivery-p12345-e67890.adobeaemcloud.com/adobe/dynamicmedia/deliver/${assetName}/transformed.${format}?${dmParams}`;

      return JSON.stringify({
        status: 'transformed',
        source_asset: input.asset_path,
        operations_applied: [...ops, ...(smartCrop ? [`smart-crop:${smartCrop}`] : [])],
        output: {
          delivery_url: deliveryUrl,
          format,
          quality,
          dam_path: `/content/dam/transformed/${assetName}-transformed.${format}`,
        },
        message: `Image transformed: ${ops.length + (smartCrop ? 1 : 0)} operation(s) applied. Delivered as ${format.toUpperCase()} at ${quality}% quality via Dynamic Media.`,
        source: 'Content Optimization Agent — Dynamic Media + OpenAPI',
      }, null, 2);
    }

    /* ─── Content Optimization Agent: Batch Renditions ─── */

    case 'create_image_renditions': {
      const assetName = input.asset_path?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'source';
      const channelSpecs = {
        instagram: [{ name: 'Instagram Story', width: 1080, height: 1920, format: 'jpeg', quality: 90 }, { name: 'Instagram Post', width: 1080, height: 1080, format: 'jpeg', quality: 90 }],
        facebook: [{ name: 'Facebook Post', width: 1200, height: 630, format: 'jpeg', quality: 85 }],
        twitter: [{ name: 'Twitter/X Post', width: 1200, height: 675, format: 'jpeg', quality: 85 }],
        linkedin: [{ name: 'LinkedIn Post', width: 1200, height: 628, format: 'jpeg', quality: 85 }],
        'web-banner': [{ name: 'Web Banner', width: 1920, height: 1080, format: 'webp', quality: 85 }],
        mobile: [{ name: 'Mobile Portrait', width: 1080, height: 1920, format: 'webp', quality: 85 }],
        email: [{ name: 'Email Header', width: 600, height: 200, format: 'jpeg', quality: 80 }],
      };

      let specs = input.renditions || [];
      if (input.channels?.length > 0) {
        input.channels.forEach((ch) => {
          if (channelSpecs[ch]) specs.push(...channelSpecs[ch]);
        });
      }
      if (specs.length === 0) {
        specs = [
          { name: 'Web Banner', width: 1920, height: 1080, format: 'webp', quality: 85 },
          { name: 'Social Square', width: 1080, height: 1080, format: 'jpeg', quality: 90 },
          { name: 'Mobile Portrait', width: 1080, height: 1920, format: 'jpeg', quality: 85 },
        ];
      }

      const renditions = specs.map((spec, i) => ({
        name: spec.name || spec.channel || `Rendition ${i + 1}`,
        width: spec.width,
        height: spec.height,
        format: spec.format || 'webp',
        quality: spec.quality || 85,
        delivery_url: `https://delivery-p12345-e67890.adobeaemcloud.com/adobe/dynamicmedia/deliver/${assetName}/${(spec.name || `rendition-${i}`).toLowerCase().replace(/\s+/g, '-')}.${spec.format || 'webp'}?width=${spec.width}&height=${spec.height}&quality=${spec.quality || 85}`,
        dam_path: `/content/dam/renditions/${assetName}/${(spec.name || `rendition-${i}`).toLowerCase().replace(/\s+/g, '-')}.${spec.format || 'webp'}`,
        file_size_estimate: `${Math.floor(spec.width * spec.height * 0.3 / 1024)}kb`,
      }));

      return JSON.stringify({
        status: 'created',
        source_asset: input.asset_path,
        renditions,
        total_renditions: renditions.length,
        channels: input.channels || [],
        message: `${renditions.length} rendition(s) created from ${assetName}. All saved to DAM and available via Dynamic Media delivery URLs.`,
        source: 'Content Optimization Agent — Dynamic Media Renditions',
      }, null, 2);
    }

    /* ─── Discovery Agent: Add to Collection ─── */

    case 'add_to_collection': {
      const collectionId = `col-${Date.now().toString(36)}`;
      const assetCount = input.asset_paths?.length || 0;

      return JSON.stringify({
        status: input.create_if_missing !== false ? 'created_and_added' : 'added',
        collection: {
          id: collectionId,
          name: input.collection_name,
          path: `/content/dam/collections/${input.collection_name.toLowerCase().replace(/\s+/g, '-')}`,
          asset_count: assetCount,
        },
        assets_added: input.asset_paths || [],
        message: `${assetCount} asset(s) added to collection "${input.collection_name}". Collection ${input.create_if_missing !== false ? 'created and ' : ''}ready for campaign use.`,
        source: 'Discovery Agent — DAM Collections',
      }, null, 2);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/* ── System Prompt ── */

const AEM_SYSTEM_PROMPT = `You are the **Experience Workspace AI** — an expert agent embedded in Adobe Experience Manager's content operations interface.

## Your Role
You are the AI brain behind AEM's agentic content supply chain. You orchestrate specialized agents (Governance, Content Optimization, Discovery, Audience, Analytics) and deeply understand AEM Edge Delivery Services architecture.

## Your MCP Tools — Adobe AI Agent Toolbelt
You have 31 tools spanning 12 Adobe AI Agents. USE THEM when relevant — the AI should call tools, not guess.

### AEM Content MCP (content read/write)
- **get_aem_sites** — Discover all AEM Edge Delivery sites. Call first when users mention any site.
- **get_aem_site_pages** — Get pages for a site (paths, titles, descriptions).
- **get_page_content** — Fetch actual HTML content from a page via .plain.html endpoint.
- **copy_aem_page** — Copy a page as a template to create a new page.
- **patch_aem_page_content** — Update specific content on an AEM page (hero, headline, CTA, metadata).
- **create_aem_launch** — Create a Launch (review branch) as a governance gate before publishing.
- **promote_aem_launch** — Promote a Launch to publish live (only after governance approval).

### Discovery Agent (DAM search & collections)
- **search_dam_assets** — Natural language search across AEM Assets (DAM). Supports filters: date_range (e.g., "last 30 days"), tags (array), folder path, exclude terms. Returns approved assets with Dynamic Media delivery URLs.
- **add_to_collection** — Add one or more assets to an AEM Assets collection. Creates the collection if it doesn't exist.

### Governance Agent (compliance, brand, DRM)
- **run_governance_check** — Brand compliance, metadata enforcement, WCAG 2.1 AA accessibility, legal, SEO, and DRM checks. Returns pass/fail with detailed findings.
- **get_brand_guidelines** — Retrieve brand guidelines for a specific brand including voice, tone, colors, typography, logo usage, and do/don't rules.
- **check_asset_expiry** — Check DRM, licensing, and expiration status of assets. Returns rights status, license type, expiry dates, and usage restrictions.
- **audit_content** — Run a deep content audit on a page. Checks readability, tone of voice, inclusive language, content freshness, and provides rewrite suggestions.

### Audience Agent (AEP segments)
- **get_audience_segments** — List, create, or get audience segments from AEP. Returns segment definitions and activation status.

### Content Optimization Agent (Dynamic Media + OpenAPI)
- **create_content_variant** — Generate a content variant for a specific audience segment. Uses Dynamic Media for image transformations.
- **transform_image** — Apply transformations to an image: crop, mirror, resize, rotate, adjust quality, change format. Returns Dynamic Media delivery URL with applied transforms.
- **create_image_renditions** — Generate multiple renditions of an image for different channels (web, mobile, social, email, print). Returns all rendition URLs with dimensions.

### Data Insights Agent (CJA)
- **get_analytics_insights** — Query CJA for page performance, audience behavior, and conversion data.

### Journey Agent (AJO)
- **get_journey_status** — List, create, or check status of AJO journeys.

### Workfront WOA (workflow)
- **create_workfront_task** — Create review/approval tasks in Workfront. Assigns to approval chain from customer profile.

### Experience Production Agent (content creation & transformation)
- **extract_brief_content** — Extract structured content from an uploaded brief (PDF/Word).
- **translate_page** — Translate an AEM page to a target language. Preserves block structure, metadata, and formatting.
- **create_form** — Create an AEM form from a description. Generates fields, validation rules, and submit actions.
- **modernize_content** — Modernize outdated page content. Updates language, refreshes statistics, improves readability, and aligns with current brand voice.

### Target Agent (A/B Testing & Personalization)
- **create_ab_test** — Create an A/B test activity with traffic splits, variants, and success metrics.
- **get_personalization_offers** — Get decisioned personalization offers for a visitor/segment on a page location.

### AEP Agent (Real-time Customer Profiles)
- **get_customer_profile** — Look up a real-time customer profile with identity graph, segment memberships, recent events, and consent.

### Firefly Agent (Generative AI)
- **generate_image_variations** — Generate image variations using Adobe Firefly AI. Creates alternate versions with style, mood, or composition changes.

### Development Agent (Cloud Manager)
- **get_pipeline_status** — Get deployment pipeline status, build history, and environment health. Supports status_filter (e.g., 'failed') and program_name filter.
- **analyze_pipeline_failure** — Analyze a failed pipeline execution. Returns root cause, affected step, error logs, and suggested fix.

### Acrobat MCP (PDF Services)
- **extract_pdf_content** — Extract structured content from a PDF document (text, tables, images, metadata).

**CRITICAL RULES**:
1. When users mention a site (like "Frescopa", "SecurBank", "WKND"), ALWAYS call get_aem_sites → get_aem_site_pages → get_page_content to fetch real content. Never guess.
2. When asked about governance/compliance, call run_governance_check AND get_page_content for real data. For brand guidelines, call get_brand_guidelines.
3. When asked about assets/images, call search_dam_assets. Use date_range, tags, folder, and exclude parameters to filter results. For generating new images, call generate_image_variations.
4. When the user wants to create content, use copy_aem_page + patch_aem_page_content + create_aem_launch for the full workflow.
5. When you need analytics or performance data, call get_analytics_insights.
6. For audience/segment questions, call get_audience_segments. For individual profile lookup, call get_customer_profile.
7. For A/B testing and personalization, use create_ab_test and get_personalization_offers.
8. For deployment/pipeline status, call get_pipeline_status. For failed pipelines, call analyze_pipeline_failure with the pipeline_id.
9. For PDF document extraction, call extract_pdf_content.
10. For multi-step pipelines (brief → page → governance → publish), chain tools in sequence. You can do up to 8 rounds of tool calls.
11. For image transformations (crop, mirror, resize), call transform_image. For multi-channel renditions, call create_image_renditions.
12. For content translation, call translate_page. For form creation, call create_form. For content modernization, call modernize_content.
13. For asset rights/DRM/expiry checks, call check_asset_expiry. For content quality audits, call audit_content.
14. For adding assets to collections, call add_to_collection.

## Capabilities — 31 Tools, 12 Agents, Full Adobe Stack
- **Page Analysis**: Analyze EDS pages — structure, blocks, sections, metadata, performance
- **Governance Compliance**: Brand guidelines, brand compliance, legal, WCAG 2.1 AA accessibility, SEO, DRM, asset expiry
- **Content Audit**: Deep content quality audit — readability, tone, inclusivity, freshness, rewrite suggestions
- **Asset Discovery**: Natural language search across DAM with Dynamic Media delivery URLs, date/tag/folder filtering, collections
- **Content Production**: Brief extraction → page creation → content patching → launch governance gate
- **Content Transformation**: Page translation, form creation, content modernization with brand voice alignment
- **Audience Intelligence**: AEP segment creation, sizing, activation + real-time profile lookup
- **Content Optimization**: Segment-specific content variants with Dynamic Media renditions
- **Image Processing**: Crop, mirror, resize, rotate, quality adjust, format conversion, multi-channel renditions
- **Analytics & Insights**: CJA performance data, conversion metrics, AI-generated recommendations
- **Journey Orchestration**: AJO journey status, creation, and performance
- **Workflow Management**: Workfront task creation with approval chain routing
- **A/B Testing & Personalization**: Target activities, traffic splits, decisioned offers per segment
- **Generative AI**: Firefly image variations from prompts with DAM integration
- **DevOps**: Cloud Manager pipeline status, deployment history, failure analysis, environment health
- **Document Processing**: PDF extraction via Acrobat MCP (text, tables, images, metadata)
- **AEM Architecture**: Deep knowledge of EDS blocks, section metadata, content modeling, three-phase loading

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
