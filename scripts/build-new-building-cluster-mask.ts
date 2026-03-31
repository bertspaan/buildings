import { join, resolve } from 'node:path'
import {
  dataDir,
  ensureDir,
  getNationalBoundsWgs84,
  removeFile,
  resetDir,
  run
} from './tile-helpers.ts'

type Options = {
  inputPath: string
  layerName: string
  outputPath: string
  keepTemp: boolean
}

const ogr2ogr = '/Applications/QGIS.app/Contents/MacOS/ogr2ogr'
const qgisProcess = '/Applications/QGIS.app/Contents/MacOS/qgis_process'
const defaultWorkDir = join(dataDir, 'new-building-cluster-mask')

function printHelp(): void {
  console.log(
    [
      'Usage: node scripts/build-new-building-cluster-mask.ts [options]',
      '',
      'Builds an inverse polygon mask for the new-building areas.',
      '',
      'The workflow is:',
      '  create a Netherlands bounding polygon',
      '  dissolve new-building areas into one multipolygon',
      '  subtract the dissolved projects from the bounding polygon',
      '',
      'Defaults:',
      `  --input ${join(dataDir, 'new-building-clusters-2015.gpkg')}`,
      '  --layer new-building-clusters-2015',
      `  --output ${join(dataDir, 'new-building-clusters-mask-2015.gpkg')}`,
      '',
      'Example:',
      '  node scripts/build-new-building-cluster-mask.ts',
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
    inputPath: resolve(dataDir, 'new-building-clusters-2015.gpkg'),
    layerName: 'new-building-clusters-2015',
    outputPath: resolve(dataDir, 'new-building-clusters-mask-2015.gpkg'),
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
      case '--layer':
        if (!next) fail('Missing value for --layer')
        options.layerName = next
        index += 1
        break
      case '--output':
        if (!next) fail('Missing value for --output')
        options.outputPath = resolve(next)
        index += 1
        break
      default:
        fail(`Unknown argument: ${arg}`)
    }
  }

  return options
}

const options = parseArgs(process.argv.slice(2))
const workDir = defaultWorkDir
const boundsPolygonPath = join(workDir, 'national-bounds.gpkg')
const dissolvedProjectsPath = join(workDir, 'new-building-clusters-dissolved.gpkg')
const bounds = getNationalBoundsWgs84()
const layerSqlName = options.layerName.replace(/"/g, '""')

ensureDir(dataDir)
resetDir(workDir)
removeFile(options.outputPath)

run(ogr2ogr, [
  '-f',
  'GPKG',
  boundsPolygonPath,
  options.inputPath,
  '-dialect',
  'SQLite',
  '-sql',
  `SELECT ST_Transform(BuildMbr(${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]}, 4326), 28992) AS geom FROM "${layerSqlName}" LIMIT 1`,
  '-nln',
  'national_bounds'
])

run(qgisProcess, [
  'run',
  'native:dissolve',
  `--INPUT=${options.inputPath}|layername=${options.layerName}`,
  '--FIELD=',
  '--SEPARATE_DISJOINT=false',
  `--OUTPUT=${dissolvedProjectsPath}`
])

run(qgisProcess, [
  'run',
  'native:difference',
  `--INPUT=${boundsPolygonPath}|layername=national_bounds`,
  `--OVERLAY=${dissolvedProjectsPath}`,
  '--GRID_SIZE=0',
  `--OUTPUT=${options.outputPath}`
])

if (!options.keepTemp) {
  resetDir(workDir)
}

console.log(options.outputPath)
