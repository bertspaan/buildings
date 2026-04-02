<script lang="ts">
  import type { LegendEntry } from '$lib/viewer-types.js'

  type Props = {
    entries?: LegendEntry[]
    selectedLabel?: string
    hoveredLabel?: string
  }

  let { entries = [], selectedLabel, hoveredLabel }: Props = $props()
</script>

<div
  class="grid grid-flow-col
    grid-rows-6 gap-x-3 gap-y-1"
>
  {#each entries as entry}
    <div
      class={[
        'grid items-center rounded-xl border grid-cols-[auto_1fr] gap-2 px-1 py-0',
        selectedLabel === entry.label
          ? 'border-white/80 bg-white/8'
          : hoveredLabel === entry.label
            ? 'border-white/55 bg-white/4'
            : 'border-transparent'
      ]}
    >
      <span
        class="block size-4 rounded-full border border-white/15"
        style:background={entry.color}
      ></span>
      <span>{entry.label}</span>
    </div>
  {/each}
</div>
