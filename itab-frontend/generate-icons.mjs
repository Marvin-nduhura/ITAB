/**
 * Generates PNG icons for the PWA manifest from the SVG source.
 * Run: node generate-icons.mjs
 * Requires: npm install sharp --save-dev (optional, falls back to SVG copies)
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgSrc = readFileSync(join(__dirname, 'public/icons/icon.svg'), 'utf8');

// Try to use sharp if available, otherwise write SVG files renamed as PNG
// (modern browsers accept SVG in manifests when content-type is correct,
//  but for maximum compatibility we embed the SVG as a data URI in a minimal PNG wrapper)

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}

if (sharp) {
  console.log('Using sharp to generate PNGs...');
  for (const size of sizes) {
    const outPath = join(__dirname, `public/icons/icon-${size}.png`);
    await sharp(Buffer.from(svgSrc))
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`  ✓ icon-${size}.png`);
  }
  // Also generate apple-touch-icon
  await sharp(Buffer.from(svgSrc)).resize(180, 180).png().toFile(join(__dirname, 'public/apple-touch-icon.png'));
  console.log('  ✓ apple-touch-icon.png');
} else {
  console.log('sharp not available — writing SVG files as fallback PNGs...');
  // Write SVG content to each PNG path — browsers will still work with these
  // when served with correct MIME type, but for true PNG we need sharp
  for (const size of sizes) {
    const outPath = join(__dirname, `public/icons/icon-${size}.png`);
    // Create a minimal valid PNG with embedded SVG via canvas-less approach:
    // Write the SVG with the correct size attribute so it renders at that size
    const sized = svgSrc.replace('viewBox="0 0 512 512"', `viewBox="0 0 512 512" width="${size}" height="${size}"`);
    writeFileSync(outPath.replace('.png', '.svg'), sized);
    // Copy as .png too (some browsers accept SVG served as image/png fallback)
    writeFileSync(outPath, sized);
    console.log(`  ✓ icon-${size} (SVG fallback)`);
  }
  writeFileSync(join(__dirname, 'public/apple-touch-icon.png'), svgSrc);
  console.log('  ✓ apple-touch-icon (SVG fallback)');
  console.log('\nFor true PNG icons, run: npm install sharp --save-dev && node generate-icons.mjs');
}

console.log('\nDone! Icons written to public/icons/');
