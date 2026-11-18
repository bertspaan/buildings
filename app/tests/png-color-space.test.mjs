import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc32, deflateSync } from 'node:zlib'
import { ensurePngSrgb } from '../src/lib/png-color-space.ts'

function chunk(type, data = Buffer.alloc(0)) {
  const bytes = Buffer.alloc(data.length + 12)
  bytes.writeUInt32BE(data.length)
  bytes.write(type, 4)
  data.copy(bytes, 8)
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4)
  return bytes
}

function png(metadata = []) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 2
  return new Blob(
    [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      ...metadata,
      chunk('IDAT', deflateSync(Buffer.from([0, 165, 0, 38]))),
      chunk('IEND')
    ],
    { type: 'image/png' }
  )
}

test('adds a valid sRGB declaration without changing compressed pixels', async () => {
  const original = png()
  const output = await ensurePngSrgb(original)
  const before = Buffer.from(await original.arrayBuffer())
  const after = Buffer.from(await output.arrayBuffer())
  assert.equal(output.type, 'image/png')
  assert.equal(after.length, before.length + 13)
  assert.deepEqual(after.subarray(0, 33), before.subarray(0, 33))
  assert.equal(after.toString('ascii', 37, 41), 'sRGB')
  assert.equal(after[41], 0)
  assert.equal(after.readUInt32BE(42), crc32(after.subarray(37, 42)))
  assert.deepEqual(after.subarray(46), before.subarray(33))
  assert.equal(await ensurePngSrgb(output), output)
})

test('preserves browser-provided color profiles and ancillary metadata', async () => {
  for (const type of ['sRGB', 'iCCP', 'cICP']) {
    const original = png([
      chunk('tEXt', Buffer.from('Comment\0test')),
      chunk(type, Buffer.from([0]))
    ])
    assert.equal(await ensurePngSrgb(original), original)
  }
  const original = png([chunk('pHYs', Buffer.alloc(9))])
  const output = await ensurePngSrgb(original)
  assert.deepEqual(
    new Uint8Array(await output.slice(46).arrayBuffer()),
    new Uint8Array(await original.slice(33).arrayBuffer())
  )
})

test('rejects invalid or truncated PNG files', async () => {
  await assert.rejects(ensurePngSrgb(new Blob(['invalid'])), /invalid PNG/)
  await assert.rejects(ensurePngSrgb(png().slice(0, 44)), /without image data/)
  await assert.rejects(ensurePngSrgb(png().slice(0, 48)), /incomplete PNG/)
})
