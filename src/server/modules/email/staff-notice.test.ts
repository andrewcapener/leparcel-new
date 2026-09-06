/**
 * The staff notice is built from text a stranger typed into a public form and
 * is opened by the team in their own inbox. Two things have to hold.
 *
 * Everything is escaped. A shop name containing markup must arrive as
 * characters, not as markup, or an application is a way to put a link, an
 * image beacon or a form into Mermade's mail.
 *
 * Every field survives. This message is one of the four places an application
 * lives, so a template that quietly drops an empty value is a backup with a
 * hole in it.
 */
import { staffNoticeHtml } from './staff-notice'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) { failures += 1; console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`) }
}

const nasty = '<script>alert(1)</script>'
const html = staffNoticeHtml({
  heading: nasty,
  sub: 'Ceramics " onload="x',
  fields: [
    { label: 'Shop', value: nasty },
    { label: 'Email', value: 'a@b.com' },
    { label: 'Website', value: 'https://example.com/x?a=1&b=2' },
    { label: 'Blank', value: '' },
    { label: '<b>Label</b>', value: 'ok' },
  ],
  cta: { href: 'https://example.com/admin/"onmouseover="y', label: 'Open in admin' },
})

check('no script tag survives', !/<script/i.test(html))
check('the markup arrives as text', html.includes('&lt;script&gt;'))
check('a quote in a value cannot close an attribute', !html.includes('" onload="x'))
check('a quote in the cta href cannot either', !html.includes('"onmouseover="'))
check('a label is escaped too', html.includes('&lt;b&gt;Label&lt;/b&gt;'))
check('an ampersand in a url is escaped', html.includes('a=1&amp;b=2'))

// Emitted tags: only the ones this template writes. Anything else means data
// became markup.
const tags = [...new Set([...html.matchAll(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1]!.toLowerCase()))]
const allowed = new Set(['html', 'head', 'body', 'meta', 'title', 'table', 'tr', 'td', 'div', 'span', 'a', 'doctype'])
const unexpected = tags.filter((t) => !allowed.has(t))
check('no unexpected tags', unexpected.length === 0, unexpected.join(', '))

check('every label appears', ['Shop', 'Email', 'Website', 'Blank'].every((l) => html.includes(l)))
check('an empty value is shown as empty, not dropped', html.includes('not given'))
check('links are linked', html.includes('mailto:a@b.com'))

// No remote anything: a client that blocks external content shows this whole,
// and a maker's details never travel to a third party to render a header.
check('no remote images', !/<img/i.test(html))
check('no external stylesheet or font', !/<link/i.test(html) && !/@import/i.test(html))

if (failures) { console.error(`staff notice: ${failures} failure(s)`); process.exit(1) }
console.log('staff notice: escapes everything, keeps every field, fetches nothing')
