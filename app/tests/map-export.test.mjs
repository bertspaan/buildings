import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  exportDimensions,
  exportStyle,
  getExportCreditFontSize
} from '../src/lib/map-export-settings.ts'

const sourceStyle = {
  version: 8,
  sources: {
    raster: { type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}.png'] },
    vector: { type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}.pbf'] }
  },
  layers: [
    { id: 'background', type: 'background' },
    {
      id: 'buildings-vector-fill',
      type: 'fill',
      source: 'vector',
      minzoom: 13
    },
    {
      id: 'buildings-raster',
      type: 'raster',
      source: 'raster',
      paint: { 'raster-opacity': 0.4 }
    },
    { id: 'buildings-vector-selected', type: 'line', source: 'vector' },
    {
      id: 'new-building-clusters-mask-fill',
      type: 'fill',
      source: 'vector',
      layout: { visibility: 'visible' }
    }
  ]
}
const map = { getStyle: () => sourceStyle }

test('a static vector export cannot capture the raster/vector crossfade', () => {
  for (const zoom of [13, 13.5, 16]) {
    const style = exportStyle(map, zoom)
    assert.ok(!style.layers.some((layer) => layer.id === 'buildings-raster'))
    assert.ok(!('raster' in style.sources))
    assert.ok(
      style.layers.some((layer) => layer.id === 'buildings-vector-fill')
    )
    assert.deepEqual(style.transition, { duration: 0, delay: 0 })
  }
})

test('keeps raster coverage below the vector archive minimum, without fading', () => {
  const style = exportStyle(map, 12.9)
  const raster = style.layers.find((layer) => layer.id === 'buildings-raster')
  assert.equal(raster.paint['raster-opacity'], 1)
  assert.equal(raster.paint['raster-fade-duration'], 0)
  assert.ok(style.sources.raster)
})

test('preserves overlays and leaves the live viewer style unchanged', () => {
  const before = structuredClone(sourceStyle)
  const style = exportStyle(map, 16)
  assert.ok(
    !style.layers.some((layer) => layer.id === 'buildings-vector-selected')
  )
  assert.deepEqual(style.layers.at(-1), sourceStyle.layers.at(-1))
  assert.deepEqual(sourceStyle, before)
  const preview = exportStyle(map)
  assert.ok(preview.layers.some((layer) => layer.id === 'buildings-raster'))
})

test('sizes landscape, portrait and poster exports without exceeding the long edge', () => {
  assert.deepEqual(exportDimensions(16 / 9, 2048), {
    width: 2048,
    height: 1152
  })
  assert.deepEqual(exportDimensions(3 / 4, 9449), { width: 7087, height: 9449 })
  assert.deepEqual(exportDimensions(1, 4096), { width: 4096, height: 4096 })
  assert.throws(() => exportDimensions(1, 10001))
  assert.throws(() => exportDimensions(1, 0))
  assert.throws(() => exportDimensions(1, 1024.5))
  assert.throws(() => exportDimensions(NaN, 1024))
})

test('keeps screen credits small and print credits around 8pt at different resolutions', () => {
  assert.equal(getExportCreditFontSize(1024, 576), 11)
  assert.equal(getExportCreditFontSize(2048, 1152), 11)
  assert.equal(getExportCreditFontSize(7087, 9449), 33)
  assert.equal(getExportCreditFontSize(9449, 7087), 33)

  for (const [width, height, dpi] of [
    [3543, 4724, 150],
    [4724, 6299, 200],
    [7087, 9449, 300]
  ]) {
    const points = (getExportCreditFontSize(width, height) * 72) / dpi
    assert.ok(points >= 7.5 && points <= 8.5, `${dpi} dpi: ${points}pt`)
  }
})
