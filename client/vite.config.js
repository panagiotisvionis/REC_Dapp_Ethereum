import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import path             from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@contracts': path.resolve(__dirname, '../build/contracts'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
