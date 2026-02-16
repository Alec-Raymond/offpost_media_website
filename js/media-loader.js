class MediaLoader {
  constructor() {
    this.cache = new Map();
    this.scrollObserver = null;
    this.gridObserver = null;
  }

  // Preload critical assets with fetch() into blob URLs for instant display
  async preloadCritical(urls) {
    const promises = urls.map(async (url) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        this.cache.set(url, blobUrl);
        return blobUrl;
      } catch (e) {
        console.warn(`MediaLoader: failed to preload ${url}`, e);
        return null;
      }
    });
    return Promise.all(promises);
  }

  // Swap data-src/data-srcset onto the real attributes for an element
  _loadElement(el) {
    if (el.dataset.srcset) {
      el.srcset = el.dataset.srcset;
      delete el.dataset.srcset;
    }
    if (el.dataset.src) {
      el.src = el.dataset.src;
      delete el.dataset.src;
    }
    // Also load sibling <source> elements inside the same <picture>
    if (el.tagName === 'IMG') {
      const picture = el.closest('picture');
      if (picture) {
        picture.querySelectorAll('source[data-srcset]').forEach(source => {
          source.srcset = source.dataset.srcset;
          delete source.dataset.srcset;
        });
      }
    }
  }

  // For horizontal scroll: preload images ahead of current viewport
  initScrollPreload(imageElements, preloadAhead = 3) {
    this.scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._loadElement(entry.target);
          this.scrollObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 3000px 0px 0px' });

    imageElements.forEach(el => this.scrollObserver.observe(el));
  }

  // Portfolio grid: standard lazy loading with vertical rootMargin
  initGridLazyLoad(imageElements) {
    this.gridObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._loadElement(entry.target);
          this.gridObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '500px 0px' });

    imageElements.forEach(el => this.gridObserver.observe(el));
  }
}

export default MediaLoader;
