<script lang="ts">
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
</script>

{#snippet toggleExpanded(children: Snippet)}
  <button
    type="button"
    class="cursor-pointer w-full text-left"
    onclick={() => {
      if (!disabled) {
        expanded = !expanded
      }
    }}
    {disabled}
  >
    {@render children()}
  </button>
{/snippet}

<section
  class={[
    'pointer-events-auto text-sm font-medium text-white leading-tight overflow-hidden',
    'rounded-xl border border-white/20 bg-black/70 backdrop-blur-xl transition-all',
    disabled && 'border-white/10'
  ]}
>
  <div
    class="grid grid-cols-[auto_1fr_auto] hover:bg-white/5 transition-colors
      gap-3 px-2 py-1 sm:px-3 sm:py-2"
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
      onclick={() => {
        if (!disabled) {
          expanded = !expanded
        }
      }}
      {disabled}
    >
      <div class="shrink-0 text-sm text-white/70 font-bold">
        {#if disabled}
          —
        {:else}
          {expanded ? '−' : '+'}
        {/if}
      </div>
    </button>
  </div>

  {#if expanded && !disabled}
    <div
      class="border-t border-white/20 text-sm leading-normal text-white/80
        px-2 py-1 sm:px-3 sm:py-2"
    >
      {@render contents()}
    </div>
  {/if}
</section>
