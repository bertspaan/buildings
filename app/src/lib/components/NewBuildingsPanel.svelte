<script lang="ts">
  import Panel from '$lib/components/Panel.svelte'

  type Props = {
    showNewBuildingClusters?: boolean
    onToggle?: () => void
    expanded?: boolean
  }

  let {
    showNewBuildingClusters = false,
    onToggle = () => {},
    expanded = $bindable(false)
  }: Props = $props()
</script>

<Panel bind:expanded>
  {#snippet header()}
    <div class="flex w-full items-center justify-between gap-2">
      <div>New building clusters since 2015</div>
      <button
        type="button"
        class={[
          'cursor-pointer rounded-lg border border-white px-3 py-0.5 text-xs',
          showNewBuildingClusters
            ? 'bg-white text-black'
            : 'bg-white/8 text-white hover:bg-white/12'
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
      This map looked different in 2015, when the
      <a
        href="https://code.waag.org/buildings/"
        target="_blank"
        rel="noreferrer"
        class="text-white underline"
      >
        first version
      </a>
      of this map was last updated. Toggle this layer to see where clusters of new
      buildings have appeared since then, and explore the urban development of Dutch
      cities.
    </div>
  {/snippet}
</Panel>
