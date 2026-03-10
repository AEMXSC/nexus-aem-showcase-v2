import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  loadScript,
  sampleRUM,
  getMetadata,
  toCamelCase,
  toClassName,
} from './aem.js';

/**
 * Returns all metadata elements matching a given prefix.
 * @param {string} scope The prefix to match
 * @returns {object} Key/value pairs of matching metadata
 */
export function getAllMetadata(scope) {
  return [...document.head.querySelectorAll(`meta[property^="${scope}:"],meta[name^="${scope}-"]`)]
    .reduce((res, meta) => {
      const id = toClassName(meta.name
        ? meta.name.substring(scope.length + 1)
        : meta.getAttribute('property').split(':').pop());
      res[id] = meta.getAttribute('content');
      return res;
    }, {});
}

/**
 * Audience definitions for experimentation.
 */
const AUDIENCES = {
  mobile: () => window.innerWidth < 600,
  desktop: () => window.innerWidth >= 600,
};

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Detects flat CDN content and rebuilds block structure from
 * table-based HTML stored in GitHub. Converts <hr> to section
 * boundaries and <table> to block divs.
 */
async function ensureBlockStructure(main) {
  if (window.location.hostname === 'localhost') return;
  const sections = main.querySelectorAll(':scope > div');
  const hasBlocks = main.querySelector('div[class]:not(.section):not([class^="default"])');
  if (sections.length > 1 || hasBlocks) return;

  try {
    const path = window.location.pathname === '/' ? '/index' : window.location.pathname.replace(/\/$/, '');
    const resp = await fetch(`https://raw.githubusercontent.com/AEMXSC/XSCTeamSite/main/content${path}.html`);
    if (!resp.ok) return;

    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const source = doc.querySelector('main');
    if (!source) return;

    main.innerHTML = '';
    let section = document.createElement('div');

    [...source.children].forEach((child) => {
      if (child.tagName === 'HR') {
        if (section.children.length) {
          main.appendChild(section);
          section = document.createElement('div');
        }
      } else if (child.tagName === 'TABLE') {
        const th = child.querySelector('tr:first-child th');
        if (th) {
          const blockName = toClassName(th.textContent.trim());
          const block = document.createElement('div');
          block.className = blockName;
          child.querySelectorAll('tr:not(:first-child)').forEach((row) => {
            const rowDiv = document.createElement('div');
            row.querySelectorAll('td').forEach((cell) => {
              const cellDiv = document.createElement('div');
              cellDiv.innerHTML = cell.innerHTML;
              rowDiv.appendChild(cellDiv);
            });
            block.appendChild(rowDiv);
          });
          section.appendChild(block);
        }
      } else {
        section.appendChild(child.cloneNode(true));
      }
    });
    if (section.children.length) main.appendChild(section);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Block structure rebuild failed', e);
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export async function decorateMain(main) {
  await ensureBlockStructure(main);
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  // Experimentation — must run before decorateMain to swap variant content
  if (getMetadata('experiment')
    || Object.keys(getAllMetadata('campaign')).length
    || Object.keys(getAllMetadata('audience')).length) {
    // eslint-disable-next-line import/no-unresolved
    const { loadEager: runEager } = await import('@adobe/aem-experimentation/src/index.js');
    await runEager(document, { audiences: AUDIENCES }, {
      getAllMetadata, getMetadata, loadCSS, loadScript, sampleRUM, toCamelCase, toClassName,
    });
  }

  const main = doc.querySelector('main');
  if (main) {
    await decorateMain(main);
    await loadSection(main.querySelector('.section'), waitForFirstImage);
    document.body.classList.add('appear');
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // Experimentation — load lazy (simulation UI, analytics integration)
  if (getMetadata('experiment')
    || Object.keys(getAllMetadata('campaign')).length
    || Object.keys(getAllMetadata('audience')).length) {
    // eslint-disable-next-line import/no-unresolved
    const { loadLazy: runLazy } = await import('@adobe/aem-experimentation/src/index.js');
    await runLazy(document, { audiences: AUDIENCES }, {
      getAllMetadata, getMetadata, loadCSS, loadScript, sampleRUM, toCamelCase, toClassName,
    });
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

export async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

// DA.live authoring tools — activate via query params
(function da() {
  const { searchParams } = new URL(window.location.href);
  if (searchParams.has('dapreview')) {
    import('../tools/da/da.js').then((mod) => mod.default(loadPage));
  }
  if (searchParams.has('quick-edit')) {
    import('../tools/quick-edit/quick-edit.js').then((mod) => mod.default(loadPage));
  }
}());

loadPage();
