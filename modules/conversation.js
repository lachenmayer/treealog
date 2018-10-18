// const EventEmitter = require('nanobus')

class Conversation {
  constructor(url) {
    this.url = url

    this.archive = null

    // true when archive has successfully been loaded
    // can be true even when the url does not contain a valid conversation
    this.loaded = false

    // true when the archive actually contains a valid treealog conversation
    this.isConversation = false

    // true when I am the owner of the conversation archive
    this.isOwner = false

    this.participants = []
    this.readOnly = true
    this.videos = {}
    this.firsts = []
  }

  // throws NotSetupError
  async load() {
    this.archive = this.archive || (await DatArchive.load('dat://' + this.url))
    this.loaded = true

    const { isOwner } = await this.archive.getInfo()
    this.isOwner = isOwner

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
        this.isConversation = false
        return
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

  async createConversation() {
    await this.archive.writeFile()
    // TODO write treealog.json
  }
}

module.exports = Conversation
