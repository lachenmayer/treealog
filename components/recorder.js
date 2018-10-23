const Component = require('choo/component')
const html = require('choo/html')
const nanostate = require('nanostate')

class Recorder extends Component {
  constructor(_id, _state, _emit) {
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
      this.props.onRecorded(this.recording)
      this.state.emit('reset')
    })

    this.state.on('*', _state => {
      if (this.element != null) {
        this.rerender()
      }
    })
  }

  createElement(
    props = {
      responseTo: null /* string - link to a previous recording */,
      onRecorded: function noop() {} /* Blob => () - called once recording is finished */,
    }
  ) {
    this.props = props
    const state = this.state.state

    if (state === 'initial') {
      return html`<div>
        ${button(
          this.props.responseTo == null
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
      return html`<button onclick=${action}>${text}</button>`
    }
  }

  update() {
    return false
  }
}

Recorder.first = 'first'

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

module.exports = Recorder
