<script lang="ts">
  type Choice = {
    id: string
    name: string
  }

  type Props = {
    choices: Choice[]
    disabled?: boolean
    onSelect?: (choice: Choice) => void
  }

  let { choices = [], disabled = false, onSelect = () => {} }: Props = $props()
</script>

<div class="pointer-events-auto w-full max-w-2xl">
  <div class="grid grid-cols-2 gap-0.5 sm:gap-1 sm:grid-cols-3">
    {#each choices as choice (choice.id)}
      <button
        type="button"
        class="cursor-pointer rounded-2xl border border-white/15 bg-black/70 px-2 py-2
          font-medium text-white backdrop-blur-md transition-all hover:bg-white/10
          disabled:cursor-default disabled:opacity-50"
        {disabled}
        onclick={() => onSelect(choice)}
      >
        <span class="block truncate">{choice.name}</span>
      </button>
    {/each}
  </div>
</div>
