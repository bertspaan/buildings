<script lang="ts">
  import LegendGrid from '$lib/components/LegendGrid.svelte'
  import Panel from '$lib/components/Panel.svelte'

  import type { LegendEntry } from '$lib/viewer-types.js'

  type Props = {
    entries?: LegendEntry[]
    selectedLabel?: string
    hoveredLabel?: string
    selectedBuildingYear?: number
    hoveredBuildingYear?: number
    detailsEnabled?: boolean
    expanded?: boolean
  }

  let {
    entries = [],
    selectedLabel,
    hoveredLabel,
    selectedBuildingYear,
    hoveredBuildingYear,
    detailsEnabled = false,
    expanded = $bindable(false)
  }: Props = $props()

  const collapsedLegendLabel = $derived(hoveredLabel ?? selectedLabel)
  const collapsedLegendYear = $derived(
    hoveredBuildingYear ?? selectedBuildingYear
  )

  function getContrastTextColor(backgroundColor: string): string {
    const normalized = backgroundColor.trim().replace('#', '')
    const hex =
      normalized.length === 3
        ? normalized
            .split('')
            .map((channel) => channel + channel)
            .join('')
        : normalized

    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      return '#ffffff'
    }

    const red = Number.parseInt(hex.slice(0, 2), 16)
    const green = Number.parseInt(hex.slice(2, 4), 16)
    const blue = Number.parseInt(hex.slice(4, 6), 16)
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

    return luminance > 0.62 ? '#111111' : '#ffffff'
  }

  function getCollapsedLegendText(): string | undefined {
    if (detailsEnabled && collapsedLegendYear) {
      return String(collapsedLegendYear)
    }

    return undefined
  }
</script>

<Panel bind:expanded>
  {#snippet header()}
    Legend
  {/snippet}

  {#snippet controls()}
    {#if !expanded}
      <div
        class="grid w-full min-w-0 max-w-full auto-cols-auto grid-flow-col items-center gap-1"
      >
        {#each entries as entry}
          {@const isActive = collapsedLegendLabel === entry.label}
          {@const collapsedLegendText = getCollapsedLegendText()}
          <div
            class={[
              'w-auto flex h-5 items-center justify-center rounded-full border border-white/15 p-1',
              'transition-all',
              isActive && collapsedLegendText ? 'px-0' : ''
            ]}
            style:background={entry.color}
          >
            {#if isActive && collapsedLegendText}
              <span
                class="text-xs font-medium"
                style:color={getContrastTextColor(entry.color)}
              >
                {collapsedLegendText}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet contents()}
    <LegendGrid {entries} {selectedLabel} {hoveredLabel} />
  {/snippet}
</Panel>
