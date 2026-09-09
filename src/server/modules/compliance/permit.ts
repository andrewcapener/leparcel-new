/**
 * California seller's permit numbers, validated but not gatekept.
 *
 * CDTFA Publication 111 makes this Mermade's record to hold, not the maker's
 * problem to prove: "You may not rent space to sellers unless they give you
 * the written documentation described in this publication," and the penalty
 * for allowing an unpermitted seller runs to $1,000 each. So the number has to
 * arrive and be stored. It does NOT have to be perfect, and that distinction
 * shapes everything here.
 *
 * A permit number is issued by CDTFA and this code cannot check it against
 * anything. All it can do is catch a typo, or a phone number pasted in the
 * wrong box. So validation is deliberately loose: enough digits to be a real
 * permit, few enough not to be a bank account. Rejecting a genuine permit
 * because it was written with spaces would block a maker from load-in over
 * punctuation, which is a far worse failure than storing something a person
 * then has to look at.
 */

/** Digits only, which is how two people writing the same permit differently
 *  become the same permit. */
export function normalizePermit(raw: string): string {
  return raw.replace(/\D/g, '')
}

export type PermitCheck =
  | { ok: true; normalized: string }
  | { ok: false; reason: string }

/* CDTFA account numbers are commonly nine digits, often written with a dash or
   spaces, and older or sub-permit formats run a little longer. This range
   accepts every shape seen in the wild and still catches the two things that
   actually get typed here by mistake: a phone number, and a half-typed one. */
const MIN_DIGITS = 8
const MAX_DIGITS = 12

export function checkPermit(raw: string): PermitCheck {
  const digits = normalizePermit(raw)
  if (digits.length === 0) {
    return { ok: false, reason: 'Add your permit number, or tell us you are an occasional seller.' }
  }
  if (digits.length < MIN_DIGITS) {
    return { ok: false, reason: 'That looks too short for a permit number. Have another look and try again.' }
  }
  if (digits.length > MAX_DIGITS) {
    return { ok: false, reason: 'That looks too long for a permit number. Have another look and try again.' }
  }
  return { ok: true, normalized: digits }
}

/**
 * Does this maker owe us a permit at all?
 *
 * Only the outdoor track. An outdoor maker sells for their own account, so
 * Publication 111 applies and the record is ours to hold. Indoor is
 * consignment: Mermade rings the sale and is the retailer of record
 * (agreement 6.2), so asking an indoor maker for a permit would be paperwork
 * nobody needs. `both` owes one, because they are outdoor for part of the show.
 */
export function owesPermit(track: string): boolean {
  return track === 'outdoor' || track === 'both'
}

/** Satisfied, either way: a number on file, or a documented occasional seller. */
export function permitSettled(sellerPermit: string, occasionalSeller: boolean): boolean {
  return sellerPermit.trim().length > 0 || occasionalSeller
}
