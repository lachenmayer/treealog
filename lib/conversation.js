const constants = require('treealog/constants')
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

  // Opens the archive selection modal for the user.
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

    // true when archive has successfully been loaded
    // can be true even when the url does not contain a valid conversation
    this.loaded = false

    // true when I am the owner of the conversation archive
    this.isOwner = false

    this.participants = []
    this.me = null
    this.readOnly = true
    this.videos = {}
    this.firsts = []
  }

  // throws NoConversationError
  async load() {
    const { isOwner } = await this.archive.getInfo()
    this.isOwner = isOwner
    this.loaded = true

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
    // Load content from each participant
    //

    const participants = participantInfos.map(({ url }) => new Participant(url))
    await Promise.all(participants.map(p => p.load()))

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
    // TODO this is a pretty heavyweight way of updating the list of participants,
    // but at least it's thorough...
    await this.load()
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
        responseTo.responses.push(video)
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

class NoConversationError extends Error {
  constructor() {
    super('treealog: There is no conversation in this archive.')
    this.noConversation = true
  }
}

module.exports = Conversation
