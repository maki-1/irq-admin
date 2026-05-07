import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://irq-admin.onrender.com',
      // target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
}));

