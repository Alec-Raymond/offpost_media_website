# Portfolio Admin & Image Quality Design Spec

## Overview

Two independent workstreams:
1. **Portfolio admin system** — server-backed album management with auth, upload, ordering, and a redesigned portfolio/viewer experience
2. **Image quality & loading fixes** — upgrade main page (`index.html`) images to use `<picture>` with avif/webp/jpg and responsive `srcset`, fix lazy loading to eliminate pop-in

## Constraints

- No changes to existing layout values on `index.html`
- No video changes — hero clip stays as-is
- No automatic image processing on upload — user pre-processes images into thumbs/medium/full and avif/webp/jpg before uploading
- Site must work well on mobile and low-data connections

---

## Workstream 1: Portfolio Admin System

### Server Architecture

Single `server.js` using Express:
- Serves all existing static files (site works exactly as before on `/`)
- Adds admin and album routes
- Single process, no external services

**Dependencies:** `express`, `multer` (file uploads), `bcrypt` (passcode hashing), `express-session` (session management), `express-rate-limit` (brute force protection)

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
      "cover": "img_6638.jpg",
      "photos": ["img_6638.jpg", "img_6643.jpg", "img_6798.jpg"]
    }
  ]
}
```

- `cover` is always `photos[0]` (first photo alphabetically from uploaded folder)
- `photos` array sorted alphanumerically from upload
- `order` determines position on portfolio grid
- `title` max 30 characters

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/admin` | GET | No | Serves admin login page |
| `/admin/login` | POST | No | Validates passcode, sets session |
| `/admin/albums` | GET | Yes | Returns albums.json |
| `/admin/albums/upload` | POST | Yes | Receives photos, creates album entry |
| `/admin/albums/reorder` | POST | Yes | Swaps album order |
| `/admin/albums/:id/update` | POST | Yes | Updates title/showTitle |
| `/admin/albums/:id` | DELETE | Yes | Removes album and its photos |

### Security

- **Passcode:** Bcrypt-hashed, stored in `.env` as `ADMIN_PASSCODE`
- **Sessions:** Server-side sessions with `SESSION_SECRET` from `.env`. Cookies are `httpOnly`, `sameSite: strict`, `secure` in production. 2-hour expiry.
- **Rate limiting:** 5 login attempts per minute
- **Upload validation:** Accept only image file types (jpg, png, webp, avif). Cap file size per image.
- **`.env` in `.gitignore`** — secrets never committed

### Admin UI

Server-rendered HTML pages, styled to match the site (Oswald headings, Roboto body, dark theme).

**Login screen:**
- Black page, single passcode input, "ENTER" button
- Error message on wrong passcode

**Dashboard:**
- Vertical list of albums
- Each album row: up/down arrow buttons, album title (editable text field, 30 char max), showTitle checkbox, delete button with confirmation
- Title field and checkbox are always visible and inline — no separate edit mode
- "Upload New Album" button at the bottom
- Upload flow: file input accepting multiple images, text field for album ID/folder name, submit

**Session:** Expires after 2 hours, redirects to login.

### Portfolio Page Redesign

**Album grid (`portfolio.html`):**
- 2-wide grid of album covers
- Last album is 1-wide (full grid width) if odd count
- Each cover: first photo of the album, `object-fit: cover`, fixed 3:2 aspect ratio
- If `showTitle` is true: title overlaid bottom-left, Oswald font, white text, subtle text shadow
- Clicking a cover navigates to the album viewer
- Page is server-rendered from `albums.json`

**Album viewer (`/album/:id`):**
- Full black background
- Photo centered, scaled to fit within viewport (letterboxed — portrait gets black on sides, landscape gets black top/bottom)
- White 4px border on the photo (matching existing site style)
- Padding/buffer between white border and screen edges
- White left/right arrow buttons on each side, vertically centered, Oswald font
- Keyboard support: left/right arrow keys
- First photo: no left arrow. Last photo: no right arrow.
- Close/back button to return to portfolio grid
- URL stays as `/album/:id` — photo changes are client-side only

---

## Workstream 2: Image Quality & Loading Fixes

Applies to `index.html` only. No layout value changes.

### Grid Sections (2x2 and 1-over-3)

Replace plain `<img data-src="...jpg">` with:

```html
<picture>
  <source type="image/avif"
    data-srcset="assets/images/medium/photo.avif 800w, assets/images/full/photo.avif 2400w"
    sizes="50vw">
  <source type="image/webp"
    data-srcset="assets/images/medium/photo.webp 800w, assets/images/full/photo.webp 2400w"
    sizes="50vw">
  <img
    data-src="assets/images/medium/photo.jpg"
    data-srcset="assets/images/medium/photo.jpg 800w, assets/images/full/photo.jpg 2400w"
    sizes="50vw"
    class="grid-lazy"
    alt="Description">
</picture>
```

`sizes` values will be set per-grid to match actual display widths without changing layout.

### Post-Video Collage Photos (intro.js)

- Upgrade `MediaLoader.preloadCritical()` to handle format selection
- When creating photo elements dynamically, use `<picture>` with avif/webp/jpg sources
- Preload the best format the browser supports

### Portrait Section

- Same `<picture>` + `srcset` treatment with `medium`/`full` resolution options

### Contact Section Image

- Currently a direct `<img src>` — upgrade to `<picture>` with format fallback and `srcset`

### Lazy Loading Improvement

- Increase `IntersectionObserver` horizontal `rootMargin` from `3000px` to `5000px` in `MediaLoader.initScrollPreload()` to preload grid images further ahead of the viewport
- `MediaLoader._loadElement()` already handles `data-srcset` on `<source>` elements inside `<picture>` — no changes needed to the loader logic

### MediaLoader Updates

- `_loadElement()` already supports `<picture>` with `data-srcset` on sibling `<source>` elements — this existing code path will handle the new markup
- `preloadCritical()` may need minor updates to handle format negotiation for intro preloading
- No structural changes to the class

---

## Out of Scope

- Video quality changes
- Automatic image processing/resizing on upload
- Multi-user accounts
- HTTPS setup (handled at hosting level)
- Layout value changes on index.html
