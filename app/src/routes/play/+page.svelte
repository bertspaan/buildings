<script lang="ts">
  import { base } from '$app/paths'
  import { onDestroy, onMount } from 'svelte'
  import { PUBLIC_WOONPLAATS_POLYGONS_PMTILES_URL } from '$env/static/public'

  import XIcon from 'phosphor-svelte/lib/XIcon'

  import Glow from '$lib/components/Glow.svelte'
  import PlayCityChoiceGrid from '$lib/components/PlayCityChoiceGrid.svelte'
  import PlayCorrectModal from '$lib/components/modals/PlayCorrectModal.svelte'
  import PlayGameOverModal from '$lib/components/modals/PlayGameOverModal.svelte'
  import PlayWonModal from '$lib/components/modals/PlayWonModal.svelte'

  import osmCenters from '$lib/generated/osm-woonplaats-centers.json'
  import originalCities from '$lib/generated/play-cities.json'
  import { mapState } from '$lib/map-state.svelte.js'

  import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl'

  type PlayCity = {
    rank: number
    name: string
    id: string
    addressCount: number
    center: [number, number]
    bounds: [number, number, number, number]
    aliases?: string[]
  }

  type OSMCenter = {
    bagId: string
  }
  type CityChoice = {
    id: string
    name: string
  }

  const citiesPerGame = 15
  const choicesPerRound = 6

  let cities = $state<PlayCity[]>(shuffleCities(originalCities as PlayCity[]))
  let cityIndex = $state(0)
  let isCorrect = $state(false)
  let isGameOver = $state(false)
  let hasWon = $state(false)
  let currentChoices = $state<CityChoice[]>([])
  const currentCity = $derived<PlayCity>(cities[cityIndex])

  const woonplaatsSourceId = 'play-woonplaats-polygons'
  const woonplaatsSourceLayer = 'woonplaats_polygons'
  const woonplaatsOtherAreasLayerId = 'play-woonplaats-other-areas'
  const woonplaatsHaloLayerId = 'play-woonplaats-halo'
  const woonplaatsOutlineLayerId = 'play-woonplaats-outline'

  function shuffleItems<T>(items: T[]): T[] {
    const shuffled = [...items]

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index]
      ]
    }

    return shuffled
  }

  function shuffleCities(cities: PlayCity[]): PlayCity[] {
    return shuffleItems(cities)
  }

  const osmCenterIds = new Set(
    (osmCenters as OSMCenter[]).map((center) => center.bagId)
  )

  const currentCenterSource = $derived<'osm' | 'bag'>(
    currentCity && osmCenterIds.has(currentCity.id) ? 'osm' : 'bag'
  )

  function applyCityToMapState(city?: PlayCity) {
    if (!city) {
      mapState.bounds = undefined
      mapState.center = undefined
      return
    }

    mapState.bounds = [...city.bounds] as [number, number, number, number]
    mapState.center = [...city.center] as [number, number]
  }

  function gotoNextCity() {
    if (cityIndex >= cities.length - 1) {
      hasWon = true
    } else {
      const nextIndex = cityIndex + 1
      const nextCity = cities[nextIndex]

      cityIndex = nextIndex
      applyCityToMapState(nextCity)
    }
  }

  function continueAfterCorrectGuess() {
    isCorrect = false
    gotoNextCity()
  }

  function startNewGame() {
    cities = shuffleCities(originalCities as PlayCity[]).slice(0, citiesPerGame)
    cityIndex = 0
    isCorrect = false
    isGameOver = false
    hasWon = false
    applyCityToMapState(cities[0])
  }

  function submitGuess(choiceName: string) {
    const correctCity = currentCity.name === choiceName

    if (!correctCity) {
      isGameOver = true
      return
    }

    isCorrect = true
  }

  function buildRoundChoices(city: PlayCity, roundIndex: number): CityChoice[] {
    const guessedCityIds = new Set(
      cities.slice(0, roundIndex).map((item) => item.id)
    )
    const distractorPool = (originalCities as PlayCity[]).filter(
      (item) => item.id !== city.id && !guessedCityIds.has(item.id)
    )

    const distractors = shuffleCities(distractorPool)
      .slice(0, choicesPerRound - 1)
      .map((item) => ({
        id: item.id,
        name: item.name
      }))

    return shuffleItems([{ id: city.id, name: city.name }, ...distractors])
  }

  function getCurrentWoonplaatsFilter(cityId?: string): FilterSpecification {
    return cityId
      ? [
          '==',
          ['to-string', ['coalesce', ['get', 'identificatie'], '']],
          cityId
        ]
      : ['==', ['get', 'identificatie'], '']
  }

  function ensurePlayMapLayers(map: MapLibreMap) {
    if (!map.getSource(woonplaatsSourceId)) {
      map.addSource(woonplaatsSourceId, {
        type: 'vector',
        url: `pmtiles://${PUBLIC_WOONPLAATS_POLYGONS_PMTILES_URL}`,
        maxzoom: 14
      })
    }

    if (!map.getLayer(woonplaatsOtherAreasLayerId)) {
      map.addLayer({
        id: woonplaatsOtherAreasLayerId,
        type: 'fill',
        source: woonplaatsSourceId,
        'source-layer': woonplaatsSourceLayer,
        minzoom: 5,
        filter: ['!=', ['get', 'identificatie'], ''],
        paint: {
          'fill-antialias': false,
          'fill-color': '#ffffff',
          'fill-opacity': 0.14
        }
      })
    }

    if (!map.getLayer(woonplaatsHaloLayerId)) {
      map.addLayer({
        id: woonplaatsHaloLayerId,
        type: 'line',
        source: woonplaatsSourceId,
        'source-layer': woonplaatsSourceLayer,
        minzoom: 5,
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 0.3,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 14, 8],
          'line-blur': 2
        }
      })
    }

    if (!map.getLayer(woonplaatsOutlineLayerId)) {
      map.addLayer({
        id: woonplaatsOutlineLayerId,
        type: 'line',
        source: woonplaatsSourceId,
        'source-layer': woonplaatsSourceLayer,
        minzoom: 5,
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 0.95,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 14, 3],
          'line-blur': 0.4
        }
      })
    }
  }

  function applyPlayMapState(map: MapLibreMap, city?: PlayCity) {
    ensurePlayMapLayers(map)

    const visibility = city ? 'visible' : 'none'
    const cityFilter = getCurrentWoonplaatsFilter(city?.id)

    if (map.getLayer(woonplaatsOtherAreasLayerId)) {
      map.setLayoutProperty(
        woonplaatsOtherAreasLayerId,
        'visibility',
        visibility
      )
      map.setFilter(woonplaatsOtherAreasLayerId, [
        '!=',
        ['to-string', ['coalesce', ['get', 'identificatie'], '']],
        city?.id ?? ''
      ])
      map.setPaintProperty(woonplaatsOtherAreasLayerId, 'fill-opacity', 0.14)
    }

    for (const layerId of [woonplaatsHaloLayerId, woonplaatsOutlineLayerId]) {
      if (!map.getLayer(layerId)) {
        continue
      }

      map.setLayoutProperty(layerId, 'visibility', visibility)
      map.setFilter(layerId, cityFilter)
    }
  }

  function removePlayMapLayers(map?: MapLibreMap) {
    if (!map) {
      return
    }

    for (const layerId of [
      woonplaatsOutlineLayerId,
      woonplaatsHaloLayerId,
      woonplaatsOtherAreasLayerId
    ]) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
    }

    if (map.getSource(woonplaatsSourceId)) {
      map.removeSource(woonplaatsSourceId)
    }
  }

  onMount(() => {
    startNewGame()
    mapState.boundsMode = 'cover'
    mapState.selectedBuilding = undefined
    mapState.hoveredLegendLabel = undefined
    mapState.hoveredBuildingYear = undefined
    mapState.showNewBuildingClusters = false
    mapState.interactive = false
  })

  onDestroy(() => {
    removePlayMapLayers(mapState.map)
    mapState.interactive = true
    mapState.boundsMode = 'contain'
    mapState.center = undefined
    mapState.bounds = undefined
  })

  $effect(() => {
    if (!currentCity) {
      return
    }

    currentChoices = buildRoundChoices(currentCity, cityIndex)
    applyCityToMapState(currentCity)
  })

  $effect(() => {
    const map = mapState.map
    const city = currentCity

    if (!map) {
      return
    }

    const apply = () => applyPlayMapState(map, city)

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
  })
</script>

<div class="h-full w-full flex flex-col justify-between p-2">
  <div
    class="grid grid-cols-[auto_auto_1fr] min-[400px]:grid-cols-[1fr_auto_1fr] gap-4 justify-items-center items-center"
  >
    <div
      class="bg-black text-white justify-self-start
        px-3 py-1 pointer-events-auto
        rounded-full
        transition-all
        shadow-[0_0_10px_rgba(255,255,255,1)]
    "
    >
      <span class="hidden sm:inline-block">Round</span>
      <span class="font-bold -tracking-wider"
        >{cityIndex + 1} / {cities.length}</span
      >
    </div>
    <div class="self-center pointer-events-auto">
      <Glow><h2 class="px-3 py-2">Which Dutch city is this?</h2></Glow>
    </div>
    <a
      class="bg-black p-2 pointer-events-auto justify-self-end
      text-white rounded-full
        transition-all
        shadow-[0_0_10px_rgba(255,255,255,1)]
        hover:shadow-[0_0_25px_rgba(255,255,255,1)]"
      href={`${base}/`}><XIcon class="size-4" weight="bold" /></a
    >
  </div>
  <div>
    <div
      class="pointer-events-none col-span-2 row-start-1 z-10 flex items-end justify-center"
    >
      <PlayCityChoiceGrid
        choices={currentChoices}
        disabled={isCorrect || isGameOver || hasWon}
        onSelect={(choice) => submitGuess(choice.name)}
      />
    </div>
  </div>
</div>

{#if isCorrect}
  <PlayCorrectModal
    cityName={currentCity.name}
    onContinue={continueAfterCorrectGuess}
  />
{/if}

{#if isGameOver}
  <PlayGameOverModal
    cityName={currentCity.name}
    correctCount={cityIndex}
    onRestart={startNewGame}
  />
{/if}

{#if hasWon}
  <PlayWonModal cityCount={cities.length} onRestart={startNewGame} />
{/if}
