const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PORTFOLIO_BASE = path.join(__dirname, '..', 'assets', 'portfolio');
const RAW_DIR = path.join(PORTFOLIO_BASE, 'raw');

const sizes = {
  thumbs: 200,
  medium: 1200,
  full: 2400
};

async function run() {
  if (!fs.existsSync(RAW_DIR)) {
    console.log('No raw folder found.');
    return;
  }

  const images = fs.readdirSync(RAW_DIR).filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));

  for (const img of images) {
    const inputPath = path.join(RAW_DIR, img);
    const baseName = path.parse(img).name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    for (const [sizeName, width] of Object.entries(sizes)) {
      const outputDir = path.join(PORTFOLIO_BASE, sizeName);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const outputPathBase = path.join(outputDir, baseName);

      // JPG cache check
      if (fs.existsSync(`${outputPathBase}.jpg`)) continue;

      console.log(`Processing ${img} -> ${sizeName}`);
      try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        const resizeOpts = metadata.width > width ? { width, withoutEnlargement: true } : {};

        await sharp(inputPath).resize(resizeOpts).jpeg({ quality: 90, mozjpeg: true }).toFile(`${outputPathBase}.jpg`);
        await sharp(inputPath).resize(resizeOpts).webp({ quality: 85 }).toFile(`${outputPathBase}.webp`);
        await sharp(inputPath).resize(resizeOpts).avif({ quality: 80 }).toFile(`${outputPathBase}.avif`);
      } catch (err) {
        console.error(`Error processing ${img}:`, err);
      }
    }
  }
}

run().then(() => console.log('Done processing images.')).catch(console.error);
