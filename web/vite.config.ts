import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/icons/' matches the GitHub Pages project path
// (https://your-job-search-genius.github.io/icons/).
export default defineConfig({
  base: '/icons/',
  plugins: [react()],
});
