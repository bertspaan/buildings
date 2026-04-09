<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { Snippet } from 'svelte'

  type Props = {
    maxWidthClass?: string
    children: Snippet
  }

  let { maxWidthClass = 'max-w-sm', children }: Props = $props()
</script>

<div
  in:fade={{ duration: 180 }}
  out:fade={{ duration: 140 }}
  class="pointer-events-auto fixed inset-0 z-20 bg-black/20 backdrop-blur-sm"
></div>

<dialog
  open
  in:fade={{ duration: 180 }}
  out:fade={{ duration: 140 }}
  class={`pointer-events-auto fixed inset-0 z-21 m-auto w-[calc(100%-2rem)] ${maxWidthClass} rounded-3xl border border-white/15 bg-black/85 p-6 text-center text-white shadow-2xl outline-none`}
>
  {@render children?.()}
</dialog>
