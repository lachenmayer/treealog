const Component = require('choo/component')
const html = require('choo/html')
const { events } = require('treealog/constants')
const Recorder = require('treealog/components/recorder')
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
    const onload = () => this.rerender()
    const onerror = e => {
      console.error(e)
      if (e.noConversation) {
        this.conversation = null
        this.rerender()
      }
    }
    this.conversation
      .load()
      .then(onload)
      .catch(onerror)
  }

  async onFirstVideo(videoBlob) {
    const me = await Participant.create(this.conversation.url)
    me.addVideo(videoBlob, null /* first video has no response */)
    await this.conversation.addParticipant(me)
    this.rerender()
  }

  createElement() {
    if (this.conversation == null) {
      const url = 'dat://' + this.url
      return html`<main>
        <p>the archive <a href=${url}>${url}</a> does not contain a conversation.</p>
        <p><button onclick=${
          this.createConversation
        }>create a new conversation</button></p>
      </main>`
    }
    if (!this.conversation.loaded) {
      return html`<main>loading...</main>`
    }

    const firstUse =
      this.conversation.isOwner && this.conversation.participants.length == 0
    if (firstUse) {
      return html`<main>
        <p>This is a brand-new conversation. <strong>Record your first video to get started!</strong></p>
        ${this.cache(Recorder, Recorder.first).render({
          onRecorded: video => {
            this.onFirstVideo(video)
          },
        })}
      </main>`
    }

    return html`<main>${Object.values(this.conversation.videos).map(v =>
      JSON.stringify(v)
    )}</main>`

    // function renderVideos() {
    //   return html`<div style="display: flex; flex-direction: row">${conversation.firsts.map(
    //     url => renderVideo(conversation.videos[url])
    //   )}</div>`
    // }

    // function renderVideo(video) {
    //   return html`<div>
    //   <video controls width="320" height="240" src="${video.url}"></video>
    //   ${conversation.readOnly ? '' : state.cache(Recorder, video.url).render()}
    //   responses:
    //   <div style="display: flex; flex-direction: row">${video.responses.map(
    //     renderVideo
    //   )}</div>
    // </div>`
    // }

    // if (isOwner) {
    //   // TODO enable inviting more people
    // } else {
    //   // TODO enable creating a new conversation
    // }
  }
}
