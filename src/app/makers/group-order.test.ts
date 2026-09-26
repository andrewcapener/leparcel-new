import { GROUP_KEYS, bySection } from './group-order'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const card = (name: string, group: string) => ({ name, group })

/* The mismatch Drew saw: junior makers book "JR Space", an indoor space, so
   the server order scattered them through the indoor makers. */
const scattered = [
  card('Almanac', 'indoor'), card('Otto', 'junior'), card('Argonaut', 'indoor'),
  card('Kelly', 'friday'), card('Brighton', 'junior'), card('Ranch52', 'saturday'),
  card('Dema', 'sunday'), card('Saltbox', 'indoor'),
]

check('indoor comes first',
  bySection(scattered)[0]!.group === 'indoor')
check('the sections come out in tab order',
  [...new Set(bySection(scattered).map((c) => c.group))].join(',')
  === 'indoor,junior,friday,saturday,sunday')

/* The important half: within a section nothing is re-sorted, so the order
   staff dragged into on /admin/lineup survives. */
check('within a section the order staff chose is untouched',
  bySection(scattered).filter((c) => c.group === 'indoor').map((c) => c.name).join(',')
  === 'Almanac,Argonaut,Saltbox')
check('and that holds for a section that was already contiguous',
  bySection(scattered).filter((c) => c.group === 'junior').map((c) => c.name).join(',')
  === 'Otto,Brighton')

/* A space type somebody adds later must not be able to take the top of the
   public page by accident. */
check('an unknown group sorts to the end, never the front',
  bySection([card('Mystery', 'popup'), card('Almanac', 'indoor')])
    .map((c) => c.name).join(',') === 'Almanac,Mystery')

check('the input is not mutated',
  (() => { const before = scattered.map((c) => c.name).join(','); bySection(scattered)
    return scattered.map((c) => c.name).join(',') === before })())
check('an empty grid is fine', bySection([]).length === 0)
check('every key the page offers has a rank', GROUP_KEYS.length === 5)

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('maker grid: Everyone reads as the sections, and staff order survives inside each')
