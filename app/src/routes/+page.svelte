<script lang="ts">
  import { onMount } from 'svelte'

  import PanelContainer from '$lib/components/PanelContainer.svelte'
  import Glow from '$lib/components/Glow.svelte'

  import { mapState } from '$lib/map-state.svelte.js'

  import buildingStats from '$lib/generated/building-stats.json'
  import tileConfig from '../../../tile-config.json'

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
    { label: '2005 - 2015', color: '#4a7fbe' },
    { label: '>= 2015', color: '#3a5fa8' }
  ]

  const hybridBreakZoom = tileConfig.hybridBreakZoom

  let bodyWidth = $state(0)
  let aboutExpanded = $state(true)

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

  function getNumericBouwjaar(bouwjaar: number | string | undefined): number {
    const year =
      typeof bouwjaar === 'number'
        ? bouwjaar
        : typeof bouwjaar === 'string'
          ? Number.parseInt(bouwjaar, 10)
          : Number.NaN

    return Number.isNaN(year) ? 0 : year
  }

  function toggleNewBuildingClusters() {
    mapState.showNewBuildingClusters = !mapState.showNewBuildingClusters
  }

  onMount(() => {
    mapState.interactive = true
    mapState.center = undefined
    mapState.bounds = undefined
    mapState.boundsMode = 'contain'
  })
</script>

<svelte:body bind:clientWidth={bodyWidth} />

<div
  class="h-full w-full pointer-events-none flex gap-2
    flex-col-reverse sm:flex-col
    justify-between
    min-h-0 max-h-full
    justify-self-end p-1.5 sm:p-2.5"
>
  <div class="self-end">
    <PanelContainer
      {allowMultipleExpanded}
      buildingCount={buildingStats.buildingCount}
      {legendEntries}
      selectedLegendLabel={getLegendLabelForBouwjaar(
        mapState.selectedBuilding?.local.bouwjaar
      )}
      selectedBuildingYear={getNumericBouwjaar(
        mapState.selectedBuilding?.local.bouwjaar
      ) || undefined}
      hoveredLegendLabel={mapState.hoveredLegendLabel}
      hoveredBuildingYear={mapState.hoveredBuildingYear}
      showNewBuildingClusters={mapState.showNewBuildingClusters}
      detailsEnabled={mapState.mapZoom >= hybridBreakZoom}
      selectedBuilding={mapState.selectedBuilding}
      onToggleNewBuildingAreas={toggleNewBuildingClusters}
    />
  </div>

  <div class="self-end flex flex-col gap-2">
    {#if mapState.error}
      <div class="self-end justify-self-start">
        <div
          class="rounded-xl border border-white/15 bg-red-500/80 px-3 py-2 text-white pointer-events-auto"
        >
          {mapState.error}
        </div>
      </div>
    {/if}

    <div class="self-end justify-self-start">
      <Glow enableHover><a href="play" class="block px-4 py-2">Play!</a></Glow>
    </div>
  </div>
</div>
<!-- </div> -->
