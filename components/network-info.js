const Component = require('choo/component')
const html = require('choo/html')

class NetworkInfo extends Component {
  constructor() {
    super()
    this.onNetworkChanged = this.onNetworkChanged.bind(this)
  }

  createElement(archive) {
    if (archive !== this.archive) {
      if (this.archive != null) {
        this.archive.removeEventListener(
          'network-changed',
          this.onNetworkChanged
        )
      }
      this.archive = archive
      this.peers = 0
      this.archive.addEventListener('network-changed', this.onNetworkChanged)
      this.archive.getInfo().then(({ peers }) => {
        this.peers = peers
        this.rerender()
      })
    }
    const id = archive.url.substr(6, 6)
    return html`<div><a href="${
      archive.url
    }" target="_blank"><span style="background-color: #${id};">${id}...</span></a> (${
      this.peers
    } peers)</div>`
  }

  onNetworkChanged({ connections }) {
    this.peers = connections
    this.rerender()
  }

  unload() {
    this.archive.removeEventListener(this.onNetworkChanged)
  }

  update() {
    return false
  }
}

module.exports = NetworkInfo
