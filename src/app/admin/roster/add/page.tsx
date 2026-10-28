import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { usd } from '@/lib/money'
import { PageHead } from '../../ui'
import { addMakerByHand } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add a maker' }

/**
 * Put a maker on the roster who never went through the application form.
 *
 * There was no way to do this at all until now. The sheet import refuses
 * anybody without an application, and everything else hangs off a row that
 * does not exist, so the only answer was to send a maker who had already paid
 * back to a sixteen field public form. That came up twice in one week in late
 * October and will keep coming up: in the last month before a show, makers
 * arrive by text message, not by form.
 *
 * It is not a second jury, and the screen says so. Nobody answered any
 * questions here, so the application it writes is nearly empty and a reason
 * is required. The curation judgement is the product; this records that a
 * person made one and who they were.
 */
export default async function AddMakerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const spaces = await db
    .select({
      id: spaceTypes.id, label: spaceTypes.label, track: spaceTypes.track,
      priceCents: spaceTypes.priceCents,
    })
    .from(spaceTypes)
    .orderBy(asc(spaceTypes.sortOrder))

  const keep = (k: string) => ({ defaultValue: sp[k] ?? '' })

  return (
    <>
      <PageHead
        title="Add a maker"
        sub={`${show.name} · for somebody who never went through the form`}
      />

      {sp.bad && <p className="adm-note" role="alert">{sp.bad}</p>}

      <p className="adm-note">
        This writes an accepted application, a booking, their Mermade ID and
        their pay link, exactly as accepting from the jury queue would. Use it
        for a maker who arrived by text message rather than through{' '}
        <code>/apply</code>. If they did apply, accept them from{' '}
        <Link href="/admin/jury?status=all">the review queue</Link> instead, so
        their answers and photographs come with them.
      </p>

      <form action={addMakerByHand} className="adm-form">
        <div className="adm-row2">
          <label className="adm-field">
            <span className="lb">Shop name</span>
            <input className="inp" type="text" name="shopName" required
              maxLength={120} {...keep('shopName')} />
          </label>
          <label className="adm-field">
            <span className="lb">Who runs it</span>
            <input className="inp" type="text" name="contactName" required
              {...keep('contactName')} />
          </label>
        </div>

        <div className="adm-row2">
          <label className="adm-field">
            <span className="lb">Email</span>
            <input className="inp" type="email" name="email" required
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              {...keep('email')} />
            <span className="hint">
              The address is the account. If they already have a vendor record
              under it, this reuses it and keeps their Mermade ID.
            </span>
          </label>
          <label className="adm-field">
            <span className="lb">Phone</span>
            <input className="inp" type="tel" name="phone" {...keep('phone')} />
          </label>
        </div>

        <div className="adm-row2">
          <label className="adm-field">
            <span className="lb">Space</span>
            <select className="inp" name="spaceTypeId" required
              defaultValue={sp.spaceTypeId ?? ''}>
              <option value="" disabled>Pick a space</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {usd(s.priceCents)} · {s.track}
                </option>
              ))}
            </select>
            <span className="hint">
              Indoor is consignment at the central register. Outdoor is a booth
              they staff themselves. Make sure they know which one they agreed to.
            </span>
          </label>
          <label className="adm-field">
            <span className="lb">Fee</span>
            <input className="inp" type="text" inputMode="decimal" name="fee"
              placeholder="list price" {...keep('fee')} />
            <span className="hint">
              Leave it empty for the list price above. Type a number to charge
              something else. It is snapshotted onto the booking and cannot be
              changed afterwards.
            </span>
          </label>
        </div>

        <div className="adm-row2">
          <label className="adm-field">
            <span className="lb">Instagram</span>
            <input className="inp" type="text" name="instagram" placeholder="@theirshop"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              {...keep('instagram')} />
          </label>
          <label className="adm-field">
            <span className="lb">Why</span>
            <input className="inp" type="text" name="reason" required minLength={3}
              placeholder="paid before we had her on a list" {...keep('reason')} />
            <span className="hint">
              Required, and it goes in the audit log. This is the one way onto
              the roster that nobody juried, so it is the only record of why.
            </span>
          </label>
        </div>

        <p className="adm-note">
          <button className="adm-btn" type="submit">Add them to the roster</button>
        </p>
      </form>

      <p className="adm-note">
        No email is sent. They will not hear anything until you send their
        invoice from their roster page, or include them in a send from{' '}
        <Link href="/admin/onboarding">item lists and payouts</Link>.
      </p>
    </>
  )
}
