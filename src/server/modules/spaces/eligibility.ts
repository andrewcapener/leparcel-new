/**
 * Which spaces a maker in a given category may actually choose.
 *
 * Elise, 7 Sep 2026: "can you make it if they are apparel, they CANNOT sign up
 * for a 3x4 !!!!! That would be amazing for me, the amount of people that want
 * that bc its cheap", and "treats on a shelf, they CANNOT choose that item
 * unless they are baked goods only".
 *
 * Both are curation rules the jury was enforcing by hand after the fact, which
 * means somebody applied, waited three weeks, and was told no for a reason
 * they could have been told in the form. The form is the right place: it costs
 * the maker nothing to know now.
 *
 * Keyed on space code rather than on label, because a label is display text
 * somebody may reword in the admin and a code is the identity. Not on the Show
 * record: CLAUDE.md rule 6 governs dates, prices, capacities and rates, which
 * these are not, and a rule that reads "apparel does not fit on a 3x4" is a
 * fact about the furniture rather than a setting for a season. If it ever needs
 * to differ per show, it becomes two nullable columns on space_types and this
 * module reads them instead; nothing else changes.
 */
import type { Category } from '@/db/schema'

export type SpaceRule = {
  /** Only these categories may choose it. */
  onlyFor?: readonly Category[]
  /** These categories may not. */
  notFor?: readonly Category[]
  /** Said to the maker, at the option, in our own voice. */
  because: string
}

export const SPACE_RULES: Readonly<Record<string, SpaceRule>> = {
  'IN-3x4': {
    notFor: ['Apparel'],
    because: 'Too small for apparel. Choose a 3x6 or larger.',
  },
  'IN-TREAT': {
    onlyFor: ['Treats'],
    because: 'Baked goods only.',
  },
}

export type Eligibility = { ok: true } | { ok: false; reason: string }

/**
 * Whether this category may choose this space.
 *
 * Open by default in both directions: a space with no rule is available to
 * everyone, and every space is available until a category has been chosen. A
 * maker who has not answered that question yet is not doing anything wrong,
 * and the form should not look like they are.
 */
export function spaceAllowed(code: string, category: string | undefined): Eligibility {
  const rule = SPACE_RULES[code]
  if (!rule || !category) return { ok: true }

  if (rule.onlyFor && !rule.onlyFor.includes(category as Category)) {
    return { ok: false, reason: rule.because }
  }
  if (rule.notFor && rule.notFor.includes(category as Category)) {
    return { ok: false, reason: rule.because }
  }
  return { ok: true }
}

/** The codes this category may not choose, for a server-side check. */
export function blockedCodes(category: string | undefined): string[] {
  return Object.keys(SPACE_RULES).filter((code) => !spaceAllowed(code, category).ok)
}
