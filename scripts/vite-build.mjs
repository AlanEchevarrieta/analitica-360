import { spawnSync } from 'node:child_process'

if (process.argv.includes('--report')) {
  process.env.BUNDLE_REPORT = '1'
}

const r = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(r.status ?? 1)
