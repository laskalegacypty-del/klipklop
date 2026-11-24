import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@klipklop/ui': path.resolve(root, '../../packages/ui/src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(root, '../..')],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
