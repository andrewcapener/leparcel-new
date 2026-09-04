import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. Point it at Supabase (use the transaction pooler URL, port 6543) or a local Postgres.',
  )
}

// prepare:false because Supabase's transaction pooler does not support
// prepared statements; harmless against a direct connection. One connection
// per serverless instance is enough at this traffic and keeps the pooler calm.
export const sqlClient = postgres(url, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(sqlClient, { schema })
export { schema }
