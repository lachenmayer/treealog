const constants = require('treealog/constants')
const ObjectCache = require('treealog/lib/object-cache')
const Participant = require('treealog/lib/participant')
const protocolify = require('treealog/lib/protocolify')

class Conversation {
  // Creates a conversation archive & returns a Conversation object.
  // Returns null if the user does not give permission to create the archive.
  static async create() {
    try {
      const archive = await DatArchive.create({
        title: 'A treealog conversation',
        type: [constants.conversationArchiveType],
      })

      await archive.mkdir('treealog')
      await archive.mkdir('treealog/participants')

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
    if (typeof urlOrArchive === 'string') {
      const url = protocolify(urlOrArchive)
      this.archive = new DatArchive(url)
    } else {
      this.archive = urlOrArchive
    }
    this.url = this.archive.url
    this.isOwner = false
    this.version = -1
    this.dependencyVersions = []

    this.participants = []
    this.me = null
    this.readOnly = true
    this.videos = {}
    this.firsts = []

    this._cache = new ObjectCache()
  }

  async sync() {
    const { isOwner, version } = await this.archive.getInfo()
    this.isOwner = isOwner
    const dependencyVersions = await Promise.all(
      this.dependencies.map(d => d.sync())
    )
    const dependenciesUpdated = !pairwiseEquals(
      this.dependencyVersions,
      dependencyVersions
    )
    this.dependencyVersions = dependencyVersions
    if (version != this.version || dependenciesUpdated) {
      console.log('↑ conversation', this.archive.url)
      this.version = version
      await this.updateState()
    }
    return this.version
  }

  async watch(onChange = noop) {
    const cb = async () => {
      await this.sync()
      onChange()
    }
    this.archive.watch(['/treealog/**'], cb)
    for (const d of this.dependencies) {
      await d.watch(cb)
    }
    await this.sync()
  }

  get loaded() {
    return this.version >= 0
  }

  get dependencies() {
    return this.participants
  }

  // throws NoConversationError
  async updateState() {
    //
    // Read participant metadata from archive
    //

    const participantInfos = []
    try {
      const participantFiles = await this.archive.readdir(
        'treealog/participants',
        {
          timeout: 60e3 /* we wanna make sure everyone's stuff shows up */,
        }
      )
      for (const file of participantFiles) {
        const content = await this.archive.readFile(
          'treealog/participants/' + file
        )
        const participant = JSON.parse(content)
        participantInfos.push(participant)
      }
    } catch (e) {
      if (e.name === 'NotFoundError') {
        throw new NoConversationError()
      } else {
        console.error(e)
      }
    }

    //
    // Sync participant content
    //

    const participants = participantInfos.map(({ url }) =>
      this._cache.get(url, Participant, url)
    )
    await Promise.all(participants.map(p => p.sync()))

    let me = null
    for (const participant of participants) {
      if (participant.isOwner) {
        me = participant
        break
      }
      // TODO what if several are owned by me
    }

    const participantVideos = participants.map(p => p.videos)
    const { videos, firsts } = buildTree(participantVideos)

    this.participants = participants
    this.me = me
    this.readOnly = me == null
    this.videos = videos
    this.firsts = firsts
  }

  async addParticipant(participant) {
    const info = participant.getInfo()
    const id = info.url.replace('dat://', '')
    await this.archive.writeFile(
      'treealog/participants/' + id,
      JSON.stringify(info)
    )
    await this.sync()
  }
}

class NoConversationError extends Error {
  constructor() {
    super('treealog: There is no conversation in this archive.')
    this.noConversation = true
  }
}

function buildTree(participantVideos) {
  const videos = {}
  for (const v of participantVideos) {
    Object.assign(videos, v)
  }

  const firsts = []
  for (const video of Object.values(videos)) {
    if (video.responseTo != null) {
      const responseTo = videos[video.responseTo]
      if (responseTo != null) {
        responseTo.responses.push(video.url)
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
