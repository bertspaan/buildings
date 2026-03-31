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
  class="grid grid-flow-col max-sm:grid-flow-row max-sm:grid-cols-1 max-sm:grid-rows-none
    grid-rows-6 gap-x-3 gap-y-1"
>
  {#each entries as entry}
    <div
      class={[
        'grid items-center rounded-[0.45rem] border grid-cols-[0.85rem_1fr] gap-1.25 px-[0.14rem] py-[0.08rem] text-[0.76rem]',
        selectedLabel === entry.label
          ? 'border-white/80 bg-white/8'
          : hoveredLabel === entry.label
            ? 'border-white/55 bg-white/4'
            : 'border-transparent'
      ]}
    >
      <span
        class="block h-[0.9rem] w-[0.9rem] rounded-full border border-white/15"
        style={`background:${entry.color}`}
      ></span>
      <span class="text-white/80">{entry.label}</span>
    </div>
  {/each}
</div>
