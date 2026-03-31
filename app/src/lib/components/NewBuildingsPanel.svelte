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
      <div>Areas built since 2015</div>
      <button
        type="button"
        class={[
          'cursor-pointer rounded-lg border border-[#4a7fbe] px-3 py-0.5 text-xs transition-all text-white',
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
      This map looked different in 2015, when the
      <a
        href="https://code.waag.org/buildings/"
        target="_blank"
        rel="noreferrer"
        class="text-white underline"
      >
        first version
      </a>
      of this map was last updated. Toggle this layer to see where new buildings have
      been built since then.
    </div>
  {/snippet}
</Panel>
