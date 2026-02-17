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

    // Touch state
    this.touchLastX = 0;
    this.touchLastY = 0;

    this.loader = new MediaLoader();
    this._animate = this._animate.bind(this);
    
    // BIND CONTACT LINK IMMEDIATELY
    this.bindContactLink();
  }

  _getMaxScroll() {
    return this.track.scrollWidth - window.innerWidth;
  }

  init() {
    if (!this.track) return;

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
    this.startScrollHintTimer();
    
    setTimeout(() => {
      if (this.target === 0) {
        this.target = 0;
        this.current = 0;
      }
    }, 100);

    requestAnimationFrame(this._animate);
  }

  startScrollHintTimer() {
    // Listen for the specific moment the tagline finishes fading
    window.addEventListener('tagline-faded', () => {
      setTimeout(() => {
        const scrollTip = document.getElementById('scroll-tip');
        if (scrollTip && this.current < 50 && scrollTip.style.display !== 'none') {
          scrollTip.style.opacity = '1';
        }
      }, 2000);
    }, { once: true });
  }

  bindContactLink() {
    const contactLink = document.getElementById('nav-contact');
    if (contactLink) {
      contactLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 1. Dispatch skip event to IntroSequence
        window.dispatchEvent(new CustomEvent('skip-intro'));
        
        // 2. Suppress/Hide scroll tip
        const scrollTip = document.getElementById('scroll-tip');
        if (scrollTip) {
          scrollTip.style.display = 'none';
          scrollTip.style.opacity = '0';
        }

        // 3. Ensure physics loop starts if it hasn't
        if (!this.isEnabled) {
          this._start();
        }

        // 4. Autoscroll (Delayed to allow hero screen to sit for a split second)
        setTimeout(() => {
          this.target = this._getMaxScroll();
        }, 500);
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
      
      this.target += delta * 1.5;
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
        scrollTip.style.opacity = '0';
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
