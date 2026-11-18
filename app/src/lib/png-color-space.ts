// PNG's standard sRGB chunk: perceptual intent (0), followed by its CRC-32.
// https://www.w3.org/TR/png-3/#11sRGB
const srgbChunk = new Uint8Array([
  0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233
])
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

/** Tag an sRGB canvas PNG when the browser omits color metadata. */
export async function ensurePngSrgb(blob: Blob): Promise<Blob> {
  const header = new Uint8Array(await blob.slice(0, 33).arrayBuffer())
  if (
    header.length !== 33 ||
    !pngSignature.every((byte, index) => header[index] === byte) ||
    new DataView(header.buffer).getUint32(8) !== 13 ||
    String.fromCharCode(...header.subarray(12, 16)) !== 'IHDR'
  ) {
    throw new Error('The browser returned an invalid PNG image.')
  }

  // Color chunks precede IDAT. Read only chunk headers, so large exports don't
  // need another full copy of their compressed image data in memory.
  for (let offset = 33; offset + 12 <= blob.size; ) {
    const bytes = new Uint8Array(
      await blob.slice(offset, offset + 8).arrayBuffer()
    )
    const length = new DataView(bytes.buffer).getUint32(0)
    const type = String.fromCharCode(...bytes.subarray(4, 8))
    if (offset + length + 12 > blob.size) {
      throw new Error('The browser returned an incomplete PNG image.')
    }
    if (type === 'sRGB' || type === 'iCCP' || type === 'cICP') return blob
    if (type === 'IDAT') {
      return new Blob([blob.slice(0, 33), srgbChunk, blob.slice(33)], {
        type: 'image/png'
      })
    }
    offset += length + 12
  }
  throw new Error('The browser returned a PNG without image data.')
}
