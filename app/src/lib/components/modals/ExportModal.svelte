<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl'
  import XIcon from 'phosphor-svelte/lib/XIcon'
  import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon'
  import {
    addExportTileTransition,
    exportCredit,
    exportCreditMargin,
    exportDimensions,
    exportSite,
    exportStyle,
    getExportCreditFontSize,
    renderMapExport,
    type ExportFormat
  } from '$lib/map-export.js'

  let { source, onclose }: { source: MapLibreMap; onclose: () => void } =
    $props()

  const sourceWidth = untrack(() => source.getContainer().clientWidth)
  const sourceHeight = untrack(() => source.getContainer().clientHeight)
  const aspects = [
    { id: 'view', label: 'Current view', ratio: sourceWidth / sourceHeight },
    { id: 'desktop', label: 'Desktop · 16:9', ratio: 16 / 9 },
    { id: 'ultrawide', label: 'Ultrawide · 21:9', ratio: 21 / 9 },
    { id: 'square', label: 'Square · 1:1', ratio: 1 },
    { id: 'photo', label: 'Photo · 3:2', ratio: 3 / 2 },
    { id: 'print', label: 'Print · 4:3', ratio: 4 / 3 },
    { id: 'portrait', label: 'Print · 3:4', ratio: 3 / 4 },
    { id: 'paper', label: 'A-series paper', ratio: 1 / Math.SQRT2 }
  ]
  let dialog: HTMLDialogElement
  let previewContainer: HTMLDivElement
  let preview: MapLibreMap | undefined
  let aspect = $state('view')
  let longEdge = $state<number | undefined>(2048)
  let format = $state<ExportFormat>('png')
  let quality = $state(95)
  let hostWidth = $state(0)
  let hostHeight = $state(0)
  let ready = $state(false)
  let rendering = $state(false)
  let progress = $state(0)
  let error = $state('')
  let result = $state<{ url: string; size: number; name: string }>()
  let controller: AbortController | undefined
  const ratio = $derived(aspects.find((entry) => entry.id === aspect)!.ratio)
  const frameWidth = $derived(
    Math.max(1, Math.floor(Math.min(hostWidth, hostHeight * ratio)))
  )
  const frameHeight = $derived(Math.max(1, Math.round(frameWidth / ratio)))
  const validResolution = $derived(
    typeof longEdge === 'number' &&
      Number.isInteger(longEdge) &&
      longEdge >= 512 &&
      longEdge <= 10000
  )
  const dimensions = $derived(
    validResolution ? exportDimensions(ratio, longEdge!) : undefined
  )
  const creditScale = $derived(dimensions ? frameHeight / dimensions.height : 1)
  const creditFontSize = $derived(
    dimensions
      ? getExportCreditFontSize(dimensions.width, dimensions.height)
      : getExportCreditFontSize(frameWidth, frameHeight)
  )

  function clearResult() {
    if (result) URL.revokeObjectURL(result.url)
    result = undefined
    error = ''
  }

  onMount(() => {
    dialog.showModal()
    hostWidth = previewContainer.parentElement!.parentElement!.clientWidth
    hostHeight = previewContainer.parentElement!.parentElement!.clientHeight
    let disposed = false
    async function initialize() {
      await tick()
      if (disposed) return
      preview = new MapLibreMap({
        container: previewContainer,
        style: exportStyle(source),
        center: source.getCenter(),
        zoom: source.getZoom() + Math.log2(frameHeight / sourceHeight),
        bearing: source.getBearing(),
        pitch: source.getPitch(),
        minZoom: 0,
        maxZoom: source.getMaxZoom(),
        attributionControl: false
      })
      addExportTileTransition(preview)
      preview.addControl(
        new NavigationControl({ showCompass: false }),
        'top-left'
      )
      preview.on('load', () => {
        ready = true
      })
      preview.on('movestart', clearResult)
      preview.on('error', () => {
        error =
          'Some map tiles could not be loaded. Try moving the map or reopening the export.'
      })
    }
    initialize().catch((cause) => {
      console.error('Unable to initialize the export preview:', cause)
      error =
        'The map preview could not be opened. Please close the export and try again.'
    })
    return () => {
      disposed = true
      controller?.abort()
      preview?.remove()
      if (result) URL.revokeObjectURL(result.url)
    }
  })

  $effect(() => {
    // Both settings and camera changes invalidate a previous download.
    void aspect
    void longEdge
    void format
    void quality
    untrack(clearResult)
  })

  $effect(() => {
    const width = frameWidth
    const height = frameHeight
    if (!ready || !preview) return
    untrack(() => {
      const currentHeight = preview!.getCanvas().clientHeight
      preview!.resize()
      if (currentHeight > 0 && height > 0 && currentHeight !== height) {
        preview!.setZoom(preview!.getZoom() + Math.log2(height / currentHeight))
      }
    })
    void width
  })

  async function render() {
    if (!preview || !dimensions || rendering) return
    preview.stop()
    clearResult()
    rendering = true
    progress = 0
    controller = new AbortController()
    try {
      const blob = await renderMapExport(
        preview,
        dimensions.width,
        dimensions.height,
        format,
        quality / 100,
        controller.signal,
        (value) => (progress = value)
      )
      result = {
        url: URL.createObjectURL(blob),
        size: blob.size,
        name: `buildings-${dimensions.width}x${dimensions.height}.${format === 'jpeg' ? 'jpg' : format}`
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        error =
          cause instanceof Error
            ? cause.message
            : 'The export failed. Please try again.'
    } finally {
      rendering = false
    }
  }
</script>

<dialog
  bind:this={dialog}
  {onclose}
  aria-labelledby="export-title"
  class="export-dialog"
>
  <header>
    <div>
      <h1 id="export-title">Export map</h1>
    </div>
    <button
      type="button"
      class="close"
      aria-label="Close export"
      onclick={() => dialog.close()}><XIcon size={22} /></button
    >
  </header>

  <div class="export-body">
    <section class="preview-section" aria-label="Export preview">
      <div
        class="preview-host"
        bind:clientWidth={hostWidth}
        bind:clientHeight={hostHeight}
      >
        <div
          class="preview-frame"
          style:width={`${frameWidth}px`}
          style:height={`${frameHeight}px`}
        >
          <div
            class="preview-map"
            bind:this={previewContainer}
            inert={rendering || !!result}
          ></div>
          {#if result}
            <img
              class="rendered-image"
              src={result.url}
              alt="Rendered map with BAG and Bert Spaan attribution"
            />
          {:else}
            <div
              class="credit"
              style:font-size={`${creditFontSize}px`}
              style:transform={`scale(${creditScale})`}
              style:right={`${exportCreditMargin * creditScale}px`}
              style:bottom={`${exportCreditMargin * creditScale}px`}
            >
              <a href={`https://${exportSite}`} target="_blank" rel="noreferrer"
                >{exportCredit}</a
              >
            </div>
          {/if}
        </div>
        {#if rendering}<div class="rendering" role="status">
            <span class="spinner"></span>{progress === 1
              ? 'Preparing download…'
              : `Rendering map… ${Math.round(progress * 100)}%`}
          </div>{/if}
      </div>
      <div class="preview-caption">
        {#if result}
          <span>Rendered · {(result.size / 1000000).toFixed(1)} MB</span>
          <button type="button" onclick={clearResult}>Adjust crop</button>
        {:else}
          <span>Drag to position · Scroll or pinch to zoom</span>
        {/if}
        {#if dimensions}<span>{dimensions.width} × {dimensions.height} px</span
          >{/if}
      </div>
    </section>

    <div class="settings">
      <fieldset disabled={rendering}>
        <legend>Aspect ratio</legend>
        <div class="aspect-options">
          {#each aspects as entry (entry.id)}
            <button
              type="button"
              class:chosen={aspect === entry.id}
              aria-pressed={aspect === entry.id}
              onclick={() => (aspect = entry.id)}>{entry.label}</button
            >
          {/each}
        </div>
      </fieldset>

      <fieldset disabled={rendering}>
        <legend>Resolution</legend>
        <div class="resolution-options">
          {#each [1024, 2048, 4096, 8192] as size (size)}
            <button
              type="button"
              class:chosen={longEdge === size}
              aria-pressed={longEdge === size}
              onclick={() => (longEdge = size)}>{size}</button
            >
          {/each}
        </div>
        <div class="resolution-label">
          <label class="input-label" for="export-resolution"
            >Longest edge in pixels</label
          >
          {#if dimensions}<p class="hint">
              {((dimensions.width * dimensions.height) / 1000000).toFixed(1)} megapixels
            </p>{/if}
        </div>
        <input
          id="export-resolution"
          type="number"
          min="512"
          max="10000"
          step="1"
          bind:value={longEdge}
          aria-invalid={!validResolution}
        />
        {#if !validResolution}<p class="field-error">
            Enter a whole number from 512 to 10,000.
          </p>{/if}
      </fieldset>

      <fieldset disabled={rendering}>
        <legend>File format</legend>
        <div class="format-options">
          {#each [{ id: 'png', label: 'PNG' }, { id: 'jpeg', label: 'JPG' }, { id: 'webp', label: 'WebP' }] as option (option.id)}
            <button
              type="button"
              class:chosen={format === option.id}
              aria-pressed={format === option.id}
              onclick={() => (format = option.id as ExportFormat)}
              >{option.label}</button
            >
          {/each}
        </div>
        {#if format !== 'png'}
          <div class="quality-control">
            <label class="input-label" for="export-quality"
              >Quality · {quality}%</label
            >
            <input
              id="export-quality"
              type="range"
              min="50"
              max="100"
              step="1"
              bind:value={quality}
            />
          </div>
        {:else}<p class="hint">Lossless, with the sharpest edges.</p>{/if}
      </fieldset>

      <div class="actions" aria-live="polite">
        {#if error}<p class="field-error" role="alert">{error}</p>{/if}
        {#if result}
          <!-- A blob URL is a local download, not a SvelteKit route. -->
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a class="primary" href={result.url} download={result.name}
            ><DownloadSimpleIcon size={19} />Download {format === 'jpeg'
              ? 'JPG'
              : format.toUpperCase()} · {(result.size / 1000000).toFixed(1)} MB</a
          >
        {:else if rendering}
          <button
            class="primary"
            type="button"
            onclick={() => controller?.abort()}>Cancel render</button
          >
        {:else}
          <button
            class="primary"
            type="button"
            disabled={!ready || !validResolution}
            onclick={render}>Render image</button
          >
        {/if}
      </div>
    </div>
  </div>
</dialog>

<style>
  .export-dialog {
    position: fixed;
    inset: 0;
    margin: auto;
    width: min(1120px, calc(100% - 32px));
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 24px;
    border: 1px solid #ffffff30;
    border-radius: 24px;
    color: white;
    background: #111;
    box-shadow: 0 24px 100px #000a;
    pointer-events: auto;
  }
  .export-dialog::backdrop {
    background: #0009;
    backdrop-filter: blur(8px);
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 24px;
    font-weight: 700;
  }
  button,
  a,
  input {
    outline-offset: 4px;
  }
  button,
  a.primary {
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.4;
  }
  .close {
    align-self: flex-start;
    border-radius: 50%;
    padding: 8px;
    background: #ffffff0d;
  }
  .close:hover {
    background: #ffffff20;
  }
  .export-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 284px;
    gap: 24px;
  }
  .preview-section {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .preview-host {
    position: relative;
    height: min(62dvh, 610px);
    min-height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 12px;
    background: repeating-conic-gradient(#1c1c1c 0% 25%, #181818 0% 50%) 50% /
      16px 16px;
  }
  .preview-frame {
    position: relative;
    overflow: hidden;
    background: black;
    box-shadow: 0 0 0 1px #ffffff30;
  }
  .preview-map,
  .rendered-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .credit {
    position: absolute;
    transform-origin: bottom right;
    font-family: sans-serif;
    font-weight: 500;
    padding: 0.25em 0.5em;
    border-radius: 0.5em;
    background: #000b;
    text-align: right;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
  }
  .credit a {
    pointer-events: auto;
  }
  .preview-caption {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: #ffffff99;
    padding-top: 12px;
  }
  .preview-caption button {
    text-decoration: underline;
    color: white;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  fieldset {
    min-width: 0;
  }
  legend {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 8px;
  }
  .aspect-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .resolution-options,
  .format-options {
    display: flex;
    gap: 6px;
  }
  fieldset button {
    border: 1px solid #ffffff26;
    border-radius: 8px;
    padding: 8px 6px;
    font-size: 12px;
    line-height: 1.3;
    text-align: center;
    flex: 1;
    background: #ffffff05;
  }
  fieldset button:hover {
    background: #ffffff15;
  }
  fieldset button.chosen {
    border-color: #ffffffe0;
    background: #ffffff20;
  }
  .input-label {
    display: block;
    font-size: 12px;
    color: #ffffffb3;
    margin: 10px 0 6px;
  }
  .resolution-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin: 10px 0 6px;
  }
  .resolution-label .input-label,
  .resolution-label .hint {
    margin: 0;
    white-space: nowrap;
  }
  input[type='number'] {
    width: 100%;
    background: #0005;
    border: 1px solid #ffffff40;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
  }
  input[type='range'] {
    width: 100%;
    accent-color: white;
  }
  .quality-control {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
  }
  .quality-control .input-label {
    flex-shrink: 0;
    margin: 0;
    white-space: nowrap;
  }
  .quality-control input {
    flex: 1;
    min-width: 0;
  }
  .hint {
    font-size: 12px;
    line-height: 1.5;
    color: #ffffff80;
    margin-top: 7px;
  }
  .field-error {
    font-size: 13px;
    color: #fca5a5;
    line-height: 1.5;
    margin: 7px 0;
  }
  .actions {
    margin-top: auto;
  }
  .primary {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    border-radius: 10px;
    padding: 12px;
    background: white;
    color: black;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
  }
  .primary:hover {
    background: #e5e5e5;
  }
  .rendering {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: #0009;
    font-size: 14px;
  }
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #ffffff40;
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
  @media (max-width: 720px) {
    .export-dialog {
      padding: 16px;
      width: calc(100% - 16px);
      max-height: calc(100dvh - 16px);
      border-radius: 18px;
    }
    .export-body {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .preview-host {
      height: 36dvh;
      min-height: 220px;
    }
    .settings {
      gap: 16px;
    }
    .aspect-options {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
