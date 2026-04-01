<script lang="ts">
  import { onMount } from 'svelte'

  import {
    GeolocateControl,
    Map as MapLibreMap,
    NavigationControl,
    addProtocol
  } from 'maplibre-gl'
  import { PMTiles, Protocol as PMTilesProtocol } from 'pmtiles'

  import {
    PUBLIC_BUILDINGS_RASTER_PMTILES_URL,
    PUBLIC_BUILDINGS_VECTOR_PMTILES_URL,
    PUBLIC_NEW_BUILDING_CLUSTERS_MASK_PMTILES_URL,
    PUBLIC_NEW_BUILDING_CLUSTERS_PMTILES_URL
  } from '$env/static/public'

  import PanelContainer from '$lib/components/PanelContainer.svelte'
  import buildingStats from '$lib/generated/building-stats.json'

  // import { ensurePmtilesProtocol } from '$lib/pmtiles.js'

  import type { MapGeoJSONFeature, StyleSpecification } from 'maplibre-gl'

  import type {
    BuildingVectorProperties,
    SelectedBuildingState
  } from '$lib/viewer-types.js'

  import tileConfig from '../../../tile-config.json'

  // ensurePmtilesProtocol(maplibre)

  const nationwideArchive = {
    raster: PUBLIC_BUILDINGS_RASTER_PMTILES_URL,
    vector: PUBLIC_BUILDINGS_VECTOR_PMTILES_URL,
    newBuildingClusters: PUBLIC_NEW_BUILDING_CLUSTERS_PMTILES_URL,
    newBuildingClustersMask: PUBLIC_NEW_BUILDING_CLUSTERS_MASK_PMTILES_URL
  }

  const legendEntries = [
    { label: '< 1700', color: '#a50026' },
    { label: '1700 - 1850', color: '#d73027' },
    { label: '1850 - 1901', color: '#f46d43' },
    { label: '1901 - 1919', color: '#fdae61' },
    { label: '1919 - 1946', color: '#fee090' },
    { label: '1946 - 1966', color: '#ffffbf' },
    { label: '1966 - 1974', color: '#e0f3f8' },
    { label: '1974 - 1992', color: '#abd9e9' },
    { label: '1992 - 2005', color: '#74add1' },
    // old viewer color: #4575b4
    // previous attempt: #3f78b5
    // previous attempt: #4f88c6
    { label: '2005 - 2015', color: '#4a7fbe' },
    // old viewer color: #313695
    // previous attempt: #2c8bc4
    // previous attempt: #2f6fb3
    { label: '>= 2015', color: '#3a5fa8' }
  ]

  const hybridBreakZoom = tileConfig.hybridBreakZoom
  const blendWindow = 1
  const blendMidZoom = hybridBreakZoom + blendWindow / 2
  const fadeEndZoom = hybridBreakZoom + blendWindow
  const vectorNativeMinZoom = hybridBreakZoom + 1
  const viewerMinZoom = tileConfig.rasterMinZoom
  const viewerMaxZoom = 19
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

  let bodyWidth = $state(0)
  let container = $state<HTMLDivElement>()
  let map: MapLibreMap | undefined
  let selectedBuilding = $state<SelectedBuildingState>()
  let hoveredLegendLabel = $state<string>()
  let hoveredBuildingYear = $state<number>()
  let showNewBuildingClusters = $state(false)
  let error = $state('')
  let mapZoom = $state(viewerMinZoom)
  let activeBuildingLoadId = 0

  let allowMultipleExpanded = $derived(bodyWidth >= 800)

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

  function formatCount(value: number): string {
    return new Intl.NumberFormat('nl-NL').format(value)
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
          activeBuildingLoadId += 1
          setSelectedBuilding()
          return
        }

        activeBuildingLoadId += 1
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
        activeBuildingLoadId += 1
        setSelectedBuilding()
      }

      hoveredLegendLabel = undefined
      hoveredBuildingYear = undefined
    })
  }

  function createStyle(
    rasterUrl: string,
    vectorUrl: string,
    newBuildingClustersUrl: string,
    newBuildingClustersMaskUrl: string,
    vectorSourceMaxZoom: number
  ): StyleSpecification {
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
      // old viewer color: #4575b4
      // previous attempt: #3f78b5
      // previous attempt: #4f88c6
      '#4a7fbe',
      2015,
      // old viewer color: #313695
      // previous attempt: #2c8bc4
      // previous attempt: #2f6fb3
      '#3a5fa8'
    ] as any

    return {
      version: 8,
      sources: {
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
      },
      layers: [
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
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              7,
              0.75,
              14,
              1.5
            ]
          }
        }
      ]
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

  function toggleNewBuildingClusters() {
    showNewBuildingClusters = !showNewBuildingClusters
    applyNewBuildingClusterLayerVisibility()
    applyNewBuildingClusterLayerEmphasis()
  }

  async function initializeMap() {
    if (!container) {
      return
    }

    const protocol = new PMTilesProtocol()
    addProtocol('pmtiles', protocol.tile)

    error = ''

    if (!nationwideArchive.raster || !nationwideArchive.vector) {
      error =
        'PMTiles URLs are not configured. Set the PUBLIC_* PMTiles env vars.'
      return
    }

    try {
      const absoluteRasterUrl = new URL(
        nationwideArchive.raster,
        window.location.href
      ).toString()
      const absoluteVectorUrl = new URL(
        nationwideArchive.vector,
        window.location.href
      ).toString()
      const absoluteNewBuildingAreasUrl = new URL(
        nationwideArchive.newBuildingClusters,
        window.location.href
      ).toString()
      const absoluteNewBuildingAreasMaskUrl = new URL(
        nationwideArchive.newBuildingClustersMask,
        window.location.href
      ).toString()

      const rasterArchive = new PMTiles(absoluteRasterUrl)
      const vectorArchive = new PMTiles(absoluteVectorUrl)
      const [rasterHeader, vectorHeader] = await Promise.all([
        rasterArchive.getHeader(),
        vectorArchive.getHeader()
      ])

      const style = createStyle(
        absoluteRasterUrl,
        absoluteVectorUrl,
        absoluteNewBuildingAreasUrl,
        absoluteNewBuildingAreasMaskUrl,
        vectorHeader.maxZoom
      )

      if (map) {
        map.remove()
      }

      setSelectedBuilding()

      map = new MapLibreMap({
        container: container!,
        style,
        center: [rasterHeader.centerLon, rasterHeader.centerLat],
        zoom: rasterHeader.minZoom,
        minZoom: viewerMinZoom,
        maxZoom: viewerMaxZoom,
        attributionControl: false,
        hash: true,
        canvasContextAttributes: {
          preserveDrawingBuffer: true
        }
      })

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

    return () => map?.remove()
  })

  $effect(() => {
    applyNewBuildingClusterLayerVisibility()
    applyNewBuildingClusterLayerEmphasis()
  })
</script>

<svelte:head>
  <title
    >All {formatCount(buildingStats.buildingCount)} buildings in the Netherlands
  </title>
  <meta
    property="og:image"
    content="https://bertspaan.nl/buildings/buildings-open-graph.jpg"
  />
  <meta
    property="og:title"
    content="All {formatCount(
      buildingStats.buildingCount
    )} buildings in the Netherlands"
  />
</svelte:head>

<svelte:body bind:clientWidth={bodyWidth} />

<div class="absolute top-0 left-0 h-dvh w-dvw overflow-hidden bg-black">
  <div
    bind:this={container}
    class="absolute top-0 left-0 h-full w-full"
    aria-label="Map showing the PMTiles archive"
  ></div>

  <div
    class="flex absolute z-10 top-0 left-0 h-full w-full pointer-events-none
      flex-row
      p-1 sm:p-2
      min-[420px]:flex-col items-end"
  >
    <PanelContainer
      {allowMultipleExpanded}
      buildingCount={buildingStats.buildingCount}
      {legendEntries}
      selectedLegendLabel={getLegendLabelForBouwjaar(
        selectedBuilding?.local.bouwjaar
      )}
      selectedBuildingYear={getNumericBouwjaar(
        selectedBuilding?.local.bouwjaar
      ) || undefined}
      {hoveredLegendLabel}
      {hoveredBuildingYear}
      {showNewBuildingClusters}
      detailsEnabled={mapZoom >= hybridBreakZoom}
      {selectedBuilding}
      onToggleNewBuildingAreas={toggleNewBuildingClusters}
    />

    {#if error}
      <div
        class="rounded-xl border border-white/15 bg-red-950/85 px-4 py-3 text-white"
      >
        {error}
      </div>
    {/if}
  </div>
</div>
