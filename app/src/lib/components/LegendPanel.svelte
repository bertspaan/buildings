<script lang="ts">
  import LegendGrid from '$lib/components/LegendGrid.svelte'
  import Panel from '$lib/components/Panel.svelte'

  import type { LegendEntry } from '$lib/viewer-types.js'

  type Props = {
    entries?: LegendEntry[]
    selectedLabel?: string
    hoveredLabel?: string
    hoveredBuildingYear?: number
    expanded?: boolean
  }

  let {
    entries = [],
    selectedLabel,
    hoveredLabel,
    hoveredBuildingYear,
    expanded = $bindable(false)
  }: Props = $props()

  const collapsedLegendLabel = $derived(hoveredLabel ?? selectedLabel)

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

  function getCollapsedLegendText(label: string): string {
    if (label === hoveredLabel && hoveredBuildingYear) {
      return String(hoveredBuildingYear)
    }

    return label
  }
</script>

<Panel bind:expanded>
  {#snippet header()}
    {#if expanded}
      Legend
    {:else}
      <div class="contents">
        <div>Legend</div>
        <div
          class="grid w-full auto-cols-auto grid-flow-col items-center gap-1"
        >
          {#each entries as entry}
            <div
              class={`flex h-5 items-center overflow-hidden rounded-full border border-white/15 transition-all duration-200 ${
                collapsedLegendLabel === entry.label
                  ? 'w-auto max-w-full px-1.5'
                  : 'w-5'
              }`}
              style={`background:${entry.color}`}
            >
              {#if collapsedLegendLabel === entry.label}
                <span
                  class="pr-0.5 text-[0.72rem] font-medium whitespace-nowrap"
                  style={`color:${getContrastTextColor(entry.color)}`}
                >
                  {getCollapsedLegendText(entry.label)}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet contents()}
    <LegendGrid {entries} {selectedLabel} {hoveredLabel} />
  {/snippet}
</Panel>
