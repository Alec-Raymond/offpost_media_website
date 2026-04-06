import MediaLoader from './media-loader.js';

class HorizontalScroll {
  constructor() {
    this.track = document.getElementById('scroll-track');
    this.wrapper = document.getElementById('scroll-wrapper');
    if (!this.track || !this.wrapper) return;

    this.current = 0;
    this.target = 0;
    this.currentSkew = 0;
    this.ease = 0.05;
    this.isEnabled = false;
    this.isMobile = window.innerWidth < 768;
    this.hintShown = false;

    // Touch state
    this.touchLastX = 0;
    this.touchLastY = 0;

    this.loader = new MediaLoader();
    this._animate = this._animate.bind(this);
    
    // BIND CONTACT LINK IMMEDIATELY
    this.bindContactLink();

    // Setup hint listener immediately
    this.setupHintListener();

    // Check for ?contact=true param (from portfolio page contact link)
    if (new URLSearchParams(window.location.search).get('contact') === 'true') {
      this._scrollToContact();
    }
  }

  setupHintListener() {
    const showHint = () => {
      if (this.hintShown) return;
      this.hintShown = true;
      setTimeout(() => {
        const scrollTip = document.getElementById('scroll-tip');
        if (scrollTip && this.target < 50) {
          scrollTip.classList.add('scroll-tip--visible');
        }
      }, 4000);
    };

    window.addEventListener('tagline-faded', showHint, { once: true });

    // ABSOLUTE FALLBACK: If nothing happens in 10s, show it anyway
    setTimeout(showHint, 10000);
  }

  _getMaxScroll() {
    return this.track.scrollWidth - window.innerWidth;
  }

  init() {
    if (!this.track) return;

    // Fix mobile viewport height issues
    const setRealVh = () => {
      let vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', setRealVh);
    setRealVh();

    if (document.body.classList.contains('scroll-enabled')) {
      this._start();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.body.classList.contains('scroll-enabled')) {
        this._start();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  _start() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.bindEvents();
    this.initLazyImages();
    
    setTimeout(() => {
      if (this.target === 0) {
        this.target = 0;
        this.current = 0;
      }
    }, 100);

    requestAnimationFrame(this._animate);
  }

  _scrollToContact() {
    window.dispatchEvent(new CustomEvent('skip-intro'));

    const scrollTip = document.getElementById('scroll-tip');
    if (scrollTip) scrollTip.style.display = 'none';

    if (!this.isEnabled) this._start();

    setTimeout(() => {
      this.target = this._getMaxScroll();
    }, 500);
  }

  bindContactLink() {
    const contactLink = document.getElementById('nav-contact');
    if (contactLink) {
      contactLink.addEventListener('click', (e) => {
        e.preventDefault();
        this._scrollToContact();
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth < 768;
      
      // Clamp current positions to the new maximum scroll limit
      const maxScroll = this._getMaxScroll();
      this.target = Math.min(this.target, maxScroll);
      this.current = Math.min(this.current, maxScroll);
    });

    window.addEventListener('wheel', (e) => {
      if (!this.isEnabled) return;
      e.preventDefault();
      this.target += e.deltaY * 1.2;
      this.target = Math.max(0, Math.min(this.target, this._getMaxScroll()));
    }, { passive: false });

    // Touch support
    window.addEventListener('touchstart', (e) => {
      if (!this.isEnabled) return;
      this.touchLastX = e.touches[0].clientX;
      this.touchLastY = e.touches[0].clientY;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.isEnabled) return;
      
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      
      const deltaX = this.touchLastX - touchX;
      const deltaY = this.touchLastY - touchY;
      
      // Use both X and Y movement for horizontal scroll on mobile
      // This makes the swipe feel more natural regardless of exact angle
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      
      // Increase sensitivity for a snappier feel
      this.target += delta * 2.0;
      this.target = Math.max(0, Math.min(this.target, this._getMaxScroll()));
      
      this.touchLastX = touchX;
      this.touchLastY = touchY;

      // Prevent default vertical scroll behavior
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.isEnabled) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.target += 200;
        this.target = Math.min(this.target, this._getMaxScroll());
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.target -= 200;
        this.target = Math.max(0, this.target);
      }
    });
  }

  initLazyImages() {
    const images = this.track.querySelectorAll('img[data-src], img.grid-lazy');
    this.loader.initScrollPreload(images, 3);
  }

  _animate() {
    if (this.isEnabled) {
      if (Math.abs(this.target - this.current) < 0.5) {
        this.current = this.target;
      } else {
        this.current += (this.target - this.current) * this.ease;
      }

      const diff = this.target - this.current;
      const skewThreshold = 60;
      const maxSkew = 0.7;
      let targetSkew = 0;

      if (Math.abs(diff) > skewThreshold) {
        targetSkew = diff > 0 ? -maxSkew : maxSkew;
        this.currentSkew = targetSkew;
      } else {
        targetSkew = 0;
        this.currentSkew += (targetSkew - this.currentSkew) * 0.03;
      }

      this.track.style.transform = `translate3d(-${this.current}px, 0, 0) skewX(${this.currentSkew}deg) rotate(${this.currentSkew * 0.1}deg)`;

      const navBrand = document.querySelector('.nav-brand');
      const scrollTip = document.getElementById('scroll-tip');
      
      if (navBrand) {
        if (this.current > window.innerWidth * 0.69) {
          navBrand.style.opacity = '1';
        } else {
          navBrand.style.opacity = '0';
        }
      }

      if (scrollTip && this.current > 10) {
        scrollTip.classList.add('scroll-tip--hidden');
      }
    }
    requestAnimationFrame(this._animate);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const scroll = new HorizontalScroll();
  scroll.init();
});

export default HorizontalScroll;
