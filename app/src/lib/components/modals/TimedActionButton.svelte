<script lang="ts">
  import { onMount } from 'svelte'

  type Props = {
    label: string
    timeoutMs?: number
    onAction?: () => void
  }

  let { label, timeoutMs = 3000, onAction = () => {} }: Props = $props()
  let button = $state<HTMLButtonElement>()
  let progress = $state(0)
  let frameId = 0
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let fired = false

  function triggerAction() {
    if (fired) {
      return
    }

    fired = true

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (frameId) {
      cancelAnimationFrame(frameId)
    }

    onAction()
  }

  onMount(() => {
    button?.focus()

    const start = performance.now()

    const tick = (now: number) => {
      progress = Math.min((now - start) / timeoutMs, 1)

      if (progress < 1 && !fired) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    timeoutId = setTimeout(() => {
      progress = 1
      triggerAction()
    }, timeoutMs)

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  })
</script>

<button
  type="button"
  bind:this={button}
  class="relative mt-5 cursor-pointer overflow-hidden rounded-full bg-white/10 px-5 py-3
    text-sm font-medium tracking-[0.06em] text-white transition hover:bg-white/14"
  onclick={triggerAction}
>
  <span
    class="absolute inset-y-0 left-0 bg-white/12"
    style:width={`${progress * 100}%`}
  ></span>
  <span class="relative z-1">{label}</span>
</button>
