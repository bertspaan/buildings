import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function printHelp() {
  console.log(
    [
      'Usage: node scripts/count-buildings.ts [path/to/file.gpkg]',
      '',
      'Counts the number of buildings in the pand layer of a GeoPackage.',
      '',
      'Examples:',
      '  node scripts/count-buildings.ts',
      '  node scripts/count-buildings.ts data/bag-light.gpkg'
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseDbPath(argv: string[]): string {
  const input = argv[0]

  if (input === '--help' || input === '-h') {
    printHelp()
    process.exit(0)
  }

  if (argv.length > 1) {
    fail('Too many arguments. Pass at most one GeoPackage path.')
  }

  return resolve(input ?? 'data/bag-light.gpkg')
}

function countBuildings(dbPath: string): number {
  const query = 'SELECT COUNT(*) FROM pand;'
  const result = spawnSync('sqlite3', ['-readonly', dbPath, query], {
    encoding: 'utf8'
  })

  if (result.error) {
    fail(`Failed to run sqlite3: ${result.error.message}`)
  }

  if (result.status !== 0) {
    fail(result.stderr.trim() || `sqlite3 exited with status ${result.status}`)
  }

  const count = Number.parseInt(result.stdout.trim(), 10)

  if (!Number.isInteger(count)) {
    fail(`Unexpected sqlite output: ${result.stdout.trim()}`)
  }

  return count
}

const dbPath = parseDbPath(process.argv.slice(2))
const count = countBuildings(dbPath)

const outputPath = resolve('app/src/lib/generated/building-stats.json')
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify({ buildingCount: count }, null, 2) + '\n')

console.log(count)
