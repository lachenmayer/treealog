const Component = require('choo/component')
const html = require('choo/html')
const Conversation = require('../modules/conversation')
const cuid = require('cuid')
const assert = require('nanoassert')
const nanostate = require('nanostate')

//
// VIEW
//

module.exports = function conversation(state, emit) {
  const url = state.params.url // defined in index.js
  return state.cache(ConversationView, url).render()

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

class ConversationView extends Component {
  constructor(url) {
    super()
    this.url = url
    this.conversation = new Conversation(url)
    const onload = () => this.rerender()
    this.conversation
      .load()
      .then(onload)
      .catch(onload)
  }

  createElement() {
    if (!this.conversation.loaded) {
      return html`<main>loading...</main>`
    }
    if (!this.conversation.isConversation) {
      const url = 'dat://' + this.url
      return html`<main><p>the archive <a href=${url}>${url}</a> does not contain a conversation.</p> ${
        this.conversation.isOwner
          ? html`<p><button onclick=${() => {
              this._createConversation()
            }}>create a conversation in this archive</button></p>`
          : html`<p>the owner of the archive can create a new conversation here.</p>`
      }</main>`
    }

    // if (isOwner) {
    //   // TODO enable inviting more people
    // } else {
    //   // TODO enable creating a new conversation
    // }
  }

  unload() {
    this.conversation = null
  }

  async _createConversation() {
    await this.conversation.createConversation()
    this.rerender()
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
  // this is the app archive. it only contains the code.
  // for every conversation, it creates a new conversation archive.
  // the conversation archive is created by the conversation starter (owner of conversation archive)
  // and links to participant archives
  // every user taking part in the conversation has a participant archives
  // the participant archive contains every user's videos and profile info

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

async function toArrayBuffer(blob) {
  const response = new Response(blob)
  const buffer = await response.arrayBuffer()
  return buffer
}
