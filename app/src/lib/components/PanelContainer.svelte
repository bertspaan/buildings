<script lang="ts">
  import AboutPanel from '$lib/components/AboutPanel.svelte'
  import InfoPanel from '$lib/components/InfoPanel.svelte'
  import LegendPanel from '$lib/components/LegendPanel.svelte'
  import NewBuildingsPanel from '$lib/components/NewBuildingsPanel.svelte'

  import type { LegendEntry, SelectedBuildingState } from '$lib/viewer-types.js'

  type Props = {
    buildingCount: number
    allowMultipleExpanded?: boolean
    legendEntries?: LegendEntry[]
    selectedLegendLabel?: string
    hoveredLegendLabel?: string
    selectedBuildingYear?: number
    hoveredBuildingYear?: number
    showNewBuildingClusters?: boolean
    detailsEnabled?: boolean
    selectedBuilding?: SelectedBuildingState | null
    onToggleNewBuildingAreas?: () => void
  }

  let {
    buildingCount,
    allowMultipleExpanded = true,
    legendEntries = [],
    selectedLegendLabel,
    hoveredLegendLabel,
    selectedBuildingYear,
    hoveredBuildingYear,
    showNewBuildingClusters = false,
    detailsEnabled = false,
    selectedBuilding = null,
    onToggleNewBuildingAreas = () => {}
  }: Props = $props()

  let aboutExpanded = $state(true)
  let newBuildingsExpanded = $state(false)
  let legendExpanded = $state(false)
  let infoExpanded = $state(false)

  let previousExpandedState = [true, false, false, false]

  function getExpandedState(): boolean[] {
    return [aboutExpanded, newBuildingsExpanded, legendExpanded, infoExpanded]
  }

  function setExpandedState(state: boolean[]): void {
    ;[aboutExpanded, newBuildingsExpanded, legendExpanded, infoExpanded] = state
  }

  $effect(() => {
    const currentExpandedState = getExpandedState()

    if (allowMultipleExpanded) {
      previousExpandedState = currentExpandedState
      return
    }

    const openCount = currentExpandedState.filter(Boolean).length

    if (openCount > 1) {
      const lastOpenedIndex = currentExpandedState.findLastIndex(
        (expanded, index) => expanded && !previousExpandedState[index]
      )

      const keepIndex =
        lastOpenedIndex >= 0
          ? lastOpenedIndex
          : currentExpandedState.findIndex(Boolean)

      setExpandedState(
        currentExpandedState.map((_, index) => index === keepIndex)
      )
    }

    previousExpandedState = getExpandedState()
  })
</script>

<div
  class="max-w-full w-full min-[420px]:w-90 max-h-full min-h-0
    flex flex-col overflow-hidden text-white
    gap-0.5 sm:gap-1"
>
  <AboutPanel bind:expanded={aboutExpanded} {buildingCount} />
  <NewBuildingsPanel
    bind:expanded={newBuildingsExpanded}
    {showNewBuildingClusters}
    {buildingCount}
    onToggle={onToggleNewBuildingAreas}
  />
  <LegendPanel
    bind:expanded={legendExpanded}
    entries={legendEntries}
    selectedLabel={selectedLegendLabel}
    hoveredLabel={hoveredLegendLabel}
    {selectedBuildingYear}
    {hoveredBuildingYear}
    {detailsEnabled}
  />
  <InfoPanel bind:expanded={infoExpanded} {detailsEnabled} {selectedBuilding} />
</div>
