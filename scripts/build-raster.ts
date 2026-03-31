import { join } from 'node:path'
import {
  getArea,
  getAreaBoundsWgs84,
  getRasterAntialias,
  getAreaExtent3857,
  getHybridBreakZoom,
  getRasterBaseName,
  getRasterDpi,
  getRasterMbtilesPath,
  getRasterMinZoom,
  getRasterPmtilesPath,
  getRasterProject,
  getRasterTileSize,
  getRasterTilesDir,
  removeFile,
  r2Dir,
  repoRoot,
  ensureDir,
  resetDir,
  run
} from './tile-helpers.ts'

const areaKey = process.argv[2] ?? 'national'
const area = getArea(areaKey)

const qgisProcess = '/Applications/QGIS.app/Contents/MacOS/qgis_process'
const projectPath = join(repoRoot, getRasterProject())
const packScript = new URL('./xyzdir-to-mbtiles.ts', import.meta.url)

const extent = `${getAreaExtent3857(area).join(',')} [EPSG:3857]`
const bounds = getAreaBoundsWgs84(area).join(',')
const rasterTilesDir = getRasterTilesDir(area)
const rasterMbtilesPath = getRasterMbtilesPath(area)
const rasterPmtilesPath = getRasterPmtilesPath(area)
const rasterBaseName = getRasterBaseName(area)

resetDir(rasterTilesDir)
ensureDir(r2Dir)
removeFile(rasterMbtilesPath)
removeFile(rasterPmtilesPath)

run(qgisProcess, [
  'run',
  'native:tilesxyzdirectory',
  '--distance_units=meters',
  '--area_units=m2',
  '--ellipsoid=EPSG:7030',
  `--project_path=${projectPath}`,
  `--EXTENT=${extent}`,
  `--ZOOM_MIN=${getRasterMinZoom()}`,
  `--ZOOM_MAX=${getHybridBreakZoom()}`,
  `--DPI=${getRasterDpi()}`,
  '--BACKGROUND_COLOR=#000000',
  `--ANTIALIAS=${getRasterAntialias()}`,
  '--TILE_FORMAT=0',
  '--QUALITY=75',
  '--METATILESIZE=4',
  `--TILE_WIDTH=${getRasterTileSize()}`,
  `--TILE_HEIGHT=${getRasterTileSize()}`,
  '--TMS_CONVENTION=false',
  `--OUTPUT_DIRECTORY=${rasterTilesDir}`
])

run(process.execPath, [
  packScript.pathname,
  rasterTilesDir,
  rasterMbtilesPath,
  '--name',
  rasterBaseName,
  '--description',
  rasterBaseName,
  '--bounds',
  bounds,
  '--minzoom',
  String(getRasterMinZoom()),
  '--maxzoom',
  String(getHybridBreakZoom()),
  '--format',
  'png'
])

run('pmtiles', ['convert', '--force', rasterMbtilesPath, rasterPmtilesPath])
