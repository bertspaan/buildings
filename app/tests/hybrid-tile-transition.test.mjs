import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { addHybridTileTransition } from '../src/lib/hybrid-tile-transition.ts'

function setup(t) {
  let now = 0
  t.after(() => mock.restoreAll())
  mock.method(performance, 'now', () => now)
  const listeners = new Set()
  const map = {
    zoom: 14,
    ready: { raster: true, vector: true },
    opacity: 1,
    repaints: 0,
    getZoom() {
      return this.zoom
    },
    isSourceLoaded(source) {
      return this.ready[source]
    },
    setPaintProperty(layer, property, value) {
      assert.equal(layer, 'buildings-raster')
      assert.equal(property, 'raster-opacity')
      this.opacity = value
    },
    triggerRepaint() {
      this.repaints++
    },
    on(event, listener) {
      assert.equal(event, 'render')
      listeners.add(listener)
    },
    off(event, listener) {
      listeners.delete(listener)
    }
  }
  const remove = addHybridTileTransition(map, {
    rasterLayerId: 'buildings-raster',
    vectorMinZoom: 13,
    blendStartZoom: 13.25,
    blendEndZoom: 14
  })
  const render = (elapsed = 0) => {
    now += elapsed
    for (const listener of listeners) listener()
  }
  return { map, render, remove }
}

test('keeps the raster visible during a slow vector load, then fades over 250 ms', (t) => {
  const { map, render } = setup(t)
  map.ready.vector = false
  render()
  render(5000)
  assert.equal(map.opacity, 1)
  assert.equal(map.repaints, 0)
  map.ready.vector = true
  render(5000)
  assert.equal(map.opacity, 1)
  render(125)
  assert.equal(map.opacity, 0.5)
  render(125)
  assert.equal(map.opacity, 0)
})

test('waits for raster tiles when zooming out', (t) => {
  const { map, render } = setup(t)
  render()
  render(250)
  map.zoom = 13.25
  map.ready.raster = false
  render()
  render(3000)
  assert.equal(map.opacity, 0)
  map.ready.raster = true
  render()
  render(125)
  assert.equal(map.opacity, 0.5)
  render(125)
  assert.equal(map.opacity, 1)
})

test('pauses a partial transition when the camera needs more tiles', (t) => {
  const { map, render } = setup(t)
  render()
  render(100)
  assert.equal(map.opacity, 0.6)
  map.ready.vector = false
  render(100)
  render(5000)
  assert.equal(map.opacity, 0.6)
  map.ready.vector = true
  render()
  assert.equal(map.opacity, 0.6)
  render(150)
  assert.equal(map.opacity, 0)
})

test('reverses a partial fade without jumping', (t) => {
  const { map, render } = setup(t)
  render()
  render(125)
  map.zoom = 13.25
  render()
  assert.equal(map.opacity, 0.5)
  render(125)
  assert.equal(map.opacity, 1)
})

test('settles at the fractional zoom blend and stops requesting frames', (t) => {
  const { map, render } = setup(t)
  map.zoom = 13.625
  render()
  render(250)
  assert.equal(map.opacity, 0.5)
  const repaints = map.repaints
  render(1000)
  assert.equal(map.repaints, repaints)
})

test('restores full raster coverage below the vector archive minimum zoom', (t) => {
  const { map, render } = setup(t)
  render()
  render(250)
  map.zoom = 12
  render()
  assert.equal(map.opacity, 1)
})

test('removes the render listener on cleanup', (t) => {
  const { map, render, remove } = setup(t)
  remove()
  render()
  render(250)
  assert.equal(map.opacity, 1)
  assert.equal(map.repaints, 0)
})
