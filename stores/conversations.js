const Conversation = require('../modules/conversation')

const events = require('../events')

const constants = {
  conversationArchiveType: ['treealog-conversation'],
}

module.exports = function conversationsStore(state, emitter) {
  emitter.on(events.selectConversation, async () => {
    try {
      const conversation = await DatArchive.selectArchive({
        title: 'Choose a conversation',
        buttonLabel: 'Go to conversation',
        filters: {
          type: constants.conversationArchiveType,
        },
      })
      navigateToConversation(conversation.url)
    } catch (e) {
      // user canceled, do nothing.
    }
  })

  emitter.on(events.createConversation, async () => {
    try {
      const conversation = await DatArchive.create({
        title: 'A treealog conversation',
        type: constants.conversationArchiveType,
        prompt: true,
      })
      navigateToConversation(conversation.url)
    } catch (error) {
      // user canceled, do nothing.
    }
  })

  function navigateToConversation(url) {
    emitter.emit('pushState', '#conversation/' + url.replace('dat://', ''))
  }
}
