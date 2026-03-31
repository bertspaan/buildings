<script lang="ts">
  import AboutPanel from '$lib/components/AboutPanel.svelte'
  import InfoPanel from '$lib/components/InfoPanel.svelte'
  import LegendPanel from '$lib/components/LegendPanel.svelte'
  import NewBuildingsPanel from '$lib/components/NewBuildingsPanel.svelte'

  import type { LegendEntry, SelectedBuildingState } from '$lib/viewer-types.js'

  type Props = {
    count?: number
    allowMultipleExpanded?: boolean
    legendEntries?: LegendEntry[]
    selectedLegendLabel?: string
    hoveredLegendLabel?: string
    hoveredBuildingYear?: number
    showNewBuildingClusters?: boolean
    detailsEnabled?: boolean
    selectedBuilding?: SelectedBuildingState | null
    onToggleNewBuildingAreas?: () => void
  }

  let {
    count = 0,
    allowMultipleExpanded = true,
    legendEntries = [],
    selectedLegendLabel,
    hoveredLegendLabel,
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
  class="max-w-full w-sm
    flex flex-col gap-1 overflow-auto text-white"
>
  <AboutPanel bind:expanded={aboutExpanded} {count} />
  <NewBuildingsPanel
    bind:expanded={newBuildingsExpanded}
    {showNewBuildingClusters}
    onToggle={onToggleNewBuildingAreas}
  />
  <LegendPanel
    bind:expanded={legendExpanded}
    entries={legendEntries}
    selectedLabel={selectedLegendLabel}
    hoveredLabel={hoveredLegendLabel}
    {hoveredBuildingYear}
  />
  <InfoPanel bind:expanded={infoExpanded} {detailsEnabled} {selectedBuilding} />
</div>
