<script lang="ts">
  import { Combobox } from 'bits-ui'
  import CaretDoubleDownIcon from 'phosphor-svelte/lib/CaretDoubleDownIcon'
  import CaretDoubleUpIcon from 'phosphor-svelte/lib/CaretDoubleUpIcon'
  import CaretUpDownIcon from 'phosphor-svelte/lib/CaretUpDownIcon'
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon'
  import MapPinLineIcon from 'phosphor-svelte/lib/MapPinLineIcon'

  import playCities from '$lib/generated/play-cities.json'
  import woonplaatsNames from '$lib/generated/woonplaats-names.json'

  type Props = {
    value?: string
    placeholder?: string
    disabled?: boolean
    onSubmit?: (value: string) => void
  }

  type PlaceItem = {
    value: string
    label: string
  }

  const aliasNames = (playCities as Array<{ aliases?: string[] }>).flatMap(
    (city) => city.aliases ?? []
  )
  const allPlaceNames = [...new Set([...woonplaatsNames, ...aliasNames])].sort(
    (a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' })
  )

  const placeItems: PlaceItem[] = allPlaceNames.map((name) => ({
    value: name,
    label: name
  }))
  const maxVisibleItems = 8

  function normalizeForSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/['’.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getMatchScore(label: string, query: string): number {
    if (!query) {
      return 0
    }

    const normalizedLabel = normalizeForSearch(label)

    if (normalizedLabel === query) {
      return 5000
    }

    if (normalizedLabel.startsWith(query)) {
      return 4000 - normalizedLabel.length
    }

    const words = normalizedLabel.split(' ')

    if (words.some((word) => word === query)) {
      return 3000 - normalizedLabel.length
    }

    if (words.some((word) => word.startsWith(query))) {
      return 2000 - normalizedLabel.length
    }

    const index = normalizedLabel.indexOf(query)

    if (index >= 0) {
      return 1000 - index - normalizedLabel.length
    }

    return Number.NEGATIVE_INFINITY
  }

  let {
    value = $bindable(''),
    placeholder = 'Type a place name',
    disabled = false,
    onSubmit = () => {}
  }: Props = $props()

  let selectedValue = $state('')
  let open = $state(false)
  let searchValue = $state(value)

  const filteredItems = $derived.by(() => {
    const query = normalizeForSearch(searchValue)

    if (query === '') {
      return placeItems.slice(0, maxVisibleItems)
    }

    return placeItems
      .map((item) => ({
        item,
        score: getMatchScore(item.label, query)
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }

        if (a.item.label.length !== b.item.label.length) {
          return a.item.label.length - b.item.label.length
        }

        return a.item.label.localeCompare(b.item.label, 'nl')
      })
      .slice(0, maxVisibleItems)
      .map((entry) => entry.item)
  })

  $effect(() => {
    if (value !== searchValue) {
      searchValue = value
    }

    if (!value) {
      selectedValue = ''
      open = false
    }
  })

  $effect(() => {
    if (selectedValue && selectedValue !== value) {
      value = selectedValue
      searchValue = selectedValue
      open = false
    }
  })

  function submitValue() {
    const trimmedValue = value.trim()

    if (!trimmedValue || disabled) {
      return
    }

    onSubmit(trimmedValue)
  }
</script>

<form
  class="pointer-events-auto"
  onsubmit={(event) => {
    event.preventDefault()
    submitValue()
  }}
>
  <Combobox.Root
    type="single"
    items={filteredItems}
    inputValue={value}
    bind:value={selectedValue}
    bind:open
    {disabled}
    onOpenChangeComplete={(isOpen) => {
      if (!isOpen) {
        searchValue = value
      }
    }}
  >
    <div
      class="inline-flex items-center gap-2 rounded-full border border-white/15
        bg-black/70 px-2 py-2 text-white backdrop-blur-md"
    >
      <div class="flex items-center gap-2 pl-2 text-white/60">
        <MapPinLineIcon weight="bold" />
      </div>

      <div class="relative">
        <Combobox.Input
          oninput={(event) => {
            searchValue = event.currentTarget.value
            value = event.currentTarget.value
            selectedValue = ''
            if (!open) {
              open = true
            }
          }}
          autofocus
          class="max-w-full w-56 bg-transparent outline-none placeholder:text-white/40 sm:w-72"
          autocomplete="off"
          autocapitalize="words"
          spellcheck="false"
          {placeholder}
          aria-label="Place name"
        />
      </div>

      <Combobox.Trigger
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/60
          transition hover:bg-white/8 hover:text-white"
      >
        <CaretUpDownIcon weight="bold" />
      </Combobox.Trigger>

      <button
        type="submit"
        class="cursor-pointer rounded-full bg-white/8 px-3 py-2 font-medium
          tracking-[0.08em] text-white transition hover:bg-white/12 disabled:cursor-default
          disabled:opacity-50"
        disabled={disabled || !value.trim()}
      >
        Guess
      </button>
    </div>

    <Combobox.Portal>
      <Combobox.Content
        sideOffset={10}
        class="z-50 min-w-[var(--bits-combobox-anchor-width)] rounded-2xl border
          border-white/15 bg-black/90 p-1 text-white shadow-2xl backdrop-blur-xl
          data-[state=open]:animate-in data-[state=closed]:animate-out"
      >
        <Combobox.ScrollUpButton
          class="flex w-full items-center justify-center py-1 text-white/50"
        >
          <CaretDoubleUpIcon size={12} weight="bold" />
        </Combobox.ScrollUpButton>

        <Combobox.Viewport
          class="max-h-64 min-w-[var(--bits-combobox-anchor-width)] overflow-y-auto p-1"
        >
          {#each filteredItems as item (item.value)}
            <Combobox.Item
              value={item.value}
              label={item.label}
              class="outline-hidden flex h-10 w-full cursor-pointer items-center rounded-xl px-3
                data-highlighted:bg-white/10"
            >
              {#snippet children({ selected })}
                <span class="truncate">{item.label}</span>

                {#if selected}
                  <span class="ml-auto text-white/70">
                    <CheckIcon size={14} weight="bold" />
                  </span>
                {/if}
              {/snippet}
            </Combobox.Item>
          {:else}
            <div class="px-3 py-2 text-white/50">No places found.</div>
          {/each}
        </Combobox.Viewport>

        <Combobox.ScrollDownButton
          class="flex w-full items-center justify-center py-1 text-white/50"
        >
          <CaretDoubleDownIcon size={12} weight="bold" />
        </Combobox.ScrollDownButton>
      </Combobox.Content>
    </Combobox.Portal>
  </Combobox.Root>
</form>
