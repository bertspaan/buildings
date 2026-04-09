import type { Map as MapLibreMap } from 'maplibre-gl'
import type { SelectedBuildingState } from '$lib/viewer-types.js'

import tileConfig from '../../../tile-config.json'

export type Bounds = [number, number, number, number]
export type Center = [number, number]
export type BoundsMode = 'contain' | 'cover'

class MapState {
  map = $state<MapLibreMap | undefined>()
  selectedBuilding = $state<SelectedBuildingState | undefined>()
  hoveredLegendLabel = $state<string>()
  hoveredBuildingYear = $state<number>()
  showNewBuildingClusters = $state(false)
  error = $state('')
  mapZoom = $state(tileConfig.rasterMinZoom)
  interactive = $state(true)
  center = $state<Center | undefined>()
  bounds = $state<Bounds | undefined>()
  boundsMode = $state<BoundsMode>('contain')
}

export const mapState = new MapState()
