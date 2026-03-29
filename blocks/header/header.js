/* ---- helpers ---- */
function safeInt(val, fallback = 28) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 16 && n <= 48 ? n : fallback;
}

function readLogoConfig() {
  try {
    const cl = JSON.parse(localStorage.getItem('xsc-customer-logo') || 'null');
    if (!cl || typeof cl.url !== 'string' || !cl.url) return null;
    return {
      url: cl.url,
      height: safeInt(cl.height),
      name: typeof cl.name === 'string' ? cl.name : 'Partner',
    };
  } catch { return null; }
}

function buildLogoImg(url, alt, height) {
  const img = document.createElement('img');
  img.src = url;
  img.alt = `${alt} logo`;
  img.className = 'nav-customer-logo';
  img.height = height;
  img.style.maxHeight = `${height}px`;
  return img;
}

function buildPreviewImg(url, height) {
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Preview';
  img.style.maxHeight = `${height}px`;
  return img;
}

export default function decorate(block) {
  const headerEl = block.closest('header');

  headerEl.innerHTML = `
    <div class="nav-wrapper">
      <div class="nav-inner">
        <div class="nav-brand-group" id="navBrandGroup">
          <a href="/" class="nav-brand" aria-label="Adobe Experience Manager">
            <svg class="nav-adobe-logo" width="28" height="25" viewBox="0 0 30 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M11.5 0H0V26L11.5 0Z" fill="#EB1000"/>
              <path d="M18.5 0H30V26L18.5 0Z" fill="#EB1000"/>
              <path d="M15 9.5L21.5 26H17L14.5 19H10L15 9.5Z" fill="#EB1000"/>
            </svg>
            <span class="nav-logo-text">
              Adobe <span class="nav-logo-accent">Experience Manager</span>
            </span>
          </a>
        </div>
        <button class="nav-hamburger" aria-label="Menu" aria-expanded="false">
          <span class="nav-hamburger-icon"></span>
        </button>
        <ul class="nav-links">
          <li><a href="#what-we-do">What We Do</a></li>
          <li><a href="#the-three-revenue-motions">Motions</a></li>
          <li><a href="#vertical-coverage">Verticals</a></li>
          <li><a href="#the-team">Team</a></li>
          <li><a href="#demo-environments">Demos</a></li>
        </ul>
        <div class="nav-actions">
          <button class="nav-admin-btn" aria-label="Admin" title="Demo Admin">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <a href="#how-we-engage" class="nav-cta">Engage Us</a>
        </div>
      </div>
    </div>

    <!-- Admin Panel Modal -->
    <div class="admin-modal" id="adminModal" role="dialog" aria-modal="true" aria-labelledby="adminTitle" hidden>
      <div class="admin-backdrop"></div>
      <div class="admin-panel">
        <div class="admin-header">
          <h2 id="adminTitle">Demo Admin</h2>
          <button class="admin-close" aria-label="Close">&times;</button>
        </div>
        <div class="admin-body">
          <section class="admin-section">
            <h3>Customer Co-Brand Logo</h3>
            <p class="admin-hint">Add a customer logo to display beside the Adobe logo during demos.</p>
            <div class="admin-logo-preview" id="adminLogoPreview">
              <span class="admin-logo-placeholder">No logo set</span>
            </div>
            <div class="admin-field">
              <label for="logoUrl">Logo URL</label>
              <input type="url" id="logoUrl" placeholder="https://example.com/logo.png" />
            </div>
            <div class="admin-field">
              <label>Or upload file</label>
              <input type="file" id="logoFile" accept="image/png,image/webp,image/svg+xml,image/jpeg" />
            </div>
            <div class="admin-row">
              <div class="admin-field admin-field-small">
                <label for="logoHeight">Height (px)</label>
                <input type="number" id="logoHeight" value="28" min="16" max="48" />
              </div>
              <div class="admin-field admin-field-small">
                <label for="logoName">Company Name</label>
                <input type="text" id="logoName" placeholder="Acme Corp" />
              </div>
            </div>
            <div class="admin-field-actions">
              <button class="admin-btn admin-btn-primary" id="adminSaveLogo">Apply Logo</button>
              <button class="admin-btn admin-btn-danger" id="adminClearLogo">Remove Logo</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  /* ---- Inject customer logo via safe DOM APIs ---- */
  const cl = readLogoConfig();
  if (cl) {
    const brandGroup = headerEl.querySelector('#navBrandGroup');
    const sep = document.createElement('span');
    sep.className = 'nav-cobrand-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '\u00D7';
    brandGroup.append(sep, buildLogoImg(cl.url, cl.name, cl.height));
  }

  /* ---- Nav interactions ---- */
  const navWrapper = headerEl.querySelector('.nav-wrapper');
  const hamburger = headerEl.querySelector('.nav-hamburger');
  const navLinks = headerEl.querySelector('.nav-links');

  hamburger.addEventListener('click', () => {
    const isOpen = navWrapper.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      navWrapper.classList.remove('nav-open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navWrapper.classList.add('scrolled');
    } else {
      navWrapper.classList.remove('scrolled');
    }
  }, { passive: true });

  /* ---- Admin Panel ---- */
  const modal = headerEl.querySelector('#adminModal');
  const adminBtn = headerEl.querySelector('.nav-admin-btn');
  const closeBtn = headerEl.querySelector('.admin-close');
  const backdrop = headerEl.querySelector('.admin-backdrop');

  function openAdmin() {
    modal.hidden = false;
    loadCurrentLogo();
    closeBtn.focus();
  }

  function closeAdmin() {
    modal.hidden = true;
    adminBtn.focus();
  }

  adminBtn.addEventListener('click', openAdmin);
  closeBtn.addEventListener('click', closeAdmin);
  backdrop.addEventListener('click', closeAdmin);

  /* Escape key closes modal */
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAdmin(); e.stopPropagation(); }
  });

  /* load current logo into preview (safe DOM APIs) */
  function loadCurrentLogo() {
    const preview = headerEl.querySelector('#adminLogoPreview');
    const cfg = readLogoConfig();
    if (cfg) {
      preview.replaceChildren(buildPreviewImg(cfg.url, cfg.height));
      const urlInput = headerEl.querySelector('#logoUrl');
      const heightInput = headerEl.querySelector('#logoHeight');
      const nameInput = headerEl.querySelector('#logoName');
      if (urlInput) urlInput.value = cfg.url;
      if (heightInput) heightInput.value = cfg.height;
      if (nameInput) nameInput.value = cfg.name;
    } else {
      preview.replaceChildren();
      const span = document.createElement('span');
      span.className = 'admin-logo-placeholder';
      span.textContent = 'No logo set';
      preview.append(span);
    }
  }

  /* file upload -> data URL */
  const fileInput = headerEl.querySelector('#logoFile');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      headerEl.querySelector('#logoUrl').value = e.target.result;
      const h = safeInt(headerEl.querySelector('#logoHeight').value);
      const preview = headerEl.querySelector('#adminLogoPreview');
      preview.replaceChildren(buildPreviewImg(e.target.result, h));
    };
    reader.readAsDataURL(file);
  });

  /* save logo */
  headerEl.querySelector('#adminSaveLogo').addEventListener('click', () => {
    const url = headerEl.querySelector('#logoUrl').value.trim();
    const height = safeInt(headerEl.querySelector('#logoHeight').value);
    const name = headerEl.querySelector('#logoName').value.trim();
    if (!url) return;
    localStorage.setItem('xsc-customer-logo', JSON.stringify({ url, height, name }));
    closeAdmin();
    window.location.reload();
  });

  /* clear logo */
  headerEl.querySelector('#adminClearLogo').addEventListener('click', () => {
    localStorage.removeItem('xsc-customer-logo');
    closeAdmin();
    window.location.reload();
  });
}
