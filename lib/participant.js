const cuid = require('cuid')
const constants = require('treealog/constants')
const protocolify = require('treealog/lib/protocolify')
const toBufferLike = require('treealog/lib/to-buffer-like')

class Participant {
  // Creates a participant archive & returns a Participant object.
  // Throws if the user does not give permission to create the archive.
  static async create(conversationUrl) {
    const links =
      conversationUrl != null
        ? {
            [constants.conversationArchiveType]: [{ href: conversationUrl }],
          }
        : {}
    const archive = await DatArchive.create({
      title: 'A treealog participant',
      description:
        'This archive contains all of your contributions to the conversation.',
      type: [constants.participantArchiveType],
      links,
    })
    await archive.mkdir('videos')
    return new Participant(archive)
  }

  constructor(urlOrArchive) {
    if (typeof urlOrArchive === 'string') {
      const url = protocolify(urlOrArchive)
      this.archive = new DatArchive(url)
    } else {
      this.archive = urlOrArchive
    }
    this.url = this.archive.url
    this.isOwner = false
    this.version = -1

    this.videos = {}
  }

  async sync() {
    const { isOwner, version } = await this.archive.getInfo()
    this.isOwner = isOwner
    if (version != this.version) {
      console.log('↑ participant', this.archive.url)
      this.version = version
      await this.updateState()
    }
    return this.version
  }

  async watch(onChange = noop) {
    this.archive.watch(['/videos/**/*.json'], async () => {
      await this.sync()
      onChange()
    })
    await this.sync()
  }

  get loaded() {
    return this.version >= 0
  }

  async updateState() {
    await this.getVideos()
  }

  async getVideos() {
    const videos = {}
    try {
      const videoFiles = await this.archive.readdir('videos')
      for (const fileName of videoFiles) {
        if (fileName.endsWith('json')) {
          const content = await this.archive.readFile('videos/' + fileName)
          const video = JSON.parse(content)
          video.responses = video.responses || []
          videos[video.url] = video
        }
      }
    } catch (e) {
      console.warn(e)
    }
    this.videos = videos
    return videos
  }

  async addVideo(blob, responseTo) {
    const buffer = await toBufferLike(blob)
    const id = cuid()
    const meta = {
      url: `${this.url}/videos/${id}.webm`,
      responseTo,
    }
    await this.archive.writeFile(`videos/${id}.webm`, buffer)
    await this.archive.writeFile(`videos/${id}.json`, JSON.stringify(meta))
    await this.sync()
  }

  getInfo() {
    return {
      url: this.url,
    }
  }
}

function noop() {}

module.exports = Participant
