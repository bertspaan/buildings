import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'

const defaultUrl =
  'https://download.geofabrik.de/europe/netherlands-latest.osm.pbf'
const defaultOutputPath = resolve('data/netherlands-latest.osm.pbf')

function printHelp() {
  console.log(
    [
      'Usage: node scripts/download-netherlands-osm-pbf.ts [--output data/netherlands-latest.osm.pbf] [--url https://download.geofabrik.de/europe/netherlands-latest.osm.pbf] [--force]',
      '',
      'Downloads the latest Netherlands OSM PBF extract from Geofabrik.'
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function parseArgs(argv: string[]) {
  let outputPath = defaultOutputPath
  let url = defaultUrl
  let force = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      printHelp()
      process.exit(0)
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

    if (argument === '--url') {
      const value = argv[index + 1]
      index += 1

      if (!value) {
        fail('Missing value after --url')
      }

      url = value
      continue
    }

    if (argument === '--force') {
      force = true
      continue
    }

    fail(`Unknown argument: ${argument}`)
  }

  return { outputPath, url, force }
}

async function main() {
  const { outputPath, url, force } = parseArgs(process.argv.slice(2))

  if (existsSync(outputPath) && !force) {
    console.log(`File already exists: ${outputPath}`)
    console.log('Use --force to re-download it.')
    return
  }

  mkdirSync(dirname(outputPath), { recursive: true })

  if (force && existsSync(outputPath)) {
    rmSync(outputPath, { force: true })
  }

  console.log(`Downloading ${url}`)
  console.log(`Saving to ${outputPath}`)

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'allmaps-buildings/1.0 (https://buildings.allmaps.org)'
    }
  })

  if (!response.ok) {
    fail(`Download failed with ${response.status}: ${response.statusText}`)
  }

  if (!response.body) {
    fail('Download failed: empty response body')
  }

  const contentLengthHeader = response.headers.get('content-length')
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN

  if (Number.isFinite(contentLength)) {
    console.log(`Size: ${formatBytes(contentLength)}`)
  }

  await pipeline(response.body, createWriteStream(outputPath))

  console.log(`Downloaded ${outputPath}`)
}

await main()
