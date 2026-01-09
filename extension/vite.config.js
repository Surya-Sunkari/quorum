import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

// Plugin to copy extension files to dist
const copyExtensionFiles = () => ({
  name: 'copy-extension-files',
  closeBundle() {
    const distDir = resolve(__dirname, 'dist');

    // Copy manifest.json
    copyFileSync(
      resolve(__dirname, 'manifest.json'),
      resolve(distDir, 'manifest.json')
    );

    // Copy background.js
    const bgPath = resolve(__dirname, 'public', 'background.js');
    if (existsSync(bgPath)) {
      copyFileSync(bgPath, resolve(distDir, 'background.js'));
    }

    // Copy icons
    const iconsDir = resolve(__dirname, 'icons');
    const distIconsDir = resolve(distDir, 'icons');

    if (existsSync(iconsDir)) {
      mkdirSync(distIconsDir, { recursive: true });
      const files = readdirSync(iconsDir);
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.svg')) {
          copyFileSync(
            resolve(iconsDir, file),
            resolve(distIconsDir, file)
          );
        }
      }
    }

    console.log('Extension files copied to dist/');
  },
});

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
