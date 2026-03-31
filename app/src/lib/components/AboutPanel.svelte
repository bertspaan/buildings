<script lang="ts">
  import Panel from '$lib/components/Panel.svelte'

  let {
    count = 0,
    expanded = $bindable(true)
  }: {
    count?: number
    expanded?: boolean
  } = $props()

  function formatCount(value: number): string {
    return new Intl.NumberFormat('nl-NL').format(value)
  }
</script>

<Panel bind:expanded>
  {#snippet header()}
    <div class="font-bold">
      All {formatCount(count)} buildings in the Netherlands
    </div>
  {/snippet}

  {#snippet contents()}
    <div>
      This map shows all buildings in the Netherlands, colored by their year of
      construction. This map is made by <a
        href="https://bertspaan.nl"
        class="text-white underline"
        target="_blank">Bert Spaan</a
      >
      — it is a new version of
      <a
        href="https://code.waag.org/buildings/"
        target="_blank"
        rel="noreferrer"
        class="text-white underline"
      >
        the map I made in 2013
      </a>. The data comes from the
      <a
        href="https://www.kadaster.nl/zakelijk/registraties/basisregistraties/bag/over-bag"
        target="_blank"
        rel="noreferrer"
        class="text-white underline">BAG</a
      >, the Dutch building and addresses registry.
    </div>
  {/snippet}
</Panel>
