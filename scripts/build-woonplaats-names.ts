import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

import { cityAliases } from './city-aliases.ts'

const defaultDbPath = resolve('data/bag-light.gpkg')
const defaultOutputPath = resolve('app/src/lib/generated/woonplaats-names.json')

function printHelp() {
  console.log(
    [
      'Usage: node scripts/build-woonplaats-names.ts [--db data/bag-light.gpkg] [--output app/src/lib/generated/woonplaats-names.json]',
      '',
      'Exports all BAG woonplaats names as a sorted JSON array.'
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv: string[]) {
  let dbPath = defaultDbPath
  let outputPath = defaultOutputPath

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      printHelp()
      process.exit(0)
    }

    if (argument === '--db') {
      const value = argv[index + 1]
      index += 1

      if (!value) {
        fail('Missing value after --db')
      }

      dbPath = resolve(value)
      continue
    }

    if (argument === '--output') {
      const value = argv[index + 1]
      index += 1

      if (!value) {
        fail('Missing value after --output')
      }

      outputPath = resolve(value)
      continue
    }

    fail(`Unknown argument: ${argument}`)
  }

  return { dbPath, outputPath }
}

function queryWoonplaatsNames(dbPath: string): string[] {
  const sql = `
    SELECT DISTINCT woonplaats
    FROM woonplaats
    WHERE woonplaats IS NOT NULL
      AND woonplaats != ''
    ORDER BY woonplaats COLLATE NOCASE ASC;
  `.trim()

  try {
    const output = execFileSync('sqlite3', ['-readonly', '-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()

    const rows = JSON.parse(output) as Array<{ woonplaats?: string }>

    return rows
      .map((row) => row.woonplaats?.trim() ?? '')
      .filter((name) => name.length > 0)
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      const stderr = String((error as { stderr?: string }).stderr ?? '').trim()
      fail(stderr || error.message)
    }

    fail(error instanceof Error ? error.message : String(error))
  }
}

function main() {
  const { dbPath, outputPath } = parseArgs(process.argv.slice(2))
  const names = queryWoonplaatsNames(dbPath)
  const aliases = Object.values(cityAliases).flat()
  const allNames = [...new Set([...names, ...aliases])].sort((a, b) =>
    a.localeCompare(b, 'nl', { sensitivity: 'base' })
  )

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(allNames, null, 2) + '\n')

  console.log(`Wrote ${allNames.length} woonplaats names to ${outputPath}`)
}

main()
