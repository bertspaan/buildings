<script lang="ts">
  import { onMount } from 'svelte'

  import { trackEvent } from '$lib/analytics.js'

  import Modal from './Modal.svelte'
  import TimedActionButton from './TimedActionButton.svelte'

  type Props = {
    cityCount: number
    onRestart?: () => void
  }

  let { cityCount, onRestart = () => {} }: Props = $props()

  onMount(() => {
    trackEvent('play_won', {
      city_count: cityCount
    })
  })
</script>

<Modal>
  {#snippet children()}
    <h2 class="text-2xl font-semibold tracking-[0.04em]">You have won!</h2>
    <p class="mt-2 text-sm text-white/70">
      You guessed all <span class="font-medium text-white">{cityCount}</span>
      cities!
    </p>
    <TimedActionButton
      label="Play again"
      timeoutMs={4000}
      onAction={onRestart}
    />
  {/snippet}
</Modal>
