class ProjectorAudio {
  constructor(audioSrc) {
    this.audioSrc = audioSrc;
    this.ctx = null;
    this.buffer = null;
    this.loaded = false;
    this.hasInteracted = false;
    this._startAudio = this._startAudio.bind(this);
  }

  // Prefetch the audio file as ArrayBuffer immediately
  async prefetch() {
    try {
      const resp = await fetch(this.audioSrc);
      if (!resp.ok) {
        console.warn('ProjectorAudio: could not fetch audio file, continuing without sound');
        this.loaded = false;
        return;
      }
      const arrayBuf = await resp.arrayBuffer();
      this.rawBuffer = arrayBuf;
      this.loaded = true;
    } catch (e) {
      console.warn('ProjectorAudio: audio fetch failed, continuing without sound', e);
      this.loaded = false;
    }
  }

  async _startAudio() {
    if (this.hasInteracted || !this.loaded) return;
    this.hasInteracted = true;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') await this.ctx.resume();

      // decodeAudioData consumes the buffer, so pass a copy
      this.buffer = await this.ctx.decodeAudioData(this.rawBuffer.slice(0));
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffer;

      // Add a gentle fade-out gain node
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
      const fadeStart = Math.max(0, this.buffer.duration - 1.0);
      gain.gain.setValueAtTime(0.6, this.ctx.currentTime + fadeStart);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.buffer.duration);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('ProjectorAudio: playback failed', e);
    }

    this._removeListeners();
  }

  _removeListeners() {
    ['click','touchstart','keydown','scroll','mousemove','pointerdown'].forEach(evt =>
      document.removeEventListener(evt, this._startAudio, { capture: true })
    );
  }

  // Attach to many events — mousemove triggers on desktop almost immediately
  init() {
    if (!this.loaded) return;
    ['click','touchstart','keydown','scroll','mousemove','pointerdown'].forEach(evt =>
      document.addEventListener(evt, this._startAudio, { capture: true })
    );
  }

  // Allow external stop
  stop() {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    this._removeListeners();
  }
}

export default ProjectorAudio;
