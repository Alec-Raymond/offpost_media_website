require('dotenv/config');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;
const ALBUMS_PATH = path.join(__dirname, 'albums.json');
const PORTFOLIO_DIR = path.join(__dirname, 'assets', 'portfolio');

// Ensure albums.json exists
if (!fs.existsSync(ALBUMS_PATH)) {
  fs.writeFileSync(ALBUMS_PATH, JSON.stringify({ albums: [] }, null, 2));
}

// Ensure portfolio directory exists
if (!fs.existsSync(PORTFOLIO_DIR)) {
  fs.mkdirSync(PORTFOLIO_DIR, { recursive: true });
}

// --- Middleware ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000 // 2 hours
  }
}));

// Rate limit login attempts
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many login attempts. Try again in a minute.',
  standardHeaders: true,
  legacyHeaders: false
});

// Multer for file uploads (temp storage, then processed by sharp)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 200 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/admin');
}

// Read/write albums
function readAlbums() {
  return JSON.parse(fs.readFileSync(ALBUMS_PATH, 'utf8'));
}

function writeAlbums(data) {
  fs.writeFileSync(ALBUMS_PATH, JSON.stringify(data, null, 2));
}

// --- Routes (registered BEFORE static serving) ---

// Admin login page
app.get('/admin', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/admin/dashboard');
  res.render('admin-login', { error: null });
});

// Admin login handler
app.post('/admin/login', loginLimiter, async (req, res) => {
  const { passcode } = req.body;
  const hash = process.env.ADMIN_PASSCODE;

  if (!hash) {
    return res.render('admin-login', { error: 'Admin passcode not configured. See .env.example.' });
  }

  try {
    const match = await bcrypt.compare(passcode || '', hash);
    if (match) {
      req.session.authenticated = true;
      return res.redirect('/admin/dashboard');
    }
  } catch (e) {
    console.error('Auth error:', e);
  }

  res.render('admin-login', { error: 'Wrong passcode.' });
});

// Admin dashboard
app.get('/admin/dashboard', requireAuth, (req, res) => {
  const data = readAlbums();
  const albums = data.albums.sort((a, b) => a.order - b.order);
  res.render('admin-dashboard', { albums });
});

// Album data API
app.get('/admin/albums', requireAuth, (req, res) => {
  res.json(readAlbums());
});

// Upload new album
app.post('/admin/albums/upload', requireAuth, upload.array('photos'), async (req, res) => {
  const albumId = (req.body.albumId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!albumId) return res.status(400).json({ error: 'Album ID is required.' });

  const data = readAlbums();
  if (data.albums.some(a => a.id === albumId)) {
    return res.status(400).json({ error: 'Album ID already exists.' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const albumDir = path.join(PORTFOLIO_DIR, albumId);
  const sizes = {
    thumbs: { width: 200, dirs: path.join(albumDir, 'thumbs') },
    medium: { width: 1200, dirs: path.join(albumDir, 'medium') },
    full: { width: 2400, dirs: path.join(albumDir, 'full') }
  };

  // Create directories
  for (const size of Object.values(sizes)) {
    fs.mkdirSync(size.dirs, { recursive: true });
  }

  const photoNames = [];

  for (const file of req.files) {
    // Normalize filename: lowercase, alphanumeric + hyphens + underscores
    const ext = path.extname(file.originalname).toLowerCase();
    const rawName = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const baseName = rawName;

    if (!photoNames.includes(baseName)) {
      photoNames.push(baseName);
    }

    // Process each size
    for (const [sizeName, sizeConfig] of Object.entries(sizes)) {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      // Only resize if image is wider than target
      const resizeOpts = metadata.width > sizeConfig.width
        ? { width: sizeConfig.width, withoutEnlargement: true }
        : {};

      // JPG — high quality
      await sharp(file.buffer)
        .resize(resizeOpts)
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(path.join(sizeConfig.dirs, `${baseName}.jpg`));

      // WebP — high quality
      await sharp(file.buffer)
        .resize(resizeOpts)
        .webp({ quality: 85 })
        .toFile(path.join(sizeConfig.dirs, `${baseName}.webp`));

      // AVIF — high quality
      await sharp(file.buffer)
        .resize(resizeOpts)
        .avif({ quality: 80 })
        .toFile(path.join(sizeConfig.dirs, `${baseName}.avif`));
    }
  }

  // Sort photos alphanumerically
  photoNames.sort();

  // Determine next order value
  const maxOrder = data.albums.reduce((max, a) => Math.max(max, a.order), -1);

  data.albums.push({
    id: albumId,
    title: req.body.title || '',
    showTitle: req.body.showTitle === 'true' || req.body.showTitle === true,
    order: maxOrder + 1,
    photos: photoNames
  });

  writeAlbums(data);
  res.json({ success: true, albumId });
});

// Reorder albums
app.post('/admin/albums/reorder', requireAuth, (req, res) => {
  const { albumId, direction } = req.body;
  const data = readAlbums();

  // Sort by order, then swap array positions and renumber
  data.albums.sort((a, b) => a.order - b.order);

  const idx = data.albums.findIndex(a => a.id === albumId);
  if (idx === -1) return res.status(404).json({ error: 'Album not found.' });

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= data.albums.length) {
    return res.status(400).json({ error: 'Cannot move further.' });
  }

  // Swap positions in array
  [data.albums[idx], data.albums[swapIdx]] = [data.albums[swapIdx], data.albums[idx]];

  // Renumber all order values sequentially
  data.albums.forEach((a, i) => { a.order = i; });

  writeAlbums(data);
  res.json({ success: true });
});

// Update album title/showTitle
app.post('/admin/albums/:id/update', requireAuth, (req, res) => {
  const data = readAlbums();
  const album = data.albums.find(a => a.id === req.params.id);
  if (!album) return res.status(404).json({ error: 'Album not found.' });

  if (req.body.title !== undefined) {
    album.title = String(req.body.title).slice(0, 30);
  }
  if (req.body.showTitle !== undefined) {
    album.showTitle = req.body.showTitle === 'true' || req.body.showTitle === true;
  }

  writeAlbums(data);
  res.json({ success: true });
});

// Delete album
app.delete('/admin/albums/:id', requireAuth, (req, res) => {
  const data = readAlbums();
  const idx = data.albums.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Album not found.' });

  data.albums.splice(idx, 1);
  writeAlbums(data);

  // Remove directory (best effort)
  const albumDir = path.join(PORTFOLIO_DIR, req.params.id);
  try {
    fs.rmSync(albumDir, { recursive: true, force: true });
  } catch (e) {
    console.warn(`Warning: could not delete album directory ${albumDir}:`, e.message);
  }

  res.json({ success: true });
});

// Portfolio page
app.get('/portfolio', (req, res) => {
  const data = readAlbums();
  const albums = data.albums.sort((a, b) => a.order - b.order);
  res.render('portfolio', { albums });
});

// Album viewer
app.get('/album/:id', (req, res) => {
  const data = readAlbums();
  const album = data.albums.find(a => a.id === req.params.id);

  if (!album) {
    return res.status(404).render('404', { message: 'Album not found.' });
  }

  if (!album.photos || album.photos.length === 0) {
    return res.status(404).render('404', { message: 'No photos in this album.' });
  }

  res.render('album-viewer', { album });
});

// --- Static files (AFTER routes) ---
app.use(express.static(__dirname));

// 404 catch-all
app.use((req, res) => {
  res.status(404).render('404', { message: 'Page not found.' });
});

app.listen(PORT, () => {
  console.log(`OFFPOST server running at http://localhost:${PORT}`);
});
