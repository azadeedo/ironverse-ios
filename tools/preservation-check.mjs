// Preservation check: compares this iOS copy with the ORIGINAL iron-verse project
// (read-only) and the import commit. Proves no original file was deleted and lists
// every line that was changed, so a reviewer can confirm each change is additive.
// Run: node tools/preservation-check.mjs [path-to-original]
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ORIGINAL = process.argv[2] ?? '../iron-verse'
const SKIP = new Set(['node_modules', '.git', 'dist', '.netlify', 'dev-dist', '.claude'])
const walk = (d) => readdirSync(d).flatMap((f) => SKIP.has(f) ? [] : statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])

const orig = walk(ORIGINAL).map((f) => relative(ORIGINAL, f).split(sep).join('/'))
const missing = orig.filter((f) => !existsSync(f))
console.log(`Original files: ${orig.length}. Missing in iOS copy: ${missing.length}`)
missing.forEach((f) => console.log('  MISSING ' + f))

const base = execSync('git rev-list --max-parents=0 HEAD').toString().trim()
const stat = execSync(`git diff --numstat ${base} -- src public tests index.html vite.config.ts package.json`).toString().trim().split('\n').filter(Boolean)
let removed = 0
console.log('\nChanged original files (added / removed lines):')
for (const l of stat) {
  const [a, r, f] = l.split('\t')
  if (!orig.includes(f)) continue
  removed += Number(r) || 0
  console.log(`  +${a.padStart(4)} -${r.padStart(3)}  ${f}`)
}
console.log(`\nLines removed or rewritten in original files: ${removed} (each is shown by: git diff ${base} -- <file>)`)
process.exit(missing.length ? 1 : 0)
