const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PORTFOLIO_DIR = path.join(__dirname, '..', 'assets', 'portfolio');
const sizes = {
  thumbs: 200,
  medium: 1200,
  full: 2400
};

async function processDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      // If this is a raw folder, process the images inside
      if (item === 'raw') {
        await processRawFolder(fullPath);
      } else {
        await processDir(fullPath);
      }
    }
  }
}

async function processRawFolder(rawPath) {
  const albumDir = path.dirname(rawPath);
  const images = fs.readdirSync(rawPath).filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));

  for (const img of images) {
    const inputPath = path.join(rawPath, img);
    const baseName = path.parse(img).name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    for (const [sizeName, width] of Object.entries(sizes)) {
      const outputDir = path.join(albumDir, sizeName);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const outputPathBase = path.join(outputDir, baseName);

      // Skip if JPG already exists (basic cache check)
      if (fs.existsSync(`${outputPathBase}.jpg`)) continue;

      console.log(`Processing ${img} -> ${sizeName}`);
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      const resizeOpts = metadata.width > width ? { width, withoutEnlargement: true } : {};

      // Generate JPG
      await sharp(inputPath).resize(resizeOpts).jpeg({ quality: 90, mozjpeg: true }).toFile(`${outputPathBase}.jpg`);
      // Generate WebP
      await sharp(inputPath).resize(resizeOpts).webp({ quality: 85 }).toFile(`${outputPathBase}.webp`);
      // Generate AVIF
      await sharp(inputPath).resize(resizeOpts).avif({ quality: 80 }).toFile(`${outputPathBase}.avif`);
    }
  }
}

processDir(PORTFOLIO_DIR).then(() => console.log('Done processing images.')).catch(console.error);
