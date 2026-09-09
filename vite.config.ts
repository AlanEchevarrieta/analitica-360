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
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom)\b/ },
            { name: 'vendor-recharts', test: /node_modules[\\/]recharts\b/ },
            { name: 'vendor-tremor', test: /node_modules[\\/]@tremor[\\/]react\b/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]supabase-js\b/ },
            { name: 'vendor-xlsx', test: /node_modules[\\/]xlsx\b/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
