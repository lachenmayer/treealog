if (typeof DatArchive == 'undefined') {
  global.DatArchive = require('node-dat-archive')
}
const EventEmitter = require('nanobus')
const constants = require('treealog/constants')
const ObjectCache = require('treealog/lib/object-cache')
const Participant = require('treealog/lib/participant')
const protocolify = require('treealog/lib/protocolify')

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
    super()
    if (typeof urlOrArchive === 'string') {
      const url = protocolify(urlOrArchive)
      this.archive = new DatArchive(url)
    } else {
      this.archive = urlOrArchive
    }
    this.url = this.archive.url
    this.isOwner = null
    this.ready = new Promise(async ready => {
      const { isOwner } = await this.archive.getInfo()
      this.isOwner = isOwner
      await this._setState()
      this.archive.watch(['/treealog/**'], () => {
        this.sync()
      })
      ready()
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
    this.participants = []
    this.pendingParticipant = null
    this.videos = {}
    this.firsts = []

    this._cache = new ObjectCache()
    this._watching = {}
  }

  // throws NoConversationError
  async _setState() {
    //
    // Read participant metadata from archive
    //

    const participantInfos = []
    try {
      const participantFiles = await this.archive.readdir(
        'treealog/participants'
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
        this.error = new NoConversationError()
        return
      } else {
        console.error(e)
      }
    }

    if (this.pendingParticipant != null) {
      if (participantInfos.find(p => p.url === this.pendingParticipant)) {
        // The pending participant has been added to the conversation, get rid of 'em.
        this.pendingParticipant = null
      } else {
        participantInfos.push({ url: this.pendingParticipant })
      }
    }

    //
    // Sync participant content
    //

    const participants = participantInfos.map(({ url }) =>
      this._cache.get(url, Participant, url)
    )
    await Promise.all(participants.map(p => p.ready))

    for (const participant of participants) {
      if (!(participant.url in this._watching)) {
        participant.on('update', () => {
          this.sync()
        })
        this._watching[participant.url] = true
      }
    }

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

    this.me = me
    this.readOnly = me == null
    this.pendingInvite = me != null && me.url === this.pendingParticipant
    this.participants = participants
    this.videos = videos
    this.firsts = firsts
  }

  // If we're the owner of the conversation, add the url to the list of participants.
  // If not, add the url as the pending participant.
  // Returns true if the participant was actually added to the conversation.
  async addParticipant(participantUrl) {
    await this.ready
    const id = participantUrl.replace('dat://', '')
    try {
      await this.archive.writeFile(
        'treealog/participants/' + id,
        JSON.stringify({ url: participantUrl })
      )
      await this.sync()
      return true
    } catch (e) {
      this.pendingParticipant = participantUrl
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

function buildTree(participantVideos) {
  const videos = {}

  for (const videosByParticipant of participantVideos) {
    // This rigmarole ensures that we don't mutate any of the videos,
    // otherwise responses can show up multiple times.
    for (const [url, video] of Object.entries(videosByParticipant)) {
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
