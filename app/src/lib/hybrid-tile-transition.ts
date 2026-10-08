import type { Map } from 'maplibre-gl'

type Options = {
  rasterLayerId: string
  vectorMinZoom: number
  blendStartZoom: number
  blendEndZoom: number
}

/** Fade an opaque raster layer over fully drawn vectors, without a brightness dip. */
export function addHybridTileTransition(map: Map, options: Options) {
  const duration = 250
  let blend = 0
  let previousTime: number | undefined

  const update = () => {
    const zoom = map.getZoom()
    const target = Math.max(
      0,
      Math.min(
        1,
        (zoom - options.blendStartZoom) /
          (options.blendEndZoom - options.blendStartZoom)
      )
    )

    // Below the archive's minimum zoom there is no vector coverage to retain.
    if (zoom < options.vectorMinZoom) {
      if (blend !== 0) {
        blend = 0
        map.setPaintProperty(options.rasterLayerId, 'raster-opacity', 1)
      }
      previousTime = undefined
      return
    }

    // Check after rendering: zoom/source events can fire before MapLibre has
    // requested the tiles for the new camera position. Both sources stay active,
    // even when covered or transparent, so this also works when zooming out.
    const incomingSource = target > blend ? 'vector' : 'raster'
    if (target === blend || !map.isSourceLoaded(incomingSource)) {
      previousTime = undefined
      return
    }

    const now = performance.now()
    const step =
      previousTime === undefined ? 0 : (now - previousTime) / duration
    previousTime = now
    const nextBlend =
      target > blend
        ? Math.min(target, blend + step)
        : Math.max(target, blend - step)

    if (nextBlend !== blend) {
      blend = nextBlend
      map.setPaintProperty(options.rasterLayerId, 'raster-opacity', 1 - blend)
    }

    if (blend !== target) {
      map.triggerRepaint()
    } else {
      previousTime = undefined
    }
  }

  map.on('render', update)
  return () => map.off('render', update)
}
