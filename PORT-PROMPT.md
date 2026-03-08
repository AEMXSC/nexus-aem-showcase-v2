# PORT-PROMPT.md
# Nexus AEM Showcase — Lovable → EDS/xwalk Port Instructions
# Last updated: March 2026
# Read this file completely before writing a single line of code.

---

## CONTEXT

This site was designed in Lovable (React + Tailwind) and must be ported to AEM Edge
Delivery Services using the xwalk/Universal Editor boilerplate. The final live site will
have AEM AI agents run against it — Content Optimization, Experience Production, and
Governance agents. Every build decision must account for agent readiness, not just
visual fidelity.

Source design: https://nexus-aem-showcase.lovable.app
Source code: src/components/ (Lovable React export in this repo)
Target: adobe-rnd/aem-boilerplate-xwalk pattern
Local preview: localhost:3000 (run `aem up` in second terminal)

---

## PHASE 0 — READ BEFORE BUILDING

### 0.1 Color Tokens (define in styles/tokens.css FIRST)

```css
:root {
  --color-navy: #0F1923;
  --color-red: #EB1000;
  --color-gold: #C9A84C;
  --color-white: #FFFFFF;
  --color-grey: #CCCCCC;
  --color-card: #1A2633;
}
```

Never hardcode hex values in block CSS. Always use var(--color-*).
The AEM Style Critic uses visual embeddings — inconsistent token application
causes style drift that agents will flag.

### 0.2 Source-First Rule — MANDATORY FOR EVERY BLOCK

Before writing any block JS or CSS, read the corresponding Lovable component:

```bash
cat src/components/Hero.tsx
cat src/components/WhatWeDo.tsx
cat src/components/RevenueMotions.tsx
cat src/components/Steps.tsx
cat src/components/Team.tsx
cat src/components/DemoEnvironments.tsx
cat src/components/Ticker.tsx
cat src/components/CTA.tsx
```

Extract from each file:
1. Background colors (bg-[#hex] or bg-slate-900 etc)
2. Text colors and sizes (text-[#hex], text-4xl, font-bold)
3. Spacing (p-4, gap-6, mt-8 etc)
4. Border and radius values
5. Layout pattern (grid, flex, columns)

Map Tailwind → CSS using tokens:

| Tailwind | EDS CSS |
|----------|---------|
| bg-[#0F1923] | background: var(--color-navy) |
| bg-[#EB1000] | background: var(--color-red) |
| text-[#C9A84C] | color: var(--color-gold) |
| p-4 | padding: 1rem |
| p-6 | padding: 1.5rem |
| p-8 | padding: 2rem |
| gap-4 | gap: 1rem |
| gap-6 | gap: 1.5rem |
| gap-8 | gap: 2rem |
| text-sm | font-size: 0.875rem |
| text-base | font-size: 1rem |
| text-lg | font-size: 1.125rem |
| text-xl | font-size: 1.25rem |
| text-2xl | font-size: 1.5rem |
| text-3xl | font-size: 1.875rem |
| text-4xl | font-size: 2.25rem |
| text-5xl | font-size: 3rem |
| font-bold | font-weight: 700 |
| font-semibold | font-weight: 600 |
| rounded-lg | border-radius: 0.5rem |
| rounded-full | border-radius: 9999px |

### 0.3 Block Inventory + Complexity

Build in this sequence — simple first, complex last:

| Block | Complexity | Notes |
|-------|------------|-------|
| hero | Medium | Stats bar, gradient bg, CTA button |
| cta | Simple | Dark bg, centered text, red button |
| steps | Simple | 3-column, numbered, no interaction |
| cards | Simple | 4 dark cards, emoji icons |
| revenue-motions | Simple | 3 numbered dark cards, gold accents |
| team | Simple | 6 cards, initials avatars, badges |
| demo-cards | Medium | LIVE/COMING SOON badges, links |
| ticker | Complex | Scrolling animation, infinite loop |
| header | Complex | Nav, scroll behaviour, mobile menu |
| footer | Simple | Copyright, nav links |

### 0.4 Asset Inventory

- No external fonts — use system stack or check src/index.css for @import
- Icons: inline SVG or /icons/ folder — no icon font libraries
- Images: /media/ folder — no external image URLs in blocks

### 0.5 Third-Party Audit

- Check src/ for any analytics, chat, video, or form embeds
- Any third-party script → delayed phase ONLY (loads 3s after LCP)
- Nothing third-party in eager or lazy phase — it will kill Lighthouse

---

## PHASE 1 — CONTENT MODEL (before code)

For every block, define what an author needs to edit in Universal Editor.
Add entries to component-models.json BEFORE writing block JS.

Every block needs a models/_blockname.json file:

```json
{
  "id": "blockname",
  "fields": [
    {
      "component": "text",
      "name": "title",
      "label": "Title",
      "valueType": "string"
    }
  ]
}
```

Field type reference:
- `text` — single line string
- `richtext` — formatted body copy
- `reference` — image/asset picker
- `boolean` — toggle
- `select` — dropdown with options
- `aem-content` — link to another AEM page

Agent-readiness rule: Every field an agent might generate, replace, summarize,
or translate MUST be modelled. Missing fields = Experience Production Agent
cannot write to that block. If in doubt, model it.

After all blocks are done: `npm run build:json`
This merges /models/_*.json into the three root-level JSON files:
- component-models.json
- component-definition.json
- component-filters.json

---

## PHASE 2 — BUILD RULES

### 2.1 EDS Block Pattern

Every block follows this structure:
```
/blocks/blockname/
  blockname.js
  blockname.css
```

Block JS signature:
```javascript
export default function decorate(block) {
  // Read from block DOM — never hardcode content
  // Manipulate, wrap, enhance
  // Return nothing — mutates block in place
}
```

### 2.2 Three-Phase Loading — CRITICAL FOR LIGHTHOUSE

```javascript
// eager — LCP content only (hero, above fold)
// lazy — below fold blocks
// delayed — third party, runs 3s after LCP
```

Hero block must load in eager phase. Everything else lazy or delayed.
Check scripts/aem.js loadEager / loadLazy / loadDelayed functions.

### 2.3 HTML Must Be Agent-Parseable

Agents fetch raw HTML. They ignore JavaScript. They enforce strict
performance thresholds. Build accordingly:

DO:
- Render full content in static HTML on page load
- Use semantic elements: h1-h6, p, ul/li, figure/img, a, article, section
- Every piece of text content is in the DOM before JS runs

DO NOT:
- JS-injected text that only appears after interaction
- Canvas-rendered content
- CSS `content: ""` for meaningful text
- Lazy-load content that agents need to read

### 2.4 Responsive — Mobile First

EDS breakpoints:
```css
/* mobile: default */
/* tablet: */
@media (min-width: 600px) { }
/* desktop: */
@media (min-width: 900px) { }
/* wide: */
@media (min-width: 1200px) { }
```

### 2.5 Lighthouse Gate — Per Block

After each block is built, verify at localhost:3000 before moving to next:
- No console errors
- Images have alt text
- Buttons have accessible labels
- Heading hierarchy is correct (one h1 per page)
- No render-blocking resources introduced

Do not build 8 blocks then try to fix Lighthouse. Fix as you go.

---

## PHASE 3 — BLOCK SPECS

### HERO

Source: `cat src/components/Hero.tsx`

Requirements:
- min-height: 100vh, flex column, vertically centered
- Background: dark navy gradient (#0F1923)
- Headline: "The XSC" white + "Revenue Motion" gold (#C9A84C) + "Showcase" white
- Subheadline: grey body text
- Stats: single horizontal inline bar with · separator
  `50+ Deals Supported · $2M+ ARR Pipeline · 3 Revenue Motions · 6 Months Active`
- CTA button: "Request a Demo" — background #EB1000, white text, rounded
- Eager phase loading (LCP block)

### TICKER

Source: `cat src/components/Ticker.tsx`

Requirements:
- Full-width red bar (#EB1000)
- White text, scrolling wins/stats, infinite loop
- CSS animation only — no JS animation libraries
- Delayed phase (not LCP critical)

### CARDS (What We Do)

Source: `cat src/components/WhatWeDo.tsx`

Requirements:
- Section heading: "What We Do", subhead: "The XSC team closes revenue across three AEM motions"
- 4 dark navy cards (#0F1923 or #1A2633)
- Each card: emoji icon, h3 title, p body — never concatenated
- Gold border or accent on card
- 4-column desktop, 2-column tablet, 1-column mobile

### REVENUE MOTIONS

Source: `cat src/components/RevenueMotions.tsx`

Requirements:
- Dark section bg (#0F1923)
- 3 numbered cards
- Motion number: ~4rem, gold (#C9A84C), bold
- Motion title: white (#FFFFFF), font-weight 600
- Body text: light grey (#CCCCCC), readable
- Card bg: slightly lighter (#1A2633), 1px gold border
- Taglines/badges where present

### STEPS (How We Engage)

Source: `cat src/components/Steps.tsx`

Requirements:
- White/light section bg
- Step numbers: large gold numerals (01, 02, 03)
- Step title: dark, bold
- Step body: grey body text
- 3-column desktop, stacked mobile

### TEAM

Source: `cat src/components/Team.tsx`

Requirements:
- Section heading: "The XSC Team"
- 6 cards, 3-column desktop, 2-column tablet
- Avatar: initials circle with gradient background
- Name, title, specialty badge (gold bg, dark text)
- Real team names: Liviu Chis, Joe Bianco, Jim McGowan,
  Lisa Strickland, John Green + Courtney Remekie

### DEMO CARDS (Demo Environments)

Source: `cat src/components/DemoEnvironments.tsx`

Requirements:
- 6 cards in 3-column grid
- LIVE badge: green bg
- COMING SOON badge: grey bg
- "View Demo →" link for live environments
- Card: white bg, border, subtle shadow
- Live envs: Frescopa Coffee, SecurBank

### CTA

Source: `cat src/components/CTA.tsx`

Requirements:
- Dark navy bg (#0F1923)
- Centered headline and subhead
- Button: "Request a Demo Session" — #EB1000, white text, rounded
- Full-width section

### HEADER/NAV

Requirements:
- Links: What We Do, Revenue Motions, Demo Envs, Team
- On scroll: solid #0F1923 background (add .scrolled class via scroll listener)
- Mobile: hamburger menu
- Nav content pulls from an AEM page fragment at `/nav` — do not hardcode links in header.js

### FOOTER

Requirements:
- Dark bg
- Copyright: "© 2026 Adobe Inc. · XSC Team · nexus-aem-showcase"
- Content pulls from footer.docx — do not hardcode

---

## PHASE 4 — METADATA (required on every page)

Every content document must have a metadata block:

| Metadata    |                                              |
|-------------|----------------------------------------------|
| title       | The XSC Revenue Motion Showcase              |
| description | Live AEM EDS demos built with Universal Editor and Claude Code |
| keywords    | AEM, Edge Delivery Services, Universal Editor, XSC, demo |
| template    | default                                      |

Agents use metadata for content discovery, routing, and generation context.
Missing metadata = agents cannot properly index or act on the page.

---

## PHASE 5 — POST-BUILD VERIFICATION

Before pushing to GitHub:

- [ ] All blocks render at localhost:3000 with no console errors
- [ ] Stats bar is horizontal inline, not a bullet list
- [ ] All CTA buttons are #EB1000, not default blue
- [ ] Hero fills full viewport (min-height: 100vh)
- [ ] Revenue Motions text is visible (white/grey on dark bg)
- [ ] Card titles and body text are separated (not concatenated)
- [ ] Nav background solid on scroll
- [ ] No hardcoded hex values in any block CSS (all var(--color-*))
- [ ] component-models.json has entries for every block
- [ ] `npm run build:json` has been run
- [ ] Mobile layout checked at 375px viewport
- [ ] All images have alt text
- [ ] No lorem ipsum anywhere — production-intent content only
- [ ] Lighthouse 100 on mobile AND desktop — verify via https://pagespeed.web.dev/ on the aem.live URL
- [ ] AEM Code Sync GitHub app installed on repo
- [ ] Do NOT add robots.txt Disallow during development — aem.page and aem.live are blocked from crawlers by default

---

## PHASE 6 — POST-LAUNCH (aemcoder.adobe.io)

aemcoder is NOT part of the build pipeline. It is a post-launch tool.

After site is live at aem.live:

1. Connect repo at aemcoder.adobe.io via AEM Code Connector
2. Use for natural language style fixes without local environment
   Example: "The hero padding on mobile is too tight" → generates PR → review → merge
3. Style Critic: compare live URL vs source design for style drift detection
4. Useful for non-dev team members to make CSS tweaks without Claude Code

DO NOT use aemcoder during the initial build.
Claude Code owns the build. aemcoder handles post-launch maintenance.

After site is live, the AEM AI agents run against the live HTML:
- Content Optimization Agent — rewrites/improves copy
- Experience Production Agent — generates new content variations
- Governance Agent — checks brand compliance
- Discovery Agent — maps content relationships

These agents fetch raw HTML. They ignore JS. Everything they need must be
in the DOM. Build semantic, build clean, build agent-ready.

---

## RESUME PROMPT (use if continuing a partial build)

```
Read PORT-PROMPT.md completely. Then:
1. Run `cat src/components/[NextBlock].tsx` for the next unbuilt block
2. Extract colors, spacing, layout from Tailwind classes
3. Map to EDS CSS tokens
4. Build block JS and CSS to match exactly
5. Verify at localhost:3000 before moving to next block
6. Repeat until all blocks in Phase 3 are complete
7. Run npm run build:json
8. Run full Phase 5 checklist

Blocks completed so far: hero (partial), steps, cta
Blocks remaining: cards, revenue-motions, team, demo-cards, ticker, header, footer
Known issues to fix in hero: stats horizontal bar, CTA button #EB1000, min-height 100vh
```

---

## Universal Editor Instrumentation

Every block built in this project must be fully instrumented for the Universal Editor at the time it is created. This is not optional. Do not build a block without also creating its UE JSON files.

### Required files — create these when the project is first set up:

**component-definition.json** (project root) — registers every block with UE so authors can insert them from the Add panel. Every block needs a title, id, and xwalk page template pointing to core/franklin/components/block/v1/block.

**component-models.json** (project root) — defines editable fields for every block. Use "text" for single-line, "richtext" for body copy, "reference" for images/assets. Blocks with repeating items (team, cards, testimonials) need a second model entry for the item level (e.g. "team-item").

**component-filters.json** (project root) — lists every block id under "section" so authors can insert any block into any section.

### Required files — create these when each block is built:

**blocks/blockname/_blockname.json** — per-block model file. Must include a definitions array and a models array with the same fields as the entry in component-models.json. Structure:

```json
{
  "definitions": [{
    "title": "BlockName",
    "id": "blockid",
    "plugins": {
      "xwalk": {
        "page": {
          "resourceType": "core/franklin/components/block/v1/block",
          "template": { "name": "BlockName", "model": "blockid" }
        }
      }
    }
  }],
  "models": [
    {
      "id": "blockid",
      "fields": [ ...editable fields... ]
    }
  ]
}
```

### Field type reference:

- Single line text: "component": "text", "valueType": "string"
- Body copy: "component": "richtext", "valueType": "string"
- Image or asset: "component": "reference", "valueType": "string", "multi": false
- Boolean toggle: "component": "boolean", "valueType": "boolean"

### Rule:

When Claude Code builds any new block it must immediately also update component-definition.json, component-models.json, component-filters.json, and create the _blockname.json file. If these files do not exist yet, create them. If they exist, append the new block entry without deleting existing entries.

### Author workflow:

1. AEM Sites console → open page → Edit → Universal Editor
2. Click block → blue outline → edit fields in right panel or inline
3. Images: click reference field → Asset Picker → select from DAM
4. Publish → live on EDS within seconds

### Constraints:

- Requires AEM as a Cloud Service with UE enabled on the Cloud Manager program
- Max 25 AEM resources instrumented per page
- component-definition.json, component-models.json, component-filters.json must be on main branch before UE can see blocks
- UE does not support mobile browsers

---

## XSC Authoring Setup — Universal Editor + EDS

This project uses the **xwalk / Universal Editor authoring model**. Content lives in AEM as a Cloud Service (JCR), authored through Universal Editor, and published to the EDS CDN. This is NOT the document-based authoring model (da.live / SharePoint / Google Docs). Do not confuse the two — they share the same EDS rendering engine but the authoring path is completely different.

**In this model:**
- Content is stored in **AEM CS JCR** (not Google Docs, not SharePoint, not da.live)
- Authors edit in **Universal Editor** (not da.live, not a document editor)
- Images come from the **AEM DAM via Asset Picker** (not media bus paste)
- Nav and footer are **AEM page fragments** authored in UE (not `/nav` doc files)
- Publishing flows **AEM CS Publish → EDS CDN** via the xwalk connector

---

### The Two-System Mental Model

| Layer | Where it lives | Who touches it |
|-------|---------------|----------------|
| Code (blocks, CSS, JS, JSON models) | GitHub `AEMXSC/nexus-aem-showcase` | Claude Code / developers |
| Content (page text, images, structure) | AEM CS JCR (authored in UE) | XSC authors |
| Live delivery | EDS CDN (`aem.live`) | Automatic on publish |

Both systems must be correctly wired together before editing works. Code changes in GitHub reach the CDN via AEM Code Sync. Content changes in UE reach the CDN via the xwalk publish pipeline.

---

### One-Time Infrastructure Setup (do this once per repo)

**1. AEM Code Sync GitHub App**
Install at: `https://github.com/apps/aem-code-sync`
Select `nexus-aem-showcase` during install.
Without this, code changes in GitHub never reach the CDN. The site serves stale blocks forever.

**2. Sidekick Browser Extension**
Install at: `https://chromewebstore.google.com/detail/aem-sidekick/igkmdomcgoebiipaifhmpfjhbjccggml`

Works on Chrome and all Chromium-based browsers. For Microsoft Edge: go to `edge://extensions` → enable "Allow extensions from other stores" → then install from the Chrome Web Store link above.

After installing, add the project to Sidekick:
1. Navigate to `https://main--nexus-aem-showcase--AEMXSC.aem.page/` in your browser
2. Click the Sidekick icon → click the context menu (≡) → **Add this project**

Sidekick will then recognise all URLs for this project automatically. No config file needed for basic use.

**3. head.html — Universal Editor Connection Tag**
`head.html` in the repo root must contain:
```html
<meta name="urn:auecon:aemconnection" content="aem:https://author-pXXXXX-eXXXXX.adobeaemcloud.com">
```
Replace with the actual AEM CS author URL for this Cloud Manager program.

This is the single most important config for UE. Without it, UE opens the page but cannot connect to AEM — edits appear to work but nothing persists. Every xwalk project must have this tag.

**4. component JSON files must be on main branch**
UE reads `component-definition.json`, `component-models.json`, and `component-filters.json` directly from the `main` branch of GitHub. If these are on a feature branch, UE cannot see the blocks and the Add panel is empty. Always merge to main before testing UE authoring.

---

### URL Reference — Bookmark These

| Purpose | URL |
|---------|-----|
| Preview URL | `https://main--nexus-aem-showcase--AEMXSC.aem.page` |
| Live site | `https://main--nexus-aem-showcase--AEMXSC.aem.live` |
| Open Universal Editor | `https://experience.adobe.com/#/aem/editor/canvas/https://main--nexus-aem-showcase--AEMXSC.aem.page` |
| AEM CS Author | `https://author-pXXXXX-eXXXXX.adobeaemcloud.com` |
| Install Sidekick | `https://chromewebstore.google.com/detail/aem-sidekick/igkmdomcgoebiipaifhmpfjhbjccggml` |
| Install Code Sync | `https://github.com/apps/aem-code-sync` |

Preview URLs (`aem.page`) are for authoring and QA only — do not share with customers.
Live URLs (`aem.live`) are the production CDN — use these in demos.

---

### Universal Editor Authoring Workflow (exact sequence)

**Step 1: Open Universal Editor**
Navigate directly to UE via the URL above, or open the preview URL in Chrome and click Sidekick → **Edit**.
You must be signed into Adobe Experience Cloud with access to the correct AEM CS program and IMS org.

**Step 2: Edit content**
Click any block on the canvas → blue outline appears → fields appear in the right Properties Rail.
- Text fields: edit inline or in the Properties Rail
- Rich text: double-click to activate inline editor
- Images: click the reference field → Asset Picker opens → browse or search the AEM DAM → confirm selection
- Repeating items (team cards, demo cards): click the container to select the list, then click individual items to edit

**Step 3: Add a new block**
Click the **+** button that appears between sections → Add panel opens → select a block from the list.
Block names in the Add panel come from `component-definition.json`. If a block is missing, check that its definition is in that file and the file is on `main`.

**Step 4: Publish**
Click **Publish** in the UE toolbar (or use Sidekick → Publish on the preview URL).
Content is live on `aem.live` within seconds via the EDS CDN.

---

### Nav and Footer in the xwalk Model

Nav and footer are **AEM page fragments** — they are separate AEM pages authored in UE, not document files.

- Create a page at `/content/nexus-aem-showcase/nav` in AEM CS
- Create a page at `/content/nexus-aem-showcase/footer` in AEM CS
- Author them in UE like any other page
- The `header.js` block loads the nav fragment via `loadFragment('/nav')`
- The `footer.js` block loads the footer fragment via `loadFragment('/footer')`

To update nav links: open the nav fragment page in UE, edit the links, publish. Do not touch `header.js`.

---

### Image Handling in the xwalk Model

Images are served from the **AEM DAM**, not pasted into documents.

- In UE: click any `reference` field → Asset Picker opens → select from DAM
- To add new images: upload to DAM first via AEM Assets console, then select in UE
- Image URLs follow the pattern: `https://publish-pXXXXX-eXXXXX.adobeaemcloud.com/content/dam/...`
- EDS optimizes and serves these via its CDN automatically on publish

Do NOT paste external image URLs into content fields. They bypass DAM governance and will not be optimized.

---

### Common Failure Points

- **UE opens but Properties Rail is empty** → not logged into the correct Adobe IMS org / not provisioned on the AEM CS program
- **Edits don't persist after reload** → `head.html` is missing the `urn:auecon:aemconnection` meta tag
- **Block not available in Add panel** → `component-definition.json` entry is missing or file is not on `main` branch
- **Code changes not showing on live site** → AEM Code Sync GitHub app is not installed on this repo
- **Asset Picker doesn't open** → user does not have DAM read permissions on the AEM CS program
- **Page renders blank** → `fstab.yaml` is misconfigured or xwalk connector is not set up on the Cloud Manager program
- **UE shows visual but can't edit** → page was not published to `aem.page` preview first, or UE is being opened on the `aem.live` URL instead of `aem.page`

---

## xwalk-Specific Gotchas (learned from CitiSignal production setup)

These are silent failure points that won't show obvious errors. Check them before assuming the code is broken.

### paths.json

`paths.json` in the repo root maps the AEM content path to the EDS URL path. If your AEM site was created with a folder name that differs from the default, this file must be updated.

Default (leave as-is if AEM site name matches repo name):
```json
{
  "mappings": [
    "/content/nexus-aem-showcase/:/"
  ]
}
```

If your AEM site was created as `/content/nexus` or any other name, update the left side of the mapping to match. Wrong path = pages load blank with no error.

### Metadata Spreadsheet (Author + Publish URLs)

This is separate from the page-level metadata block. It is a spreadsheet file inside the AEM Sites admin for the project that holds the Author URL and Publish URL used by the xwalk connector and UE.

To fill it in:
1. Go to AEM Sites admin → open the nexus-aem-showcase site
2. Find the "Metadata" file — open it
3. Fill in the Author URL: `https://author-pXXXXX-eXXXXX.adobeaemcloud.com`
4. Fill in the Publish URL: `https://publish-pXXXXX-eXXXXX.adobeaemcloud.com`

**Critical: use Chrome for this step. Safari breaks the metadata spreadsheet editor.**

### No Trailing Slash on Author/Publish URLs

The Author and Publish URLs in the metadata spreadsheet must NOT have a trailing slash.

```
✅ Correct:   https://author-p152653-e1583859.adobeaemcloud.com
❌ Wrong:     https://author-p152653-e1583859.adobeaemcloud.com/
```

A trailing slash causes silent failures — blocks that depend on AEM data don't render, and there is no console error pointing to the cause.

### fstab.yaml Points to AEM Author (not da.live)

In the xwalk model, `fstab.yaml` points to the AEM CS author instance, not da.live or SharePoint.

```yaml
mountpoints:
  /:
    url: https://author-pXXXXX-eXXXXX.adobeaemcloud.com/bin/franklin.delivery/AEMXSC/nexus-aem-showcase/main
```

The exact URL format depends on the xwalk connector version installed on the Cloud Manager program. Check an existing working xwalk project (e.g. CitiSignal) to confirm the correct URL pattern for your AEM CS environment.

### GraphQL Endpoint (only if using Content Fragments)

If any blocks in Nexus use Content Fragments (CF block, dynamic data), a GraphQL endpoint must be created and published in AEM before those blocks will render. Steps:

1. Tools → General → Configuration Browser → your site folder → Publish
2. Tools → General → GraphQL → Create → name it → select your site's CF schema
3. Select the new endpoint → Publish
4. Dismiss the security console prompt (configure permissions separately if needed)
5. Tools → General → GraphQL Query Editor → change dropdown to your endpoint → select and Publish each query

For the initial Nexus showcase build, Content Fragments are not used. Skip this unless a CF-driven block is added later.
