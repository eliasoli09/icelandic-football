// Load web/.env.local for scripts run from this machine.
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
