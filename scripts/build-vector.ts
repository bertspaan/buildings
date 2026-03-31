import {
  dataDir,
  ensureDir,
  getArea,
  getAreaBoundsWgs84,
  getNationalBoundsWgs84,
  getVectorAttributes,
  getVectorBaseName,
  getVectorGeoJsonPath,
  getVectorLayerName,
  getVectorMaxZoom,
  getVectorMbtilesPath,
  getVectorMinZoom,
  getVectorPmtilesPath,
  removeFile,
  r2Dir,
  run,
  sourceGeopackagePath
} from './tile-helpers.ts'

const areaKey = process.argv[2] ?? 'national'
const area = getArea(areaKey)

const ogr2ogr = '/Applications/QGIS.app/Contents/MacOS/ogr2ogr'
const geopackagePath = sourceGeopackagePath

const vectorGeoJsonPath = getVectorGeoJsonPath(area)
const vectorMbtilesPath = getVectorMbtilesPath(area)
const vectorPmtilesPath = getVectorPmtilesPath(area)
const vectorBaseName = getVectorBaseName(area)
const clipBounds =
  areaKey === 'national' ? getNationalBoundsWgs84() : getAreaBoundsWgs84(area)

ensureDir(dataDir)
ensureDir(`${dataDir}/vector`)
ensureDir(r2Dir)
removeFile(vectorGeoJsonPath)
removeFile(vectorMbtilesPath)
removeFile(vectorPmtilesPath)

run(ogr2ogr, [
  '-f',
  'GeoJSONSeq',
  vectorGeoJsonPath,
  geopackagePath,
  'pand',
  '-select',
  getVectorAttributes().join(','),
  '-t_srs',
  'EPSG:4326',
  '-spat',
  ...clipBounds.map(String),
  '-spat_srs',
  'EPSG:4326'
])

run('tippecanoe', [
  '-o',
  vectorMbtilesPath,
  '-f',
  '-P',
  '-l',
  getVectorLayerName(),
  '-n',
  vectorBaseName,
  '-N',
  vectorBaseName,
  '-Z',
  String(getVectorMinZoom()),
  '-z',
  String(getVectorMaxZoom()),
  '-pf',
  '-pk',
  ...getVectorAttributes().flatMap((attribute) => ['-y', attribute]),
  vectorGeoJsonPath
])

run('pmtiles', ['convert', '--force', vectorMbtilesPath, vectorPmtilesPath])
