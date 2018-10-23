const Component = require('choo/component')
const html = require('choo/html')
const Recorder = require('treealog/components/recorder')
const { events } = require('treealog/constants')
const Contributor = require('treealog/lib/contributor')
const Conversation = require('treealog/lib/conversation')

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

    this.conversation = null
    this.setupConversation()
  }

  async setupConversation() {
    this.conversation = new Conversation(this.url)
    this.conversation.on('update', () => {
      console.log('↑')
      this.rerender()
    })
    await this.conversation.ready
    if (this.conversation.error != null) {
      this.conversation = null
    } else {
      await this.addPending()
    }
    this.rerender()
  }

  createElement() {
    if (this.conversation == null) {
      return this.renderNoConversation()
    }
    if (!this.conversation.ready) {
      return this.renderLoading()
    }

    const firstUse = Object.keys(this.conversation.videos).length == 0
    if (firstUse) {
      return this.renderFirstUse()
    }

    return this.renderConversation()
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
    ${this.renderRecorder(null)}
  </main>`
  }

  renderRecorder(responseTo) {
    return this.cache(Recorder, responseTo || Recorder.first).render({
      responseTo,
      onRecorded: blob => {
        this.onResponse(blob, responseTo)
      },
    })
  }

  renderConversation() {
    return html`<main>
      ${this.renderInviteWarning()}
      ${this.renderContributions(this.conversation.firsts)}
    </main>`
  }

  renderInviteWarning() {
    if (this.conversation.pendingInvite) {
      return html`<div>
        <p><strong>Your contributions can't be seen by anyone else.</strong>
        <p>Send this invite link to the owner of the conversation so that others can discover your contributions: ${this.renderInviteLink()}</p>
      </div>`
    } else {
      return ''
    }
  }

  renderInviteLink() {
    const inviteLink =
      window.location.href +
      '/invite/' +
      this.conversation.pendingContributor.replace('dat://', '')
    return html`<input type="text" value="${inviteLink}" onclick=${e => {
      e.currentTarget.select()
    }} />`
  }

  renderContributions(videos) {
    return html`<div style="display: flex; flex-direction: row">
      ${videos.map(url =>
        this.renderContribution(this.conversation.videos[url])
      )}
    </div>`
  }

  renderContribution(video) {
    if (video == null) {
      return ''
    }
    return html`<div>
      ${
        video.creator === this.conversation.pendingContributor
          ? html`<p>(only visible to you)</p>`
          : ''
      }
      <video controls width="320" height="240" src="${video.url}"></video>
      ${this.renderRecorder(video.url)}
      ${this.renderResponses(video)}
    </div>`
  }

  renderVideo(videoUrl) {
    return html`<div>
      <video controls width="320" height="240" src="${videoUrl}"></video>
    </div>`
  }

  renderResponses(video) {
    if (video.responses.length > 0) {
      return html`<div>
        responses:
        ${this.renderContributions(video.responses)}
      </div>`
    } else {
      return ''
    }
  }

  async onResponse(blob, responseTo) {
    const me = await this.getOrCreateMe()
    if (me != null) {
      await me.addVideo(blob, responseTo)
    } else {
      console.warn('could not get a contributor object for "me".')
    }
  }

  async addPending() {
    if (this.conversation.me == null) {
      const pendingUrl = localStorage.getItem('pending-invite/' + this.url)
      if (pendingUrl != null) {
        await this.conversation.addContributor(pendingUrl)
      }
    }
  }

  async getOrCreateMe() {
    await this.addPending()
    const me = this.conversation.me
    if (me == null) {
      try {
        const me = await Contributor.create(this.conversation.url)
        const added = await this.conversation.addContributor(me.url)
        if (!added) {
          localStorage.setItem('pending-invite/' + this.url, me.url)
        }
        return me
      } catch (e) {
        console.warn(e)
        return null
      }
    } else {
      if (!this.conversation.pendingInvite) {
        // Remove the cached pending invite because we are in the conversation now.
        localStorage.removeItem('pending-invite/' + this.conversation.url)
      }
      return me
    }
  }
}
