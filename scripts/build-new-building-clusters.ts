import { join, resolve } from 'node:path'
import {
  dataDir,
  ensureDir,
  removeFile,
  resetDir,
  run,
  sourceGeopackagePath
} from './tile-helpers.ts'

type Options = {
  inputPath: string
  minYear: number
  minRecentBuildingArea: number
  cellSize: number
  minRecentCount: number
  minRecentShare: number
  candidateZoneDistance: number
  buildingBufferDistance: number
  tightenDistance: number
  minArea: number
  holeArea: number
  outputPath: string
  keepTemp: boolean
}

const qgisProcess = '/Applications/QGIS.app/Contents/MacOS/qgis_process'
const defaultWorkDir = join(dataDir, 'new-building-clusters')

function printHelp(): void {
  console.log(
    [
      'Usage: node scripts/build-new-building-clusters.ts [options]',
      '',
      'Builds polygonal new-building areas for buildings with bouwjaar >= min-year.',
      '',
      'The workflow is:',
      '  recent buildings -> centroids',
      '  old buildings -> centroids',
      '  square grid',
      '  count recent + old points per cell',
      '  keep only cells with enough recent buildings and a high recent share',
      '  merge accepted cells into candidate zones',
      '  clip recent building footprints to those candidate zones',
      '  build a buffered organic envelope from the actual recent buildings',
      '  tighten + clean the result so it resembles project/neighbourhood areas',
      '',
      'Defaults:',
      `  --input ${sourceGeopackagePath}`,
      '  --min-year 2015',
      '  --min-recent-building-area 25',
      '  --cell-size 150',
      '  --min-recent-count 8',
      '  --min-recent-share 0.6',
      '  --candidate-zone-distance 40',
      '  --building-buffer-distance 50',
      '  --tighten-distance 30',
      '  --min-area 20000',
      '  --hole-area 5000',
      `  --output ${join(dataDir, 'new-building-clusters-2015.gpkg')}`,
      '',
      'Examples:',
      '  node scripts/build-new-building-clusters.ts',
      '  node scripts/build-new-building-clusters.ts --min-year 2020 --cell-size 200 --min-recent-share 0.7',
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
  const options: Options = {
    inputPath: sourceGeopackagePath,
    minYear: 2015,
    minRecentBuildingArea: 25,
    cellSize: 150,
    minRecentCount: 8,
    minRecentShare: 0.6,
    candidateZoneDistance: 40,
    buildingBufferDistance: 50,
    tightenDistance: 30,
    minArea: 20_000,
    holeArea: 5_000,
    outputPath: resolve(dataDir, 'new-building-clusters-2015.gpkg'),
    keepTemp: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--keep-temp') {
      options.keepTemp = true
      continue
    }

    const next = argv[index + 1]

    switch (arg) {
      case '--input':
        if (!next) fail('Missing value for --input')
        options.inputPath = resolve(next)
        index += 1
        break
      case '--min-year':
        options.minYear = parseNumber(next, '--min-year', options.minYear)
        index += 1
        break
      case '--min-recent-building-area':
        options.minRecentBuildingArea = parseNumber(
          next,
          '--min-recent-building-area',
          options.minRecentBuildingArea
        )
        index += 1
        break
      case '--cell-size':
        options.cellSize = parseNumber(next, '--cell-size', options.cellSize)
        index += 1
        break
      case '--min-recent-count':
        options.minRecentCount = parseNumber(
          next,
          '--min-recent-count',
          options.minRecentCount
        )
        index += 1
        break
      case '--min-recent-share':
        options.minRecentShare = parseNumber(
          next,
          '--min-recent-share',
          options.minRecentShare
        )
        index += 1
        break
      case '--candidate-zone-distance':
        options.candidateZoneDistance = parseNumber(
          next,
          '--candidate-zone-distance',
          options.candidateZoneDistance
        )
        index += 1
        break
      case '--building-buffer-distance':
        options.buildingBufferDistance = parseNumber(
          next,
          '--building-buffer-distance',
          options.buildingBufferDistance
        )
        index += 1
        break
      case '--tighten-distance':
        options.tightenDistance = parseNumber(
          next,
          '--tighten-distance',
          options.tightenDistance
        )
        index += 1
        break
      case '--min-area':
        options.minArea = parseNumber(next, '--min-area', options.minArea)
        index += 1
        break
      case '--hole-area':
        options.holeArea = parseNumber(next, '--hole-area', options.holeArea)
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

function layerPath(path: string, layerName: string): string {
  return `${path}|layername=${layerName}`
}

const options = parseArgs(process.argv.slice(2))
const sourceLayer = layerPath(options.inputPath, 'pand')
const shareThreshold = options.minRecentShare.toFixed(4)

const workDir = defaultWorkDir
const recentBuildingsPath = join(workDir, 'recent-buildings.gpkg')
const oldBuildingsPath = join(workDir, 'old-buildings.gpkg')
const recentCentroidsPath = join(workDir, 'recent-centroids.gpkg')
const oldCentroidsPath = join(workDir, 'old-centroids.gpkg')
const gridPath = join(workDir, 'grid.gpkg')
const gridWithRecentPath = join(workDir, 'grid-with-recent.gpkg')
const gridWithCountsPath = join(workDir, 'grid-with-counts.gpkg')
const selectedCellsPath = join(workDir, 'selected-cells.gpkg')
const candidateZonesPath = join(workDir, 'candidate-zones.gpkg')
const recentBuildingsInZonesPath = join(workDir, 'recent-buildings-in-zones.gpkg')
const recentBuildingsBufferedPath = join(workDir, 'recent-buildings-buffered.gpkg')
const recentBuildingsBufferedSinglepartsPath = join(
  workDir,
  'recent-buildings-buffered-singleparts.gpkg'
)
const recentAreasTightenedPath = join(workDir, 'recent-areas-tightened.gpkg')
const recentAreasTightenedSinglepartsPath = join(
  workDir,
  'recent-areas-tightened-singleparts.gpkg'
)
const cleanedPath = join(workDir, 'new-building-clusters-cleaned.gpkg')
const cleanedSinglepartsPath = join(
  workDir,
  'new-building-clusters-cleaned-singleparts.gpkg'
)

ensureDir(dataDir)
resetDir(workDir)
removeFile(options.outputPath)

run(qgisProcess, [
  'run',
  'native:extractbyexpression',
  `--INPUT=${sourceLayer}`,
  `--EXPRESSION="bouwjaar" >= ${options.minYear} AND area($geometry) >= ${options.minRecentBuildingArea}`,
  `--OUTPUT=${recentBuildingsPath}`
])

run(qgisProcess, [
  'run',
  'native:extractbyexpression',
  `--INPUT=${sourceLayer}`,
  `--EXPRESSION="bouwjaar" < ${options.minYear}`,
  `--OUTPUT=${oldBuildingsPath}`
])

run(qgisProcess, [
  'run',
  'native:centroids',
  `--INPUT=${recentBuildingsPath}`,
  '--ALL_PARTS=false',
  `--OUTPUT=${recentCentroidsPath}`
])

run(qgisProcess, [
  'run',
  'native:centroids',
  `--INPUT=${oldBuildingsPath}`,
  '--ALL_PARTS=false',
  `--OUTPUT=${oldCentroidsPath}`
])

run(qgisProcess, [
  'run',
  'native:creategrid',
  '--TYPE=2',
  `--EXTENT=${sourceLayer}`,
  `--HSPACING=${options.cellSize}`,
  `--VSPACING=${options.cellSize}`,
  '--HOVERLAY=0',
  '--VOVERLAY=0',
  `--CRS=EPSG:28992`,
  `--OUTPUT=${gridPath}`
])

run(qgisProcess, [
  'run',
  'native:countpointsinpolygon',
  `--POLYGONS=${gridPath}`,
  `--POINTS=${recentCentroidsPath}`,
  '--FIELD=recent_count',
  '--WEIGHT=',
  '--CLASSFIELD=',
  `--OUTPUT=${gridWithRecentPath}`
])

run(qgisProcess, [
  'run',
  'native:countpointsinpolygon',
  `--POLYGONS=${gridWithRecentPath}`,
  `--POINTS=${oldCentroidsPath}`,
  '--FIELD=old_count',
  '--WEIGHT=',
  '--CLASSFIELD=',
  `--OUTPUT=${gridWithCountsPath}`
])

run(qgisProcess, [
  'run',
  'native:extractbyexpression',
  `--INPUT=${gridWithCountsPath}`,
  `--EXPRESSION="recent_count" >= ${options.minRecentCount} AND "recent_count" / ("recent_count" + "old_count") >= ${shareThreshold}`,
  `--OUTPUT=${selectedCellsPath}`
])

run(qgisProcess, [
  'run',
  'native:buffer',
  `--INPUT=${selectedCellsPath}`,
  `--DISTANCE=${options.candidateZoneDistance}`,
  '--SEGMENTS=5',
  '--END_CAP_STYLE=0',
  '--JOIN_STYLE=0',
  '--MITER_LIMIT=2',
  '--DISSOLVE=true',
  `--OUTPUT=${candidateZonesPath}`
])

run(qgisProcess, [
  'run',
  'native:clip',
  `--INPUT=${recentBuildingsPath}`,
  `--OVERLAY=${candidateZonesPath}`,
  `--OUTPUT=${recentBuildingsInZonesPath}`
])

run(qgisProcess, [
  'run',
  'native:buffer',
  `--INPUT=${recentBuildingsInZonesPath}`,
  `--DISTANCE=${options.buildingBufferDistance}`,
  '--SEGMENTS=8',
  '--END_CAP_STYLE=0',
  '--JOIN_STYLE=0',
  '--MITER_LIMIT=2',
  '--DISSOLVE=true',
  `--OUTPUT=${recentBuildingsBufferedPath}`
])

run(qgisProcess, [
  'run',
  'native:multiparttosingleparts',
  `--INPUT=${recentBuildingsBufferedPath}`,
  `--OUTPUT=${recentBuildingsBufferedSinglepartsPath}`
])

run(qgisProcess, [
  'run',
  'native:buffer',
  `--INPUT=${recentBuildingsBufferedSinglepartsPath}`,
  `--DISTANCE=${-options.tightenDistance}`,
  '--SEGMENTS=8',
  '--END_CAP_STYLE=0',
  '--JOIN_STYLE=0',
  '--MITER_LIMIT=2',
  '--DISSOLVE=true',
  `--OUTPUT=${recentAreasTightenedPath}`
])

run(qgisProcess, [
  'run',
  'native:multiparttosingleparts',
  `--INPUT=${recentAreasTightenedPath}`,
  `--OUTPUT=${recentAreasTightenedSinglepartsPath}`
])

run(qgisProcess, [
  'run',
  'native:deleteholes',
  `--INPUT=${recentAreasTightenedSinglepartsPath}`,
  `--MIN_AREA=${options.holeArea}`,
  `--OUTPUT=${cleanedPath}`
])

run(qgisProcess, [
  'run',
  'native:multiparttosingleparts',
  `--INPUT=${cleanedPath}`,
  `--OUTPUT=${cleanedSinglepartsPath}`
])

run(qgisProcess, [
  'run',
  'native:extractbyexpression',
  `--INPUT=${cleanedSinglepartsPath}`,
  `--EXPRESSION=area($geometry) >= ${options.minArea}`,
  `--OUTPUT=${options.outputPath}`
])

if (!options.keepTemp) {
  resetDir(workDir)
}

console.log(options.outputPath)
