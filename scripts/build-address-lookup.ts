import { createReadStream, createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import readline from 'node:readline'

import {
  dataDir,
  ensureDir,
  r2Dir,
  removeFile,
  resetDir,
  sourceGeopackagePath
} from './tile-helpers.ts'

type Options = {
  inputPath: string
  outputBaseName: string
  keepTemp: boolean
}

type BucketIndexEntry = {
  offset: number
  length: number
  count: number
}

const defaultWorkDir = join(dataDir, 'address-lookup')
const bucketCount = 4096

function printHelp(): void {
  console.log(
    [
      'Usage: node scripts/build-address-lookup.ts [options]',
      '',
      'Builds a static 3-file building address lookup from the verblijfsobject layer.',
      '',
      'Output files:',
      '  <name>.data',
      '  <name>.lookup',
      '  <name>.lookup.index.json',
      '',
      'Defaults:',
      `  --input ${sourceGeopackagePath}`,
      '  --name building-addresses',
      '',
      'Examples:',
      '  node scripts/build-address-lookup.ts',
      '  node scripts/build-address-lookup.ts --name building-addresses-v1',
      ''
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    inputPath: sourceGeopackagePath,
    outputBaseName: 'building-addresses',
    keepTemp: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--keep-temp') {
      options.keepTemp = true
      continue
    }

    switch (arg) {
      case '--input':
        if (!next) fail('Missing value for --input')
        options.inputPath = resolve(next)
        index += 1
        break
      case '--name':
        if (!next) fail('Missing value for --name')
        options.outputBaseName = next
        index += 1
        break
      default:
        fail(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function formatAddress(parts: {
  street: string
  houseNumber: string
  houseLetter: string
  addition: string
  postcode: string
  city: string
}): string | undefined {
  const street = parts.street.trim()
  const houseNumber = parts.houseNumber.trim()

  if (!street || !houseNumber) {
    return undefined
  }

  const suffix = `${parts.houseLetter.trim()}${parts.addition.trim()}`
  const line1 = `${street} ${houseNumber}${suffix}`
  const line2 = [parts.postcode.trim(), parts.city.trim()].filter(Boolean).join(' ')

  return [line1, line2].filter(Boolean).join(', ')
}

function getBucketForPandId(pandId: string): string {
  let hash = 2166136261

  for (let index = 0; index < pandId.length; index += 1) {
    hash ^= pandId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 20).toString(16).padStart(3, '0')
}

async function closeStream(
  stream: NodeJS.WritableStream & { end: (cb?: () => void) => void }
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    stream.on('error', rejectPromise)
    stream.end(() => resolvePromise())
  })
}

async function concatenateBucketFiles(
  bucketPaths: string[],
  outputPath: string
): Promise<Record<string, BucketIndexEntry>> {
  const output = createWriteStream(outputPath)
  const bucketIndex: Record<string, BucketIndexEntry> = {}
  let offset = 0

  for (const bucketPath of bucketPaths) {
    const bucketName = basename(bucketPath, '.lookup')
    const stat = await fs.stat(bucketPath)

    if (stat.size === 0) {
      bucketIndex[bucketName] = { offset, length: 0, count: 0 }
      continue
    }

    const countRaw = await fs.readFile(`${bucketPath}.count`, 'utf8')
    const count = Number.parseInt(countRaw.trim(), 10) || 0
    bucketIndex[bucketName] = { offset, length: stat.size, count }

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const input = createReadStream(bucketPath)
      input.on('error', rejectPromise)
      output.on('error', rejectPromise)
      input.on('end', () => {
        offset += stat.size
        resolvePromise()
      })
      input.pipe(output, { end: false })
    })
  }

  await closeStream(output)
  return bucketIndex
}

async function buildLookup(options: Options): Promise<void> {
  const workDir = defaultWorkDir
  const bucketsDir = join(workDir, 'buckets')
  const dataPath = join(r2Dir, `${options.outputBaseName}.data`)
  const lookupPath = join(r2Dir, `${options.outputBaseName}.lookup`)
  const indexPath = join(r2Dir, `${options.outputBaseName}.lookup.index.json`)

  ensureDir(dataDir)
  ensureDir(r2Dir)
  resetDir(workDir)
  ensureDir(bucketsDir)
  removeFile(dataPath)
  removeFile(lookupPath)
  removeFile(indexPath)

  const dataStream = createWriteStream(dataPath)
  const bucketStreams = new Map<string, ReturnType<typeof createWriteStream>>()
  const bucketCounts = new Map<string, number>()
  const bucketPaths: string[] = []

  for (let index = 0; index < bucketCount; index += 1) {
    const bucket = index.toString(16).padStart(3, '0')
    const bucketPath = join(bucketsDir, `${bucket}.lookup`)
    bucketPaths.push(bucketPath)
    bucketStreams.set(bucket, createWriteStream(bucketPath))
    bucketCounts.set(bucket, 0)
  }

  const query = [
    "SELECT pand_identificatie,",
    "       COALESCE(openbare_ruimte_naam, ''),",
    "       COALESCE(huisnummer, ''),",
    "       COALESCE(huisletter, ''),",
    "       COALESCE(toevoeging, ''),",
    "       COALESCE(postcode, ''),",
    "       COALESCE(woonplaats_naam, '')",
    'FROM verblijfsobject',
    "WHERE pand_identificatie IS NOT NULL AND pand_identificatie <> ''",
    'ORDER BY pand_identificatie, feature_id;'
  ].join(' ')

  const sqlite = spawn(
    'sqlite3',
    ['-readonly', '-cmd', '.mode tabs', options.inputPath, query],
    {
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  let stderr = ''
  sqlite.stderr.setEncoding('utf8')
  sqlite.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })

  const rl = readline.createInterface({
    input: sqlite.stdout,
    crlfDelay: Infinity
  })

  let currentPandId = ''
  let currentAddresses: string[] = []
  let dataOffset = 0
  let buildingCount = 0

  const flushCurrent = () => {
    if (!currentPandId) {
      return
    }

    const uniqueAddresses = [...new Set(currentAddresses)]
    const payload = JSON.stringify(uniqueAddresses)
    const byteLength = Buffer.byteLength(payload)
    dataStream.write(payload)

    const bucket = getBucketForPandId(currentPandId)
    const bucketStream = bucketStreams.get(bucket)

    if (!bucketStream) {
      fail(`Missing bucket stream for ${bucket}`)
    }

    bucketStream.write(`${currentPandId}\t${dataOffset}\t${byteLength}\n`)
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1)

    dataOffset += byteLength
    buildingCount += 1
  }

  for await (const line of rl) {
    if (!line) {
      continue
    }

    const [pandId, street, houseNumber, houseLetter, addition, postcode, city] =
      line.split('\t')

    if (!pandId) {
      continue
    }

    if (pandId !== currentPandId) {
      flushCurrent()
      currentPandId = pandId
      currentAddresses = []
    }

    const address = formatAddress({
      street: street ?? '',
      houseNumber: houseNumber ?? '',
      houseLetter: houseLetter ?? '',
      addition: addition ?? '',
      postcode: postcode ?? '',
      city: city ?? ''
    })

    if (address) {
      currentAddresses.push(address)
    }
  }

  flushCurrent()

  const exitCode = await new Promise<number>((resolvePromise) => {
    sqlite.on('close', resolvePromise)
  })

  if (exitCode !== 0) {
    fail(stderr.trim() || `sqlite3 exited with status ${exitCode}`)
  }

  await closeStream(dataStream)

  for (const [bucket, stream] of bucketStreams) {
    await closeStream(stream)
    const bucketPath = join(bucketsDir, `${bucket}.lookup`)
    await fs.writeFile(
      `${bucketPath}.count`,
      String(bucketCounts.get(bucket) ?? 0),
      'utf8'
    )
  }

  const bucketIndex = await concatenateBucketFiles(bucketPaths, lookupPath)
  await fs.writeFile(indexPath, JSON.stringify(bucketIndex, null, 2) + '\n', 'utf8')

  if (!options.keepTemp) {
    resetDir(workDir)
  }

  console.log(
    JSON.stringify(
      {
        buildings: buildingCount,
        dataPath,
        lookupPath,
        indexPath
      },
      null,
      2
    )
  )
}

const options = parseArgs(process.argv.slice(2))
await buildLookup(options)
