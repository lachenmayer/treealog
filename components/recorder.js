const Component = require('choo/component')
const html = require('choo/html')
const nanostate = require('nanostate')

class Recorder extends Component {
  constructor(_id, _state, _emit) {
    super()

    this.props = {
      responseTo: null,
      onRecorded: function noop() {},
    }

    this.state = nanostate('initial', {
      initial: { show: 'permissions' },
      permissions: { accepted: 'prerecording', error: 'error' },
      error: { retry: 'permissions' },
      prerecording: { record: 'recording', cancel: 'initial' },
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

  update() {
    return false
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
      return this.renderInitial()
    }
    if (state === 'permissions') {
      return this.renderPermissions()
    }
    if (state === 'error') {
      return this.renderError()
    }
    if (state === 'prerecording') {
      return this.renderPrerecording()
    }
    if (state === 'recording') {
      return this.renderRecording()
    }
    if (state === 'postrecording') {
      return this.renderPostrecording()
    }
    if (state === 'preview') {
      return this.renderPreview()
    }
    if (state === 'done') {
      return this.renderDone()
    }
    return html`<div class="recorder error">internal error: unimplemented state "${state}"</div>`
  }

  renderInitial() {
    return html`<div class="recorder initial">
      ${this.renderButton(
        this.props.responseTo == null
          ? 'start the conversation'
          : 'respond to this',
        () => this.state.emit('show')
      )}
    </div>`
  }

  renderPermissions() {
    return html`<div class="recorder permissions">
      <p>checking permissions...</p>
    </div>`
  }

  renderError() {
    return html`
      <div class="recorder error">
        <p>something went wrong - did you give the page permission to record audio/video?</p>
        <p>detailed error message: ${
          this.error && this.error.message
            ? this.error.message
            : 'not available'
        }</p>
        ${this.renderButton('try again', () => this.state.emit('retry'))}
      </div>
    `
  }

  renderPrerecording() {
    return html`
      <div class="recorder prerecording">
        ${this.cameraPreview.render(this.stream)}
        ${this.renderButton('start recording', () => this.state.emit('record'))}
        ${this.renderButton('cancel', () => this.state.emit('cancel'))}
      </div>
    `
  }

  renderRecording() {
    return html`
      <div class="recorder recording">
        ${this.cameraPreview.render(this.stream)}
        ${this.renderButton('finish recording', () =>
          this.state.emit('finish')
        )}
      </div>
    `
  }

  renderPostrecording() {
    return html`<div class="recorder postrecording">fetching recording...</div>`
  }

  renderPreview() {
    return html`<div class="recorder preview">
      ${this.recordingPreview.render(this.recording)}
      ${this.renderButton('use this recording', () => this.state.emit('use'))}
      ${this.renderButton('redo', () => this.state.emit('redo'))}
    </div>`
  }

  renderDone() {
    return html`<div class="recorder saving">saving recording...</div>`
  }

  renderButton(text, action) {
    return html`<button onclick=${action}>${text}</button>`
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
    return html`<div class="preview camera-preview">${this.video}</div>`
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
    return html`<div class="preview recording-preview">${this.video}</div>`
  }

  unload() {
    this.video = null
  }

  update() {
    return false
  }
}

module.exports = Recorder
