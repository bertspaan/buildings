<script lang="ts">
  import PlusIcon from 'phosphor-svelte/lib/PlusIcon'
  import MinusIcon from 'phosphor-svelte/lib/MinusIcon'

  import type { Snippet } from 'svelte'

  type Props = {
    header: Snippet
    controls?: Snippet
    contents: Snippet
    expanded?: boolean
    disabled?: boolean
  }

  let {
    header,
    controls,
    contents,
    expanded = $bindable(false),
    disabled = false
  }: Props = $props()

  function handleExpandClick(event: MouseEvent): void {
    if (!disabled) {
      expanded = !expanded
    }

    event.stopPropagation()
  }
</script>

{#snippet toggleExpanded(children: Snippet)}
  <button
    type="button"
    class="cursor-pointer w-full text-left"
    onclick={handleExpandClick}
    {disabled}
  >
    {@render children()}
  </button>
{/snippet}

<section
  class={[
    'pointer-events-auto font-medium text-white leading-tight overflow-hidden shrink-0',
    'rounded-xl border border-white/20 bg-black/70 backdrop-blur-xl transition-all',
    disabled && 'border-white/10'
  ]}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="grid grid-cols-[auto_1fr_auto] hover:bg-white/5 transition-colors
      gap-3 px-3 py-2 cursor-pointer"
    onclick={handleExpandClick}
  >
    <div class="contents">
      {@render toggleExpanded(header)}
    </div>
    <div>
      {#if controls}
        {@render controls()}
      {/if}
    </div>

    <button
      type="button"
      class="cursor-pointer"
      onclick={handleExpandClick}
      {disabled}
    >
      <div class="shrink-0 text-white/70 font-bold">
        {#if expanded || disabled}
          <MinusIcon weight="bold" />
        {:else}
          <PlusIcon weight="bold" />
        {/if}
      </div>
    </button>
  </div>

  {#if expanded && !disabled}
    <div
      class="border-t border-white/20 leading-normal text-white/80
        px-3 py-2"
    >
      {@render contents()}
    </div>
  {/if}
</section>
