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
// prepared statements; harmless against a direct connection.
//
// max was 1, on the reasoning that one connection per serverless instance is
// enough at this traffic and keeps the pooler calm. The traffic part is true
// and the cost was invisible until it was measured: from the deployment, a
// single trivial query costs about 130ms, and five issued at once took 659ms
// against 657ms for five in a row. Identical, because one connection cannot
// overlap anything. Every query a page runs waits for the one before it even
// where the page does not care about the order.
//
// A handful of connections changes that without changing the pooler's life:
// an instance serves one request at a time, so this is at most a few
// overlapping queries from one page, not a few more clients. Queries are
// still queued once they are all busy, which is the behaviour max:1 had.
export const sqlClient = postgres(url, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(sqlClient, { schema })
export { schema }
