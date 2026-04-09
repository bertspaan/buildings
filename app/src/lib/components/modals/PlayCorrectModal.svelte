<script lang="ts">
  import Modal from './Modal.svelte'
  import TimedActionButton from './TimedActionButton.svelte'

  type Props = {
    cityName: string
    onContinue?: () => void
  }

  let { cityName, onContinue = () => {} }: Props = $props()
</script>

<Modal>
  {#snippet children()}
    <h2 class="text-2xl font-semibold tracking-[0.04em]">Correct!</h2>
    <p class="mt-2 text-sm text-white/70">
      This city was <span class="font-medium text-white">{cityName}</span>.
    </p>
    <TimedActionButton
      label="Continue"
      timeoutMs={2500}
      onAction={onContinue}
    />
  {/snippet}
</Modal>
