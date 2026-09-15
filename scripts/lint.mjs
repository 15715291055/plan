import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const sourceFiles = []
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(path)
  }
}
await collect('src')
await collect('api')

const forbidden = [/DEEPSEEK_API_KEY\s*=/, /SUPABASE_SERVICE_ROLE_KEY\s*=/]
const violations = []
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8')
  forbidden.forEach(pattern => { if (pattern.test(source)) violations.push(`${file}: contains a server secret assignment`) })
  if (/console\.log\(/.test(source)) violations.push(`${file}: remove console.log before release`)
}
if (violations.length) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.log(`lint ok (${sourceFiles.length} source files checked)`)
}
