import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Para GitHub Pages (proyecto), descomenta y pon el nombre del repo:
  // base: '/aureth/',
  build: {
    rollupOptions: {
      output: {
        // Three pesa casi todo el bundle y no cambia nunca. En chunks
        // aparte, una corrección en la historia no invalida la caché
        // del motor 3D para quien ya visitó la página.
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          post: ['@react-three/postprocessing', 'postprocessing'],
          gsap: ['gsap', '@gsap/react'],
        },
      },
    },
  },
});
