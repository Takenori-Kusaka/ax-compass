import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages のプロジェクトサイト(https://<user>.github.io/ax-compass/)で動かすため base を固定する
export default defineConfig({
  base: '/ax-compass/',
  plugins: [svelte()],
  build: { target: 'es2022' },
});
