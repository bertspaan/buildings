import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

import { cityAliases } from './city-aliases.ts'

type CityCountRow = {
  id: string
  name: string
  addressCount: number
}

type CityExtentRow = {
  identificatie: string
  woonplaats: string
  minlon: number
  minlat: number
  maxlon: number
  maxlat: number
}

type HistoricCenterRow = {
  id: string
  name: string
  lon: number
  lat: number
}

type OsmCenterRow = {
  bagId: string
  center: [number, number]
}

type PlayCity = {
  rank: number
  name: string
  id: string
  aliases?: string[]
  addressCount: number
  center: [number, number]
  bounds: [number, number, number, number]
}

const defaultDbPath = resolve('data/bag-light.gpkg')
const defaultOutputPath = resolve('app/src/lib/generated/play-cities.json')
const defaultOsmCentersPath = resolve(
  'app/src/lib/generated/osm-woonplaats-centers.json'
)
const defaultLimit = 100
function printHelp() {
  console.log(
    [
      'Usage: node scripts/build-play-cities.ts [--limit 100] [--db data/bag-light.gpkg] [--output app/src/lib/generated/play-cities.json]',
      '',
      'Builds a ranked list of the largest Dutch cities for the /play route,',
      'using BAG woonplaats names ranked by verblijfsobject count and enriched',
      'with WGS84 bounds and center coordinates.',
      '',
      `Defaults:`,
      `  --db ${defaultDbPath}`,
      `  --output ${defaultOutputPath}`,
      `  --osm-centers ${defaultOsmCentersPath}`
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv: string[]) {
  let limit = defaultLimit
  let dbPath = defaultDbPath
  let outputPath = defaultOutputPath
  let osmCentersPath = defaultOsmCentersPath

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      printHelp()
      process.exit(0)
    }

    if (argument === '--limit') {
      const value = argv[index + 1]
      index += 1
      const parsed = Number.parseInt(value ?? '', 10)

      if (!Number.isInteger(parsed) || parsed <= 0) {
        fail(`Invalid --limit value: ${value}`)
      }

      limit = parsed
      continue
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

    if (argument === '--osm-centers') {
      const value = argv[index + 1]
      index += 1

      if (!value) {
        fail('Missing value after --osm-centers')
      }

      osmCentersPath = resolve(value)
      continue
    }

    fail(`Unknown argument: ${argument}`)
  }

  return { limit, dbPath, outputPath, osmCentersPath }
}

function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      const stderr = String((error as { stderr?: string }).stderr ?? '').trim()
      fail(stderr || error.message)
    }

    fail(error instanceof Error ? error.message : String(error))
  }
}

function unquoteCsvValue(value: string): string {
  return value.replace(/^"(.*)"$/, '$1')
}

function queryTopCities(dbPath: string, limit: number): CityCountRow[] {
  const sql = `
    SELECT
      woonplaats_identificatie AS id,
      woonplaats_naam AS name,
      COUNT(*) AS addressCount
    FROM verblijfsobject
    WHERE woonplaats_identificatie IS NOT NULL
      AND woonplaats_identificatie != ''
      AND woonplaats_naam IS NOT NULL
      AND woonplaats_naam != ''
    GROUP BY woonplaats_identificatie, woonplaats_naam
    ORDER BY addressCount DESC
    LIMIT ${limit};
  `.trim()

  const output = run('sqlite3', ['-readonly', '-json', dbPath, sql]).trim()
  const rows = JSON.parse(output) as CityCountRow[]

  return rows.filter(
    (row) =>
      row.id &&
      row.name &&
      Number.isFinite(row.addressCount) &&
      row.addressCount > 0
  )
}

function queryCityExtents(dbPath: string): Map<string, CityExtentRow> {
  const sql = `
    SELECT
      identificatie,
      woonplaats,
      ST_MinX(ST_Transform(geom, 4326)) AS minlon,
      ST_MinY(ST_Transform(geom, 4326)) AS minlat,
      ST_MaxX(ST_Transform(geom, 4326)) AS maxlon,
      ST_MaxY(ST_Transform(geom, 4326)) AS maxlat
    FROM woonplaats;
  `.trim()

  const output = run('ogr2ogr', ['-f', 'CSV', '/vsistdout/', dbPath, '-sql', sql])
  const lines = output.trim().split('\n')

  if (lines.length <= 1) {
    fail('No woonplaats extents returned by ogr2ogr.')
  }

  const extents = new Map<string, CityExtentRow>()

  for (const line of lines.slice(1)) {
    const [identificatie, woonplaats, minlon, minlat, maxlon, maxlat] =
      line.split(',')

    if (!identificatie || !woonplaats) {
      continue
    }

    extents.set(unquoteCsvValue(identificatie), {
      identificatie: unquoteCsvValue(identificatie),
      woonplaats: unquoteCsvValue(woonplaats),
      minlon: Number.parseFloat(minlon ?? ''),
      minlat: Number.parseFloat(minlat ?? ''),
      maxlon: Number.parseFloat(maxlon ?? ''),
      maxlat: Number.parseFloat(maxlat ?? '')
    })
  }

  return extents
}

function queryHistoricCenters(
  dbPath: string,
  limit: number
): Map<string, HistoricCenterRow> {
  const sql = `
    WITH topcities AS (
      SELECT
        woonplaats_identificatie AS id,
        woonplaats_naam AS name,
        COUNT(*) AS address_count
      FROM verblijfsobject
      WHERE woonplaats_identificatie IS NOT NULL
        AND woonplaats_identificatie != ''
        AND woonplaats_naam IS NOT NULL
        AND woonplaats_naam != ''
      GROUP BY woonplaats_identificatie, woonplaats_naam
      ORDER BY address_count DESC
      LIMIT ${limit}
    ),
    ranked AS (
      SELECT
        v.woonplaats_identificatie AS id,
        v.woonplaats_naam AS name,
        v.bouwjaar,
        ST_X(Centroid(v.geom)) AS x,
        ST_Y(Centroid(v.geom)) AS y,
        ROW_NUMBER() OVER (
          PARTITION BY v.woonplaats_identificatie
          ORDER BY v.bouwjaar ASC, v.feature_id ASC
        ) AS age_rank,
        COUNT(*) OVER (PARTITION BY v.woonplaats_identificatie) AS city_count
      FROM verblijfsobject v
      JOIN topcities t
        ON v.woonplaats_identificatie = t.id
      WHERE v.bouwjaar IS NOT NULL
        AND v.bouwjaar > 0
    ),
    sampled AS (
      SELECT
        id,
        name,
        bouwjaar,
        x,
        y,
        CAST(Floor(x / 250.0) AS INTEGER) AS cell_x,
        CAST(Floor(y / 250.0) AS INTEGER) AS cell_y
      FROM ranked
      WHERE age_rank <= CASE
        WHEN city_count * 0.05 < 150 THEN 150
        WHEN city_count * 0.05 > 1500 THEN 1500
        ELSE CAST(city_count * 0.05 AS INTEGER)
      END
    ),
    densest AS (
      SELECT
        id,
        name,
        COUNT(*) AS sample_count,
        AVG(x) AS center_x,
        AVG(y) AS center_y,
        ROW_NUMBER() OVER (
          PARTITION BY id
          ORDER BY COUNT(*) DESC, MIN(bouwjaar) ASC
        ) AS density_rank
      FROM sampled
      GROUP BY id, name, cell_x, cell_y
    )
    SELECT
      id,
      name,
      ST_X(ST_Transform(MakePoint(center_x, center_y, 28992), 4326)) AS lon,
      ST_Y(ST_Transform(MakePoint(center_x, center_y, 28992), 4326)) AS lat
    FROM densest
    WHERE density_rank = 1;
  `.trim()

  const output = run('ogr2ogr', [
    '-f',
    'CSV',
    '/vsistdout/',
    dbPath,
    '-dialect',
    'sqlite',
    '-sql',
    sql
  ])

  const lines = output.trim().split('\n')

  if (lines.length <= 1) {
    return new Map()
  }

  const centers = new Map<string, HistoricCenterRow>()

  for (const line of lines.slice(1)) {
    const [id, name, lon, lat] = line.split(',')

    if (!id || !name) {
      continue
    }

    centers.set(unquoteCsvValue(id), {
      id: unquoteCsvValue(id),
      name: unquoteCsvValue(name),
      lon: Number.parseFloat(lon ?? ''),
      lat: Number.parseFloat(lat ?? '')
    })
  }

  return centers
}

function readOsmCenters(osmCentersPath: string): Map<string, OsmCenterRow> {
  const rows = JSON.parse(readFileSync(osmCentersPath, 'utf8')) as OsmCenterRow[]

  return new Map(rows.map((row) => [row.bagId, row]))
}

function buildPlayCity(
  row: CityCountRow,
  extent: CityExtentRow,
  osmCenter: OsmCenterRow | undefined,
  historicCenter: HistoricCenterRow | undefined,
  rank: number
): PlayCity {
  const boundsWgs84 = [
    extent.minlon,
    extent.minlat,
    extent.maxlon,
    extent.maxlat
  ] as [number, number, number, number]

  const aliases = cityAliases[row.name]

  return {
    rank,
    name: row.name,
    id: extent.identificatie,
    ...(aliases ? { aliases } : {}),
    addressCount: row.addressCount,
    center: osmCenter
      ? [
          Number.parseFloat(osmCenter.center[0].toFixed(6)),
          Number.parseFloat(osmCenter.center[1].toFixed(6))
        ]
      : historicCenter
      ? [
          Number.parseFloat(historicCenter.lon.toFixed(6)),
          Number.parseFloat(historicCenter.lat.toFixed(6))
        ]
      : [
          Number.parseFloat(((extent.minlon + extent.maxlon) / 2).toFixed(6)),
          Number.parseFloat(((extent.minlat + extent.maxlat) / 2).toFixed(6))
        ],
    bounds: boundsWgs84.map((value) =>
      Number.parseFloat(value.toFixed(6))
    ) as [number, number, number, number]
  }
}

function main() {
  const { limit, dbPath, outputPath, osmCentersPath } = parseArgs(
    process.argv.slice(2)
  )
  const topCities = queryTopCities(dbPath, limit)
  const extents = queryCityExtents(dbPath)
  const historicCenters = queryHistoricCenters(dbPath, limit)
  const osmCenters = readOsmCenters(osmCentersPath)

  const cities = topCities
    .map((row, index) => {
      const extent = extents.get(row.id)

      if (!extent) {
        return undefined
      }

      return buildPlayCity(
        row,
        extent,
        osmCenters.get(extent.identificatie),
        historicCenters.get(row.id),
        index + 1
      )
    })
    .filter((city): city is PlayCity => city !== undefined)

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(cities, null, 2) + '\n')

  console.log(`Wrote ${cities.length} play cities to ${outputPath}`)
}

main()
