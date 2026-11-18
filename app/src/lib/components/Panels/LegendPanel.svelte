<script lang="ts">
  import LegendGrid from '$lib/components/Panels/LegendGrid.svelte'
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
  const collapsedLegendText = $derived(
    detailsEnabled && collapsedLegendYear
      ? String(collapsedLegendYear)
      : undefined
  )
  const hasActiveSwatch = $derived(
    !!collapsedLegendText &&
      entries.some((entry) => entry.label === collapsedLegendLabel)
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
</script>

<Panel bind:expanded>
  {#snippet header()}
    Legend
  {/snippet}

  {#snippet controls()}
    {#if !expanded}
      <div class="legend-container">
        <div
          class="collapsed-legend"
          class:has-active={hasActiveSwatch}
          style:--entry-count={entries.length || 1}
        >
          {#each entries as entry (entry.label)}
            {@const isActive =
              collapsedLegendLabel === entry.label && !!collapsedLegendText}
            <div
              class="legend-swatch"
              class:active={isActive}
              style:background={entry.color}
              title={entry.label}
            >
              <span
                class="legend-year"
                aria-hidden={!isActive}
                style:color={getContrastTextColor(entry.color)}
              >
                {isActive ? collapsedLegendText : ''}
              </span>
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

<style>
  .legend-container {
    container-type: inline-size;
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .collapsed-legend {
    --pill-extra: 0px;
    --swatch-gap: clamp(
      4px,
      calc(
        (100cqw - var(--entry-count) * 20px - var(--pill-extra)) /
          max(1, var(--entry-count) - 1)
      ),
      8px
    );
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--swatch-gap);
    min-width: max-content;
    height: 20px;
    transition: gap 200ms ease;
  }
  .collapsed-legend.has-active {
    --pill-extra: 28px;
  }
  .legend-swatch {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    overflow: hidden;
    border: 1px solid #ffffff26;
    border-radius: 9999px;
    transition: width 200ms ease;
  }
  .legend-swatch.active {
    width: 48px;
  }
  .legend-year {
    flex: none;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .legend-swatch.active .legend-year {
    opacity: 1;
    transition-delay: 70ms;
  }
  @media (prefers-reduced-motion: reduce) {
    .collapsed-legend,
    .legend-swatch,
    .legend-year {
      transition: none;
    }
  }
</style>
