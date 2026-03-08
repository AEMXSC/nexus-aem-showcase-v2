export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  if (!cell) return;

  const heading = cell.querySelector('h1, h2, h3');
  const subheadP = cell.querySelector('p:not(:has(> a))');
  const ctaPs = [...cell.querySelectorAll('p:has(> a)')];
  const primaryP = ctaPs[0] || null;
  const secondaryP = ctaPs[1] || null;

  if (primaryP) {
    const a = primaryP.querySelector('a');
    if (a) a.classList.add('button', 'primary');
  }

  if (secondaryP) {
    const a = secondaryP.querySelector('a');
    if (a) a.classList.add('button', 'secondary');
  }

  block.innerHTML = '';

  const inner = document.createElement('div');
  inner.className = 'cta-inner';
  if (heading) inner.append(heading);
  if (subheadP) inner.append(subheadP);

  if (primaryP || secondaryP) {
    const ctas = document.createElement('div');
    ctas.className = 'cta-buttons';
    if (primaryP) ctas.append(primaryP);
    if (secondaryP) ctas.append(secondaryP);
    inner.append(ctas);
  }

  block.append(inner);
}
