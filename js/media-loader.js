class MediaLoader {
  constructor() {
    this.cache = new Map();
    this.scrollObserver = null;
    this.gridObserver = null;
    this.bestFormat = null; // detected async: 'avif', 'webp', or 'jpg'
  }

  // Detect best supported image format using data URI probes
  async detectBestFormat() {
    if (this.bestFormat) return this.bestFormat;

    const checkFormat = (dataUri) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width === 1 && img.height === 1);
      img.onerror = () => resolve(false);
      img.src = dataUri;
    });

    // 1x1 AVIF (smallest valid AVIF)
    const avifSupported = await checkFormat(
      'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABhAQ0GkyCRAAAAAP+I9ngA=='
    );
    if (avifSupported) { this.bestFormat = 'avif'; return 'avif'; }

    // 1x1 WebP
    const webpSupported = await checkFormat(
      'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'
    );
    if (webpSupported) { this.bestFormat = 'webp'; return 'webp'; }

    this.bestFormat = 'jpg';
    return 'jpg';
  }

  // Map a .jpg URL to the best supported format
  toBestFormat(url) {
    if (!this.bestFormat || this.bestFormat === 'jpg') return url;
    return url.replace(/\.jpg$/, `.${this.bestFormat}`);
  }

  // Preload critical assets with fetch() into blob URLs for instant display
  async preloadCritical(urls) {
    // Detect format first so we can preload the best version
    await this.detectBestFormat();

    const promises = urls.map(async (url) => {
      const bestUrl = this.toBestFormat(url);
      try {
        const resp = await fetch(bestUrl);
        if (!resp.ok) {
          // Fall back to original jpg if best format fails
          if (bestUrl !== url) {
            const fallback = await fetch(url);
            if (!fallback.ok) return null;
            const blob = await fallback.blob();
            const blobUrl = URL.createObjectURL(blob);
            this.cache.set(url, blobUrl);
            return blobUrl;
          }
          return null;
        }
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        // Cache under the original jpg key so intro.js lookups work
        this.cache.set(url, blobUrl);
        return blobUrl;
      } catch (e) {
        console.warn(`MediaLoader: failed to preload ${bestUrl}`, e);
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
    }, { rootMargin: '0px 5000px 0px 0px' });

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
