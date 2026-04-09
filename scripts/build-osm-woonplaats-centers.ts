import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

type PlayCityRow = {
  id: string
  name?: string
  aliases?: string[]
  bounds?: [number, number, number, number]
}

type OSMPlaceFeature = {
  geometry?: {
    type?: string
    coordinates?: [number, number]
  }
  properties?: {
    osm_id?: string
    name?: string
    place?: string
    other_tags?: string
  }
}

type OsmWoonplaatsCenter = {
  bagId: string
  osmType: 'node' | 'way' | 'relation'
  osmId: number
  place?: string
  name?: string
  center: [number, number]
}

const defaultInputPath = resolve('app/src/lib/generated/play-cities.json')
const defaultPbfPath = resolve('data/netherlands-latest.osm.pbf')
const defaultOutputPath = resolve(
  'app/src/lib/generated/osm-woonplaats-centers.json'
)

function printHelp() {
  console.log(
    [
      'Usage: node scripts/build-osm-woonplaats-centers.ts [--input app/src/lib/generated/play-cities.json] [--pbf data/netherlands-latest.osm.pbf] [--output app/src/lib/generated/osm-woonplaats-centers.json]',
      '',
      'Builds Dutch woonplaats centers from a local Netherlands OSM PBF,',
      'matching place features by ref:woonplaatscode.'
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv: string[]) {
  let inputPath = defaultInputPath
  let pbfPath = defaultPbfPath
  let outputPath = defaultOutputPath

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      printHelp()
      process.exit(0)
    }

    if (argument === '--input') {
      const value = argv[index + 1]
      index += 1

      if (!value) {
        fail('Missing value after --input')
      }

      inputPath = resolve(value)
      continue
    }

    if (argument === '--pbf') {
      const value = argv[index + 1]
      index += 1

      if (!value) {
        fail('Missing value after --pbf')
      }

      pbfPath = resolve(value)
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

  return { inputPath, pbfPath, outputPath }
}

function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024
    })
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      const stderr = String((error as { stderr?: string }).stderr ?? '').trim()
      fail(stderr || error.message)
    }

    fail(error instanceof Error ? error.message : String(error))
  }
}

function parseOtherTags(otherTags: string | undefined): Record<string, string> {
  const tags: Record<string, string> = {}

  if (!otherTags) {
    return tags
  }

  for (const match of otherTags.matchAll(/"([^"]+)"=>"([^"]*)"/g)) {
    const [, key, value] = match
    tags[key] = value
  }

  return tags
}

function normalizeName(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getPlacePriority(place: string | undefined): number {
  return place === 'city'
    ? 0
    : place === 'town'
      ? 1
      : place === 'village'
        ? 2
        : place === 'hamlet'
          ? 3
        : 4
}

function isWithinBounds(
  coordinates: [number, number],
  bounds: [number, number, number, number] | undefined
): boolean {
  if (!bounds) {
    return false
  }

  const [lon, lat] = coordinates

  return (
    lon >= bounds[0] && lon <= bounds[2] && lat >= bounds[1] && lat <= bounds[3]
  )
}

function getTypeFromOsmId(osmId: string | undefined): 'node' | 'way' | 'relation' {
  if (!osmId) {
    return 'node'
  }

  if (osmId.startsWith('way/')) {
    return 'way'
  }

  if (osmId.startsWith('relation/')) {
    return 'relation'
  }

  return 'node'
}

function getNumericOsmId(osmId: string | undefined): number {
  if (!osmId) {
    return 0
  }

  const match = osmId.match(/(\d+)$/)
  return Number.parseInt(match?.[1] ?? '0', 10)
}

function exportPlacePoints(pbfPath: string): string {
  const outputPath = resolve(tmpdir(), 'buildings-osm-place-points.geojsonl')

  console.log(`Extracting OSM place points from ${pbfPath}`)

  run('ogr2ogr', [
    '-skipfailures',
    '-f',
    'GeoJSONSeq',
    outputPath,
    pbfPath,
    'points',
    '-where',
    'place IS NOT NULL'
  ])

  return outputPath
}

function readPlaceFeatures(path: string): OSMPlaceFeature[] {
  const output = readFileSync(path, 'utf8')
  const features = output
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OSMPlaceFeature)

  console.log(`Loaded ${features.length} OSM place points from ${path}`)
  return features
}

function chooseBestCenters(
  playCities: PlayCityRow[],
  features: OSMPlaceFeature[]
): OsmWoonplaatsCenter[] {
  const bestByBagId = new Map<string, OsmWoonplaatsCenter>()

  const preparedFeatures = features
    .map((feature) => {
      const properties = feature.properties ?? {}
      const tags = parseOtherTags(properties.other_tags)
      const coordinates = feature.geometry?.coordinates

      if (
        !coordinates ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1])
      ) {
        return undefined
      }

      const names = new Set<string>()

      for (const value of [
        properties.name,
        tags.alt_name,
        tags['name:nl'],
        tags['official_name'],
        tags['short_name']
      ]) {
        const normalized = normalizeName(value)

        if (normalized) {
          names.add(normalized)
        }
      }

      return {
        osmType: getTypeFromOsmId(properties.osm_id),
        osmId: getNumericOsmId(properties.osm_id),
        place: properties.place,
        name: properties.name,
        center: coordinates as [number, number],
        names
      }
    })
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))

  for (const city of playCities) {
    const cityNames = new Set<string>([
      normalizeName(city.name),
      ...(city.aliases ?? []).map((alias) => normalizeName(alias))
    ])

    const matches = preparedFeatures.filter((feature) => {
      for (const cityName of cityNames) {
        if (cityName && feature.names.has(cityName)) {
          return true
        }
      }

      return false
    })

    if (matches.length === 0) {
      continue
    }

    matches.sort((a, b) => {
      const aWithinBounds = isWithinBounds(a.center, city.bounds)
      const bWithinBounds = isWithinBounds(b.center, city.bounds)

      if (aWithinBounds !== bWithinBounds) {
        return aWithinBounds ? -1 : 1
      }

      const placePriorityDelta = getPlacePriority(a.place) - getPlacePriority(b.place)

      if (placePriorityDelta !== 0) {
        return placePriorityDelta
      }

      if (a.osmType !== b.osmType) {
        return a.osmType === 'node' ? -1 : 1
      }

      return 0
    })

    const best = matches[0]

    bestByBagId.set(city.id, {
      bagId: city.id,
      osmType: best.osmType,
      osmId: best.osmId,
      place: best.place,
      name: best.name,
      center: best.center
    })
  }

  return playCities
    .map((city) => bestByBagId.get(city.id))
    .filter((center): center is OsmWoonplaatsCenter => Boolean(center))
}

async function main() {
  const { inputPath, pbfPath, outputPath } = parseArgs(process.argv.slice(2))
  const playCities = JSON.parse(readFileSync(inputPath, 'utf8')) as PlayCityRow[]

  console.log(`Loaded ${playCities.length} play cities from ${inputPath}`)

  const placePointsPath = exportPlacePoints(pbfPath)
  const pointFeatures = readPlaceFeatures(placePointsPath)
  const centers = chooseBestCenters(playCities, pointFeatures)

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(centers, null, 2)}\n`)

  console.log(`Wrote ${centers.length} OSM woonplaats centers to ${outputPath}`)
}

await main()
