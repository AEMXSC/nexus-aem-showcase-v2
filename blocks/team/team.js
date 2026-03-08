export default function decorate(block) {
  const items = [...block.children].map((row) => {
    const cells = [...row.children];
    const initials = cells[0]?.textContent.trim() || '';
    const name = cells[1]?.textContent.trim() || '';
    const role = cells[2]?.textContent.trim() || '';
    const vertical = cells[3]?.textContent.trim() || '';

    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-avatar" aria-hidden="true">${initials}</div>
      <div class="team-info">
        <div class="team-name">${name}</div>
        <div class="team-role">${role}</div>
        ${vertical ? `<span class="team-badge">${vertical}</span>` : ''}
      </div>`;
    return card;
  });

  const grid = document.createElement('div');
  grid.className = 'team-grid';
  items.forEach((card) => grid.append(card));

  block.innerHTML = '';
  block.append(grid);
}
