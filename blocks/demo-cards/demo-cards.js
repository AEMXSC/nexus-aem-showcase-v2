export default function decorate(block) {
  const items = [...block.children].map((row) => {
    const cells = [...row.children];
    const titleEl = cells[0]?.querySelector('h2, h3, strong');
    const title = titleEl?.textContent.trim() || cells[0]?.textContent.trim() || '';
    const badge = cells[1]?.textContent.trim() || '';
    const status = (cells[2]?.textContent.trim() || 'coming').toLowerCase().replace(/\s+/g, '-');
    const isLive = status === 'live';

    const card = document.createElement('div');
    card.className = 'demo-card';
    card.innerHTML = `
      <div class="demo-card-pills">
        <span class="demo-card-status demo-card-status-${isLive ? 'live' : 'coming'}">
          ${isLive ? '● Live' : 'Coming Soon'}
        </span>
        ${badge ? `<span class="demo-card-badge">${badge}</span>` : ''}
      </div>
      <h3 class="demo-card-title">${title}</h3>
      ${!isLive ? '<button class="demo-card-request">Request Early Access</button>' : ''}`;
    return card;
  });

  const grid = document.createElement('div');
  grid.className = 'demo-grid';
  items.forEach((card) => grid.append(card));

  block.innerHTML = '';
  block.append(grid);
}
