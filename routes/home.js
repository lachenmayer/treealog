const html = require('choo/html')
const { events } = require('treealog/constants')

module.exports = function home(state, emit) {
  return html`
    <main>
      <h1>treealog 🌲</h1>
      <button onclick=${() => {
        emit(events.selectConversation)
      }}>go to an existing conversation</button>
      <button onclick=${() => {
        emit(events.createConversation)
      }}>create a new conversation</button>
    </main>`
}
