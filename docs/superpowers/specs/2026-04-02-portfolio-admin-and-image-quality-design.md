# Portfolio Admin & Image Quality Design Spec

## Overview

Two independent workstreams:
1. **Portfolio admin system** — server-backed album management with auth, upload, ordering, and a redesigned portfolio/viewer experience
2. **Image quality & loading fixes** — upgrade main page (`index.html`) images to use `<picture>` with avif/webp/jpg and responsive `srcset`, fix lazy loading to eliminate pop-in

## Core Principle

**Image quality is the top priority.** This is a photography website — every image should be presented at the highest quality the viewer's device and connection can handle. When there is a trade-off between file size and visual fidelity, favor quality. Use the best available format (AVIF > WebP > JPG), serve the highest resolution the screen can display, and only downsize for genuinely constrained scenarios (small mobile screens, slow connections). Compression artifacts, soft images, or visible quality loss are unacceptable.

## Constraints

- No changes to existing layout values on `index.html`
- No video changes — hero clip stays as-is
- No automatic image processing on upload — user pre-processes images into the expected directory structure before uploading
- Site must work well on mobile and low-data connections (but quality is still prioritized — serve the highest quality the device can handle)

---

## Workstream 1: Portfolio Admin System

### Server Architecture

Single `server.js` using Express:
- Route handlers are registered first, then `express.static` serves remaining requests from the project root. This prevents static files from shadowing routes like `/admin`.
- Adds admin, album, and viewer routes
- Single process, no external services
- Production mode determined by `NODE_ENV=production` environment variable

**Dependencies:** `express`, `multer` (file uploads), `bcrypt` (passcode hashing), `express-session` (session management), `express-rate-limit` (brute force protection), `ejs` (templating)

**Session store:** Uses the default `MemoryStore`. Acceptable for this use case — single admin user, low traffic. Sessions are lost on server restart (admin re-enters passcode). Not suitable if the server scales to multiple processes.

### Data Model

**`albums.json`** replaces `portfolio-config.json`:

```json
{
  "albums": [
    {
      "id": "hawaii-2024",
      "title": "HAWAII 2024",
      "showTitle": true,
      "order": 0,
      "photos": ["img_6638.jpg", "img_6643.jpg", "img_6798.jpg"]
    }
  ]
}
```

- **Cover image** is always derived from `photos[0]` at render time — not stored as a separate field
- `photos` array is in fixed alphanumeric order, set at upload time. Photo order within an album is not user-reorderable.
- `order` determines position on portfolio grid
- `title` max 30 characters
- `id` must be URL-safe: lowercase alphanumeric and hyphens only. Used as both the album identifier and the subdirectory name under `assets/portfolio/`.

**First launch:** If `albums.json` does not exist when the server starts, it creates an empty file: `{"albums": []}`. The portfolio page renders an empty grid with a "No albums yet" message. The admin dashboard works normally — the user can immediately upload.

**Migration from `portfolio-config.json`:** The existing `portfolio-config.json` and `portfolio.js` (client-side grid builder) are retired. Existing portfolio images in `assets/images/` remain untouched but are no longer referenced by the portfolio page. Albums are created fresh through the admin UI. The old files can be removed once the new system is live.

### Upload Directory Structure

Albums are stored separately from the main page images:

```
assets/portfolio/<album-id>/
  thumbs/    # Small placeholders, exactly 200px wide
  medium/    # Display size, exactly 800px wide
  full/      # Full resolution for viewer (expected ~2400px wide, but actual width varies)
```

**Important:** The `w` descriptors in `srcset` must match the actual pixel width of each file. `thumbs/` = `200w`, `medium/` = `800w`, `full/` = actual pixel width (use the real value, e.g., `2400w` if the image is 2400px wide).

Each size directory contains the same filenames in all supported formats:
```
assets/portfolio/hawaii-2024/
  thumbs/img_6638.jpg
  thumbs/img_6638.webp
  thumbs/img_6638.avif
  medium/img_6638.jpg
  medium/img_6638.webp
  medium/img_6638.avif
  full/img_6638.jpg
  full/img_6638.webp
  full/img_6638.avif
```

**Upload flow:** The user selects multiple image files via the admin UI file input. The server expects pre-processed files following the naming convention: `<size>-<filename>` (e.g., `thumbs-img_6638.jpg`, `medium-img_6638.avif`, `full-img_6638.jpg`). The server parses the prefix, creates the directory structure, and sorts the base filenames alphanumerically to build the `photos` array.

**Complete example for one photo** (3 sizes x 3 formats = 9 files per photo):
```
thumbs-img_6638.jpg    thumbs-img_6638.webp    thumbs-img_6638.avif
medium-img_6638.jpg    medium-img_6638.webp    medium-img_6638.avif
full-img_6638.jpg      full-img_6638.webp      full-img_6638.avif
```
An album of 10 photos = 90 files uploaded at once.

**Upload limits:** 20MB per file. Total upload capped at 500MB per request (a large album with all sizes/formats).

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/admin` | GET | No | Serves admin login page |
| `/admin/login` | POST | No | Validates passcode, sets session |
| `/admin/dashboard` | GET | Yes | Serves admin dashboard |
| `/admin/albums` | GET | Yes | Returns albums.json data |
| `/admin/albums/upload` | POST | Yes | Receives pre-processed photos, creates album entry |
| `/admin/albums/reorder` | POST | Yes | Swaps album order. Payload: `{ "albumId": "hawaii-2024", "direction": "up" }`. Swaps `order` with the adjacent album in that direction. |
| `/admin/albums/:id/update` | POST | Yes | Updates title/showTitle |
| `/admin/albums/:id` | DELETE | Yes | Removes album entry from albums.json and deletes `assets/portfolio/<id>/` directory. If the directory doesn't exist or deletion partially fails, the JSON entry is still removed and a warning is logged. |
| `/portfolio` | GET | No | Serves portfolio page (album grid) |
| `/album/:id` | GET | No | Serves album viewer page |

### Security

- **Passcode:** Bcrypt-hashed, stored in `.env` as `ADMIN_PASSCODE`
- **Initial setup:** A setup script (`scripts/hash-passcode.js`) takes a plaintext passcode as an argument and outputs the bcrypt hash to paste into `.env`. Example: `node scripts/hash-passcode.js "my-secure-passcode"`.
- **Sessions:** Server-side sessions with `SESSION_SECRET` from `.env`. Cookies are `httpOnly`, `sameSite: strict`. The `secure` flag is set only when `NODE_ENV=production`. 2-hour expiry.
- **Rate limiting:** 5 login attempts per minute on `POST /admin/login`
- **Upload validation:** Accept only image file types (jpg, png, webp, avif) by checking MIME type. 20MB per file, 500MB per request.
- **`.env` in `.gitignore`** — add `.env` to `.gitignore` as an implementation step (not currently present)

**`.env.example`** provided in the repo:
```
ADMIN_PASSCODE=<bcrypt hash from scripts/hash-passcode.js>
SESSION_SECRET=<random string, e.g. output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
NODE_ENV=development
```

### Admin UI

Server-rendered HTML pages using **EJS templates**, styled to match the site (Oswald headings, Roboto body, dark theme).

**Login screen (`/admin`):**
- Black page, single passcode input, "ENTER" button
- Error message on wrong passcode

**Dashboard (`/admin/dashboard`):**
- Vertical list of albums
- Each album row: up/down arrow buttons, album title (editable text field, 30 char max), showTitle checkbox, delete button with confirmation prompt
- Title field and checkbox are always visible and inline — no separate edit mode
- "Upload New Album" button at the bottom
- Upload flow: file input accepting multiple files, text field for album ID (validated: lowercase alphanumeric and hyphens only, must be unique), submit

**Session:** Expires after 2 hours, redirects to login.

### Portfolio Page Redesign

**Album grid (`/portfolio`):**
- 2-wide grid of album covers
- Last album is 1-wide (full grid width) if odd count
- Each cover: `photos[0]` of the album, using `<picture>` with avif/webp/jpg. The `<img>` `src` loads `thumbs/` as a low-res placeholder; `srcset` provides `medium/` (800w) and `full/` (2400w) for resolution switching. `object-fit: cover`, fixed 3:2 aspect ratio.
- If `showTitle` is true: title overlaid bottom-left, Oswald font, white text, subtle text shadow
- Clicking a cover navigates to `/album/:id`
- `alt` text for covers: use album title if `showTitle` is true, otherwise use `"Album: <album-id>"` as a basic accessible label
- Server-rendered with EJS from `albums.json`

**Album viewer (`/album/:id`):**
- Full black background
- Photo centered, letterboxed to fit within viewport using `<picture>` with responsive `srcset`:
  - `medium/` (800w) for mobile, `full/` for desktop — in avif/webp/jpg format fallback
  - `sizes="calc(100vw - 6rem)"` (accounting for padding and border)
- White 4px border on the photo (matching existing site style)
- `3rem` padding between white border and screen edges on all sides
- White left/right arrow buttons on each side, vertically centered, Oswald font
- `alt` text for viewer photos: `"Photo <n> of <total>"` (e.g., "Photo 3 of 12")
- Keyboard support: left/right arrow keys
- First photo: no left arrow. Last photo: no right arrow.
- Close/back button (top-right "X") to return to `/portfolio`
- URL stays as `/album/:id` — photo navigation is client-side JS only

**Error states:**
- `/album/nonexistent-id` — returns 404 page with "Album not found" message and link back to `/portfolio`
- Album with zero photos — should not occur (admin prevents creating empty albums; deleting an album removes it entirely). If the JSON is manually corrupted, the viewer shows "No photos in this album" with a back link.

### Nav Link Update

The PORTFOLIO link in `index.html` nav (currently pointing to Instagram) will be updated to point to `/portfolio`.

---

## Workstream 2: Image Quality & Loading Fixes

Applies to `index.html` only. No layout value changes.

### Grid Sections (2x2 and 1-over-3)

Replace plain `<img data-src="...jpg">` with `<picture>` elements. The `<img>` inside each `<picture>` retains `class="grid-lazy"` so the existing `initScrollPreload()` selector (`img[data-src], img.grid-lazy`) continues to find it. When `_loadElement()` fires on the `<img>`, it also swaps `data-srcset` to `srcset` on sibling `<source>` elements inside the `<picture>` — this code path already exists in `media-loader.js` lines 37-45.

**`sizes` values per image position:**

Panel `panel--grid-4` (2x2 staggered, total panel width: `100rem`):
- `.col-left` images (58% of 100rem): `sizes="58rem"`
- `.col-right` images (42% of 100rem): `sizes="42rem"`

Panel `panel--grid-1-2` (1-over-3, total panel width: `100rem`):
- `.row-top` image (full width): `sizes="100rem"`
- `.row-bottom` images (1/3 each): `sizes="33rem"`

Panel `panel--portrait` (single image, `45rem` wide):
- `sizes="45rem"`

Contact section image (inside `40rem` panel, `35rem` max-width content):
- `sizes="35rem"`

These fixed `rem` values match the actual CSS widths. The browser compares them against the `w` descriptors in `srcset` to pick the right resolution.

### Post-Video Collage Photos (intro.js)

- `preloadCritical()` currently takes URL strings and fetches them directly. To support format selection: detect best supported format at init time using the data URI probe technique — attempt to decode a tiny 1x1 AVIF data URI via `new Image()`, check `onload`/`onerror`. If AVIF is supported, use it; otherwise probe WebP the same way; fall back to JPG. This is more reliable than `canvas.toDataURL()` which tests *encode* support (most browsers can decode AVIF but cannot encode it to canvas). Store the detected best format on the `MediaLoader` instance.
- `preloadCritical()` then maps each base URL to the best format variant before fetching (e.g., `.jpg` -> `.avif` if AVIF is supported).
- When `intro.js` creates photo elements dynamically, it uses `<picture>` with avif/webp/jpg `<source>` elements, using blob URLs from the cache where available.

### Portrait Section

Same `<picture>` + `srcset` treatment:
```html
<picture>
  <source type="image/avif" data-srcset="assets/images/medium/img_7296.avif 800w, assets/images/full/img_7296.avif 2400w" sizes="45rem">
  <source type="image/webp" data-srcset="assets/images/medium/img_7296.webp 800w, assets/images/full/img_7296.webp 2400w" sizes="45rem">
  <img data-src="assets/images/medium/img_7296.jpg" data-srcset="assets/images/medium/img_7296.jpg 800w, assets/images/full/img_7296.jpg 2400w" sizes="45rem" alt="Portrait photo">
</picture>
```

### Contact Section Image

Currently a direct `<img src>` — upgrade to `<picture>` with format fallback and `srcset`. Since this is a visible-on-load image inside the contact panel (not lazy loaded), use `src`/`srcset` directly (not `data-src`):
```html
<picture>
  <source type="image/avif" srcset="assets/images/medium/img_6967.avif 800w, assets/images/full/img_6967.avif 2400w" sizes="35rem">
  <source type="image/webp" srcset="assets/images/medium/img_6967.webp 800w, assets/images/full/img_6967.webp 2400w" sizes="35rem">
  <img src="assets/images/medium/img_6967.jpg" srcset="assets/images/medium/img_6967.jpg 800w, assets/images/full/img_6967.jpg 2400w" sizes="35rem" class="contact-image" alt="Contact image" style="width: 100%; height: auto; margin-top: 1.5rem; margin-bottom: 0.5rem; border: 4px solid #fff;">
</picture>
```

### Lazy Loading Improvement

- Increase `IntersectionObserver` horizontal `rootMargin` from `'0px 3000px 0px 0px'` to `'0px 5000px 0px 0px'` in `MediaLoader.initScrollPreload()` to preload grid images further ahead of the viewport

### Role of `thumbs/` Directory

The `thumbs/` directory under `assets/images/` is not used on `index.html` (the main page has no thumbnail-to-full swap pattern). It was used by the old `portfolio.js` as an initial low-res `src` before lazy-loading `medium/`. Since the old portfolio system is being retired, `thumbs/` under `assets/images/` becomes unused. The new portfolio system has its own `thumbs/` per album under `assets/portfolio/<album-id>/thumbs/`, used as low-res placeholders for album covers on the portfolio grid.

---

## Out of Scope

- Video quality changes
- Automatic image processing/resizing on upload
- Multi-user accounts
- HTTPS setup (handled at hosting level)
- Layout value changes on index.html
- Reordering photos within an album (fixed alphanumeric order)
