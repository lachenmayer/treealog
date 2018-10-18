// dat://foo => dat://foo
// foo => dat://foo
module.exports = function protocolify(url) {
  if (url.startsWith('dat://')) {
    return url
  }
  return 'dat://' + url
}
