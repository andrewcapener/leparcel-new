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

/**
 * What we actually know about this maker's permit.
 *
 * Three fields carry this and they mean different things, which is how the
 * old two-field check went wrong. `permitStatus` is what the MAKER told us on
 * the application: have one, occasional seller, or not sure. `sellerPermit` is
 * the number, which the form requires whenever they said "have". And
 * `occasionalSeller` is the staff-side fact that a signed CDTFA-410-D is on
 * file, which is a different and later thing than somebody selecting
 * "occasional" from a dropdown.
 *
 * The bug this replaces: `Boolean(sellerPermit) || occasionalSeller` treated a
 * maker who answered "I am an occasional seller" as though they had never been
 * asked, because nothing in the application ever sets `occasionalSeller`. They
 * showed as undocumented with no sign anywhere that they had answered, and the
 * roster's "410-D claimed" tag was keyed on a field nothing writes, so it
 * could never render at all.
 */
export type PermitState =
  /** Indoor. Mermade is the retailer of record, so nobody asks. */
  | 'not_required'
  /** The number is on file. Done. */
  | 'on_file'
  /** They said they have one and we do not have the number yet. */
  | 'promised'
  /** They said they are an occasional seller. Needs the 410-D signed. */
  | 'occasional_declared'
  /** The 410-D is on file. Done. */
  | 'occasional_documented'
  /** They asked for help working out whether they need one. */
  | 'unsure'
  /** Outdoor, and they never answered. Pre-dates the question, or a gap. */
  | 'unanswered'

export function permitState(input: {
  track: string
  permitStatus: string | null
  sellerPermit: string
  occasionalSeller: boolean
}): PermitState {
  if (!owesPermit(input.track)) return 'not_required'
  if (input.sellerPermit.trim().length > 0) return 'on_file'
  if (input.occasionalSeller) return 'occasional_documented'
  switch (input.permitStatus) {
    case 'have': return 'promised'
    case 'occasional': return 'occasional_declared'
    case 'unsure': return 'unsure'
    default: return 'unanswered'
  }
}

/** Cleared for load-in on the permit question. Only two states are done: the
 *  number is held, or the 410-D is signed. A declaration is not a document,
 *  and Publication 111 asks for the record, not the intention. */
export function permitCleared(state: PermitState): boolean {
  return state === 'not_required' || state === 'on_file' || state === 'occasional_documented'
}

/** True when the maker has already answered and the ball is with us. Used so
 *  the maker's dashboard stops asking for something they already gave. */
export function permitAnswered(state: PermitState): boolean {
  return state !== 'unanswered'
}

/**
 * What a maker reads back about their own permit, in their profile.
 *
 * This is where the permit answer belongs. Everybody outdoor answers it on
 * the application, so it is a fact about them like their address, not a task:
 * putting an answered question on a to-do list is how a careful maker ends up
 * feeling unheard. The checklist only carries it back when something is
 * genuinely still theirs to do.
 */
export function permitProfileLine(state: PermitState, sellerPermit: string): string | null {
  switch (state) {
    case 'not_required': return null
    case 'on_file': return sellerPermit.trim()
    case 'occasional_documented': return 'Occasional seller, form on file'
    case 'occasional_declared': return 'Occasional seller, form to follow from us'
    case 'unsure': return 'You asked us to help you work out whether you need one'
    case 'promised': return 'You have one, number still to come'
    case 'unanswered': return 'Not answered'
  }
}

/** Still theirs to do. Everything else is either done or waiting on us. */
export function permitNeedsMaker(state: PermitState): boolean {
  return state === 'promised' || state === 'unanswered'
}

/** Kept for the old two-argument callers. */
export function permitSettled(sellerPermit: string, occasionalSeller: boolean): boolean {
  return sellerPermit.trim().length > 0 || occasionalSeller
}
