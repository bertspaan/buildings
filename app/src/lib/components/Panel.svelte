<script lang="ts">
  import type { Snippet } from 'svelte'

  type Props = {
    header: Snippet
    contents: Snippet
    expanded?: boolean
    disabled?: boolean
  }

  let {
    header,
    contents,
    expanded = $bindable(false),
    disabled = false
  }: Props = $props()
</script>

<section
  class={[
    'pointer-events-auto',
    'rounded-xl border border-white/20 bg-black/70 backdrop-blur-xl transition-all',
    disabled && 'border-white/10'
  ]}
>
  <button
    type="button"
    class="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left
    cursor-pointer overflow-hidden"
    onclick={() => {
      if (!disabled) {
        expanded = !expanded
      }
    }}
    {disabled}
  >
    <div class="contents text-sm font-medium text-white leading-tight">
      {@render header()}
    </div>
    <div class="shrink-0 text-sm text-white/70 font-bold">
      {#if disabled}
        —
      {:else}
        {expanded ? '−' : '+'}
      {/if}
    </div>
  </button>

  {#if expanded && !disabled}
    <div
      class="border-t border-white/20 px-3 pb-3 pt-2 text-sm leading-normal text-white/80"
    >
      {@render contents()}
    </div>
  {/if}
</section>
