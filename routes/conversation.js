const Component = require('choo/component')
const html = require('choo/html')
const Recorder = require('treealog/components/recorder')
const { events } = require('treealog/constants')
const Conversation = require('treealog/lib/conversation')
const Participant = require('treealog/lib/participant')

module.exports = function conversation(state, emit) {
  const url = state.params.url // defined in route in index.js
  return state.cache(ConversationView, url).render()
}

class ConversationView extends Component {
  constructor(url, state, emit) {
    super()
    this.url = url

    // globals
    this.cache = state.cache
    this.createConversation = () => {
      emit(events.createConversation)
    }

    this.conversation = new Conversation(url)
    const onChange = () => this.rerender()
    const onerror = e => {
      console.error(e)
      if (e.noConversation) {
        this.conversation = null
        this.rerender()
      }
    }
    this.conversation
      .watch(onChange)
      .then(onChange)
      .catch(onerror)
  }
  createElement() {
    if (this.conversation == null) {
      return this.renderNoConversation()
    }
    if (!this.conversation.loaded) {
      return this.renderLoading()
    }

    const firstUse =
      this.conversation.isOwner && this.conversation.participants.length == 0
    if (firstUse) {
      return this.renderFirstUse()
    }

    return this.renderConversation()

    // if (isOwner) {
    //   // TODO enable inviting more people
    // } else {
    //   // TODO enable creating a new conversation
    // }
  }

  renderNoConversation() {
    const url = 'dat://' + this.url
    return html`<main>
      <p>the archive <a href=${url}>${url}</a> does not contain a conversation.</p>
      <p><button onclick=${
        this.createConversation
      }>create a new conversation</button></p>
    </main>`
  }

  renderLoading() {
    return html`<main>loading...</main>`
  }

  renderFirstUse() {
    return html`<main>
    <p>This is a brand-new conversation. <strong>Record your first video to get started!</strong></p>
    ${this.cache(Recorder, Recorder.first).render({
      onRecorded: video => {
        this.onFirstVideo(video)
      },
    })}
  </main>`
  }

  renderConversation() {
    return html`<main>
      ${this.renderVideos(this.conversation.firsts)}
    </main>`
  }

  renderVideos(videos) {
    return html`<div style="display: flex; flex-direction: row">
      ${videos.map(url => this.renderVideo(this.conversation.videos[url]))}
    </div>`
  }

  renderVideo(video) {
    if (video == null) {
      return ''
    }
    const readOnly = this.conversation.readOnly
    return html`<div id="${btoa(video.url)}">
      <video controls width="320" height="240" src="${video.url}"></video>
      ${
        readOnly
          ? ''
          : this.cache(Recorder, video.url).render({
              responseTo: video.url,
              onRecorded: blob => {
                this.onResponse(blob, video.url)
              },
            })
      }
      ${this.renderResponses(video)}
    </div>`
  }

  renderResponses(video) {
    if (video.responses.length > 0) {
      return html`<div>
        responses:
        ${this.renderVideos(video.responses)}
      </div>`
    } else {
      return ''
    }
  }

  async onFirstVideo(videoBlob) {
    const me = await Participant.create(this.conversation.url)
    await me.addVideo(videoBlob, null /* first video has no response */)
    await this.conversation.addParticipant(me)
    this.rerender()
  }

  async onResponse(videoBlob, responseTo) {
    const me = this.conversation.me
    await me.addVideo(videoBlob, responseTo)
    await this.conversation.sync() // TODO automatic sync
    this.rerender()
  }
}
