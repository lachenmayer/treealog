const Conversation = require('treealog/lib/conversation')

const { events } = require('treealog/constants')

module.exports = function conversationsStore(_, emitter) {
  emitter.on(events.selectConversation, async () => {
    const conversation = await Conversation.select()
    if (conversation != null) {
      navigateToConversation(conversation.url)
    }
  })

  emitter.on(events.createConversation, async () => {
    const conversation = await Conversation.create()
    if (conversation != null) {
      navigateToConversation(conversation.url)
    }
  })

  function navigateToConversation(url) {
    emitter.emit('pushState', '#conversation/' + url.replace('dat://', ''))
  }
}
