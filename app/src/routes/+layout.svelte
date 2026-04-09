<script lang="ts">
  import { dev } from '$app/environment'
  import { onNavigate } from '$app/navigation'

  import './layout.css'
  import 'maplibre-gl/dist/maplibre-gl.css'

  import {
    PUBLIC_BUILDINGS_RASTER_PMTILES_URL,
    PUBLIC_BUILDINGS_VECTOR_PMTILES_URL,
    PUBLIC_NEW_BUILDING_CLUSTERS_MASK_PMTILES_URL,
    PUBLIC_NEW_BUILDING_CLUSTERS_PMTILES_URL
  } from '$env/static/public'

  import favicon from '$lib/assets/favicon.png'
  import MapView from '$lib/components/Map.svelte'
  import { formatCount } from '$lib/format.js'
  import buildingStats from '$lib/generated/building-stats.json'
  import { mapState } from '$lib/map-state.svelte.js'

  let { children } = $props()

  onNavigate((navigation) => {
    if (!document.startViewTransition) {
      return
    }

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve()
        await navigation.complete
      })
    })
  })
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
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
  {#if !dev}
    <script
      defer
      src="https://stats.bertspaan.nl/script.js"
      data-website-id="8566e488-fb4d-48ab-9c12-3f6bd9b2e409"
      data-exclude-hash="true"
    ></script>
  {/if}
</svelte:head>

<div class="absolute top-0 left-0 h-dvh w-dvw overflow-hidden bg-black">
  {#key mapState.interactive}
    <MapView
      rasterUrl={PUBLIC_BUILDINGS_RASTER_PMTILES_URL}
      vectorUrl={PUBLIC_BUILDINGS_VECTOR_PMTILES_URL}
      newBuildingClustersUrl={PUBLIC_NEW_BUILDING_CLUSTERS_PMTILES_URL}
      newBuildingClustersMaskUrl={PUBLIC_NEW_BUILDING_CLUSTERS_MASK_PMTILES_URL}
      bind:map={mapState.map}
      interactive={mapState.interactive}
      center={mapState.center}
      bounds={mapState.bounds}
      boundsMode={mapState.boundsMode}
      bind:selectedBuilding={mapState.selectedBuilding}
      bind:hoveredLegendLabel={mapState.hoveredLegendLabel}
      bind:hoveredBuildingYear={mapState.hoveredBuildingYear}
      bind:mapZoom={mapState.mapZoom}
      bind:error={mapState.error}
      showNewBuildingClusters={mapState.showNewBuildingClusters}
    />
  {/key}
  <div class="absolute top-0 left-0 h-full w-full pointer-events-none">
    {@render children()}
  </div>
</div>
