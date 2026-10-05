import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Cada archivo levanta la app completa contra una base real y corren en paralelo:
    // en una PC cargada (o la primera vez, en frío) 5 s no alcanzan y fallaban pruebas sanas.
    testTimeout: 30_000,
    hookTimeout: 90_000,
    // Como mucho 4 archivos a la vez: con más, la base y la PC se saturan.
    maxWorkers: 4,
  },
});
