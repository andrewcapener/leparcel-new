import { randomUUID } from 'crypto'
import { db } from '@/db'
import { auditLog } from '@/db/schema'

/**
 * Every thumbnail change, with before and after.
 *
 * Not money, so rule 3 does not strictly reach it, but this is staff editing
 * how a maker is presented to the public and "who changed my photo" is a
 * question somebody will ask in November. It costs one row.
 *
 * Its own file because actions.ts carries 'use server' and may only export
 * async functions: a helper exported from there is a runtime 500 that tsc and
 * the build both pass. See src/app/use-server-exports.test.ts.
 */
export async function logAudit(
  applicationId: string, before: string | null, after: string | null, reason: string,
): Promise<void> {
  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'application',
    entityId: applicationId,
    action: 'thumbnail_change',
    before: JSON.stringify({ thumbnailUrl: before }),
    after: JSON.stringify({ thumbnailUrl: after }),
    reason,
    actor: 'staff',
  })
}
