import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.NATIONX_BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': backendTarget,
      '/uploads': backendTarget,
      '/images': backendTarget,
      '/css': backendTarget
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true
  }
});
