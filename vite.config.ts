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
        //
        // React va listado aparte, y no es cosmético: sin esta línea
        // Rollup lo mete dentro del chunk de r3f, que es quien más lo
        // usa. Como la página necesita React desde el primer momento,
        // el HTML acaba precargando r3f —y con él three— y la carga
        // diferida del mundo 3D deja de servir para nada.
        // Va como función y no como lista de paquetes porque la lista no
        // llega a `react/jsx-runtime`, que es un fichero aparte dentro del
        // mismo paquete: con la lista, el chunk de React salía vacío y el
        // runtime de JSX se quedaba dentro de r3f.
        manualChunks(id) {
          // El ayudante de precarga que Vite inyecta para los `import()`
          // dinámicos. Suena a detalle y no lo es: si se deja donde Rollup
          // lo ponga, acaba dentro del chunk de r3f, y entonces la entrada
          // importa r3f solo por esta función de veinte líneas —y r3f
          // importa three—. El HTML precarga medio mega para nada.
          if (id.includes('preload-helper')) return 'react';
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/node_modules[\\/]three[\\/]/.test(id)) return 'three';
          if (
            /node_modules[\\/]@react-three[\\/]postprocessing/.test(id) ||
            /node_modules[\\/]postprocessing[\\/]/.test(id) ||
            /node_modules[\\/]n8ao/.test(id)
          ) {
            return 'post';
          }
          if (/node_modules[\\/]@react-three[\\/]/.test(id)) return 'r3f';
          if (/node_modules[\\/](gsap|@gsap)[\\/]/.test(id)) return 'gsap';
          // El resto de dependencias de drei se quedan donde Rollup las
          // ponga: solo las usa el mundo 3D, así que caen en su chunk.
          return undefined;
        },
      },
    },
  },
});
