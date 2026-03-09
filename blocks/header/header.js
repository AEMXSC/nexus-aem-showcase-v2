export default function decorate(block) {
  const headerEl = block.closest('header');

  headerEl.innerHTML = `
    <div class="nav-wrapper">
      <div class="nav-inner">
        <a href="#hero" class="nav-brand">
          <svg width="28" height="24" viewBox="0 0 30 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M11.5 0H0V26L11.5 0Z" fill="hsl(0 100% 46%)"/>
            <path d="M18.5 0H30V26L18.5 0Z" fill="hsl(0 100% 46%)"/>
            <path d="M15 9.5L21.5 26H17L14.5 19H10L15 9.5Z" fill="hsl(0 100% 46%)"/>
          </svg>
          <span class="nav-logo-text">
            AEM <span class="nav-logo-xsc">XSC</span>
          </span>
        </a>
        <button class="nav-hamburger" aria-label="Menu" aria-expanded="false">
          <span class="nav-hamburger-icon"></span>
        </button>
        <ul class="nav-links">
          <li><a href="#work">What We Do</a></li>
          <li><a href="#motions">Motions</a></li>
          <li><a href="#verticals">Verticals</a></li>
          <li><a href="#team">Team</a></li>
          <li><a href="#demos">Demos</a></li>
        </ul>
        <a href="#engage" class="nav-cta">Engage Us</a>
      </div>
    </div>
  `;

  const navWrapper = headerEl.querySelector('.nav-wrapper');
  const hamburger = headerEl.querySelector('.nav-hamburger');
  const navLinks = headerEl.querySelector('.nav-links');

  hamburger.addEventListener('click', () => {
    const isOpen = navWrapper.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', isOpen);
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
}
