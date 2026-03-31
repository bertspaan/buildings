<script lang="ts">
  import Panel from '$lib/components/Panel.svelte'

  import type {
    BagPandFeature,
    BagVerblijfsobjectFeature,
    SelectedBuildingState
  } from '$lib/viewer-types.js'

  type Props = {
    detailsEnabled?: boolean
    selectedBuilding?: SelectedBuildingState | null
    expanded?: boolean
  }

  let {
    detailsEnabled = false,
    selectedBuilding = null,
    expanded = $bindable(false)
  }: Props = $props()
  let bagFeature = $state<BagPandFeature>()
  let addresses = $state<string[]>([])
  let isFetching = $state(false)
  let error = $state('')
  let showAllAddresses = $state(false)
  let loadId = 0

  const maxPopupAddresses = 5

  $effect(() => {
    const identificatie = selectedBuilding?.local.identificatie

    bagFeature = undefined
    addresses = []
    isFetching = false
    error = ''
    showAllAddresses = false

    if (!identificatie || !detailsEnabled) {
      return
    }

    const currentLoadId = ++loadId
    isFetching = true
    ;(async () => {
      try {
        const nextBagFeature = await fetchBagPand(identificatie)
        const nextAddresses = await fetchAddressesForPand(nextBagFeature)

        if (currentLoadId !== loadId) {
          return
        }

        bagFeature = nextBagFeature
        addresses = nextAddresses
        isFetching = false
      } catch (cause) {
        if (currentLoadId !== loadId) {
          return
        }

        error =
          cause instanceof Error
            ? cause.message
            : 'BAG gegevens konden niet worden geladen.'
        isFetching = false
      }
    })()
  })

  function formatValue(value: unknown): string {
    if (!value) {
      return 'Onbekend'
    }

    return String(value)
  }

  function formatAddress(
    feature: BagVerblijfsobjectFeature
  ): string | undefined {
    const properties = feature.properties
    if (!properties) {
      return undefined
    }

    const street = properties.openbare_ruimte_naam
    const houseNumber = properties.huisnummer
    const houseLetter = properties.huisletter ?? ''
    const addition = properties.toevoeging ?? ''
    const postcode = properties.postcode
    const city = properties.woonplaats_naam

    if (!street || houseNumber === null || houseNumber === undefined) {
      return undefined
    }

    const line1 = `${street} ${houseNumber}${houseLetter}${addition}`
    const line2 = [postcode, city].filter(Boolean).join(' ')
    return [line1, line2].filter(Boolean).join(', ')
  }

  async function fetchBagPand(
    identificatie: string
  ): Promise<BagPandFeature | undefined> {
    const url = new URL(
      `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?f=json&limit=1&identificatie=${identificatie}`
    )

    const response = await fetch(url, {
      headers: {
        accept: 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`BAG API request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as { features?: BagPandFeature[] }
    return payload.features?.[0]
  }

  async function fetchBagVerblijfsobject(
    url: string
  ): Promise<BagVerblijfsobjectFeature | undefined> {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`BAG API request failed with status ${response.status}`)
    }

    return (await response.json()) as BagVerblijfsobjectFeature
  }

  async function fetchAddressesForPand(
    nextBagFeature?: BagPandFeature
  ): Promise<string[]> {
    const urls = nextBagFeature?.properties?.['verblijfsobject.href'] ?? []
    if (urls.length === 0) {
      return []
    }

    const features = await Promise.all(
      urls.map((url: string) => fetchBagVerblijfsobject(url))
    )

    const nextAddresses = features
      .map((feature: BagVerblijfsobjectFeature | undefined) =>
        feature ? formatAddress(feature) : undefined
      )
      .filter((address: string | undefined): address is string =>
        Boolean(address)
      )

    return [...new Set(nextAddresses)]
  }

  function getVisibleAddresses(): string[] {
    return showAllAddresses ? addresses : addresses.slice(0, maxPopupAddresses)
  }

  function getRemainingAddressCount(): number {
    return Math.max(0, addresses.length - getVisibleAddresses().length)
  }

  function getMapLinks(): {
    allmapsHere: string
    openStreetMap: string
    googleMaps: string
    streetView: string
  } | null {
    if (!selectedBuilding?.location) {
      return null
    }

    const { lat, lng } = selectedBuilding.location
    const latString = lat.toFixed(6)
    const lngString = lng.toFixed(6)

    return {
      allmapsHere: `https://here.allmaps.org/?position=${latString},${lngString}`,
      openStreetMap: `https://www.openstreetmap.org/?mlat=${latString}&mlon=${lngString}#map=19/${latString}/${lngString}`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${latString},${lngString}`,
      streetView: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latString},${lngString}`
    }
  }

  function getBagObjectUrl(): string {
    const directUrl = bagFeature?.properties?.rdf_seealso?.trim()

    if (directUrl) {
      return directUrl.replace(/^http:\/\//, 'https://')
    }

    const identificatie = selectedBuilding?.local.identificatie?.trim()

    if (identificatie) {
      return `https://bag.basisregistraties.overheid.nl/bag/id/pand/${identificatie}`
    }

    return 'https://bag.basisregistraties.overheid.nl/'
  }
</script>

<Panel bind:expanded disabled={!detailsEnabled}>
  {#snippet header()}
    {#if !detailsEnabled}
      Zoom in to see building details
    {:else if selectedBuilding && addresses.length > 0}
      {addresses[0]}
    {:else if expanded}
      Building details
    {:else}
      Click on a building for details
    {/if}
  {/snippet}

  {#snippet contents()}
    {#if selectedBuilding}
      <div class="grid gap-1.5">
        <div class="grid grid-cols-[8rem_1fr] gap-2.5 text-[0.83rem]">
          <span class="text-white/70">BAG ID</span>
          <a
            class="wrap-break-words text-white underline"
            href={getBagObjectUrl()}
            target="_blank"
            rel="noreferrer"
          >
            {formatValue(selectedBuilding.local.identificatie)}
          </a>
        </div>
        <div class="grid grid-cols-[8rem_1fr] gap-2.5 text-[0.83rem]">
          <span class="text-white/70">Year of construction</span>
          <span class="wrap-break-words"
            >{formatValue(selectedBuilding.local.bouwjaar)}</span
          >
        </div>
      </div>
      {#if addresses.length > 1}
        <div class="mb-2 flex items-baseline justify-between gap-3">
          <div class="text-[0.8rem] uppercase tracking-[0.04em] text-white/70">
            All addresses
          </div>
          <div class="text-[0.82rem] text-white/85">
            {formatValue(
              bagFeature?.properties?.aantal_verblijfsobjecten ??
                bagFeature?.properties?.['verblijfsobject.href']?.length
            )}
          </div>
        </div>

        <div class="grid gap-1.5">
          {#each getVisibleAddresses() as address}
            <div class="text-[0.82rem] leading-[1.35]">{address}</div>
          {/each}
        </div>

        {#if getRemainingAddressCount() > 0}
          <button
            type="button"
            class="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[0.8rem] text-white underline"
            onclick={() => {
              showAllAddresses = true
            }}
          >
            Show {getRemainingAddressCount()} more address{getRemainingAddressCount() ===
            1
              ? ''
              : 'es'}
          </button>
        {/if}

        {@const mapLinks = getMapLinks()}
        {#if mapLinks}
          <div class="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[0.8rem]">
            <a
              class="text-white underline"
              href={mapLinks.allmapsHere}
              target="_blank"
              rel="noreferrer">Allmaps Here</a
            >
            <a
              class="text-white underline"
              href={mapLinks.openStreetMap}
              target="_blank"
              rel="noreferrer">OpenStreetMap</a
            >
            <a
              class="text-white underline"
              href={mapLinks.streetView}
              target="_blank"
              rel="noreferrer">Google Street View</a
            >
          </div>
        {/if}

        <div class="my-3 h-px bg-white/12"></div>
      {/if}

      {#if isFetching}
        <div class="mt-3 text-[0.78rem] text-white/70">Loading BAG data...</div>
      {/if}

      {#if error}
        <div class="mt-3 text-[0.78rem] text-[#ff9f9f]">{error}</div>
      {/if}
    {:else}
      <div>Click on a building to see its details.</div>
    {/if}
  {/snippet}
</Panel>
