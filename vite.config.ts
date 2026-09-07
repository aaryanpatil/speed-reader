import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite is the build tool. It serves the app instantly while you develop
// and bundles it into a static site when you run `npm run build`.
export default defineConfig({
  plugins: [react()],
  // Static site, no server. `base` matters only if you deploy to a
  // GitHub Pages subpath like username.github.io/speed-reader/
  base: './',
})
