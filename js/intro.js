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

    // On mobile portrait, swap to vertical video before autoplay kicks in
    this.isMobile = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
    if (this.isMobile && this.video) {
      this._setMobileVideo();
    }
  }

  _setMobileVideo() {
    const sources = this.video.querySelectorAll('source');
    sources.forEach(s => s.remove());

    const webm = document.createElement('source');
    webm.src = 'assets/video/hero-clip-mobile.webm';
    webm.type = 'video/webm';

    const mp4 = document.createElement('source');
    mp4.src = 'assets/video/hero-clip-mobile.mp4';
    mp4.type = 'video/mp4';

    this.video.appendChild(webm);
    this.video.appendChild(mp4);
    this.video.removeAttribute('autoplay');
    this.video.style.opacity = '0';
    this.video.load();

    // Hide hero branding until the delayed reveal
    if (this.heroLogo) this.heroLogo.style.opacity = '0';
    if (this.heroBrand) this.heroBrand.style.opacity = '0';
    if (this.heroTagline) this.heroTagline.style.opacity = '0';
  }

  _startSurfboardBlend() {
    const video = this.video;

    // Clone the logo overlay with black text, positioned on top
    const darkOverlay = this.heroLogo.cloneNode(true);
    darkOverlay.removeAttribute('id');
    darkOverlay.style.zIndex = '101';
    const darkBrand = darkOverlay.querySelector('.brand');
    const darkTagline = darkOverlay.querySelector('.tagline');
    if (darkBrand) { darkBrand.style.color = '#000'; darkBrand.style.opacity = '1'; }
    if (darkTagline) { darkTagline.style.color = '#000'; darkTagline.style.opacity = '1'; }
    this.heroLogo.parentElement.appendChild(darkOverlay);

    // Small canvas for the threshold mask — match viewport aspect ratio
    const canvas = document.createElement('canvas');
    const scale = 240 / window.innerWidth;
    const w = 240;
    const h = Math.round(window.innerHeight * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const minBright = 100;
    const maxBright = 172;

    const processFrame = () => {
      if (video.ended || video.paused) {
        darkOverlay.remove();
        return;
      }

      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const buf = new Uint32Array(imageData.data.buffer);
      for (let i = 0; i < buf.length; i++) {
        const px = buf[i];
        const r = px & 0xFF;
        const g = (px >> 8) & 0xFF;
        const b = (px >> 16) & 0xFF;
        const avg = (r + g + b) / 3;
        // Opaque only in the brightness band where the surfboard lives
        buf[i] = (avg >= minBright && avg <= maxBright) ? 0xFFFFFFFF : 0x00000000;
      }
      ctx.putImageData(imageData, 0, 0);

      const url = canvas.toDataURL();
      darkOverlay.style.webkitMaskImage = `url(${url})`;
      darkOverlay.style.maskImage = `url(${url})`;
      darkOverlay.style.webkitMaskSize = 'cover';
      darkOverlay.style.maskSize = 'cover';

      requestAnimationFrame(processFrame);
    };
    processFrame();
  }

  async init() {
    // Listen for skip event from scroll_physics
    window.addEventListener('skip-intro', () => this.skipIntro());

    // If ?skip=true, skip the intro immediately
    const params = new URLSearchParams(window.location.search);
    if (params.get('skip') === 'true') {
      // Clean the URL without reloading
      history.replaceState(null, '', window.location.pathname);
      this.skipIntro();
      return;
    }

    // Safety timeout to ensure intro starts even if assets take too long
    const safety = setTimeout(() => this.startSequence(), 4000);

    try {
      const preloads = [
        this.audio.prefetch(),
        this.loader.preloadCritical([...COLLAGE_IMAGES, ...POST_VIDEO_PHOTOS, 'assets/images/medium/img_6967.jpg'])
      ];

      // On mobile, wait for video to buffer before starting
      if (this.isMobile && this.video) {
        preloads.push(new Promise(resolve => {
          if (this.video.readyState >= 4) return resolve();
          this.video.addEventListener('canplaythrough', resolve, { once: true });
        }));
      }

      await Promise.allSettled(preloads);
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
    if (this.heroLogo) this.heroLogo.style.opacity = '1';

    // Tagline (MEDIA) — show it first, then fade out
    if (this.heroTagline) {
      this.heroTagline.style.transition = 'none';
      this.heroTagline.style.opacity = '1';
      this.heroTagline.offsetHeight; // force reflow
      this.heroTagline.style.transition = 'opacity 1.5s ease';
      this.heroTagline.style.opacity = '0';
      setTimeout(() => {
        this.heroTagline.style.visibility = 'hidden';
      }, 1500);
    }

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
        
        const baseSrc = this.loader.cache.get(src) || src;
        const img = document.createElement('img');
        img.src = baseSrc;
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
    if (!this.logoContainer || this.isSkipped) return;

    // On mobile, blur collage first, then cross-dissolve to video
    if (this.isMobile && this.video) {
      if (this.logoContainer) this.logoContainer.style.opacity = '0';
      this.video.play().catch(() => {});

      setTimeout(() => {
        this.video.style.transition = 'opacity 0.8s ease';
        this.video.style.opacity = '1';
        this.overlay.style.transition = 'background-color 0.8s ease';
        this.overlay.style.backgroundColor = 'transparent';
      }, 200);

      // Show OFFPOST logo 1.5s after video starts
      setTimeout(() => {
        if (this.heroLogo) {
          this.heroLogo.style.transition = 'opacity 0.5s ease';
          this.heroLogo.style.opacity = '1';
        }
        if (this.heroBrand) this.heroBrand.style.opacity = '1';
        if (this.heroTagline) this.heroTagline.style.opacity = '1';
      }, 1500);

      // Last 3.4s: surfboard silhouette shows through the text
      let blendStarted = false;
      this.video.addEventListener('timeupdate', () => {
        if (blendStarted) return;
        const remaining = this.video.duration - this.video.currentTime;
        if (remaining <= 3.4 && this.heroLogo) {
          blendStarted = true;
          this._startSurfboardBlend();
        }
      });
    }

    // Skip intro logo flicker on mobile
    if (!this.isMobile) {
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
    }

    const collage = this.overlay.querySelectorAll('.flash-img');
    if (this.isMobile) {
      // On mobile, blur first then fade out (video fades in after 350ms delay)
      const frost = document.getElementById('frost-overlay');
      if (frost) frost.remove();
      collage.forEach(el => {
        el.style.transition = 'filter 0.25s ease, opacity 0.5s ease 0.15s';
        el.style.filter = 'blur(10px) brightness(0.3)';
        el.style.opacity = '0';
        setTimeout(() => { if (el.parentNode) el.remove(); }, 700);
      });
    } else {
      collage.forEach(el => {
        el.style.transition = 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.filter = 'brightness(0.2) blur(10px)';
        el.style.transform += ' translateY(-20px) scale(1.05)';
      });
    }
  }

  slamDown() {
    if (this.isSkipped) return;
    if (this.video) {
      // Safety trigger: Only fallback if it's really stuck (back to 5s for safety but checks state)
      const safetyTrigger = setTimeout(() => {
        if (!this.photosShown && (this.video.paused || this.video.currentTime === 0)) {
          console.warn("Video stuck: forcing photo reveal.");
          this.handleVideoFailure();
        }
      }, 5000);

      const startVisuals = () => {
        clearTimeout(safetyTrigger);

        if (this.isMobile) {
          // No flash on mobile — video and logo already handled in surgeUp
          this.revealMainBranding(false);
        } else {
          this.flash.classList.add('flash-active');
          this.revealMainBranding(false);
        }
      };

      // If already playing due to autoplay attribute, trigger visuals immediately
      if (!this.video.paused) {
        startVisuals();
      } else {
        this.video.play().then(startVisuals).catch((error) => {
          console.warn("Autoplay blocked (LPM):", error);
          clearTimeout(safetyTrigger);
          this.handleVideoFailure();
        });
      }

      const onVideoEnd = () => {
        if (this._videoEnded) return;
        this._videoEnded = true;
        clearTimeout(safetyTrigger);
        clearTimeout(videoTimeout);
        this.video.pause();
        this.video.style.opacity = '0';

        if (this.heroBrand) this.heroBrand.style.opacity = '1';

        if (this.isMobile) {
          if (this.heroTagline) {
            this.heroTagline.style.transition = 'opacity 1.5s ease';
            this.heroTagline.style.opacity = '0';
            setTimeout(() => { if (this.heroTagline) this.heroTagline.style.visibility = 'hidden'; }, 1500);
          }
          window.dispatchEvent(new CustomEvent('tagline-faded'));
        } else {
          if (this.heroTagline) this.heroTagline.style.opacity = '1';
        }

        this._enableScroll();
        setTimeout(() => this.showPostVideoPhotos(), 500);
      };

      this.video.addEventListener('ended', onVideoEnd, { once: true });

      // Hard timeout: video duration + 2s buffer, or 15s max if duration unknown
      const maxWait = (this.video.duration && isFinite(this.video.duration))
        ? (this.video.duration * 1000) + 2000
        : 15000;
      const videoTimeout = setTimeout(onVideoEnd, maxWait);
    } else {
      this.handleVideoFailure();
    }
  }

  revealMainBranding(isSlow = false) {
    const duration = isSlow ? '1.5s' : '0.3s';
    const timing = isSlow ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.17, 0.89, 0.32, 1)';

    this.overlay.style.backgroundColor = 'transparent';
    const frost = document.getElementById('frost-overlay');
    if (frost) frost.remove();
    
    // Video Descent
    if (this.video) {
      this.video.style.transition = 'none';
      this.video.style.transform = 'translateY(-10px) scale(1.02)';
      this.video.offsetHeight; // Force reflow
      this.video.style.transition = `transform ${duration} ${timing}, opacity ${duration} ease`;
      this.video.style.transform = 'translateY(0) scale(1)';
    }

    // Branding reveal logic — skip on mobile; logo appears after delay in startVisuals
    if (!this.isMobile) {
      if (this.heroLogo) {
        this.heroLogo.style.opacity = '1';
        this.heroLogo.style.zIndex = '50';
        this.heroLogo.style.transition = 'none';
        this.heroLogo.style.transform = 'translateY(-10px)'; // Match surgeUp height

        this.heroLogo.offsetHeight; // Force reflow

        this.heroLogo.style.transition = `opacity ${duration} ease, transform ${duration} ${timing}`;
        this.heroLogo.style.transform = 'translateY(0)';
      }

      if (this.heroBrand) this.heroBrand.style.opacity = '1';
      if (this.heroTagline) this.heroTagline.style.opacity = '1';
      else window.dispatchEvent(new CustomEvent('tagline-faded'));
    }
    
    // Hide intro logo container — immediately on mobile, slight delay on desktop
    if (this.isMobile) {
      if (this.logoContainer) this.logoContainer.style.opacity = '0';
    } else {
      setTimeout(() => {
        if (this.logoContainer) this.logoContainer.style.opacity = '0';
      }, 100);
    }

    // Clear initial collage smoothly
    const collage = this.overlay.querySelectorAll('.flash-img');
    collage.forEach(el => {
      el.style.transition = `all ${duration} ${timing}`;
      el.style.transform += ' translateY(40px)';
      el.style.opacity = '0';
      setTimeout(() => { if(el.parentNode) el.remove(); }, isSlow ? 1500 : 300);
    });
  }

  handleVideoFailure() {
    if (this.photosShown) return;
    
    // Slower, more atmospheric flash for failure
    this.flash.style.transition = 'opacity 1.0s ease-out';
    this.flash.style.opacity = '0.8';
    setTimeout(() => { this.flash.style.opacity = '0'; }, 100);

    this.revealMainBranding(true); // Trigger the slow descent logic
    
    this.video.style.opacity = '0';
    this.video.style.display = 'none';
    this.finishIntroGracefully();
    
    // Wait for the slow branding animation to settle before starting photo reveal
    setTimeout(() => {
      this.showPostVideoPhotos();
    }, 1500);
  }

  finishIntroGracefully() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.style.display = 'none';
      this.overlay.remove();
    }
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
        // Preloaded blob URL is already the best format; fall back to original jpg
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

  // Clicking any OFFPOST logo on the main page replays the intro
  const navBrand = document.querySelector('.nav-brand');
  const heroBrand = document.getElementById('hero-brand');

  const replayIntro = (e) => {
    e.preventDefault();
    // Reload without skip param to play the full intro
    window.location.href = window.location.pathname;
  };

  if (navBrand) navBrand.addEventListener('click', replayIntro);
  if (heroBrand) {
    heroBrand.style.cursor = 'pointer';
    heroBrand.style.pointerEvents = 'auto';
    heroBrand.addEventListener('click', replayIntro);
  }
});
