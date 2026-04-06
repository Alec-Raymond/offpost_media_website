const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PORTFOLIO_BASE = path.join(__dirname, '..', 'assets', 'portfolio');
const sizes = {
  thumbs: 200,
  medium: 1200,
  full: 2400
};

async function run() {
  if (!fs.existsSync(PORTFOLIO_BASE)) return;

  const albums = fs.readdirSync(PORTFOLIO_BASE);

  for (const albumId of albums) {
    const albumDir = path.join(PORTFOLIO_BASE, albumId);
    if (!fs.statSync(albumDir).isDirectory()) continue;

    const rawDir = path.join(albumDir, 'raw');
    if (!fs.existsSync(rawDir)) continue;

    const images = fs.readdirSync(rawDir).filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));

    for (const img of images) {
      const inputPath = path.join(rawDir, img);
      const baseName = path.parse(img).name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      for (const [sizeName, width] of Object.entries(sizes)) {
        const outputDir = path.join(albumDir, sizeName);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputPathBase = path.join(outputDir, baseName);

        // JPG cache check
        if (fs.existsSync(`${outputPathBase}.jpg`)) continue;

        console.log(`Processing ${albumId}/${img} -> ${sizeName}`);
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
}

run().then(() => console.log('Done.')).catch(console.error);
