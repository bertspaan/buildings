<script lang="ts">
  import { onMount } from 'svelte'

  import {
    GeolocateControl,
    Map as MapLibreMap,
    NavigationControl,
    addProtocol
  } from 'maplibre-gl'
  import { PMTiles, Protocol as PMTilesProtocol } from 'pmtiles'

  import type { MapGeoJSONFeature, StyleSpecification } from 'maplibre-gl'

  import type {
    BuildingVectorProperties,
    SelectedBuildingState
  } from '$lib/viewer-types.js'

  import tileConfig from '../../../../tile-config.json'

  type Props = {
    rasterUrl: string
    vectorUrl: string
    newBuildingClustersUrl?: string
    newBuildingClustersMaskUrl?: string
    map?: MapLibreMap | undefined
    interactive?: boolean
    center?: [number, number]
    bounds?: [number, number, number, number]
    boundsMode?: 'contain' | 'cover'
    showNewBuildingClusters?: boolean
    selectedBuilding?: SelectedBuildingState | undefined
    hoveredLegendLabel?: string | undefined
    hoveredBuildingYear?: number | undefined
    mapZoom?: number
    error?: string
  }

  const hybridBreakZoom = tileConfig.hybridBreakZoom
  const blendWindow = 1
  const blendMidZoom = hybridBreakZoom + blendWindow / 2
  const fadeEndZoom = hybridBreakZoom + blendWindow
  const vectorNativeMinZoom = hybridBreakZoom + 1
  const viewerMinZoom = tileConfig.rasterMinZoom
  const viewerMaxZoom = 19
  const mapBounds = tileConfig.nationalBoundsWgs84 as [
    number,
    number,
    number,
    number
  ]
  const mapBoundsWidth = mapBounds[2] - mapBounds[0]
  const mapBoundsHeight = mapBounds[3] - mapBounds[1]
  const mapBoundsBufferX = mapBoundsWidth * 1
  const mapBoundsBufferY = mapBoundsHeight * 1
  const paddedMapBounds = [
    mapBounds[0] - mapBoundsBufferX,
    mapBounds[1] - mapBoundsBufferY,
    mapBounds[2] + mapBoundsBufferX,
    mapBounds[3] + mapBoundsBufferY
  ] as [number, number, number, number]

  const selectedBuildingLayerId = 'buildings-vector-selected'
  const vectorFillLayerId = 'buildings-vector-fill'
  const vectorOutlineLayerId = 'buildings-vector-outline'
  const newBuildingClustersFillLayerId = 'new-building-clusters-fill'
  const newBuildingClustersHaloLayerId = 'new-building-clusters-halo'
  const newBuildingClustersOutlineLayerId = 'new-building-clusters-outline'
  const newBuildingClustersMaskFillLayerId = 'new-building-clusters-mask-fill'
  const newBuildingClustersSourceLayer = 'new_building_clusters_2015'
  const newBuildingClustersMaskSourceLayer = 'new_building_clusters_mask_2015'
  const newestBuildingColor = '#7896d0'

  let {
    rasterUrl,
    vectorUrl,
    newBuildingClustersUrl = '',
    newBuildingClustersMaskUrl = '',
    map = $bindable<MapLibreMap | undefined>(),
    interactive = true,
    center,
    bounds,
    boundsMode = 'contain',
    showNewBuildingClusters = false,
    selectedBuilding = $bindable<SelectedBuildingState | undefined>(),
    hoveredLegendLabel = $bindable<string | undefined>(),
    hoveredBuildingYear = $bindable<number | undefined>(),
    mapZoom = $bindable(viewerMinZoom),
    error = $bindable('')
  }: Props = $props()

  let container = $state<HTMLDivElement>()
  let lastAppliedBounds = $state<string>()
  let lastAppliedCenter = $state<string>()

  function getLegendLabelForBouwjaar(
    bouwjaar: number | string | undefined
  ): string | undefined {
    const year =
      typeof bouwjaar === 'number'
        ? bouwjaar
        : typeof bouwjaar === 'string'
          ? Number.parseInt(bouwjaar, 10)
          : Number.NaN

    if (Number.isNaN(year)) {
      return undefined
    }

    if (year < 1700) return '< 1700'
    if (year < 1850) return '1700 - 1850'
    if (year < 1901) return '1850 - 1901'
    if (year < 1919) return '1901 - 1919'
    if (year < 1946) return '1919 - 1946'
    if (year < 1966) return '1946 - 1966'
    if (year < 1974) return '1966 - 1974'
    if (year < 1992) return '1974 - 1992'
    if (year < 2005) return '1992 - 2005'
    if (year < 2015) return '2005 - 2015'
    return '>= 2015'
  }

  function updateSelectedBuildingHighlight() {
    if (!map?.getLayer(selectedBuildingLayerId)) {
      return
    }

    const identificatie = selectedBuilding?.local.identificatie
    map.setFilter(
      selectedBuildingLayerId,
      identificatie
        ? ['==', ['get', 'identificatie'], identificatie]
        : ['==', ['get', 'identificatie'], '']
    )
  }

  function setSelectedBuilding(building?: SelectedBuildingState) {
    selectedBuilding = building
    updateSelectedBuildingHighlight()
  }

  function getNumericBouwjaar(bouwjaar: number | string | undefined): number {
    const year =
      typeof bouwjaar === 'number'
        ? bouwjaar
        : typeof bouwjaar === 'string'
          ? Number.parseInt(bouwjaar, 10)
          : Number.NaN

    return Number.isNaN(year) ? 0 : year
  }

  function addBuildingInteraction() {
    if (!interactive) {
      map?.getCanvas().style.setProperty('cursor', '')
      return
    }

    const interactiveLayers = [vectorFillLayerId, vectorOutlineLayerId]

    map?.on(
      'mousemove',
      interactiveLayers,
      (event: { features?: MapGeoJSONFeature[] }) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined
        const properties = (feature?.properties ??
          {}) as BuildingVectorProperties
        hoveredLegendLabel = getLegendLabelForBouwjaar(properties.bouwjaar)
        const numericBouwjaar = getNumericBouwjaar(properties.bouwjaar)
        hoveredBuildingYear = numericBouwjaar > 0 ? numericBouwjaar : undefined
      }
    )

    map?.on('mouseenter', interactiveLayers, () => {
      map?.getCanvas().style.setProperty('cursor', 'pointer')
    })

    map?.on('mouseleave', interactiveLayers, () => {
      map?.getCanvas().style.setProperty('cursor', '')
      hoveredLegendLabel = undefined
      hoveredBuildingYear = undefined
    })

    map?.on(
      'click',
      interactiveLayers,
      (event: {
        features?: MapGeoJSONFeature[]
        lngLat: { lat: number; lng: number }
      }) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined
        const properties = (feature?.properties ??
          {}) as BuildingVectorProperties
        const identificatie = properties.identificatie

        if (!feature || !identificatie) {
          return
        }

        if (selectedBuilding?.local.identificatie === identificatie) {
          setSelectedBuilding()
          return
        }

        setSelectedBuilding({
          local: properties,
          location: {
            lat: event.lngLat.lat,
            lng: event.lngLat.lng
          }
        })
      }
    )

    map?.on('click', (event: { point: unknown }) => {
      const features = map?.queryRenderedFeatures(event.point as never, {
        layers: interactiveLayers
      })

      if ((features?.length ?? 0) > 0) {
        return
      }

      if (selectedBuilding) {
        setSelectedBuilding()
      }

      hoveredLegendLabel = undefined
      hoveredBuildingYear = undefined
    })
  }

  function createStyle(vectorSourceMaxZoom: number): StyleSpecification {
    const bouwjaarExpression = [
      'coalesce',
      ['to-number', ['get', 'bouwjaar']],
      0
    ]
    const vectorFillColor = [
      'step',
      bouwjaarExpression,
      '#a50026',
      1700,
      '#d73027',
      1850,
      '#f46d43',
      1901,
      '#fdae61',
      1919,
      '#fee090',
      1946,
      '#ffffbf',
      1966,
      '#e0f3f8',
      1974,
      '#abd9e9',
      1992,
      '#74add1',
      2005,
      '#4a7fbe',
      2015,
      '#3a5fa8'
    ] as any

    const sources: StyleSpecification['sources'] = {
      raster: {
        type: 'raster',
        url: `pmtiles://${rasterUrl}`,
        tileSize: 512,
        maxzoom: hybridBreakZoom
      },
      vector: {
        type: 'vector',
        url: `pmtiles://${vectorUrl}`,
        maxzoom: vectorSourceMaxZoom
      },
      newBuildingClusters: {
        type: 'vector',
        url: `pmtiles://${newBuildingClustersUrl}`,
        maxzoom: 14
      },
      newBuildingClustersMask: {
        type: 'vector',
        url: `pmtiles://${newBuildingClustersMaskUrl}`,
        maxzoom: 14
      }
    }

    const layers: StyleSpecification['layers'] = [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#000000'
        }
      },
      {
        id: 'buildings-raster',
        type: 'raster',
        source: 'raster',
        paint: {
          'raster-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            hybridBreakZoom,
            1,
            blendMidZoom,
            0.8,
            fadeEndZoom,
            0
          ]
        }
      },
      {
        id: vectorFillLayerId,
        type: 'fill',
        source: 'vector',
        'source-layer': 'buildings',
        minzoom: hybridBreakZoom,
        paint: {
          'fill-color': vectorFillColor,
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            hybridBreakZoom,
            0,
            blendMidZoom,
            0.8,
            fadeEndZoom,
            1
          ]
        }
      },
      {
        id: selectedBuildingLayerId,
        type: 'line',
        source: 'vector',
        'source-layer': 'buildings',
        minzoom: hybridBreakZoom,
        filter: ['==', ['get', 'identificatie'], ''],
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 1,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            hybridBreakZoom,
            1.5,
            19,
            3
          ]
        }
      },
      {
        id: vectorOutlineLayerId,
        type: 'line',
        source: 'vector',
        'source-layer': 'buildings',
        minzoom: hybridBreakZoom,
        paint: {
          'line-color': 'rgba(0,0,0,0.35)',
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            hybridBreakZoom,
            0,
            blendMidZoom,
            0.8,
            fadeEndZoom,
            1
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            vectorNativeMinZoom,
            0.25,
            17,
            0.7
          ]
        }
      },
      {
        id: newBuildingClustersMaskFillLayerId,
        type: 'fill',
        source: 'newBuildingClustersMask',
        'source-layer': newBuildingClustersMaskSourceLayer,
        minzoom: 7,
        layout: {
          visibility: showNewBuildingClusters ? 'visible' : 'none'
        },
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0.5
        }
      },
      {
        id: newBuildingClustersFillLayerId,
        type: 'fill',
        source: 'newBuildingClusters',
        'source-layer': newBuildingClustersSourceLayer,
        minzoom: 7,
        layout: {
          visibility: showNewBuildingClusters ? 'visible' : 'none'
        },
        paint: {
          'fill-color': '#22d3ee',
          'fill-opacity': 0
        }
      },
      {
        id: newBuildingClustersHaloLayerId,
        type: 'line',
        source: 'newBuildingClusters',
        'source-layer': newBuildingClustersSourceLayer,
        minzoom: 7,
        layout: {
          visibility: showNewBuildingClusters ? 'visible' : 'none'
        },
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 0.45,
          'line-blur': 1.6,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2.5, 14, 4]
        }
      },
      {
        id: newBuildingClustersOutlineLayerId,
        type: 'line',
        source: 'newBuildingClusters',
        'source-layer': newBuildingClustersSourceLayer,
        minzoom: 7,
        layout: {
          visibility: showNewBuildingClusters ? 'visible' : 'none'
        },
        paint: {
          'line-color': newestBuildingColor,
          'line-opacity': 1,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.75, 14, 1.5]
        }
      }
    ]

    return {
      version: 8,
      sources,
      layers
    }
  }

  function applyNewBuildingClusterLayerVisibility() {
    if (!map) {
      return
    }

    const visibility = showNewBuildingClusters ? 'visible' : 'none'

    if (map.getLayer(newBuildingClustersFillLayerId)) {
      map.setLayoutProperty(
        newBuildingClustersFillLayerId,
        'visibility',
        visibility
      )
    }

    if (map.getLayer(newBuildingClustersHaloLayerId)) {
      map.setLayoutProperty(
        newBuildingClustersHaloLayerId,
        'visibility',
        visibility
      )
    }

    if (map.getLayer(newBuildingClustersOutlineLayerId)) {
      map.setLayoutProperty(
        newBuildingClustersOutlineLayerId,
        'visibility',
        visibility
      )
    }

    if (map.getLayer(newBuildingClustersMaskFillLayerId)) {
      map.setLayoutProperty(
        newBuildingClustersMaskFillLayerId,
        'visibility',
        visibility
      )
    }
  }

  function applyNewBuildingClusterLayerEmphasis() {
    if (!map) {
      return
    }

    if (map.getLayer(newBuildingClustersFillLayerId)) {
      map.setPaintProperty(newBuildingClustersFillLayerId, 'fill-opacity', 0)
    }

    if (map.getLayer(newBuildingClustersOutlineLayerId)) {
      map.setPaintProperty(
        newBuildingClustersOutlineLayerId,
        'line-opacity',
        showNewBuildingClusters ? 1 : 0.75
      )
    }

    if (map.getLayer(newBuildingClustersMaskFillLayerId)) {
      map.setPaintProperty(
        newBuildingClustersMaskFillLayerId,
        'fill-opacity',
        showNewBuildingClusters ? 0.5 : 0
      )
    }
  }

  async function initializeMap() {
    if (!container) {
      return
    }

    const protocol = new PMTilesProtocol()
    addProtocol('pmtiles', protocol.tile)

    error = ''

    if (!rasterUrl || !vectorUrl) {
      error =
        'PMTiles URLs are not configured. Set the PUBLIC_* PMTiles env vars.'
      return
    }

    try {
      const absoluteRasterUrl = new URL(
        rasterUrl,
        window.location.href
      ).toString()
      const absoluteVectorUrl = new URL(
        vectorUrl,
        window.location.href
      ).toString()

      const rasterArchive = new PMTiles(absoluteRasterUrl)
      const vectorArchive = new PMTiles(absoluteVectorUrl)
      const [rasterHeader, vectorHeader] = await Promise.all([
        rasterArchive.getHeader(),
        vectorArchive.getHeader()
      ])

      const style = createStyle(vectorHeader.maxZoom)

      if (map) {
        map.remove()
      }

      setSelectedBuilding()

      map = new MapLibreMap({
        container,
        style,
        center: center ?? [rasterHeader.centerLon, rasterHeader.centerLat],
        zoom: rasterHeader.minZoom,
        minZoom: viewerMinZoom,
        maxZoom: viewerMaxZoom,
        maxBounds: [
          [paddedMapBounds[0], paddedMapBounds[1]],
          [paddedMapBounds[2], paddedMapBounds[3]]
        ],
        attributionControl: false,
        interactive,
        hash: interactive,
        canvasContextAttributes: {
          preserveDrawingBuffer: true
        }
      })

      if (interactive) {
        map.addControl(
          new NavigationControl({ visualizePitch: true }),
          'top-left'
        )
        map.addControl(
          new GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserLocation: true,
            showAccuracyCircle: true
          }),
          'top-left'
        )
      }
      map.on('load', () => {
        map?.resize()
        mapZoom = map?.getZoom() ?? viewerMinZoom
        updateSelectedBuildingHighlight()
      })
      map.on('zoom', () => {
        mapZoom = map?.getZoom() ?? viewerMinZoom
      })
      addBuildingInteraction()
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : 'Unable to open the PMTiles archive.'
    }
  }

  onMount(() => {
    initializeMap()

    return () => {
      map?.remove()
      map = undefined
    }
  })

  $effect(() => {
    if (interactive) {
      return
    }

    hoveredLegendLabel = undefined
    hoveredBuildingYear = undefined
    selectedBuilding = undefined
  })

  $effect(() => {
    updateSelectedBuildingHighlight()
  })

  $effect(() => {
    if (!map || !bounds) {
      return
    }

    const nextBounds = [...bounds] as [number, number, number, number]
    const nextCenter = center ? ([...center] as [number, number]) : undefined
    const nextBoundsKey = nextBounds.join(',')
    const nextCenterKey = nextCenter?.join(',')
    const nextCameraKey = `${nextBoundsKey}|${nextCenterKey ?? ''}|${boundsMode}`

    if (nextCameraKey === lastAppliedBounds) {
      return
    }

    lastAppliedBounds = nextCameraKey
    lastAppliedCenter = nextCenterKey

    const applyBounds = () => {
      if (!map) {
        return
      }

      const camera = map.cameraForBounds(
        [
          [nextBounds[0], nextBounds[1]],
          [nextBounds[2], nextBounds[3]]
        ],
        {
          padding: boundsMode === 'cover' ? 0 : 64,
          maxZoom: 13
        }
      )

      const computedZoom = camera?.zoom ?? map.getZoom()
      const targetZoom =
        boundsMode === 'cover' ? Math.min(computedZoom + 1, 13) : computedZoom

      map.jumpTo({
        center: nextCenter ?? [
          (nextBounds[0] + nextBounds[2]) / 2,
          (nextBounds[1] + nextBounds[3]) / 2
        ],
        zoom: targetZoom
      })
    }

    if (map.isStyleLoaded()) {
      applyBounds()
    } else {
      map.once('load', applyBounds)
    }
  })

  $effect(() => {
    if (!map || bounds || !center) {
      return
    }

    const nextCenterKey = center.join(',')

    if (nextCenterKey === lastAppliedCenter) {
      return
    }

    lastAppliedCenter = nextCenterKey
    lastAppliedBounds = undefined
    map.jumpTo({ center })
  })

  $effect(() => {
    applyNewBuildingClusterLayerVisibility()
    applyNewBuildingClusterLayerEmphasis()
  })
</script>

<div bind:this={container} class="col-span-2 row-start-1 h-full w-full"></div>
