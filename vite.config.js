import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    tailwindcss(),
    react()
  ],
  build: {
    target: 'esnext',
    assetsInlineLimit: 0, // never inline the .glb binaries
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        privacy: path.resolve(__dirname, 'privacy.html'),
        variant3d: path.resolve(__dirname, 'work/variant3d.html'),
        mira: path.resolve(__dirname, 'work/mira.html'),
        melemTokyo: path.resolve(__dirname, 'work/melem-tokyo.html'),
        octadezx: path.resolve(__dirname, 'work/octadezx.html'),
        accertOne: path.resolve(__dirname, 'work/accert-one.html'),
        cybersecurityAudit: path.resolve(__dirname, 'work/cybersecurity-audit.html'),
        howZerioticRenders: path.resolve(__dirname, 'work/how-zeriotic-renders.html'),
        compareAgencies: path.resolve(__dirname, 'compare/zeriotic-vs-agencies.html'),
        phpVulnBlog: path.resolve(__dirname, 'blog/php-vulnerability-login-without-password.html'),
        uncensoredAiBlog: path.resolve(__dirname, 'blog/how-uncensored-ai-agents-increase-hacking.html'),
      },
      output: {
        // Split the big libs into their own long-cache chunks.
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
          react: ['react', 'react-dom']
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
