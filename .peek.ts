import { db } from './src/db/index'
import { applications, vendors, spaceTypes, addOns } from './src/db/schema'
async function main() {
  const rows = await db.select().from(applications).limit(2)
  console.log(JSON.stringify(rows, null, 1))
  const v = await db.select().from(vendors).limit(1); console.log(JSON.stringify(v[0]))
  const s = await db.select().from(spaceTypes).limit(12); console.log(s.map(x=>[x.id,x.code,x.label,x.priceCents]))
  const a = await db.select().from(addOns); console.log(a.map(x=>[x.code,x.name,x.track,x.priceCents]))
  process.exit(0)
}
main()
