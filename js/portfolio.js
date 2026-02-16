import MediaLoader from './media-loader.js';

class Portfolio {
  constructor() {
    this.grid = document.getElementById('portfolio-grid');
    this.lightbox = document.getElementById('lightbox');
    this.lightboxImg = this.lightbox ? this.lightbox.querySelector('.lightbox__img') : null;
    this.loader = new MediaLoader();
  }

  async init() {
    if (!this.grid) return;

    let config;
    try {
      const resp = await fetch('portfolio-config.json');
      if (!resp.ok) throw new Error('Config not found');
      config = await resp.json();
    } catch (e) {
      this.grid.innerHTML = '<p style="color:#999;text-align:center;padding:4rem;">Portfolio configuration not found.</p>';
      console.error('Portfolio: could not load portfolio-config.json', e);
      return;
    }

    if (config.title) document.title = config.title;

    config.sections.forEach(section => {
      const sectionEl = document.createElement('section');
      sectionEl.className = 'portfolio-section';

      const heading = document.createElement('h2');
      heading.textContent = section.heading;
      sectionEl.appendChild(heading);

      const gridInner = document.createElement('div');
      gridInner.className = 'portfolio-grid-inner';

      section.images.forEach(imgData => {
        const item = document.createElement('div');
        const validSizes = ['small', 'medium', 'large', 'full-width'];
        const size = validSizes.includes(imgData.size) ? imgData.size : 'medium';
        item.className = `grid-item grid-item--${size}`;

        const picture = document.createElement('picture');

        const sourceAvif = document.createElement('source');
        sourceAvif.type = 'image/avif';
        sourceAvif.dataset.srcset = `assets/images/medium/${imgData.src}.avif`;

        const sourceWebp = document.createElement('source');
        sourceWebp.type = 'image/webp';
        sourceWebp.dataset.srcset = `assets/images/medium/${imgData.src}.webp`;

        const imgEl = document.createElement('img');
        imgEl.src = `assets/images/thumbs/${imgData.src}.jpg`;
        imgEl.dataset.src = `assets/images/medium/${imgData.src}.jpg`;
        imgEl.alt = imgData.alt || '';
        imgEl.loading = 'lazy';
        imgEl.decoding = 'async';

        picture.appendChild(sourceAvif);
        picture.appendChild(sourceWebp);
        picture.appendChild(imgEl);
        item.appendChild(picture);

        item.addEventListener('click', () => this._openLightbox(imgData));

        gridInner.appendChild(item);
      });

      sectionEl.appendChild(gridInner);
      this.grid.appendChild(sectionEl);
    });

    const allImages = this.grid.querySelectorAll('img[data-src]');
    this.loader.initGridLazyLoad(allImages);

    this._initLightbox();
  }

  _openLightbox(imgData) {
    if (!this.lightbox || !this.lightboxImg) return;
    this.lightboxImg.src = `assets/images/full/${imgData.src}.jpg`;
    this.lightboxImg.alt = imgData.alt || '';
    this.lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  _closeLightbox() {
    if (!this.lightbox || !this.lightboxImg) return;
    this.lightbox.hidden = true;
    this.lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  _initLightbox() {
    if (!this.lightbox) return;

    const closeBtn = this.lightbox.querySelector('.lightbox__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._closeLightbox());
    }

    this.lightbox.addEventListener('click', (e) => {
      if (e.target === this.lightbox) {
        this._closeLightbox();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.lightbox.hidden) {
        this._closeLightbox();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Portfolio().init();
});
