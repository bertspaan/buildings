import type { Map, StyleSpecification } from 'maplibre-gl'

export function getExportCreditFontSize(width: number, height: number): number {
  // About 8pt for an 80cm long edge printed at 150–300 dpi, with a readable
  // 11px minimum for smaller screen exports.
  return Math.max(11, Math.round(Math.max(width, height) * 0.0035))
}

export function exportDimensions(ratio: number, longEdge: number) {
  if (
    !Number.isFinite(ratio) ||
    ratio <= 0 ||
    !Number.isInteger(longEdge) ||
    longEdge < 512 ||
    longEdge > 10000
  ) {
    throw new Error('Choose a resolution between 512 and 10,000 pixels.')
  }
  return ratio >= 1
    ? { width: longEdge, height: Math.round(longEdge / ratio) }
    : { width: Math.round(longEdge * ratio), height: longEdge }
}

/** Use the same data and overlays, without the building selection outline. */
export function exportStyle(map: Map, renderZoom?: number): StyleSpecification {
  const style = structuredClone(map.getStyle())
  style.layers = style.layers.filter(
    (layer) => layer.id !== 'buildings-vector-selected'
  )
  const raster = style.layers.find((layer) => layer.id === 'buildings-raster')
  if (raster?.type === 'raster') {
    raster.paint = {
      ...raster.paint,
      'raster-opacity': 1,
      'raster-fade-duration': 0
    }
  }
  if (renderZoom !== undefined) {
    // A still image must not capture the viewer's raster/vector crossfade.
    // Once vectors are available, use them exclusively for uniformly sharp edges.
    const vectorLayer = style.layers.find(
      (layer) => layer.id === 'buildings-vector-fill'
    )
    if (vectorLayer && renderZoom >= (vectorLayer.minzoom ?? 0)) {
      style.layers = style.layers.filter(
        (layer) => layer.id !== 'buildings-raster'
      )
      delete style.sources.raster
    }
    style.transition = { duration: 0, delay: 0 }
  }
  return style
}
