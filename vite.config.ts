import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['react-is', 'recharts', '@tremor/react', 'papaparse', 'xlsx'],
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-is'],
  },
})
