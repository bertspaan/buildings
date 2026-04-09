<script lang="ts">
  import { onMount } from 'svelte'

  import { trackEvent } from '$lib/analytics.js'

  import Modal from './Modal.svelte'
  import TimedActionButton from './TimedActionButton.svelte'

  type Props = {
    cityName: string
    correctCount: number
    onRestart?: () => void
  }

  let { cityName, correctCount, onRestart = () => {} }: Props = $props()

  onMount(() => {
    trackEvent('play_game_over', {
      correct_count: correctCount,
      incorrect_city: cityName
    })
  })
</script>

<Modal>
  {#snippet children()}
    <h2 class="text-2xl font-semibold tracking-[0.04em]">Game over</h2>
    <p class="mt-2 text-sm text-white/70">
      That was <span class="font-medium text-white">{cityName}</span>.
    </p>
    <TimedActionButton
      label="Start over"
      timeoutMs={4000}
      onAction={onRestart}
    />
  {/snippet}
</Modal>
