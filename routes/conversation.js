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
    this.selectConversation = () => {
      emit(events.selectConversation)
    }
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
      await this.addPendingContributor()
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
    const firstUse = this.conversation.contributors.length == 0
    if (firstUse) {
      return this.renderFirstUse()
    }
    return this.renderConversation()
  }

  renderNoConversation() {
    const url = 'dat://' + this.url
    return html`<main>
      <p>the archive <a href=${url}>${url}</a> does not contain a conversation.</p>
      <p><button onclick=${this.createConversation}>
        create a new conversation
      </button></p>
    </main>`
  }

  renderLoading() {
    return html`<main>loading...</main>`
  }

  renderFirstUse() {
    return html`<main>
      ${this.renderHeader()}
      <p>This is a brand-new conversation. <strong>Record your first video to get started!</strong></p>
      ${this.renderRecorder(null)}
    </main>`
  }

  renderConversation() {
    return html`<main>
      ${this.renderHeader()}
      ${this.renderInviteWarning()}
      ${this.renderContributions(this.conversation.firsts)}
    </main>`
  }

  renderHeader() {
    return html`<div class="header">
      <h1>treealog 🌲</h1>
      <button onclick=${this.selectConversation}>
          go to an existing conversation
      </button>
      <button onclick=${this.createConversation}>
        create a new conversation
      </button>
      <h2>${this.conversation.title} (${
      this.conversation.contributors.length
    } contributors)</h2>
    </div>`
  }

  renderRecorder(responseTo) {
    return this.cache(Recorder, responseTo || Recorder.first).render({
      responseTo,
      onRecorded: blob => {
        this.onResponse(blob, responseTo)
      },
    })
  }

  renderInviteWarning() {
    if (this.conversation.pendingInvite) {
      return html`<div class="pending-warning">
        <p><strong>Your contributions can't be seen by anyone else.</strong>
        <p>Send this invite link to the owner of the conversation so that others can discover your contributions:</p>
        <p>${this.renderInviteLink()}</p>
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
    return html`<input class="invite-link" type="text" value="${inviteLink}" onclick=${e => {
      e.currentTarget.select()
    }} />`
  }

  renderContributions(videos) {
    return html`<div class="contributions">
      ${videos.map(url =>
        this.renderContribution(this.conversation.videos[url])
      )}
    </div>`
  }

  renderContribution(video) {
    if (video == null) {
      return ''
    }
    const pending = video.creator === this.conversation.pendingContributor
    return html`<div class="contribution ${pending ? ' pending' : ''}">
      ${this.renderVideo(video.url)}
      ${this.renderRecorder(video.url)}
      ${pending ? html`<div>(only visible to you)</div>` : ''}
      ${this.renderResponses(video)}
    </div>`
  }

  renderVideo(videoUrl) {
    return html`<div class="video">
      <video controls width="320" height="240" src="${videoUrl}"></video>
    </div>`
  }

  renderResponses(video) {
    if (video.responses.length > 0) {
      return html`<div class="responses">
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

  // We may have a pending contributor url stored in local storage,
  // add them to the conversation so we can see our contributions
  // even though we're not in the conversation yet.
  async addPendingContributor() {
    if (this.conversation.me == null) {
      const pendingUrl = localStorage.getItem('pending-invite/' + this.url)
      if (pendingUrl != null) {
        await this.conversation.addContributor(pendingUrl)
      }
    }
  }

  // If we are in the Conversation, returns our Contributor object.
  // If we are not, creates a new 'pending' contributor and adds it to the conversation.
  // Allows us to view content in the context of a conversation without actually
  // being part of it.
  async getOrCreateMe() {
    if (this.conversation.me == null) {
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
      return this.conversation.me
    }
  }
}
