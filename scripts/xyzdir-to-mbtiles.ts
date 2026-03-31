import { readdirSync, rmSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

type TileRow = {
  z: number
  x: number
  y: number
  path: string
}

type Options = {
  name: string
  description: string
  format: string
  bounds?: string
  minzoom?: string
  maxzoom?: string
}

function usage(): never {
  console.error(
    [
      'Usage: node scripts/xyzdir-to-mbtiles.js <inputDir> <outputMbtiles> [--name value] [--description value] [--bounds minLon,minLat,maxLon,maxLat] [--minzoom value] [--maxzoom value] [--format png|jpg]'
    ].join('\n')
  )
  process.exit(1)
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''")
}

function listTiles(rootDir: string): TileRow[] {
  const rows: TileRow[] = []
  const zoomDirs = readdirSync(rootDir, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory()
  )

  for (const zoomDir of zoomDirs) {
    const z = Number(zoomDir.name)
    if (!Number.isInteger(z)) continue

    const xDirs = readdirSync(join(rootDir, zoomDir.name), {
      withFileTypes: true
    }).filter((entry) => entry.isDirectory())

    for (const xDir of xDirs) {
      const x = Number(xDir.name)
      if (!Number.isInteger(x)) continue

      const files = readdirSync(join(rootDir, zoomDir.name, xDir.name), {
        withFileTypes: true
      }).filter((entry) => entry.isFile())

      for (const file of files) {
        const dotIndex = file.name.lastIndexOf('.')
        if (dotIndex === -1) continue

        const y = Number(file.name.slice(0, dotIndex))
        if (!Number.isInteger(y)) continue

        rows.push({
          z,
          x,
          y: 2 ** z - 1 - y,
          path: join(rootDir, zoomDir.name, xDir.name, file.name)
        })
      }
    }
  }

  rows.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y)
  return rows
}

const args = process.argv.slice(2)
if (args.length < 2) usage()

const inputDir = resolve(args[0] ?? usage())
const outputMbtiles = resolve(args[1] ?? usage())

const options: Options = {
  name: basename(outputMbtiles, '.mbtiles'),
  description: basename(outputMbtiles, '.mbtiles'),
  format: 'png'
}

for (let index = 2; index < args.length; index += 2) {
  const key = args[index]
  const value = args[index + 1]
  if (!key || !value) usage()

  switch (key) {
    case '--name':
      options.name = value
      break
    case '--description':
      options.description = value
      break
    case '--bounds':
      options.bounds = value
      break
    case '--minzoom':
      options.minzoom = value
      break
    case '--maxzoom':
      options.maxzoom = value
      break
    case '--format':
      options.format = value
      break
    default:
      usage()
  }
}

const tiles = listTiles(inputDir)
if (tiles.length === 0) {
  console.error(`No XYZ tiles found in ${inputDir}`)
  process.exit(1)
}

const minZoom =
  options.minzoom ?? String(Math.min(...tiles.map((tile) => tile.z)))
const maxZoom =
  options.maxzoom ?? String(Math.max(...tiles.map((tile) => tile.z)))

const metadata: Array<[string, string]> = [
  ['name', options.name],
  ['type', 'overlay'],
  ['version', '1.1'],
  ['description', options.description],
  ['format', options.format],
  ['minzoom', minZoom],
  ['maxzoom', maxZoom]
]

if (options.bounds) {
  metadata.push(['bounds', options.bounds])
  const [minLon, minLat, maxLon, maxLat] = options.bounds.split(',').map(Number)
  const centerLon = (minLon + maxLon) / 2
  const centerLat = (minLat + maxLat) / 2
  metadata.push(['center', `${centerLon},${centerLat},${minZoom}`])
}

const sqlLines = [
  'PRAGMA journal_mode=DELETE;',
  'PRAGMA synchronous=OFF;',
  'BEGIN;',
  'CREATE TABLE metadata (name TEXT, value TEXT);',
  'CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB);',
  'CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);'
]

for (const [name, value] of metadata) {
  sqlLines.push(
    `INSERT INTO metadata (name, value) VALUES ('${escapeSqlString(name)}', '${escapeSqlString(value)}');`
  )
}

for (const tile of tiles) {
  const relativePath = relative(process.cwd(), tile.path)
  sqlLines.push(
    `INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (${tile.z}, ${tile.x}, ${tile.y}, readfile('${escapeSqlString(relativePath)}'));`
  )
}

sqlLines.push('COMMIT;')
sqlLines.push('VACUUM;')

rmSync(outputMbtiles, { force: true })

execFileSync('sqlite3', [outputMbtiles], {
  input: sqlLines.join('\n'),
  stdio: ['pipe', 'inherit', 'inherit']
})
