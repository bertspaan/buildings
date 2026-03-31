#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

type HistogramRow = {
  bouwjaar: number
  count: number
}

type Options = {
  dbPath: string
  outputPath?: string
  asJson: boolean
}

function parseArgs(argv: string[]): Options {
  let dbPath = 'data/bag-light.gpkg'
  let outputPath: string | undefined
  let asJson = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--json') {
      asJson = true
      continue
    }

    if (arg === '--out') {
      const next = argv[i + 1]
      if (!next) {
        fail('Missing value for --out')
      }
      outputPath = next
      i += 1
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg.startsWith('-')) {
      fail(`Unknown option: ${arg}`)
    }

    dbPath = arg
  }

  return {
    dbPath: resolve(dbPath),
    outputPath: outputPath ? resolve(outputPath) : undefined,
    asJson
  }
}

function printHelp() {
  console.log(
    [
      'Usage: bun run scripts/bouwjaar-histogram.ts [path/to/file.gpkg] [--json] [--out output-file]',
      '',
      'Computes a histogram of pand.bouwjaar from a GeoPackage.',
      '',
      'Examples:',
      '  bun run scripts/bouwjaar-histogram.ts',
      '  bun run scripts/bouwjaar-histogram.ts data/bag-light.gpkg --json',
      '  bun run scripts/bouwjaar-histogram.ts data/bag-light.gpkg --out output/bouwjaar-histogram.json --json'
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function runSqlite(dbPath: string): HistogramRow[] {
  const query = `
    SELECT bouwjaar, COUNT(*) AS count
    FROM pand
    GROUP BY bouwjaar
    ORDER BY bouwjaar;
  `

  const result = spawnSync('sqlite3', ['-readonly', dbPath, query], {
    encoding: 'utf8'
  })

  if (result.error) {
    fail(`Failed to run sqlite3: ${result.error.message}`)
  }

  if (result.status !== 0) {
    fail(result.stderr.trim() || `sqlite3 exited with status ${result.status}`)
  }

  return result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [bouwjaarRaw, countRaw] = line.split('|')
      const bouwjaar = Number.parseInt(bouwjaarRaw, 10)
      const count = Number.parseInt(countRaw, 10)

      if (!Number.isInteger(bouwjaar) || !Number.isInteger(count)) {
        fail(`Unexpected sqlite row: ${line}`)
      }

      return { bouwjaar, count }
    })
}

function formatTable(rows: HistogramRow[]): string {
  const bouwjaarWidth = Math.max(
    'bouwjaar'.length,
    ...rows.map((row) => String(row.bouwjaar).length)
  )
  const countWidth = Math.max(
    'count'.length,
    ...rows.map((row) => String(row.count).length)
  )

  const lines = [
    `${'bouwjaar'.padEnd(bouwjaarWidth)}  ${'count'.padStart(countWidth)}`,
    `${'-'.repeat(bouwjaarWidth)}  ${'-'.repeat(countWidth)}`
  ]

  for (const row of rows) {
    lines.push(
      `${String(row.bouwjaar).padEnd(bouwjaarWidth)}  ${String(row.count).padStart(countWidth)}`
    )
  }

  return lines.join('\n')
}

function writeOutput(outputPath: string, contents: string) {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, contents)
}

const options = parseArgs(process.argv.slice(2))
const histogram = runSqlite(options.dbPath)

if (histogram.length === 0) {
  fail('No rows returned. Is the pand layer present and non-empty?')
}

const output = options.asJson
  ? JSON.stringify(histogram, null, 2)
  : formatTable(histogram)

if (options.outputPath) {
  writeOutput(options.outputPath, `${output}\n`)
  console.error(
    `Wrote ${histogram.length} histogram rows to ${options.outputPath}`
  )
} else {
  console.log(output)
}
