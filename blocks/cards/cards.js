export default function decorate(block) {
  const items = [...block.children].map((row) => {
    const cells = [...row.children];

    // Col 0: icon (emoji or text)
    const icon = cells[0]?.textContent.trim() || '';

    // Col 1: title — extract text from h2/h3/strong, or raw cell text
    const titleEl = cells[1]?.querySelector('h2, h3, strong');
    const title = titleEl ? titleEl.textContent.trim() : (cells[1]?.textContent.trim() || '');

    // Col 2: description — if present use it; otherwise fall back to col 1 content
    // but NEVER duplicate the title in the description
    let desc = '';
    if (cells[2]) {
      desc = cells[2].innerHTML;
    } else if (cells[1]) {
      // Remove the title element clone so desc doesn't repeat it
      const clone = cells[1].cloneNode(true);
      const titleClone = clone.querySelector('h2, h3, strong');
      if (titleClone) titleClone.remove();
      desc = clone.innerHTML.trim();
    }

    const li = document.createElement('li');
    li.className = 'cards-item';
    li.innerHTML = `
      <div class="cards-item-icon" aria-hidden="true">${icon}</div>
      <div class="cards-item-body">
        <h3 class="cards-item-title">${title}</h3>
        <div class="cards-item-desc">${desc}</div>
      </div>`;
    return li;
  });

  const ul = document.createElement('ul');
  ul.className = 'cards-list';
  items.forEach((li) => ul.append(li));

  block.innerHTML = '';
  block.append(ul);
}
