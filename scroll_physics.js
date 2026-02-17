const container = document.getElementById("scroll-container");

// State Variables
let current = 0; // Current pixel position
let target = 0; // Target pixel position (where the mouse wheel wants to go)
let currentSkew = 0; // Current skew angle
const ease = 0.05; // The "Heaviness" (Lower = Heavier)

let isMobile = window.innerWidth < 768;

// Helper to calculate maximum scrollable distance
function getMaxScroll() {
  return container.scrollWidth - window.innerWidth;
}

// Handle Window Resize
window.addEventListener("resize", () => {
  isMobile = window.innerWidth < 768;
  if (isMobile) container.style.transform = "none";
});

// 1. INPUT: Capture Mouse Wheel
window.addEventListener("wheel", (e) => {
  if (isMobile) return;

  // Add scroll delta to target (Multiplier increases speed)
  target += e.deltaY * 1.2;

  // Clamp target within bounds
  target = Math.max(0, Math.min(target, getMaxScroll()));
});

// 2. PHYSICS: The Animation Loop
function animate() {
  if (!isMobile) {
    // --- A. POSITION LOGIC (Abrupt Halt) ---
    // If we are very close to the target (< 0.5px), snap instantly.
    // This prevents the "creeping" effect at low speeds.
    if (Math.abs(target - current) < 0.5) {
      current = target;
    } else {
      // Otherwise, lerp towards target (Glide)
      current += (target - current) * ease;
    }

    // --- B. SKEW LOGIC (Instant Attack / Smooth Release) ---
    const diff = target - current; // Current speed
    const skewThreshold = 60; // Speed required to trigger distortion
    const maxSkew = 0.7; // Max angle of distortion
    let targetSkew = 0;

    // Check if speed exceeds threshold
    if (Math.abs(diff) > skewThreshold) {
      // ATTACK: Snap instantly to max skew (Negative for right, Positive for left)
      targetSkew = diff > 0 ? -maxSkew : maxSkew;
      currentSkew = targetSkew;
    } else {
      // RELEASE: Target is 0, but lerp slowly back to it
      targetSkew = 0;
      currentSkew += (targetSkew - currentSkew) * 0.03; // 0.03 = very smooth decay
    }

    // --- C. RENDER ---
    // Apply Translation + Skew + Slight Rotation for extra chaos
    container.style.transform = `translate3d(-${current}px, 0, 0) skewX(${currentSkew}deg) rotate(${currentSkew * 0.1}deg)`;
  }

  requestAnimationFrame(animate);
}

// Start Loop
animate();
