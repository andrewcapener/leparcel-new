import type { NextConfig } from 'next'
const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  // Ship the seeded demo db inside every serverless function bundle so the
  // Vercel deploy has data. See the note in src/db/index.ts.
  outputFileTracingIncludes: { '/**': ['./mermade.db'] },
}
export default config
