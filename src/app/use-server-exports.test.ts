import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A 'use server' file may export async functions and nothing else.
 *
 * Next compiles such a file into a set of callable endpoints, so every export
 * has to be callable. An object among them throws "a use server file can only
 * export async functions" the moment any action in that file is invoked, and
 * the throw is nowhere near the export that caused it.
 *
 * What makes this worth a test rather than a rule is the shape of the
 * failure. Nothing catches it: tsc is happy, the build compiles, the page
 * renders and the button is there. It only goes wrong when somebody presses
 * it, and what they see is an error boundary, which from the far side of a
 * phone is indistinguishable from a button that does nothing. It has cost two
 * nights: /admin/import in the morning and /admin/sheet the same evening,
 * with the same three words in the report both times.
 *
 * Type exports are erased before Next sees the module and are fine. Value
 * exports are not, whatever their type, so a state object belongs beside the
 * form in its own file.
 */

const ROOT = 'src'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** The directive has to be the first statement, ignoring comments and blanks. */
function isUseServerFile(src: string): boolean {
  const head = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))[0]
  return head === "'use server'" || head === '"use server"'
}

/**
 * Every exported name that is a value rather than a type or an async function.
 *
 * `export type` and `export interface` are erased; `export type { X }` is too.
 * Everything else, const or let or class or a re-export, reaches the compiler
 * and has to be callable.
 */
function badExports(src: string): string[] {
  const bad: string[] = []
  for (const line of src.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('export ')) continue
    if (/^export\s+(type|interface)\b/.test(t)) continue
    if (/^export\s+async\s+function\s/.test(t)) continue
    if (/^export\s+(const|let|var)\s+[A-Za-z0-9_$]+\s*(:[^=]+)?=\s*async\b/.test(t)) continue
    if (/^export\s+\{\s*type\s/.test(t)) continue
    bad.push(t.slice(0, 100))
  }
  return bad
}

let failures = 0
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  if (!isUseServerFile(src)) continue
  for (const line of badExports(src)) {
    console.error(`FAIL ${file}\n  ${line}\n  A 'use server' file may export async functions only.`)
    failures++
  }
}

if (failures > 0) {
  console.error(`\n${failures} export(s) would break a server action at runtime.`)
  process.exit(1)
}
console.log("use-server exports: every 'use server' file exports async functions only")
