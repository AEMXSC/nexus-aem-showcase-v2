export default function decorate(block) {
  const items = [...block.children].map((row, i) => {
    const cells = [...row.children];
    const icon = cells[0]?.textContent.trim() || '';
    const titleEl = cells[1]?.querySelector('h2, h3, strong');
    const title = titleEl?.textContent.trim() || cells[1]?.textContent.trim() || '';
    const desc = cells[2]?.innerHTML || '';

    const step = document.createElement('div');
    step.className = 'step';
    step.innerHTML = `
      <div class="step-number" aria-hidden="true">${icon}</div>
      <div class="step-content">
        <span class="step-label">Step ${i + 1}</span>
        <h3 class="step-title">${title}</h3>
        <div class="step-desc">${desc}</div>
      </div>`;
    return step;
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'steps-grid';
  items.forEach((step) => wrapper.append(step));

  block.innerHTML = '';
  block.append(wrapper);
}
