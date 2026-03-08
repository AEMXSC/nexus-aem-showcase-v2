# CLAUDE.md — nexus-aem-showcase

This project is an AEM Edge Delivery Services site using Universal Editor (xwalk) authoring.
Built on `adobe-rnd/aem-boilerplate-xwalk`. Developed by Adobe XSC team.

> Copy this file as both `CLAUDE.md` and `AGENTS.md` in every new project repo.
> Remove the `[Project Name]` placeholder and the tip lines (lines starting with `>`).

---

## Platform

Edge Delivery Services for AEM Sites (documentation at https://www.aem.live/ — always search `site:www.aem.live` or `www.aem.live` to restrict results).

**Tech stack:** Vanilla JavaScript (ES6+), no transpiling, no build steps, no frameworks, CSS custom properties.

**LLMs context:** https://www.aem.live/llms.txt — paste into any session for full AEM context.

---

## Development Workflow — Non-Negotiable

For **ALL** development work (new blocks, modifications, CSS changes, core scripts, bug fixes):

**START with the `content-driven-development` skill.** It orchestrates the complete workflow.

```
NEVER write code before you have test content.
NEVER skip content modeling.
Author needs come before developer needs.
```

Three phases — always in order:
1. Content Discovery → design or find content model, create test content
2. Implementation → build code against real content, test at localhost:3000
3. Validation → lint, Lighthouse 100, a11y, PR with test URL

For finding reference implementations: use `block-collection-and-party` skill.

---

## Project Environments

> Update these with actual URLs for each project.

- **Preview:** `https://main--nexus-aem-showcase--[org].aem.page/`
- **Live:** `https://main--nexus-aem-showcase--[org].aem.live/`
- **Local dev:** `http://localhost:3000` (run `aem up`)

---

## This Project (xwalk / Universal Editor)

This project uses the **xwalk boilerplate** and supports Universal Editor authoring.

Three component JSON files live at root level — update all three when adding a new block:
- `component-models.json` — author-editable fields (the UE properties panel)
- `component-definition.json` — block registration in UE "Add component" picker
- `component-filters.json` — placement rules (what goes inside what)

After adding new blocks: `npm run build:json` (merges `/models/_*.json` into root files).

**ResourceType for all blocks:** `core/franklin/components/block/v1/block`
**ResourceType for sections:** `core/franklin/components/section/v1/section`
**Never use custom resource types.**

Reference implementations:
- Retail: `aem-showcase/frescopa` (frescopa.coffee)
- FSI: `markszulc/securbank-aem-ue`

---

## Block Pattern

Every block needs exactly these files:

```
blocks/
  [blockname]/
    [blockname].js    ← export default function decorate(block) {}
    [blockname].css   ← scoped, no frameworks
```

Do not touch `/scripts/aem.js` — that is the core AEM library.

Content model before code — define the Google Doc table / UE content model first, always.

---

## Design Tokens

> Update with actual project color scheme.

```css
--color-primary:   #[hex];
--color-secondary: #[hex];
--color-text:      #[hex];
--color-bg:        #[hex];
```

---

## Three-Phase Loading (Performance Rules)

1. **Eager** — LCP content only (hero image, above-fold text)
2. **Lazy** — developer-controlled timing
3. **Delayed** — third-party scripts, analytics, only after 3s post-LCP

Target: **Lighthouse 100** on every PR. The AEM GitHub bot will fail PRs that don't hit it.

---

## Skills Installed

> Run `gh upskill adobe/skills --path skills/aem/edge-delivery-services --all` to install.

| Skill | When to invoke |
|---|---|
| `content-driven-development` | Entry point for ALL block/code work |
| `block-collection-and-party` | Finding reference implementations |
| `content-modeling` | Designing author-friendly content models |
| `building-blocks` | Block JS/CSS implementation patterns |
| `testing-blocks` | Validation, linting, a11y |
| `docs-search` | AEM documentation lookup |
| `block-inventory` | Audit what's already built in this project |

---

## MCP Servers

```json
{
  "mcpServers": {
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "playwright": { "command": "npx", "args": ["@playwright/mcp"] }
  }
}
```

Use Playwright to take screenshots of localhost:3000 and verify visual output — don't assume.

---

## XSC Context

This demo supports one or more of Adobe's three XSC revenue motions:

- **Motion 1** — Experience Production Agent (agentic SKU upsell, existing AEM CS customers)
- **Motion 2** — Universal Editor + Claude Code + Crosswalk (Move-to-Cloud Accelerator)
- **Motion 3** — Generative Websites (3 pages → conversion lift → expand EDS footprint)

> Specify which motion(s) this project serves and any customer/vertical context below.

**This project serves:** [Motion X — brief description]
**Customer vertical:** [FSI / Retail / Media / Healthcare / etc.]
**Demo narrative:** [One line: what the customer sees and why it matters]

---

*For full XSC strategy context, revenue motion talk tracks, and component JSON patterns, see the workspace-level `CLAUDE.md` in `Claude-Projects/`.*
