export default function decorate(block) {
  const footerEl = block.closest('footer');
  footerEl.innerHTML = `
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-brand">
          <svg width="24" height="20" viewBox="0 0 30 26" fill="none" aria-hidden="true">
            <path d="M11.5 0H0V26L11.5 0Z" fill="#EB1000"/>
            <path d="M18.5 0H30V26L18.5 0Z" fill="#EB1000"/>
            <path d="M15 9.5L21.5 26H17L14.5 19H10L15 9.5Z" fill="#EB1000"/>
          </svg>
          <div>
            <div class="footer-logo-text">Adobe <span class="footer-logo-accent">Experience Manager</span></div>
            <p class="footer-tagline">Edge Delivery Services</p>
          </div>
        </div>
        <nav class="footer-nav" aria-label="Footer">
          <a href="#the-team">Team</a>
          <a href="#vertical-coverage">Verticals</a>
          <a href="#the-three-revenue-motions">Motions</a>
          <a href="#demo-environments">Demos</a>
          <a href="#how-we-engage">Engage</a>
        </nav>
        <div class="footer-meta">
          <span class="footer-powered">Powered by AEM Edge Delivery Services</span>
          <span class="footer-score">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
            100
          </span>
        </div>
      </div>
      <div class="footer-copyright">&copy; 2026 Adobe. All rights reserved.</div>
    </div>
  `;
}
