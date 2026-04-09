<script lang="ts">
  import Panel from '$lib/components/Panel.svelte'
  import { formatCount } from '$lib/format.js'

  type Props = {
    buildingCount: number
    showNewBuildingClusters?: boolean
    onToggle?: () => void
    expanded?: boolean
  }

  let {
    buildingCount,
    showNewBuildingClusters = false,
    onToggle = () => {},
    expanded = $bindable(false)
  }: Props = $props()

  const buildingsCount2015 = 9_866_539
</script>

<Panel bind:expanded>
  {#snippet header()}
    Buildings built since 2015
  {/snippet}

  {#snippet controls()}
    <div class="text-right">
      <button
        type="button"
        class={[
          'cursor-pointer rounded-lg border border-[#4a7fbe] px-3 py-0.5 transition-all text-white',
          showNewBuildingClusters
            ? 'bg-[#3a5fa8]'
            : 'bg-none hover:bg-[#3a5fa8]/50'
        ]}
        onclick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        {showNewBuildingClusters ? 'Hide' : 'Show'}
      </button>
    </div>
  {/snippet}

  {#snippet contents()}
    <div>
      The Netherlands looked different in 2015, when the
      <a
        href="https://code.waag.org/buildings/"
        target="_blank"
        rel="noreferrer"
        class="text-white underline"
      >
        first version
      </a>
      of this map was last updated. According to the data, {formatCount(
        buildingCount - buildingsCount2015
      )} new buildings have been built since then. Toggle this layer to see where.
    </div>
  {/snippet}
</Panel>
