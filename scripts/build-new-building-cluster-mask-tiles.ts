import { join, resolve } from 'node:path'
import {
  dataDir,
  ensureDir,
  removeFile,
  r2Dir,
  run
} from './tile-helpers.ts'

type Options = {
  inputPath: string
  layerName: string
  outputBaseName: string
  minZoom: number
  maxZoom: number
}

const ogr2ogr = '/Applications/QGIS.app/Contents/MacOS/ogr2ogr'

function printHelp(): void {
  console.log(
    [
      'Usage: node scripts/build-new-building-cluster-mask-tiles.ts [options]',
      '',
      'Converts the new-building area inverse mask GeoPackage to vector tiles.',
      '',
      'Defaults:',
      `  --input ${join(dataDir, 'new-building-clusters-mask-2015.gpkg')}`,
      '  --layer new-building-clusters-mask-2015',
      '  --name new-building-clusters-mask-2015',
      '  --min-zoom 7',
      '  --max-zoom 14',
      '',
      'Example:',
      '  node scripts/build-new-building-cluster-mask-tiles.ts',
      ''
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseNumber(
  rawValue: string | undefined,
  flag: string,
  fallback: number
): number {
  if (!rawValue) {
    return fallback
  }

  const value = Number(rawValue)

  if (!Number.isFinite(value)) {
    fail(`Invalid numeric value for ${flag}: ${rawValue}`)
  }

  return value
}

function parseArgs(argv: string[]): Options {
  const defaultBaseName = 'new-building-clusters-mask-2015'
  const options: Options = {
    inputPath: resolve(dataDir, `${defaultBaseName}.gpkg`),
    layerName: defaultBaseName,
    outputBaseName: defaultBaseName,
    minZoom: 7,
    maxZoom: 14
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    switch (arg) {
      case '--input':
        if (!next) fail('Missing value for --input')
        options.inputPath = resolve(next)
        index += 1
        break
      case '--layer':
        if (!next) fail('Missing value for --layer')
        options.layerName = next
        index += 1
        break
      case '--name':
        if (!next) fail('Missing value for --name')
        options.outputBaseName = next
        index += 1
        break
      case '--min-zoom':
        options.minZoom = parseNumber(next, '--min-zoom', options.minZoom)
        index += 1
        break
      case '--max-zoom':
        options.maxZoom = parseNumber(next, '--max-zoom', options.maxZoom)
        index += 1
        break
      default:
        fail(`Unknown argument: ${arg}`)
    }
  }

  return options
}

const options = parseArgs(process.argv.slice(2))
const vectorDir = join(dataDir, 'vector')
const geoJsonPath = join(vectorDir, `${options.outputBaseName}.geojsonl`)
const mbtilesPath = join(dataDir, `${options.outputBaseName}.mbtiles`)
const pmtilesPath = join(r2Dir, `${options.outputBaseName}.pmtiles`)

ensureDir(dataDir)
ensureDir(vectorDir)
ensureDir(r2Dir)
removeFile(geoJsonPath)
removeFile(mbtilesPath)
removeFile(pmtilesPath)

run(ogr2ogr, [
  '-f',
  'GeoJSONSeq',
  geoJsonPath,
  options.inputPath,
  options.layerName,
  '-t_srs',
  'EPSG:4326'
])

run('tippecanoe', [
  '-o',
  mbtilesPath,
  '-f',
  '-P',
  '-l',
  options.outputBaseName.replace(/[^a-zA-Z0-9_]+/g, '_'),
  '-n',
  options.outputBaseName,
  '-N',
  options.outputBaseName,
  '-Z',
  String(options.minZoom),
  '-z',
  String(options.maxZoom),
  '-pf',
  '-pk',
  '--no-feature-limit',
  '--no-tile-size-limit',
  geoJsonPath
])

run('pmtiles', ['convert', '--force', mbtilesPath, pmtilesPath])

console.log(pmtilesPath)
