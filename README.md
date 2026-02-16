# Outpost Media — Surf Photography Website

## Quick Start

1. **Add your media assets:**
   - Place hero video as `assets/video/hero-clip.mp4` and `assets/video/hero-clip.webm`
   - Place projector sound effect as `assets/audio/projector.mp3`
   - Place 2-3 intro flash images in `assets/images/intro/` (named `flash1.avif`, `flash2.avif`, `flash3.avif`)

2. **Process portfolio images:**
   ```bash
   chmod +x scripts/process-images.sh
   ./scripts/process-images.sh path/to/your/raw-photos
   ```

3. **Edit the portfolio:**
   Open `portfolio-config.json` and add/remove/reorder images.

4. **Serve locally:**
   ```bash
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000

## Portfolio Configuration

Edit `portfolio-config.json` to manage the portfolio grid. Each image entry has:

| Field  | Description | Options |
|--------|-------------|---------|
| `src`  | Filename without extension (must match files in `assets/images/`) | e.g. `"surf-01"` |
| `alt`  | Description of the photo | Any text |
| `size` | Grid size of the photo | `"small"` (1/3 width), `"medium"` (1/2 width), `"large"` (2/3 width), `"full-width"` (full width) |

### Example

```json
{
  "src": "pipeline-barrel",
  "alt": "Pipeline barrel at sunrise",
  "size": "large"
}
```

### Adding a New Section

Add a new object to the `sections` array:

```json
{
  "heading": "SECTION TITLE",
  "layout": "masonry",
  "images": [
    { "src": "filename", "alt": "description", "size": "medium" }
  ]
}
```

## File Structure

```
assets/
├── video/          Hero video clip (MP4 + WebM, keep under 6 seconds)
├── audio/          Projector sound effect (MP3)
└── images/
    ├── intro/      2-3 images for the film reel startup flash
    ├── full/       Full resolution (auto-generated, ~2400px wide)
    ├── medium/     Medium resolution (auto-generated, ~1200px wide)
    └── thumbs/     Thumbnails (auto-generated, ~300px wide)
```

## Requirements for Image Processing

```bash
brew install imagemagick webp libavif
```

## Customization

- **Fonts:** Oswald (display) + Roboto (body) via Google Fonts
- **Colors:** Edit CSS variables in `css/main.css` (`:root` block)
- **Scroll feel:** Adjust physics in `js/scroll_physics.js` (`friction`, `skewFactor`, `sensitivity`, `lerp`)
- **Grain intensity:** Adjust `opacity` on `#noise-overlay` in `css/noise.css`
- **Contact form:** Replace `YOUR_ID` in the form action with your [Formspree](https://formspree.io) endpoint
