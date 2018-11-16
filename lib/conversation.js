const EventEmitter = require('nanobus')
const constants = require('../constants')
const Contributor = require('../lib/contributor')
const ObjectCache = require('../lib/object-cache')
const protocolify = require('../lib/protocolify')

class Conversation extends EventEmitter {
  // Creates a conversation archive & returns a Conversation object.
  // Returns null if the user does not give permission to create the archive.
  static async create() {
    try {
      const archive = await DatArchive.create({
        title: 'A treealog conversation',
        type: [constants.conversationArchiveType],
      })

      await archive.mkdir('treealog')
      await archive.mkdir('treealog/contributors')

      const conversation = new Conversation(archive)
      return conversation
    } catch (e) {
      console.warn(e)
      return null
    }
  }

  // Opens the archive selection modal for the user & returns a Conversation object.
  // Returns null if the user does not select an archive.
  static async select() {
    try {
      const archive = await DatArchive.selectArchive({
        title: 'Choose a conversation',
        buttonLabel: 'Go to conversation',
        filters: {
          type: constants.conversationArchiveType,
        },
      })
      return new Conversation(archive)
    } catch (e) {
      console.warn(e)
      return null
    }
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
    this.isOwner = null
    this.ready = new Promise(async ready => {
      const { isOwner, title, description } = await this.archive.getInfo()
      this.title = title
      this.description = description
      this.isOwner = isOwner
      await this._setState()
      this.archive.watch(['/treealog/**'], () => {
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
    await this._setState()
    this.emit('update')
  }

  _initialState() {
    this.error = null

    this.me = null
    this.readOnly = true
    this.pendingInvite = false
    this.contributors = []
    this.pendingContributor = null
    this.videos = {}
    this.firsts = []

    this._cache = new ObjectCache()
    this._watching = {}
  }

  // throws NoConversationError
  async _setState() {
    //
    // Read contributor metadata from archive
    //

    const contributorInfos = []
    try {
      const contributorFiles = await this.archive.readdir(
        'treealog/contributors'
      )
      for (const file of contributorFiles) {
        const content = await this.archive.readFile(
          'treealog/contributors/' + file
        )
        const contributor = JSON.parse(content)
        contributorInfos.push(contributor)
      }
    } catch (e) {
      if (e.name === 'NotFoundError') {
        this.error = new NoConversationError()
        return
      } else {
        console.error(e)
      }
    }

    if (this.pendingContributor != null) {
      if (contributorInfos.find(c => c.url === this.pendingContributor)) {
        // The pending contributor has been added to the conversation, get rid of 'em.
        this.pendingContributor = null
      } else {
        contributorInfos.push({ url: this.pendingContributor })
      }
    }

    //
    // Sync contributor content
    //

    const contributors = contributorInfos.map(({ url }) =>
      this._cache.get(url, Contributor, url)
    )
    await Promise.all(contributors.map(c => c.ready))

    for (const contributor of contributors) {
      if (!(contributor.url in this._watching)) {
        contributor.on('update', () => {
          this.sync()
        })
        this._watching[contributor.url] = true
      }
    }

    let me = null
    for (const contributor of contributors) {
      if (contributor.isOwner) {
        me = contributor
        break
      }
      // TODO what if several are owned by me
    }

    const contributorVideos = contributors.map(c => c.videos)
    const { videos, firsts } = buildTree(contributorVideos)

    this.me = me
    this.readOnly = me == null
    this.pendingInvite = me != null && me.url === this.pendingContributor
    this.contributors = contributors
    this.videos = videos
    this.firsts = firsts
  }

  // If we're the owner of the conversation, add the url to the list of contributors.
  // If not, add the url as the pending contributor.
  // Returns true if the contributor was actually added to the conversation.
  async addContributor(contributorUrl) {
    await this.ready
    contributorUrl = protocolify(contributorUrl)
    const id = contributorUrl.replace('dat://', '')
    try {
      await this.archive.writeFile(
        'treealog/contributors/' + id,
        JSON.stringify({ url: contributorUrl })
      )
      await this.sync()
      return true
    } catch (e) {
      this.pendingContributor = contributorUrl
      await this.sync()
      return false
    }
  }
}

class NoConversationError extends Error {
  constructor() {
    super('treealog: There is no conversation in this archive.')
    this.noConversation = true
  }
}

function buildTree(contributorVideos) {
  const videos = {}

  for (const videosByContributor of contributorVideos) {
    // This rigmarole ensures that we don't mutate any of the videos,
    // otherwise responses can show up multiple times.
    for (const [url, video] of Object.entries(videosByContributor)) {
      videos[url] = Object.assign({}, video)
    }
  }

  const firsts = []
  for (const video of Object.values(videos)) {
    if (video.responseTo != null) {
      const responseTo = videos[video.responseTo]
      if (responseTo != null) {
        responseTo.responses = (responseTo.responses || []).concat([video.url])
      } else {
        console.warn(
          'treealog: could not find video',
          video.responseTo,
          'which this video is a response to:',
          video
        )
      }
    } else {
      firsts.push(video.url)
    }
  }

  return { videos, firsts }
}

function pairwiseEquals(array1, array2) {
  if (array1.length !== array2.length) {
    return false
  }
  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) return false
  }
  return true
}

module.exports = Conversation
