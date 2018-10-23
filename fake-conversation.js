const fs = require('fs').promises
const Conversation = require('treealog/lib/conversation')
const Participant = require('treealog/lib/participant')

async function main() {
  const video = await fs.readFile(__dirname + '/test/video.webm')
  const conversation = await Conversation.create()
  console.log(
    conversation.url.replace(
      'dat://',
      'dat://25144c35af792ad6f1c3c63fd6d817b70e6e7a9393a41c9e3d311ca8619b529a/#conversation/'
    )
  )
  const participant = await Participant.create()
  await conversation.addParticipant(participant.url)
  await participant.addVideo(video, null)
}
main()
