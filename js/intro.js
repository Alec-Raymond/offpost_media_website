import MediaLoader from './media-loader.js';
import ProjectorAudio from './audio.js';

// Configuration
const COLLAGE_IMAGES = [
  'assets/images/medium/dsc03007.jpg',
  'assets/images/medium/dsc03224.jpg',
  'assets/images/medium/dsc03376.jpg',
  'assets/images/medium/dsc03417.jpg',
  'assets/images/medium/img_6802.jpg',
  'assets/images/medium/img_6807.jpg'
];

// Three photos for the end sequence in specific order
const POST_VIDEO_PHOTOS = [
  'assets/images/medium/img_6643.jpg', // 1st: Top Left
  'assets/images/medium/img_6960.jpg', // 2nd: Bottom Left
  'assets/images/medium/img_6638.jpg'  // 3rd: Top Right
];

const INTRO_DURATION = 3750; 

class IntroSequence {
  constructor() {
    this.overlay = document.getElementById('intro-overlay');
    this.logoContainer = document.getElementById('intro-logo-container');
    this.flash = document.getElementById('impact-flash');
    this.video = document.getElementById('hero-video');
    this.heroLogo = document.getElementById('hero-logo-overlay');
    this.heroBrand = document.getElementById('hero-brand');
    this.heroTagline = document.getElementById('hero-tagline');
    this.loader = new MediaLoader();
    this.audio = new ProjectorAudio('assets/audio/projector.mp3');
    this.isStarted = false;
    this.photosShown = false;
  }

  async init() {
    // Listen for skip event from scroll_physics
    window.addEventListener('skip-intro', () => this.skipIntro());

    // Safety timeout to ensure intro starts even if assets take too long
    const safety = setTimeout(() => this.startSequence(), 4000);

    try {
      await Promise.allSettled([
        this.audio.prefetch(),
        this.loader.preloadCritical([...COLLAGE_IMAGES, ...POST_VIDEO_PHOTOS, 'assets/images/medium/img_6967.jpg'])
      ]);
    } catch (e) {
      console.warn('Intro preloading failed, starting anyway', e);
    }

    clearTimeout(safety);
    this.startSequence();
  }

  startSequence() {
    if (this.isStarted) return;
    this.isStarted = true;

    this.audio.init();
    this.runCollageSequence();

    setTimeout(() => this.surgeUp(), INTRO_DURATION - 800);
    setTimeout(() => this.slamDown(), INTRO_DURATION);
  }

  skipIntro() {
    if (this.isSkipped) return;
    this.isSkipped = true;
    
    // Kill intro elements
    if (this.overlay && this.overlay.parentNode) this.overlay.remove();
    if (this.video) {
      this.video.pause();
      this.video.style.opacity = '0';
    }
    
    // Show Main Branding
    if (this.heroBrand) this.heroBrand.style.opacity = '1';
    
    // Tagline (MEDIA) fades out gracefully then disappears permanently
    if (this.heroTagline) {
      this.heroTagline.style.transition = 'opacity 1.5s ease';
      this.heroTagline.style.opacity = '0';
      setTimeout(() => {
        this.heroTagline.style.visibility = 'hidden';
      }, 1500);
    } 
    if (this.heroLogo) this.heroLogo.style.opacity = '1';

    // Dispatch immediately so hint timer can start in skip mode
    window.dispatchEvent(new CustomEvent('tagline-faded'));

    this._enableScroll();
    
    if (!this.photosShown) {
      this.showPostVideoPhotos(true);
    }
  }

  runCollageSequence() {
    const sequence = [
      { time: 200,  width: 'calc(15rem + 4vw)', top: '10%', left: '5%',   rot: -8 },
      { time: 600,  width: 'calc(18rem + 5vw)', top: '55%', left: '2%',   rot: 12 },
      { time: 1100, width: 'calc(22rem + 6vw)', top: '5%',  left: '70%',  rot: -5 },
      { time: 1700, width: 'calc(30rem + 8vw)', top: '12%', left: '15%',  rot: -3 },
      { time: 2300, width: 'calc(35rem + 10vw)', top: '22%', left: '25%', rot: 2 }
    ];

    const frost = document.createElement('div');
    frost.id = 'frost-overlay';
    this.overlay.appendChild(frost);
    
    setTimeout(() => { if(frost.parentNode) frost.classList.add('visible'); }, 100);
    
    sequence.forEach((s, i) => {
      setTimeout(() => {
        if (this.isSkipped) return;
        const assetIdx = i >= 3 ? i + 1 : i;
        const src = COLLAGE_IMAGES[assetIdx % COLLAGE_IMAGES.length];
        const container = document.createElement('div');
        container.className = 'flash-img';
        container.style.top = s.top;
        container.style.left = s.left;
        container.style.width = s.width;
        container.style.zIndex = 100 + i;
        container.style.transform = `rotate(${s.rot}deg) scale(0.5) translate(0, 50px)`;
        
        const img = document.createElement('img');
        img.src = this.loader.cache.get(src) || src;
        img.style.width = '100%';

        const dots = document.createElement('div');
        dots.className = 'halftone-overlay';

        container.appendChild(img);
        container.appendChild(dots);
        this.overlay.appendChild(container);
        
        requestAnimationFrame(() => {
          if (container.parentNode) {
            container.style.opacity = 1;
            container.style.transform = `rotate(${s.rot}deg) scale(1) translate(0, 0)`;
          }
        });
      }, s.time);
    });
  }

  surgeUp() {
    if (!this.logoContainer) return;
    this.logoContainer.style.opacity = 0;
    this.logoContainer.style.transform = 'translateY(-10px) scale(1.02)';
    this.logoContainer.style.transition = 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)';

    setTimeout(() => { if(this.logoContainer) this.logoContainer.style.opacity = '1'; }, 50);
    setTimeout(() => { if(this.logoContainer) this.logoContainer.style.opacity = '0'; }, 550);
    setTimeout(() => { 
      if(this.logoContainer) {
        this.logoContainer.style.transition = 'none'; 
        this.logoContainer.classList.add('negative-logo');
        this.logoContainer.style.opacity = '1'; 
      }
    }, 750);
    setTimeout(() => { if(this.logoContainer) this.logoContainer.style.opacity = '0'; }, 800);
    
    const collage = this.overlay.querySelectorAll('.flash-img');
    collage.forEach(el => {
      el.style.transition = 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.filter = 'brightness(0.2) blur(10px)';
      el.style.transform += ' translateY(-20px) scale(1.05)';
    });
  }

  slamDown() {
    if (this.video) {
      this.flash.classList.add('flash-active');
      this.video.play().catch(() => {
        this.finishIntroGracefully();
      });
      
      this.overlay.style.backgroundColor = 'transparent';
      
      const frost = document.getElementById('frost-overlay');
      if (frost) frost.remove();
      
      if (this.heroBrand) this.heroBrand.style.opacity = '1';
      if (this.heroTagline) this.heroTagline.style.opacity = '1';
      if (this.heroLogo) {
        this.heroLogo.style.opacity = '1';
        this.heroLogo.style.zIndex = '50';
      }

      this.logoContainer.style.opacity = '0';

      const collage = this.overlay.querySelectorAll('.flash-img');
      collage.forEach(el => {
        el.style.transition = 'all 0.3s ease-in';
        el.style.transform += ' translateY(40px)';
        el.style.opacity = '0';
        setTimeout(() => { if(el.parentNode) el.remove(); }, 300);
      });

      this.video.style.transform = 'translateY(-5px)';
      requestAnimationFrame(() => {
        this.video.style.transition = 'transform 0.3s cubic-bezier(0.17, 0.89, 0.32, 1)';
        this.video.style.transform = 'translateY(0)';
      });

      this.video.addEventListener('ended', () => {
        this.video.pause();
        this.video.style.opacity = '0';
        
        if (this.heroBrand) this.heroBrand.style.opacity = '1';
        if (this.heroTagline) this.heroTagline.style.opacity = '1';
        
        // Enable scroll immediately when video ends
        this._enableScroll();
        
        setTimeout(() => this.showPostVideoPhotos(), 500);
      }, { once: true });
    } else {
      this.finishIntroGracefully();
    }
  }

  finishIntroGracefully() {
    if (this.overlay && this.overlay.parentNode) this.overlay.remove();
    this._enableScroll();
  }

  showPostVideoPhotos(instant = false) {
    if (this.photosShown) return;
    this.photosShown = true;

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.style.backgroundColor = 'transparent';
      this.overlay.style.pointerEvents = 'none';
    }

    const collageArea = document.getElementById('hero-collage-area');

    // Anchoring to 100vw ensures perfect centering initially.
    // The right photo "peeks" by hanging off the edge into the next panel.
    const positions = [
      { top: '7rem',    left: 'min(5rem, 5vw)',      width: 'calc(18rem + 6vw)', rot: -90 }, // 1st: Top Left (Pinned on mobile)
      { bottom: '3rem', left: 'min(3rem, 3vw)',      width: 'calc(28rem + 8vw)', rot: 0 },   // 2nd: Bottom Left (Pinned on mobile)
      // 3rd: Top Right - Perfect drift math, but capped at 100vw - 4rem to ensure a tiny peek on mobile.
      { top: '4.5rem',  left: 'min(calc(50vw + (50vh - 8rem)), calc(100vw - 4rem))', width: 'calc(20rem + 6vw)', rot: 0 } 
    ];

    POST_VIDEO_PHOTOS.forEach((src, i) => {
      const show = () => {
        const img = document.createElement('img');
        img.className = 'post-video-photo';
        img.src = this.loader.cache.get(src) || src;
        const pos = positions[i];
        
        if (pos.top) img.style.top = pos.top;
        if (pos.bottom) img.style.bottom = pos.bottom;
        if (pos.left) img.style.left = pos.left;
        if (pos.right) img.style.right = pos.right;
        
        img.style.width = pos.width;
        img.style.zIndex = '40'; 
        img.style.transform = `rotate(${pos.rot}deg) scale(0.95)`;
        
        if (collageArea) collageArea.appendChild(img);
        
        setTimeout(() => {
          img.style.opacity = 1;
          img.style.transform = `rotate(${pos.rot}deg) scale(1)`;
        }, instant ? 0 : 100);

        // Fade out "MEDIA" tagline after last photo
        if (i === POST_VIDEO_PHOTOS.length - 1) {
          setTimeout(() => {
            const taglines = document.querySelectorAll('.tagline');
            taglines.forEach(t => {
              t.style.transition = 'opacity 1.5s ease';
              t.style.opacity = '0';
              // Keep in layout to prevent OFFPOST from jumping, but hide from view
              setTimeout(() => { t.style.visibility = 'hidden'; }, 1500);
            });

            // Dispatch event after the 1.5s fade completes
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('tagline-faded'));
            }, instant ? 0 : 1500);

          }, instant ? 0 : 1500);
        }
      };

      if (instant) show();
      else setTimeout(show, i * 1200); 
    });
  }

  _enableScroll() {
    document.body.classList.add('scroll-enabled');
    window.addEventListener('scroll', () => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.style.opacity = 0;
        setTimeout(() => { if(this.overlay && this.overlay.parentNode) this.overlay.remove(); }, 1000);
      }
    }, { once: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.introSequence = new IntroSequence();
  window.introSequence.init();
});
