import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    {
      name: 'build-stabilizer',
      transform(code, id) {
        if (!id.includes('node_modules')) {
          console.log('Compiling:', path.basename(id));
        }
      }
    },
    react()
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@firebase/app': path.resolve(__dirname, '../node_modules/@firebase/app'),
      '@firebase/component': path.resolve(__dirname, '../node_modules/@firebase/component'),
      '@firebase/logger': path.resolve(__dirname, '../node_modules/@firebase/logger'),
      '@firebase/util': path.resolve(__dirname, '../node_modules/@firebase/util'),
    },
    dedupe: [
      'firebase',
      '@firebase/app',
      '@firebase/component',
      '@firebase/firestore',
      '@firebase/auth',
      '@firebase/storage',
      '@firebase/analytics',
      '@firebase/util',
      'react',
      'react-dom'
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/app/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000
  }
});
