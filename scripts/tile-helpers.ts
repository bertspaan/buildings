import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

type Bounds = [number, number, number, number]

type AreaConfig = {
  id: string
  label: string
  extent3857: Bounds
  boundsWgs84: Bounds
}

type TileConfig = {
  hybridBreakZoom: number
  rasterMinZoom: number
  vectorMaxZoom: number
  rasterTileSize: number
  rasterDpi: number
  rasterAntialias: boolean
  rasterProject: string
  vectorLayerName: string
  vectorAttributes: string[]
  nationalBoundsWgs84: Bounds
  areas: Record<string, AreaConfig>
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(scriptDir, '..')
export const dataDir = join(repoRoot, 'data')
export const sourceGeopackagePath = join(dataDir, 'bag-light.gpkg')
export const r2Dir = join(dataDir, 'r2')
export const qgisAppRoot = '/Applications/QGIS.app/Contents'
export const qgisEnv = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  TMPDIR: process.env.TMPDIR ?? '',
  LANG: process.env.LANG ?? 'en_US.UTF-8',
  PROJ_DATA: join(qgisAppRoot, 'Resources', 'qgis', 'proj'),
  PROJ_LIB: join(qgisAppRoot, 'Resources', 'qgis', 'proj'),
  GDAL_DATA: join(qgisAppRoot, 'Resources', 'qgis', 'gdal')
}

export const config = JSON.parse(
  readFileSync(new URL('../tile-config.json', import.meta.url), 'utf8')
) as TileConfig

export function getArea(areaKey: string): AreaConfig {
  const area = config.areas[areaKey]

  if (!area) {
    throw new Error(`Unknown area "${areaKey}"`)
  }

  return area
}

export function getHybridBreakZoom(): number {
  return config.hybridBreakZoom
}

export function getRasterMinZoom(): number {
  return config.rasterMinZoom
}

export function getVectorMinZoom(): number {
  return config.hybridBreakZoom
}

export function getVectorMaxZoom(): number {
  return config.vectorMaxZoom
}

export function getRasterTileSize(): number {
  return config.rasterTileSize
}

export function getRasterDpi(): number {
  return config.rasterDpi
}

export function getRasterAntialias(): boolean {
  return config.rasterAntialias
}

export function getRasterProject(): string {
  return config.rasterProject
}

export function getVectorLayerName(): string {
  return config.vectorLayerName
}

export function getVectorAttributes(): string[] {
  return [...config.vectorAttributes]
}

export function getNationalBoundsWgs84(): Bounds {
  return [...config.nationalBoundsWgs84] as Bounds
}

export function getAreaBoundsWgs84(area: AreaConfig): Bounds {
  return [...area.boundsWgs84] as Bounds
}

export function getAreaExtent3857(area: AreaConfig): Bounds {
  return [...area.extent3857] as Bounds
}

export function getRasterBaseName(area: AreaConfig): string {
  return `${area.id}-raster@2x`
}

export function getVectorBaseName(area: AreaConfig): string {
  return `${area.id}-vector`
}

export function getRasterTilesDir(area: AreaConfig): string {
  return join(
    dataDir,
    'tiles',
    `${area.id}-z${getRasterMinZoom()}-${getHybridBreakZoom()}@2x`
  )
}

export function getRasterMbtilesPath(area: AreaConfig): string {
  return join(dataDir, `${getRasterBaseName(area)}.mbtiles`)
}

export function getRasterPmtilesPath(area: AreaConfig): string {
  return join(r2Dir, `${getRasterBaseName(area)}.pmtiles`)
}

export function getVectorGeoJsonPath(area: AreaConfig): string {
  return join(dataDir, 'vector', `${area.id}.geojsonl`)
}

export function getVectorMbtilesPath(area: AreaConfig): string {
  return join(dataDir, `${getVectorBaseName(area)}.mbtiles`)
}

export function getVectorPmtilesPath(area: AreaConfig): string {
  return join(r2Dir, `${getVectorBaseName(area)}.pmtiles`)
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

export function resetDir(path: string): void {
  rmSync(path, { recursive: true, force: true })
  mkdirSync(path, { recursive: true })
}

export function removeFile(path: string): void {
  rmSync(path, { force: true })
}

export function run(command: string, args: string[]): void {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: qgisEnv
  })
}
