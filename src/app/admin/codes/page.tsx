import { PageHead } from '../ui'
import { CodeForm } from './CodeForm'

export const dynamic = 'force-dynamic'
/* Forty odd makers renumbered against a remote database. Every other screen
   that writes in bulk carries this, and leaving it off here is why Drew
   pressed the button and watched nothing happen: the default cut the
   transaction off part way and rolled the whole thing back. */
export const maxDuration = 60

/**
 * Re-cutting the maker numbers from the girls' own list.
 *
 * Drew, 29 October: "we have new MM numbers for each vendor", and forty two
 * rows out of the sheet. The numbers in the database were minted in
 * acceptance order; these were decided by a person, by category and by where
 * a maker stands in the room, and theirs is the one that goes on the tent
 * card and gets read off a Venmo note.
 */
export default function CodesPage() {
  return (
    <>
      <PageHead
        title="Maker numbers"
        sub="Paste the sheet, read what it would do, then do it."
      />
      <CodeForm />
    </>
  )
}
