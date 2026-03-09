export default function decorate(block) {
  const items = [...block.children].map((row) => {
    const cells = [...row.children];
    const number = cells[0]?.textContent.trim() || '';
    const titleEl = cells[1]?.querySelector('h2, h3, strong');
    const title = titleEl?.textContent.trim() || cells[1]?.textContent.trim() || '';
    const tag = cells[2]?.textContent.trim() || '';
    const proof = cells[3]?.textContent.trim() || '';

    const card = document.createElement('div');
    card.className = 'motion-card';
    card.dataset.number = number;
    card.innerHTML = `
      <h3 class="motion-title">${title}</h3>
      <p class="motion-desc">${cells[1]?.querySelector('p')?.textContent || cells[1]?.textContent.replace(title, '').trim() || ''}</p>
      ${tag ? `<span class="motion-tag">${tag}</span>` : ''}
      ${proof ? `<div class="motion-proof"><p>${proof}</p><a href="#demos" class="motion-proof-link">Build This Demo <span aria-hidden="true">\u2192</span></a></div>` : ''}`;
    return card;
  });

  const grid = document.createElement('div');
  grid.className = 'motions-grid';
  items.forEach((card) => grid.append(card));

  block.innerHTML = '';
  block.append(grid);
}
