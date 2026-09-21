import { popupSuppressed } from './popup-paths'

/**
 * This list has been wrong twice, both times caught in a screenshot. The
 * point of the file is that a third time fails here instead.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* Every door where somebody is mid task. */
for (const p of [
  '/apply', '/apply/thanks',
  '/account', '/account/enter', '/account/payment',
  '/admin', '/admin/roster', '/admin/show',
  '/pay', '/pay/0520ab39bd914621a796a40f1df901e4b1e83a114d814bd1b076df3dc1605b25',
]) {
  check(`no pop-up on ${p}`, popupSuppressed(p))
}

/* The marketing site, where it belongs and where the email capture is the
   revenue miss ranked first in the content audit. */
for (const p of ['/', '/faq', '/journal', '/journal/a-post', '/lookbook', '/merchants', '/schedule']) {
  check(`the pop-up still runs on ${p}`, !popupSuppressed(p))
}

/* Prefix matching must be on a path SEGMENT. A marketing page that merely
   starts with the same letters is not a task. */
check('a lookalike marketing path is not suppressed', !popupSuppressed('/payment-terms'))
check('nor is one under it', !popupSuppressed('/paydays/2026'))
check('nor an account-adjacent marketing page', !popupSuppressed('/accountability'))
/* And the exact path itself always is, with or without a trailing segment. */
check('the bare path is suppressed', popupSuppressed('/pay'))
check('and a child of it', popupSuppressed('/pay/anything/deeper'))

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('pop-up paths: never in front of somebody part way through a task')
export {}
