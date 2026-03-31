<script lang="ts">
  import './layout.css'
  import 'maplibre-gl/dist/maplibre-gl.css'

  import favicon from '$lib/assets/favicon.png'

  let { children } = $props()
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
