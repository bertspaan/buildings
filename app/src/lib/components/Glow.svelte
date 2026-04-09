<script lang="ts">
  import type { Snippet } from 'svelte'

  type Props = {
    enableHover?: boolean
    children: Snippet
  }

  let { enableHover = false, children }: Props = $props()

  const colors = [
    '#a50026',
    '#d73027',
    '#f46d43',
    '#fdae61',
    '#fee090',
    '#ffffbf',
    '#e0f3f8',
    '#abd9e9',
    '#74add1',
    '#4a7fbe',
    '#3a5fa8'
  ]

  function conicGradient(angle: number) {
    return `conic-gradient(from ${angle}deg, ${[...colors, colors[0]].join(', ')})`
  }

  const gradient = conicGradient(0)
  const gradientHover = conicGradient(180)
</script>

<div
  class="glow isolate relative rounded-xl z-10 bg-black text-white pointer-events-auto font-bold p-1"
  data-enable-hover={enableHover}
  style:--glow-gradient={gradient}
  style:--glow-gradient-hover={gradientHover}
>
  <div class="overflow-hidden rounded-xl bg-black">
    {@render children()}
  </div>
</div>

<style scoped>
  .glow {
    transition: all 0.3s ease;
  }

  .glow::before {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: inherit;
    background: var(--glow-gradient);
    filter: blur(5px);
    z-index: -1;
    transition: all 0.3s ease;
  }

  .glow[data-enable-hover='true']:hover {
    scale: 1.05;
  }

  .glow[data-enable-hover='true']:hover::before {
    inset: -10px;
    background: var(--glow-gradient-hover);
    filter: blur(10px);
  }
</style>
