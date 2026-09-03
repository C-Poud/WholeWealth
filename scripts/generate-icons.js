import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const logoSvgPath = path.resolve('client/public/logo.svg');
const logoSvg = fs.readFileSync(logoSvgPath);

async function generate() {
  const publicDirs = [
    path.resolve('client/public'),
    path.resolve('public')
  ];

  for (const dir of publicDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Standard 192x192
  const png192 = await sharp(logoSvg)
    .resize(192, 192)
    .png()
    .toBuffer();

  // 2. Standard 512x512
  const png512 = await sharp(logoSvg)
    .resize(512, 512)
    .png()
    .toBuffer();

  // 3. Apple Touch Icon 180x180 (needs solid background for iOS Safari)
  const apple180 = await sharp(logoSvg)
    .resize(180, 180)
    .flatten({ background: '#09090B' })
    .png()
    .toBuffer();

  // 4. Maskable 512x512 with safe-zone margin (15% padding = 384x384 logo centered on 512x512 solid background)
  const innerLogo = await sharp(logoSvg)
    .resize(384, 384)
    .toBuffer();

  const maskable512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 9, g: 9, b: 11, alpha: 1 }
    }
  })
    .composite([
      {
        input: innerLogo,
        top: 64,
        left: 64
      }
    ])
    .png()
    .toBuffer();

  for (const dir of publicDirs) {
    fs.writeFileSync(path.join(dir, 'pwa-192x192.png'), png192);
    fs.writeFileSync(path.join(dir, 'pwa-512x512.png'), png512);
    fs.writeFileSync(path.join(dir, 'pwa-maskable-512x512.png'), maskable512);
    fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), apple180);
  }

  console.log('Successfully generated all PWA & Mobile icons!');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
