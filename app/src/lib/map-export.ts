import type { Map } from 'maplibre-gl'
import { addHybridTileTransition } from './hybrid-tile-transition.js'
import tileConfig from '../../../tile-config.json'
import { exportStyle, getExportCreditFontSize } from './map-export-settings.js'
import { ensurePngSrgb } from './png-color-space.js'
export {
  exportDimensions,
  exportStyle,
  getExportCreditFontSize
} from './map-export-settings.js'

export type ExportFormat = 'png' | 'jpeg' | 'webp'
export const exportSite = 'bertspaan.nl/buildings'
export const exportCredit = `© Bert Spaan • ${exportSite} • Data: BAG`
export const exportCreditMargin = 4

export function addExportTileTransition(map: Map) {
  // MapLibre installs the supplied style asynchronously on a new map.
  if (!map.getStyle()) {
    map.once('style.load', () => addExportTileTransition(map))
    return
  }
  const vectorMinZoom =
    map.getStyle().layers.find((layer) => layer.id === 'buildings-vector-fill')
      ?.minzoom ?? tileConfig.hybridBreakZoom
  const blendStartZoom =
    Math.max(tileConfig.hybridBreakZoom, vectorMinZoom) + 0.25
  const remove = addHybridTileTransition(map, {
    rasterLayerId: 'buildings-raster',
    vectorMinZoom,
    blendStartZoom,
    blendEndZoom: blendStartZoom + 0.75
  })
  map.once('remove', remove)
}

function waitForTiles(map: Map, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout)
      map.off('idle', onIdle)
      map.off('error', onError)
      map.getCanvas().removeEventListener('webglcontextlost', onContextLost)
      signal.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve()
    }
    const onIdle = () => finish()
    const onError = () =>
      finish(new Error('Some map tiles could not be loaded. Please try again.'))
    const onAbort = () =>
      finish(new DOMException('Export cancelled', 'AbortError'))
    const onContextLost = () =>
      finish(
        new Error(
          'The graphics memory limit was reached. Try a lower resolution.'
        )
      )
    const timeout = setTimeout(
      () =>
        finish(new Error('Loading the map took too long. Please try again.')),
      90000
    )
    map.on('idle', onIdle)
    map.on('error', onError)
    map.getCanvas().addEventListener('webglcontextlost', onContextLost)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
}

export function drawExportCredit(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('The image could not be created. Try a lower resolution.')
  let fontSize = getExportCreditFontSize(canvas.width, canvas.height)
  context.font = `500 ${fontSize}px sans-serif`
  const measuredWidth = context.measureText(exportCredit).width
  fontSize = Math.min(
    fontSize,
    (canvas.width - exportCreditMargin * 2) / (measuredWidth / fontSize + 1)
  )
  const margin = exportCreditMargin
  const paddingX = Math.round(fontSize * 0.5)
  const paddingY = Math.round(fontSize * 0.25)
  const lineHeight = Math.round(fontSize * 1.4)
  context.font = `500 ${fontSize}px sans-serif`
  const textWidth = context.measureText(exportCredit).width
  const boxWidth = textWidth + paddingX * 2
  const boxHeight = lineHeight + paddingY * 2
  context.fillStyle = 'rgba(0, 0, 0, 0.75)'
  context.beginPath()
  context.roundRect(
    canvas.width - margin - boxWidth,
    canvas.height - margin - boxHeight,
    boxWidth,
    boxHeight,
    fontSize * 0.5
  )
  context.fill()
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  context.fillStyle = '#ffffff'
  context.fillText(
    exportCredit,
    canvas.width - margin - paddingX,
    canvas.height - margin - boxHeight / 2
  )
}

export async function renderMapExport(
  preview: Map,
  width: number,
  height: number,
  format: ExportFormat,
  quality: number,
  signal: AbortSignal,
  onProgress: (progress: number) => void = () => {}
): Promise<Blob> {
  signal.throwIfAborted()
  const previewCanvas = preview.getCanvas()
  const previewGl = previewCanvas.getContext('webgl2')
  if (!previewGl || previewGl.isContextLost()) {
    throw new Error(
      'The graphics context is unavailable. Please reopen the export.'
    )
  }
  const graphicsLimit = Math.min(
    previewGl.getParameter(previewGl.MAX_TEXTURE_SIZE),
    previewGl.getParameter(previewGl.MAX_RENDERBUFFER_SIZE)
  )
  const tilted = preview.getPitch() !== 0
  if (tilted && (width > graphicsLimit || height > graphicsLimit)) {
    throw new Error(
      'This tilted view exceeds your browser’s graphics limit. Use a lower resolution or reset the map tilt.'
    )
  }
  // Render flat maps in overlapping sections. This bounds GPU memory even for
  // poster-sized images; the overlap prevents clipped strokes at section edges.
  const gutter = tilted ? 0 : 16
  const sectionSize = tilted
    ? Math.max(width, height)
    : Math.min(4096, graphicsLimit) - gutter * 2
  const columns = Math.ceil(width / sectionSize)
  const rows = Math.ceil(height / sectionSize)
  const previewWidth = preview.getContainer().clientWidth
  const previewHeight = preview.getContainer().clientHeight
  const scale = height / previewHeight
  const zoom = preview.getZoom() + Math.log2(scale)
  const style = exportStyle(preview, zoom)
  const bearing = preview.getBearing()
  const pitch = preview.getPitch()
  // Freeze the camera before any awaits: resizing the window during an export
  // must not move individual sections to different geographic positions.
  const sections = Array.from({ length: rows * columns }, (_, index) => {
    const left = (index % columns) * sectionSize
    const top = Math.floor(index / columns) * sectionSize
    const sectionWidth = Math.min(sectionSize, width - left)
    const sectionHeight = Math.min(sectionSize, height - top)
    const center = tilted
      ? preview.getCenter()
      : preview.unproject([
          previewWidth / 2 + (left + sectionWidth / 2 - width / 2) / scale,
          previewHeight / 2 + (top + sectionHeight / 2 - height / 2) / scale
        ])
    return { left, top, sectionWidth, sectionHeight, center }
  })
  const { Map: MapLibreMap } = await import('maplibre-gl')
  signal.throwIfAborted()
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-20000px;top:0;pointer-events:none;'
  container.setAttribute('aria-hidden', 'true')
  document.body.append(container)
  let map: Map | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', {
      alpha: false,
      colorSpace: 'srgb'
    })
    if (!context)
      throw new Error('The image could not be created. Try a lower resolution.')
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        signal.throwIfAborted()
        const { left, top, sectionWidth, sectionHeight, center } =
          sections[row * columns + column]
        const renderWidth = sectionWidth + gutter * 2
        const renderHeight = sectionHeight + gutter * 2
        container.style.width = `${renderWidth}px`
        container.style.height = `${renderHeight}px`
        if (!map) {
          map = new MapLibreMap({
            container,
            style,
            center,
            zoom,
            bearing,
            pitch,
            maxZoom: 30,
            minZoom: 0,
            interactive: false,
            attributionControl: false,
            pixelRatio: 1,
            maxCanvasSize: [graphicsLimit, graphicsLimit],
            canvasContextAttributes: { preserveDrawingBuffer: true }
          })
        } else {
          map.resize()
          map.jumpTo({ center, zoom })
        }
        const rendered = map.getCanvas()
        const gl = rendered.getContext('webgl2')
        if (
          !gl ||
          gl.drawingBufferWidth !== renderWidth ||
          gl.drawingBufferHeight !== renderHeight
        ) {
          throw new Error(
            'This resolution exceeds your browser’s graphics limit. Try a lower resolution.'
          )
        }
        if ('drawingBufferColorSpace' in gl) gl.drawingBufferColorSpace = 'srgb'
        if ('unpackColorSpace' in gl) gl.unpackColorSpace = 'srgb'
        await waitForTiles(map, signal)
        signal.throwIfAborted()
        context.drawImage(
          rendered,
          gutter,
          gutter,
          sectionWidth,
          sectionHeight,
          left,
          top,
          sectionWidth,
          sectionHeight
        )
        onProgress((row * columns + column + 1) / (rows * columns))
      }
    }
    // Free the GPU resources before allocating the encoded file.
    map?.remove()
    map = undefined
    drawExportCredit(canvas)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas!.toBlob(
        (result) => {
          if (result) resolve(result)
          else
            reject(
              new Error(
                'The image could not be encoded. Try a lower resolution.'
              )
            )
        },
        `image/${format}`,
        quality
      )
    })
    signal.throwIfAborted()
    if (blob.type !== `image/${format}`) {
      throw new Error(
        'Your browser cannot export this format. Choose PNG or JPG instead.'
      )
    }
    // JPEG/WebP encoders carry the canvas's sRGB ICC profile. Some browsers
    // omit PNG color metadata, so add its standard sRGB declaration explicitly.
    const output = format === 'png' ? await ensurePngSrgb(blob) : blob
    signal.throwIfAborted()
    return output
  } finally {
    map?.remove()
    container.remove()
    if (canvas) canvas.width = canvas.height = 0
  }
}
