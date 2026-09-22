import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'
import { PageHead } from '../ui'
import { ImportForm } from './ImportForm'

export const dynamic = 'force-dynamic'
/* Seventy eight makers are booked one at a time, because the Mermade ID is a
   running count and two inserted at once would claim the same number. That is
   several hundred sequential round trips to Supabase, which is comfortably
   past the platform's default function timeout: the first real run against
   the production database hit it. Sixty seconds is the ceiling on every plan,
   so it is the safe number to ask for.

   The run survives being cut off either way, since each maker is committed on
   its own and a maker who already has a booking is skipped. This only saves
   somebody having to press the button twice. */
export const maxDuration = 60

/**
 * Accepting the whole roster from the sheet the fees were agreed in.
 *
 * Seventy eight makers, most at the list price and fifteen at something the
 * girls settled by hand. Accepting them one at a time is seventy eight trips
 * through the jury screen, each one a chance to pick the wrong space or
 * mistype a fee, at night, against a deadline. This is one paste and one read
 * of exactly what will happen.
 *
 * Two things it deliberately does not do, both of which the single maker path
 * does: it never adds an add-on on top of the sheet's number, because that
 * number is already the whole fee, and it never sends an email, whatever the
 * Show's switches say. The girls write their own.
 */
export default async function RosterImport() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const spaces = await db
    .select({ label: spaceTypes.label, priceCents: spaceTypes.priceCents })
    .from(spaceTypes)
    .where(eq(spaceTypes.showId, show.id))
    .orderBy(asc(spaceTypes.sortOrder))

  return (
    <div className="adm-narrow">
      <PageHead
        title="Accept from the sheet"
        sub={`${show.numeral} · ${show.name} · ${spaces.length} space labels`}
      />

      <p className="adm-note">
        Nothing is written until you have read the list and pressed the second button. The fee in
        the sheet is charged exactly as typed: no add-on is applied on top of it, because that
        number already carries the credits and the discounts the girls agreed.{' '}
        <strong>No email is sent to anybody</strong>, whatever the Show settings say. Every
        booking is audit-logged, and a maker who already has one is left alone, so running this
        twice changes nothing the second time.
      </p>

      <p className="adm-note">
        Payment is due{' '}
        <strong>
          {show.paymentDueAt
            ? fmtDateTime(show.paymentDueAt)
            : `${show.paymentWindowHours} hours after each acceptance`}
        </strong>
        . That is stamped on every booking as it is created, so set it on Show settings before
        running this rather than after.
      </p>

      <ImportForm spaces={spaces} />
    </div>
  )
}
