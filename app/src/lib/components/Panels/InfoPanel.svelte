<script lang="ts">
  import {
    PUBLIC_BUILDING_ADDRESS_LOOKUP_DATA_URL,
    PUBLIC_BUILDING_ADDRESS_LOOKUP_INDEX_URL,
    PUBLIC_BUILDING_ADDRESS_LOOKUP_URL
  } from '$env/static/public'

  import Panel from '$lib/components/Panel.svelte'

  import type { SelectedBuildingState } from '$lib/viewer-types.js'

  type LookupBucketIndex = Record<
    string,
    {
      offset: number
      length: number
      count: number
    }
  >

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
  let displayedBuilding = $state<SelectedBuildingState | null>(null)
  let addressCount = $state(0)
  let addresses = $state<string[]>([])
  let isFetching = $state(false)
  let error = $state('')
  let showAllAddresses = $state(false)
  let loadId = 0

  const maxPopupAddresses = 5
  let bucketIndexPromise: Promise<LookupBucketIndex> | undefined

  $effect(() => {
    const identificatie = selectedBuilding?.local.identificatie

    if (!identificatie || !detailsEnabled) {
      displayedBuilding = selectedBuilding
      addressCount = 0
      addresses = []
      isFetching = false
      error = ''
      showAllAddresses = false
      return
    }

    const currentLoadId = ++loadId
    isFetching = true
    ;(async () => {
      try {
        const nextAddresses = await fetchAddressesForPand(identificatie)

        if (currentLoadId !== loadId) {
          return
        }

        displayedBuilding = selectedBuilding
        addresses = nextAddresses
        addressCount = nextAddresses.length
        error = ''
        showAllAddresses = false
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

  function getLookupBucketKey(pandId: string): string {
    let hash = 2166136261

    for (let index = 0; index < pandId.length; index += 1) {
      hash ^= pandId.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }

    return (hash >>> 20).toString(16).padStart(3, '0')
  }

  async function loadLookupIndex(): Promise<LookupBucketIndex> {
    if (!PUBLIC_BUILDING_ADDRESS_LOOKUP_INDEX_URL) {
      throw new Error('Address lookup index URL is not configured.')
    }

    bucketIndexPromise ??= fetch(PUBLIC_BUILDING_ADDRESS_LOOKUP_INDEX_URL, {
      headers: {
        accept: 'application/json'
      }
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Address lookup index request failed with status ${response.status}`
        )
      }

      return (await response.json()) as LookupBucketIndex
    })

    return bucketIndexPromise
  }

  async function fetchByteRange(url: string, start: number, length: number) {
    const end = start + length - 1
    const response = await fetch(url, {
      headers: {
        Range: `bytes=${start}-${end}`
      }
    })

    if (!(response.ok || response.status === 206)) {
      throw new Error(`Range request failed with status ${response.status}`)
    }

    return await response.text()
  }

  function findLookupLine(
    lookupText: string,
    pandId: string
  ): string | undefined {
    return lookupText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${pandId}\t`))
  }

  async function fetchAddressesForPand(pandId: string): Promise<string[]> {
    if (
      !PUBLIC_BUILDING_ADDRESS_LOOKUP_DATA_URL ||
      !PUBLIC_BUILDING_ADDRESS_LOOKUP_URL
    ) {
      throw new Error('Address lookup URLs are not configured.')
    }

    const bucketIndex = await loadLookupIndex()
    const bucketKey = getLookupBucketKey(pandId)
    const bucket = bucketIndex[bucketKey]

    if (!bucket || bucket.length === 0) {
      return []
    }

    const lookupText = await fetchByteRange(
      PUBLIC_BUILDING_ADDRESS_LOOKUP_URL,
      bucket.offset,
      bucket.length
    )

    const lookupLine = findLookupLine(lookupText, pandId)

    if (!lookupLine) {
      return []
    }

    const [, offsetRaw, lengthRaw] = lookupLine.split('\t')
    const offset = Number.parseInt(offsetRaw ?? '', 10)
    const length = Number.parseInt(lengthRaw ?? '', 10)

    if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) {
      return []
    }

    const payloadText = await fetchByteRange(
      PUBLIC_BUILDING_ADDRESS_LOOKUP_DATA_URL,
      offset,
      length
    )

    return JSON.parse(payloadText) as string[]
  }

  function getVisibleAddresses(): string[] {
    if (showAllAddresses) return addresses
    const remaining = addresses.length - maxPopupAddresses
    if (remaining < 3) return addresses
    return addresses.slice(0, maxPopupAddresses)
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
    if (!displayedBuilding?.location) {
      return null
    }

    const { lat, lng } = displayedBuilding.location
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
    const identificatie = displayedBuilding?.local.identificatie?.trim()

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
    {:else if displayedBuilding && addresses.length > 0}
      {addresses[0]}
    {:else if expanded}
      Building details
    {:else}
      Click on a building for details
    {/if}
  {/snippet}

  {#snippet contents()}
    {#if displayedBuilding}
      <div class="grid grid-cols-2 gap-2">
        <span class="text-white/70">BAG ID</span>
        <a
          class="wrap-break-words text-white underline"
          href={getBagObjectUrl()}
          target="_blank"
          rel="noreferrer"
        >
          {formatValue(displayedBuilding.local.identificatie)}
        </a>

        <span class="text-white/70">Year of construction</span>
        <span class="wrap-break-words"
          >{formatValue(displayedBuilding.local.bouwjaar)}</span
        >
      </div>

      <div class="my-1 h-px bg-white/12"></div>

      {@const mapLinks = getMapLinks()}
      {#if mapLinks}
        <div class="mt-3 flex flex-wrap gap-2">
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
          <a
            class="text-white underline"
            href={mapLinks.allmapsHere}
            target="_blank"
            rel="noreferrer">Allmaps Here</a
          >
        </div>
      {/if}

      {#if addresses.length > 1}
        <div class="my-1 h-px bg-white/12"></div>
        <div class="mb-2 flex items-baseline justify-between gap-3">
          <span class="font-bold">All addresses</span>

          <div
            class="border border-white/50 bg-white/20 rounded-full px-2 py-0.5 text-xs"
          >
            {formatValue(addressCount)}
          </div>
        </div>

        <div class="grid gap-1.5 max-h-30 sm:max-h-90 overflow-y-auto">
          {#each getVisibleAddresses() as address}
            <div class="leading-4">{address}</div>
          {/each}
        </div>

        {#if getRemainingAddressCount() > 0}
          <button
            type="button"
            class="mt-3 cursor-pointer border-0 p-0 underline"
            onclick={() => {
              showAllAddresses = true
            }}
          >
            Show {getRemainingAddressCount()} more addresses
          </button>
        {/if}
      {/if}

      {#if error}
        <div class="mt-3 text-red-600">{error}</div>
      {/if}
    {:else}
      <div>Click on a building to see its details.</div>
    {/if}
  {/snippet}
</Panel>
