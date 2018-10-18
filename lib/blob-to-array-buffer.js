// Converts a Blob to an ArrayBuffer, in a wonderfully roundabout way.
module.exports = async function toArrayBuffer(blob) {
  const response = new Response(blob)
  const buffer = await response.arrayBuffer()
  return buffer
}
