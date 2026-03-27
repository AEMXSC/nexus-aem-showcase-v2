/* carousel — auto-advancing slide carousel mapped from AEM Core Carousel v1 */

let carouselCount = 0;

export default function decorate(block) {
  const id = `carousel-${carouselCount++}`;
  const slides = [...block.children].map((row, i) => {
    const cells = [...row.children];
    // Col 0: image (optional), Col 1: heading + body text
    const hasImage = cells.length > 1 && cells[0].querySelector('picture, img');
    const imageCell = hasImage ? cells[0] : null;
    const contentCell = hasImage ? cells[1] : cells[0];

    const slide = document.createElement('li');
    slide.className = 'carousel-slide';
    slide.setAttribute('role', 'tabpanel');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `Slide ${i + 1}`);
    slide.id = `${id}-slide-${i}`;

    if (imageCell) {
      const img = document.createElement('div');
      img.className = 'carousel-slide-image';
      img.append(...imageCell.childNodes);
      slide.append(img);
    }

    const content = document.createElement('div');
    content.className = 'carousel-slide-content';
    content.append(...contentCell.childNodes);
    slide.append(content);

    return slide;
  });

  const total = slides.length;
  if (!total) return;

  // Track
  const track = document.createElement('ul');
  track.className = 'carousel-track';
  track.setAttribute('aria-live', 'polite');
  slides.forEach((s) => track.append(s));

  // Dots
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  dots.setAttribute('role', 'tablist');
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-controls', `${id}-slide-${i}`);
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dots.append(dot);
  });

  // Prev / Next buttons
  const prev = document.createElement('button');
  prev.className = 'carousel-btn carousel-btn-prev';
  prev.setAttribute('aria-label', 'Previous slide');
  prev.innerHTML = '&#8592;';
  prev.addEventListener('click', () => goTo((current - 1 + total) % total));

  const next = document.createElement('button');
  next.className = 'carousel-btn carousel-btn-next';
  next.setAttribute('aria-label', 'Next slide');
  next.innerHTML = '&#8594;';
  next.addEventListener('click', () => goTo((current + 1) % total));

  let current = 0;
  let timer;

  function goTo(index) {
    slides[current].classList.remove('is-active');
    dots.children[current].classList.remove('is-active');
    dots.children[current].removeAttribute('aria-selected');
    current = index;
    slides[current].classList.add('is-active');
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.children[current].classList.add('is-active');
    dots.children[current].setAttribute('aria-selected', 'true');
    resetTimer();
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo((current + 1) % total), 5000);
  }

  goTo(0);

  // Pause on hover
  block.addEventListener('mouseenter', () => clearInterval(timer));
  block.addEventListener('mouseleave', resetTimer);

  // Keyboard nav
  block.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo((current - 1 + total) % total);
    if (e.key === 'ArrowRight') goTo((current + 1) % total);
  });

  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  viewport.append(track);

  block.innerHTML = '';
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');
  block.setAttribute('aria-label', 'Carousel');
  block.setAttribute('tabindex', '0');
  block.append(prev, viewport, next, dots);
}
