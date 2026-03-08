export default function decorate(block) {
  const grid = document.createElement('div');
  grid.className = 'verticals-grid';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const asv = cells[0]?.textContent.trim() || '';
    const name = cells[1]?.textContent.trim() || '';

    const card = document.createElement('div');
    card.className = 'vertical-card';
    card.innerHTML = `
      <div class="vertical-card-bar"></div>
      <div class="vertical-card-header">
        <span class="vertical-asv">${asv}</span>
        <span class="vertical-badge">Demo Available</span>
      </div>
      <h3 class="vertical-name">${name}</h3>
      <p class="vertical-label">ASV Target</p>`;
    grid.append(card);
  });

  block.innerHTML = '';
  block.append(grid);
}
