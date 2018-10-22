// In browser, converts a Blob to an ArrayBuffer.
// Returns everything else unchanged, so that in Node you can pass in Buffers unharmed.
module.exports = async function toBufferLike(blobLike) {
  if (blobLike.constructor.name === 'Blob') {
    const response = new Response(blobLike)
    const buffer = await response.arrayBuffer()
    return buffer
  }
  return blobLike
}
