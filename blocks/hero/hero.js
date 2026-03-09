export default function decorate(block) {
  // Find content: try xwalk richtext nesting first, then fall back to first cell
  let raw = block.querySelector(':scope > div > div > div');
  if (!raw) raw = block.querySelector(':scope > div > div');
  if (!raw) raw = block.querySelector(':scope > div');
  if (!raw) {
    // Treat the block itself as the content container
    raw = block;
  }

  const kids = [...raw.children];
  const allParaNoLink = kids.filter((el) => el.tagName === 'P' && !el.querySelector('a'));
  const allParaLink = kids.filter((el) => el.tagName === 'P' && el.querySelector('a'));
  const h1El = kids.find((el) => el.tagName === 'H1');
  const ulEl = kids.find((el) => el.tagName === 'UL');

  const container = document.createElement('div');
  container.className = 'hero-container';

  // 1. Eyebrow
  if (allParaNoLink[0]) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'hero-eyebrow';
    eyebrow.textContent = allParaNoLink[0].textContent.trim();
    container.appendChild(eyebrow);
  }

  // 2. H1
  if (h1El) {
    const heading = document.createElement('h1');
    heading.textContent = h1El.textContent.trim();
    container.appendChild(heading);
  }

  // 3. Subtext
  if (allParaNoLink[1]) {
    const sub = document.createElement('p');
    sub.className = 'hero-subtext';
    sub.textContent = allParaNoLink[1].textContent.trim();
    container.appendChild(sub);
  }

  // 4. CTAs side by side
  const ctaWrap = document.createElement('div');
  ctaWrap.className = 'hero-ctas';
  allParaLink.forEach((p, i) => {
    const a = p.querySelector('a');
    if (a) {
      const btn = document.createElement('a');
      btn.href = a.getAttribute('href') || '#';
      btn.textContent = a.textContent.trim();
      btn.className = i === 0 ? 'hero-btn-primary' : 'hero-btn-secondary';
      ctaWrap.appendChild(btn);
    }
  });
  if (ctaWrap.children.length) container.appendChild(ctaWrap);

  // 5. Stats
  if (ulEl) {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'hero-stats';
    ulEl.querySelectorAll('li').forEach((li) => {
      const strong = li.querySelector('strong');
      const statEl = document.createElement('div');
      statEl.className = 'hero-stat';
      const val = document.createElement('span');
      val.className = 'hero-stat-value';
      val.textContent = strong ? strong.textContent.trim() : '';
      const lbl = document.createElement('span');
      lbl.className = 'hero-stat-label';
      lbl.textContent = li.textContent.replace(val.textContent, '').trim();
      statEl.appendChild(val);
      statEl.appendChild(lbl);
      statsDiv.appendChild(statEl);
    });
    container.appendChild(statsDiv);
  }

  block.innerHTML = '';
  block.appendChild(container);
}
