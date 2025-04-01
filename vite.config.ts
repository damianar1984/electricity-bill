import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5200,
    strictPort: true,
    allowedHosts: ['openstone.io', 'www.openstone.io'],
  },
  plugins: [preact(), tailwindcss()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  base: '/',
});