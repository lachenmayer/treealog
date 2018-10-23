if (typeof DatArchive == 'undefined') {
  global.DatArchive = require('node-dat-archive')
}
const cuid = require('cuid')
const EventEmitter = require('nanobus')
const constants = require('treealog/constants')
const protocolify = require('treealog/lib/protocolify')
const toBufferLike = require('treealog/lib/to-buffer-like')

class Contributor extends EventEmitter {
  // Creates a contributor archive & returns a Contributor object.
  // Throws if the user does not give permission to create the archive.
  static async create(conversationUrl) {
    const links =
      conversationUrl != null
        ? {
            [constants.conversationArchiveType]: [{ href: conversationUrl }],
          }
        : {}
    const archive = await DatArchive.create({
      title: 'anonymous treealog contributor',
      description:
        'This archive contains all of your contributions to the conversation.',
      type: [constants.contributorArchiveType],
      links,
    })
    await archive.mkdir('videos')
    return new Contributor(archive)
  }

  constructor(urlOrArchive) {
    super()
    if (typeof urlOrArchive === 'string') {
      const url = protocolify(urlOrArchive)
      this.archive = new DatArchive(url)
    } else {
      this.archive = urlOrArchive
    }
    this.url = this.archive.url
    this.title = null
    this.description = null
    this.conversation = null
    this.isOwner = null
    this.ready = new Promise(async ready => {
      const {
        isOwner,
        title,
        description,
        links,
      } = await this.archive.getInfo()
      this.title = title
      this.description = description
      this.isOwner = isOwner
      if (links != null && constants.conversationArchiveType in links) {
        this.conversation = links[constants.conversationArchiveType]
      }
      await this._setState()
      this.archive.watch(['/videos/**/*.json'], () => {
        this.sync()
      })
      ready()
    }).catch(error => {
      console.error(error)
      this.error = error
    })

    this._initialState()
  }

  async sync() {
    await this.ready
    const updated = await this._setState()
    if (updated) {
      this.emit('update')
    }
  }

  _initialState() {
    this.version = -1
    this.videos = {}
  }

  // Returns true if state changed
  async _setState() {
    const { version } = await this.archive.getInfo()
    if (this.version != version) {
      // State that only depends on the Dat archive.
      // Doesn't have to be recomputed if the archive version hasn't changed.
      this.videos = await this.getVideos()
      this.version = version
      return true
    }
    return false
  }

  async getVideos() {
    const videos = {}
    try {
      const videoFiles = await this.archive.readdir('videos')
      for (const fileName of videoFiles) {
        if (fileName.endsWith('json')) {
          const content = await this.archive.readFile('videos/' + fileName)
          const video = JSON.parse(content)
          video.creator = this.url
          video.responses = []
          videos[video.url] = video
        }
      }
    } catch (e) {
      console.warn(e)
    }
    return videos
  }

  async addVideo(blob, responseTo) {
    await this.ready
    const buffer = await toBufferLike(blob)
    const id = cuid()
    const url = `${this.url}/videos/${id}.webm`
    const meta = {
      url,
      responseTo,
    }
    await Promise.all([
      this.archive.writeFile(`videos/${id}.webm`, buffer),
      this.archive.writeFile(`videos/${id}.json`, JSON.stringify(meta)),
    ])
    await this.sync()
    return this.videos[url]
  }
}

module.exports = Contributor
