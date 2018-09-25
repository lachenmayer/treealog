const Component = require('choo/component')
const html = require('choo/html')
const cuid = require('cuid')
const assert = require('nanoassert')
const nanostate = require('nanostate')

//
// VIEW
//

function view(state, emit) {
  const conversation = state.conversation
  if (conversation == null) {
    return html`<main>loading...</main>`
  }
  if (conversation.error != null) {
    return html`
      <main>
        <p>something's wrong... (${conversation.error.message})</p>
      </main>
    `
  }
  return html`
    <main>
      ${conversation.participants.map(archive =>
        state.cache(NetworkInfo, archive.url).render(archive)
      )}
      ${
        !conversation.readOnly && Object.keys(conversation.videos).length === 0
          ? state.cache(Recorder, Recorder.first).render()
          : renderVideos()
      }
    </main>
  `

  function renderVideos() {
    return html`<div style="display: flex; flex-direction: row">${conversation.firsts.map(
      url => renderVideo(conversation.videos[url])
    )}</div>`
  }

  function renderVideo(video) {
    return html`<div>
      <video controls width="320" height="240" src="${video.url}"></video>
      ${conversation.readOnly ? '' : state.cache(Recorder, video.url).render()}
      responses:
      <div style="display: flex; flex-direction: row">${video.responses.map(
        renderVideo
      )}</div>
    </div>`
  }
}

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

class CameraPreview extends Component {
  createElement(stream) {
    if (this.video == null) {
      this.video = html`<video width=320 height=240></video>`
      this.video.muted = true
      this.video.srcObject = stream
      this.video.play()
    }
    return this.video
  }

  unload() {
    this.video = null
  }

  update() {
    return false
  }
}

class RecordingPreview extends Component {
  createElement(blob) {
    if (this.video == null) {
      this.video = html`<video width=320 height=240></video>`
      this.video.src = URL.createObjectURL(blob)
      this.video.loop = true
      this.video.onclick = () => {
        if (this.video.paused) {
          this.video.play()
        } else {
          this.video.pause()
        }
      }
      this.video.play()
    }
    return this.video
  }

  unload() {
    this.video = null
  }

  update() {
    return false
  }
}

// emits 'recorded' event when recording is complete
class Recorder extends Component {
  constructor(responseTo, _globalState, emit) {
    super()

    this.responseTo = responseTo
    this.emitGlobal = emit

    this.state = nanostate('initial', {
      initial: { show: 'permissions' },
      permissions: { accepted: 'prerecording', error: 'error' },
      error: { retry: 'permissions' },
      prerecording: { record: 'recording' },
      recording: { finish: 'postrecording' },
      postrecording: { recorded: 'preview' },
      preview: { redo: 'recording', use: 'done' },
      done: { reset: 'initial' },
    })

    this.state.on('initial', () => {
      // permissions
      this.stream = null
      this.error = null
      this.cameraPreview = null
      // recording
      this.recorder = null
      // postrecording
      this.recordingPreview = null
      this.recording = null
    })

    this.state.on('permissions', async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })
        this.cameraPreview = new CameraPreview()
        this.state.emit('accepted')
      } catch (e) {
        this.error = e
        this.state.emit('error')
      }
    })

    this.state.on('recording', () => {
      this.recorder = new MediaRecorder(this.stream)
      this.recorder.start()
    })

    this.state.on('postrecording', () => {
      this.recorder.ondataavailable = event => {
        this.recordingPreview = new RecordingPreview()
        this.recording = event.data
        this.state.emit('recorded')
      }
      this.recorder.stop()
    })

    this.state.on('done', () => {
      this.emitGlobal('recorded', {
        responseTo: this.responseTo,
        recording: this.recording,
      })
      this.state.emit('reset')
    })

    this.state.on('*', _state => {
      this.rerender()
    })
  }

  createElement() {
    const state = this.state.state

    if (state === 'initial') {
      return html`<div>
        ${button(
          this.responseTo === Recorder.first
            ? 'start the conversation'
            : 'respond to this',
          () => this.state.emit('show')
        )}
      </div>`
    }

    if (state === 'permissions') {
      return html`<div>
        <p>checking permissions...</p>
      </div>`
    }

    if (state === 'error') {
      return html`
        <div>
          <p>something went wrong - did you give the page permission to record audio/video?</p>
          <p>detailed error message: ${
            this.error && this.error.message
              ? this.error.message
              : 'not available'
          }</p>
          ${button('try again', () => this.state.emit('retry'))}
        </div>
      `
    }

    if (state === 'prerecording') {
      return html`
        <div>
          ${this.cameraPreview.render(this.stream)}
          ${button('start recording', () => this.state.emit('record'))}
        </div>
      `
    }

    if (state === 'recording') {
      return html`
        <div>
          ${this.cameraPreview.render(this.stream)}
          ${button('finish recording', () => this.state.emit('finish'))}
        </div>
      `
    }

    if (state === 'postrecording') {
      return html`<div>fetching recording...</div>`
    }

    if (state === 'preview') {
      return html`<div>
        ${this.recordingPreview.render(this.recording)}
        ${button('use this recording', () => this.state.emit('use'))}
        ${button('redo', () => this.state.emit('redo'))}
      </div>`
    }

    if (state === 'done') {
      return html`<div>saving recording...</div>`
    }

    return html`<div>internal error: unimplemented state "${state}"</div>`

    function button(text, action) {
      return html`<div class="button" onclick=${action}>${text}</div>`
    }
  }

  update() {
    return false
  }
}

Recorder.first = 'first'

//
// STORE
//

async function store(state, emitter) {
  const initialState = {
    error: null,
    archive: null,
    participants: [],
    readOnly: true,
    firsts: [],
    videos: {},
  }
  state.conversation = state.conversation || initialState

  // this is the app archive. it only contains the code.
  // for every conversation, it creates a new conversation archive.
  // the conversation archive is created by the conversation starter (owner of conversation archive)
  // and links to participant archives
  // every user taking part in the conversation has a participant archives
  // the participant archive contains every user's videos and profile info

  try {
    const url = 'dat://' + state.params.url
    const archive = await DatArchive.load(url)

    //
    // add more people to a conversation
    //
    const { isOwner: conversationOwner } = await archive.getInfo()
    if (conversationOwner) {
      // TODO enable inviting more people
    } else {
      // TODO enable creating a new conversation
    }

    //
    // get participants in conversation
    //
    let participantInfos = []
    try {
      const participantFiles = await archive.readdir('participants', {
        timeout: 30e3 /* we wanna make sure everyone's stuff shows up */,
      })
      for (let file of participantFiles) {
        const content = await archive.readFile('participants/' + file)
        const participant = JSON.parse(content)
        participantInfos.push(participant)
      }
    } catch (e) {
      if (e.name === 'NotFoundError') {
        throw new Error(
          'treealog: could not find participants directory. are you sure this is a treealog conversation?'
        )
      } else {
        console.warn(e)
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
    // build talk tree
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

    state.conversation = {
      archive,
      participants,
      readOnly: me == null,
      firsts,
      videos,
    }
    emitter.emit('render')
  } catch (error) {
    console.error(error)
    state.conversation = { error }
    emitter.emit('render')
    return
  }

  emitter.on('recorded', async ({ recording, responseTo }) => {
    assert.ok(me, 'recorder should never be visible when read-only')
    const buffer = await toArrayBuffer(recording)
    try {
      await me.mkdir('videos')
    } catch (e) {
      console.warn(e)
    }
    const id = cuid()
    console.log(me.url)
    await me.writeFile(`videos/${id}.webm`, buffer)
    await me.writeFile(
      `videos/${id}.json`,
      JSON.stringify({
        url: `${me.url}/videos/${id}.webm`,
        conversation: archive.url,
        responseTo: responseTo === Recorder.first ? null : responseTo,
      })
    )
  })
}

function cleanup(state, emitter) {
  state.conversation = null
}

async function toArrayBuffer(blob) {
  const response = new Response(blob)
  const buffer = await response.arrayBuffer()
  return buffer
}

async function __TODO__getHardcodedParticipantUrl(appArchive) {
  let profileUrl
  try {
    profileUrl = await appArchive.readFile('__TODO__profile-url')
  } catch (e) {
    if (e.name === 'NotFoundError') {
      const newArchive = await DatArchive.create({
        title: 'TODO profile',
        type: ['profile', 'treealog-profile'],
        prompt: false,
      })
      await newArchive.writeFile(
        'profile.json',
        JSON.stringify({ name: 'harry' })
      )
      await appArchive.writeFile('__TODO__profile-url', newArchive.url)
      profileUrl = newArchive.url
    } else {
      throw e
    }
  }
  return profileUrl
}

async function __TODO__getHardcodedConversationUrl(appArchive) {
  let conversationUrl
  try {
    conversationUrl = await appArchive.readFile('__TODO__conversation-url')
  } catch (e) {
    if (e.name === 'NotFoundError') {
      const newArchive = await DatArchive.create({
        title: 'TODO test conversation',
        type: ['treealog-conversation'],
        prompt: false,
      })
      await appArchive.writeFile('__TODO__conversation-url', newArchive.url)
      conversationUrl = newArchive.url
    } else {
      throw e
    }
  }
  return conversationUrl
}

async function __TODO__setupFakeConversation(conversation, profileUrl) {
  try {
    await conversation.readdir('participants', { timeout: 30e3 })
  } catch (e) {
    if (e.name === 'NotFoundError') {
      await conversation.mkdir('participants')
      await conversation.writeFile(
        'participants/0.json',
        JSON.stringify({ url: profileUrl })
      )
    } else {
      throw e
    }
  }
}

module.exports = { view, store, cleanup }
