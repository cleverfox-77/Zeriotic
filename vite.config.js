import { defineConfig } from 'vite';

// Relative base so the build can be dropped on any static host / sub-path.
export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,           // never inline the .glb binaries
    rollupOptions: {
      output: {
        // Split the big libs into their own long-cache chunks.
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
  assetsInclude: ['**/*.glb'],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: false,
    // contact form → the nodemailer API (npm run api)
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
