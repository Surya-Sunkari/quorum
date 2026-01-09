// Simple script to generate placeholder icons
// Run with: node scripts/generate-icons.js

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'icons');

// Ensure icons directory exists
mkdirSync(iconsDir, { recursive: true });

// Create a simple PNG with a "Q" letter (minimal valid PNG)
// This is a 16x16 purple square as placeholder
const createPlaceholderPNG = (size) => {
  // PNG header + IHDR + minimal purple IDAT + IEND
  // This creates a simple colored square
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, size, // width
    0x00, 0x00, 0x00, size, // height
    0x08, 0x02, // bit depth, color type (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x00, 0x00, 0x00, 0x00, // CRC (placeholder)
    0x00, 0x00, 0x00, 0x00, // IDAT length (placeholder)
    0x49, 0x44, 0x41, 0x54, // IDAT
    // Minimal compressed data would go here
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82, // IEND CRC
  ]);
  return png;
};

// For a proper icon, we'll create an SVG and note that users should convert it
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#grad)"/>
  <text x="64" y="88" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">Q</text>
</svg>`;

// Write SVG (can be converted to PNG with various tools)
writeFileSync(join(iconsDir, 'icon.svg'), svgIcon);

console.log('Icon SVG created at icons/icon.svg');
console.log('');
console.log('To create PNG icons, you can use an online converter or:');
console.log('  - Use Inkscape: inkscape icon.svg -w 16 -h 16 -o icon16.png');
console.log('  - Use ImageMagick: convert -background none icon.svg -resize 16x16 icon16.png');
console.log('');
console.log('For now, creating simple placeholder PNGs...');

// Create minimal valid 1x1 PNGs that Chrome will accept (will appear as colored squares)
// These are properly formatted minimal PNGs
const sizes = [16, 48, 128];

for (const size of sizes) {
  // Create a simple valid PNG file
  // Using the simplest possible valid PNG structure
  const filename = join(iconsDir, `icon${size}.png`);

  // This is a valid minimal 1x1 purple PNG that we'll use as placeholder
  const purplePng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFfwJ/QkPhCgAAAABJRU5ErkJggg==',
    'base64'
  );

  writeFileSync(filename, purplePng);
  console.log(`Created placeholder: icon${size}.png`);
}

console.log('');
console.log('Done! Replace these placeholders with proper icons for production.');
