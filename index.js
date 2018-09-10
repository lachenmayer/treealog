const app = require('choo')()
const Component = require('choo/component')
const html = require('choo/html')
const nanostate = require('nanostate')

class CameraVideo extends Component {
  createElement(stream) {
    if (this.video == null) {
      this.video = html`<video width=320 height=240></video>`
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

class PreviewVideo extends Component {
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

// emits 'new-recording' event when recording is complete
class Recorder extends Component {
  constructor() {
    super()

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
      this.stream = null
      this.cameraVideo = null
      this.previewVideo = null
      this.error = null
      this.recorder = null
    })

    this.state.on('permissions', async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })
        this.cameraVideo = new CameraVideo()
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
        this.previewVideo = new PreviewVideo()
        this.recording = event.data
        this.state.emit('recorded')
      }
      this.recorder.stop()
    })

    this.state.on('done', () => {
      this.emitGlobal('new-recording', this.recording)
      this.state.emit('reset')
    })

    this.state.on('*', _state => {
      this.rerender()
    })
  }

  createElement(emit) {
    this.emitGlobal = emit
    const state = this.state.state

    if (state === 'initial') {
      return html`<div>
        ${button('respond to this', () => this.state.emit('show'))}
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
          ${this.cameraVideo.render(this.stream)}
          ${button('start recording', () => this.state.emit('record'))}
        </div>
      `
    }

    if (state === 'recording') {
      return html`
        <div>
          ${this.cameraVideo.render(this.stream)}
          ${button('finish recording', () => this.state.emit('finish'))}
        </div>
      `
    }

    if (state === 'postrecording') {
      return html`<div>fetching recording...</div>`
    }

    if (state === 'preview') {
      return html`<div>
        ${this.previewVideo.render(this.recording)}
        ${button('redo', () => this.state.emit('redo'))}
        ${button('use this recording', () => this.state.emit('use'))}
      </div>`
    }

    if (state === 'done') {
      return html`<div>saving recording...</div>`
    }

    return html`<div>unimplemented state "${state}"</div>`

    function button(text, action) {
      return html`<div class="button" onclick=${action}>${text}</div>`
    }
  }

  update() {
    return false
  }
}

const recorder = new Recorder()

app.route('/', (state, emit) => {
  return html`
    <main>
      ${recorder.render(emit)}
    </main>
  `
})

app.use((state, emitter) => {
  emitter.on('new-recording', blob => {
    console.log(blob)
  })
})

app.mount('main')
