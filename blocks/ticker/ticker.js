export default function decorate(block) {
  const items = [...block.querySelectorAll('li')].map((li) => li.textContent.trim());
  if (!items.length) {
    // fallback: read each row as a single item
    [...block.children].forEach((row) => {
      const text = row.textContent.trim();
      if (text) items.push(text);
    });
  }

  // Duplicate items for seamless loop
  const allItems = [...items, ...items];

  const track = document.createElement('div');
  track.className = 'ticker-track';
  track.setAttribute('aria-hidden', 'true');

  allItems.forEach((text) => {
    const span = document.createElement('span');
    span.className = 'ticker-item';
    span.textContent = text;
    track.append(span);
  });

  // Accessible static version for screen readers
  const srList = document.createElement('ul');
  srList.className = 'visually-hidden';
  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    srList.append(li);
  });

  block.innerHTML = '';
  block.append(track);
  block.append(srList);
}
