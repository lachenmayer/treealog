// const EventEmitter = require('nanobus')
const constants = require('treealog/constants')

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

  // Creates a participant archive & returns it.
  // Throws if the user does not give permission to create the archive.
  static async createParticipant(conversationUrl) {
    const participant = await DatArchive.create({
      title: 'A treealog participant',
      description:
        'This archive contains all of your contributions to the conversation.',
      type: [constants.participantArchiveType],
      links: {
        [constants.conversationArchiveType]: [{ href: conversationUrl }],
      },
    })
    await participant.mkdir('videos')
    return participant
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
    // get participants in conversation
    //
    let participantInfos = []
    try {
      const participantFiles = await this.archive.readdir(
        'treealog/participants',
        {
          timeout: 60e3 /* we wanna make sure everyone's stuff shows up */,
        }
      )
      for (let file of participantFiles) {
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

    const participants = await Promise.all(
      participantInfos.map(({ url }) => DatArchive.load(url))
    )
    let me = null
    for (let participant of participants) {
      const { isOwner } = await participant.getInfo()
      if (isOwner) {
        me = participant
        break
      }
      // TODO what if several are owned by me
    }

    //
    // build tree
    //

    // get all video metadata
    const videos = {}
    for (let participant of participants) {
      try {
        const videoFiles = await participant.readdir('videos')
        for (let fileName of videoFiles) {
          if (fileName.endsWith('json')) {
            const content = await participant.readFile('videos/' + fileName)
            const video = JSON.parse(content)
            videos[video.url] = video
            videos[video.url].responses = []
          }
        }
      } catch (e) {
        console.warn(e)
      }
    }

    const firsts = []
    for (let video of Object.values(videos)) {
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

    this.participants = participants
    this.readOnly = me == null
    this.videos = videos
    this.firsts = firsts
  }
}

class NoConversationError extends Error {
  constructor() {
    super('treealog: There is no conversation in this archive.')
    this.noConversation = true
  }
}

// dat://foo => dat://foo
// foo => dat://foo
function protocolify(url) {
  if (url.startsWith('dat://')) {
    return url
  }
  return 'dat://' + url
}

module.exports = Conversation
