import MediaLoader from './media-loader.js';

class HorizontalScroll {
  constructor() {
    this.track = document.getElementById('scroll-track');
    this.wrapper = document.getElementById('scroll-wrapper');
    if (!this.track || !this.wrapper) return;

    // Position track at the hero section (past the About panel) from the start
    const aboutPanel = document.getElementById('about-panel');
    this.heroOffset = aboutPanel ? aboutPanel.offsetWidth : 0;

    this.current = this.heroOffset;
    this.target = this.heroOffset;
    this.currentSkew = 0;
    this.ease = 0.05;
    this.isEnabled = false;
    this.isMobile = window.innerWidth < 768;
    this.hintShown = false;

    // Set track position immediately so hero video is behind the intro overlay
    if (this.heroOffset > 0) {
      this.track.style.transform = `translate3d(-${this.heroOffset}px, 0, 0)`;
    }

    // Touch state
    this.touchLastX = 0;
    this.touchLastY = 0;

    this.loader = new MediaLoader();
    this._animate = this._animate.bind(this);
    
    // BIND CONTACT LINK IMMEDIATELY
    this.bindContactLink();

    // Setup hint listener immediately
    this.setupHintListener();

    // Check for query params (from portfolio page links)
    const params = new URLSearchParams(window.location.search);
    if (params.get('contact') === 'true') {
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
      }, 7000);
    };

    window.addEventListener('tagline-faded', showHint, { once: true });

    // ABSOLUTE FALLBACK: If nothing happens in 10s, show it anyway
    setTimeout(showHint, 10000);
  }

  _getMaxScroll() {
    return this.track.scrollWidth - window.innerWidth;
  }

  _updateHeroOffset() {
    const aboutPanel = document.getElementById('about-panel');
    const oldOffset = this.heroOffset;
    this.heroOffset = aboutPanel ? aboutPanel.offsetWidth : 0;
    const delta = this.heroOffset - oldOffset;
    if (delta !== 0) {
      this.target += delta;
      this.current += delta;
      this.track.style.transform = `translate3d(-${this.current}px, 0, 0)`;
    }
  }

  init() {
    if (!this.track) return;

    // Fix mobile viewport height issues
    const setRealVh = () => {
      let vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', () => {
      setRealVh();
      // Recalculate hero offset after --vh changes rem values
      requestAnimationFrame(() => {
        this._updateHeroOffset();
      });
    });
    setRealVh();

    // Recalculate hero offset after --vh sets the correct rem
    requestAnimationFrame(() => {
      this._updateHeroOffset();
    });

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
    requestAnimationFrame(this._animate);
  }

  _scrollToContact() {
    window.dispatchEvent(new CustomEvent('skip-intro'));

    // Always stop the hero video
    const video = document.getElementById('hero-video');
    if (video) {
      video.pause();
      video.style.opacity = '0';
    }

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
      requestAnimationFrame(() => {
        const maxScroll = this._getMaxScroll();
        this.target = Math.max(0, Math.min(this.target, maxScroll));
        this.current = Math.max(0, Math.min(this.current, maxScroll));
      });
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
        const heroStart = this.heroOffset || 0;
        const shouldShow = this.current > heroStart + window.innerWidth * 0.69 || this.current < heroStart - 10;
        if (shouldShow && !navBrand.classList.contains('nav-brand--visible')) {
          navBrand.classList.add('nav-brand--visible');
        } else if (!shouldShow && navBrand.classList.contains('nav-brand--visible')) {
          navBrand.classList.remove('nav-brand--visible');
        }

        // Reveal "ABOUT " letters one at a time as user scrolls left toward about panel
        if (!this._aboutLetters) {
          this._aboutLetters = navBrand.querySelectorAll('.nav-about-letters span');
          // Measure each letter's natural width once
          this._aboutLetterWidths = [];
          this._aboutLetters.forEach(span => {
            span.style.width = 'auto';
            span.style.opacity = '1';
            this._aboutLetterWidths.push(span.offsetWidth);
            span.style.width = '0';
            span.style.opacity = '0';
          });
        }

        const letterCount = this._aboutLetters.length;
        // Only start revealing in the last 40% of the scroll toward the about panel
        const rawProgress = Math.max(0, Math.min(1, 1 - (this.current / heroStart)));
        const progress = Math.max(0, (rawProgress - 0.6) / 0.4);

        let totalRevealedWidth = 0;
        for (let i = 0; i < letterCount; i++) {
          const letterStart = i / letterCount;
          const letterEnd = (i + 1) / letterCount;
          const letterProgress = Math.max(0, Math.min(1, (progress - letterStart) / (letterEnd - letterStart)));

          const revealedWidth = letterProgress * this._aboutLetterWidths[i];
          totalRevealedWidth += revealedWidth;
          this._aboutLetters[i].style.width = `${revealedWidth}px`;
          // Only start fading in during the last 20% of the letter's width expansion
          const fadeProgress = Math.max(0, (letterProgress - 0.8) / 0.2);
          this._aboutLetters[i].style.opacity = fadeProgress;
        }

        // Scale up the nav brand, anchored from the left
        const scale = 1 + progress * 2;
        // Tighten letter-spacing as it scales up
        const spacing = 0.3 - progress * 0.2;
        navBrand.style.letterSpacing = `${spacing}em`;
        navBrand.style.transformOrigin = 'left center';
        const yShift = window.innerWidth < 768 ? 3 : 2;
        navBrand.style.transform = `translateX(-${totalRevealedWidth * 0.2}px) translateY(${progress * yShift}rem) scale(${scale})`;

        // Disable nav brand click when about is showing
        navBrand.style.pointerEvents = progress > 0 ? 'none' : '';

        // Move nav links to left on mobile only
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
          if (window.innerWidth < 768 && progress > 0) {
            const navLinksLeft = navLinks.offsetLeft;
            const navPadding = navBrand.offsetLeft;
            const targetX = navPadding - navLinksLeft;
            navLinks.style.transform = `translateX(${progress * targetX}px)`;
          } else {
            navLinks.style.transform = '';
          }
        }


        // Translate the hero OFFPOST logo off-screen — starts slow, accelerates
        const heroLogo = document.getElementById('hero-logo-overlay');
        const lateProgress = Math.max(0, Math.min(1, (rawProgress - 0.65) / 0.35));
        if (heroLogo) {
          if (lateProgress > 0) {
            const eased = lateProgress * lateProgress * lateProgress;
            heroLogo.style.transform = `translateX(${eased * window.innerWidth * 0.6}px)`;
          } else {
            heroLogo.style.transform = '';
          }
        }

        // Shift the rightmost collage photo left onto screen if there's room
        const collagePhotos = document.querySelectorAll('.post-video-photo');
        if (collagePhotos.length >= 3) {
          const rightPhoto = collagePhotos[2];
          const topLeftPhoto = collagePhotos[0];

          // Where the right photo currently sits on screen (no translateX applied)
          const heroScreenLeft = heroStart - this.current;
          const rightPhotoScreenLeft = heroScreenLeft + rightPhoto.offsetLeft;
          const rightPhotoWidth = rightPhoto.offsetWidth;

          // Target: right edge of photo sits just inside the viewport
          const margin = 30; // px from right edge
          const targetLeft = window.innerWidth - rightPhotoWidth - margin;

          // How much we need to shift left
          const maxShift = Math.max(0, rightPhotoScreenLeft - targetLeft);

          // Check if shifting would overlap with top-left photo
          const topLeftRight = heroScreenLeft + topLeftPhoto.offsetLeft + topLeftPhoto.offsetWidth;
          const rightPhotoAfterShift = rightPhotoScreenLeft - maxShift;

          if (rightPhotoAfterShift < topLeftRight + 20) {
            // Would overlap — don't move
            rightPhoto.style.transform = `rotate(0deg) scale(1)`;
          } else {
            const eased = lateProgress * lateProgress * lateProgress;
            const shiftPx = eased * maxShift;
            rightPhoto.style.transform = `translateX(-${shiftPx}px) rotate(0deg) scale(1)`;
          }
        }
      }

      if (scrollTip && this.current > (this.heroOffset || 0) + 10) {
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
