const cuid = require('cuid')
const constants = require('treealog/constants')
const protocolify = require('treealog/lib/protocolify')
const toArrayBuffer = require('treealog/lib/blob-to-array-buffer')

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

    // true when archive has successfully been loaded
    // can be true even when the url does not contain a valid conversation
    this.loaded = false

    // true when I am the owner of the conversation archive
    this.isOwner = false

    this.videos = {}
  }

  async load() {
    const { isOwner } = await this.archive.getInfo()
    this.isOwner = isOwner
    this.loaded = true

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
    const buffer = await toArrayBuffer(blob)
    const id = cuid()
    const meta = {
      url: `${this.url}/videos/${id}.webm`,
      responseTo,
    }
    await this.archive.writeFile(`videos/${id}.webm`, buffer)
    await this.archive.writeFile(`videos/${id}.json`, JSON.stringify(meta))
  }

  getInfo() {
    return {
      url: this.url,
    }
  }
}

module.exports = Participant
