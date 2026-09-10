import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, type Plugin } from 'vite'

const reportarBundle = process.env.BUNDLE_REPORT === '1'

function cssNoBloqueante(): Plugin {
  return {
    name: 'css-no-bloqueante',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<link rel="stylesheet"([^>]*?)href="(\/assets\/[^"]+\.css)"([^>]*)>/g,
          '<link rel="preload" as="style" href="$2" onload="this.onload=null;this.rel=\'stylesheet\'">\n    <noscript><link rel="stylesheet" href="$2"></noscript>',
        )
      },
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cssNoBloqueante(),
    ...(reportarBundle
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            template: 'treemap',
            emitFile: true,
          }),
        ]
      : []),
  ],
  optimizeDeps: {
    include: ['react-is', 'recharts', '@tremor/react', 'papaparse', 'xlsx'],
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-is'],
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) =>
            !dep.includes('vendor-recharts') &&
            !dep.includes('vendor-tremor') &&
            !dep.includes('vendor-xlsx') &&
            !dep.includes('vendor-ss'),
        ),
    },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom)\b/ },
            { name: 'vendor-recharts', test: /node_modules[\\/]recharts\b/ },
            { name: 'vendor-tremor', test: /node_modules[\\/]@tremor[\\/]react\b/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]supabase-js\b/ },
            { name: 'vendor-xlsx', test: /node_modules[\\/]xlsx\b/ },
            { name: 'vendor-ss', test: /node_modules[\\/]simple-statistics\b/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
