import { redirect } from 'next/navigation'

/** The lookbook split in two when the outdoor one was ported. */
export default function LookbookIndex() {
  redirect('/lookbook/indoor')
}
