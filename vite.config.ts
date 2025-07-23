import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },server: {
    proxy: {
      '/api': {
        target: 'http://103.219.1.138:4430',
        changeOrigin: true,
        secure: false, // disables SSL verification
        rewrite: (path) => path.replace(/^\/api/, '/api'), // optional
      },
    },
  },
});