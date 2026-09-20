import { redirect } from 'next/navigation'

/** The first name for the universal link, kept alive because it was shared
 *  once before /pay existed. Nothing here but the forward. */
export default function PaymentAlias(): never {
  redirect('/pay')
}
