import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../logo no background.png');
const iconsDir = resolve(__dirname, 'public/icons');
const publicDir = resolve(__dirname, 'public');

const BG = { r: 37, g: 99, b: 235, alpha: 1 }; // ITAB blue #2563eb

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function run() {
  for (const size of sizes) {
    const padding = Math.round(size * 0.12);
    const inner = size - padding * 2;
    await sharp(src)
      .resize(inner, inner, { fit: 'contain', background: BG })
      .extend({ top: padding, bottom: padding, left: padding, right: padding, background: BG })
      .png()
      .toFile(join(iconsDir, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }

  // apple-touch-icon 180x180
  const atPad = Math.round(180 * 0.12);
  const atInner = 180 - atPad * 2;
  await sharp(src)
    .resize(atInner, atInner, { fit: 'contain', background: BG })
    .extend({ top: atPad, bottom: atPad, left: atPad, right: atPad, background: BG })
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // favicon.svg (32x32 PNG embedded as base64)
  const fav32 = await sharp(src)
    .resize(28, 28, { fit: 'contain', background: BG })
    .extend({ top: 2, bottom: 2, left: 2, right: 2, background: BG })
    .png()
    .toBuffer();
  const b64 = fav32.toString('base64');
  const svgContent = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    `<image href="data:image/png;base64,${b64}" width="32" height="32"/>`,
    '</svg>'
  ].join('');
  writeFileSync(join(iconsDir, 'icon.svg'), svgContent);
  writeFileSync(join(publicDir, 'favicon.svg'), svgContent);
  console.log('✓ icon.svg + favicon.svg');

  // logo.png for use in the app UI (transparent background, 400px)
  await sharp(src)
    .resize(400, 200, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'logo.png'));
  console.log('✓ logo.png (transparent, for UI use)');

  // logo-white.png (white background version for dark contexts)
  await sharp(src)
    .resize(400, 200, { fit: 'contain', background: BG })
    .png()
    .toFile(join(publicDir, 'logo-white.png'));
  console.log('✓ logo-white.png');

  console.log('\nAll icons generated successfully!');
}

run().catch(err => { console.error(err); process.exit(1); });
