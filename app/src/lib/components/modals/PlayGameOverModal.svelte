<script lang="ts">
  import Modal from './Modal.svelte'
  import TimedActionButton from './TimedActionButton.svelte'

  type Props = {
    cityName: string
    onRestart?: () => void
  }

  let { cityName, onRestart = () => {} }: Props = $props()
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
