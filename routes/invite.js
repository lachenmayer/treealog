const Component = require('choo/component')
const html = require('choo/html')
const Contributor = require('treealog/lib/contributor')
const Conversation = require('treealog/lib/conversation')

module.exports = function invite(state, emit) {
  const { url, contributor } = state.params
  return new InviteView(url, contributor).render()
}

class InviteView extends Component {
  constructor(conversationUrl, contributorUrl) {
    super()
    this.conversation = null
    this.contributor = null

    this.loading = true
    this.error = null
    this.alreadyInConversation = false
    this.success = false

    this.setup(conversationUrl, contributorUrl)
  }

  async setup(conversationUrl, contributorUrl) {
    this.conversation = new Conversation(conversationUrl)
    await this.conversation.ready
    if (this.conversation.error != null) {
      this.loading = false
      this.error = this.conversation.error
      this.conversation = null
      return this.rerender()
    }
    const contributorInConversation = this.conversation.contributors.find(
      c => c.url === contributorUrl
    )
    if (contributorInConversation != null) {
      this.loading = false
      this.alreadyInConversation = true
      return this.rerender()
    }
    this.contributor = new Contributor(contributorUrl)
    await this.contributor.ready
    this.loading = false
    if (this.contributor.error != null) {
      this.error = this.contributor.error
      this.contributor = null
      return this.rerender()
    }
    this.rerender()
  }

  createElement() {
    if (this.loading) {
      return this.renderLoading()
    }
    if (this.error != null) {
      return this.renderError()
    }
    if (this.alreadyInConversation) {
      return this.renderAlreadyInConversation()
    }
    if (this.success) {
      return this.renderSuccess()
    }
    if (this.conversation.isOwner) {
      return this.renderConfirmInvite()
    }
    return this.renderCantInvite()
  }

  renderLoading() {
    return html`<main><p>Loading...</p></main>`
  }

  renderError() {
    return html`<main>
      <p>This invite link is not valid.</p>
      <p>(Error: ${this.error.message})</p>
    </main>`
  }

  renderAlreadyInConversation() {
    return html`<main>
      <p>This contributor is already in the conversation.</p>
      <p><a href="#conversation/${this.conversation.url.replace(
        'dat://',
        ''
      )}">Go to the conversation</a></p>
    </main>`
  }

  renderSuccess() {
    return html`<main>
      <p>Nice one, you added ${this.contributor.title} to the conversation!</p>
      <p>Sending you to the conversation...</p>
    </main>`
  }

  renderConfirmInvite() {
    const url = `#conversation/${this.conversation.url.replace('dat://', '')}`
    return html`<main>
      <p>The contributor <a href=${this.contributor.url}>${
      this.contributor.title
    }</a> wants to join the conversation <a href=${url}>${
      this.conversation.title
    }</a>.</p>
      <p><button onclick=${() => {
        this.onInvite()
      }}>Invite them to the conversation</button></p>
    </main>`
  }

  renderCantInvite() {
    const url = `#conversation/${this.conversation.url.replace('dat://', '')}`
    return html`<main>
      <p>You are not the owner of this conversation, so you can't invite <a href=${
        this.contributor.url
      }>${this.contributor.title}</a>.</p>
      <p><a href=${url}>Go to the conversation</a></p>
    </main>`
  }

  async onInvite() {
    const success = await this.conversation.addContributor(this.contributor.url)
    if (!success) {
      this.error = new Error(
        'Could not add contributor. Are you the owner of the conversation?'
      )
      return this.rerender()
    }
    this.sucess = true
    this.rerender()
    window.setTimeout(() => {
      window.location =
        '#conversation/' + this.conversation.url.replace('dat://', '')
    }, 3000)
  }
}
