import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../logo.png');
const iconsDir = resolve(__dirname, 'public/icons');
const publicDir = resolve(__dirname, 'public');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function run() {
  // Generate all PNG icons — just resize, keep original colors/background
  for (const size of sizes) {
    await sharp(src)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(join(iconsDir, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }

  // apple-touch-icon 180x180
  await sharp(src)
    .resize(180, 180, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // favicon.svg (32x32 PNG embedded as base64)
  const fav32 = await sharp(src)
    .resize(32, 32, { fit: 'cover', position: 'centre' })
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

  // logo.png for UI use — wider format, just resize, no background changes
  await sharp(src)
    .resize(400, 160, { fit: 'inside' })
    .png()
    .toFile(join(publicDir, 'logo.png'));
  console.log('✓ logo.png');

  console.log('\nAll done!');
}

run().catch(err => { console.error(err); process.exit(1); });
